// ============================================================================
// Rendering service — orchestrates the visualization pipeline.
//
// Default pipeline (VISUALIZATION_PROVIDER=compositing or unset):
//   preprocess → preflight → upload original → SAM 2 segment (once) → composite → upload result
//   SAM 2 runs ONCE per pregenerate batch; all follower colors reuse the cached mask.
//
// Fallback (VISUALIZATION_PROVIDER=openai):
//   preprocess → upload original → OpenAI gpt-image-1 → upload result
// ============================================================================

const sharp  = require('sharp');
const axios  = require('axios');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2, BUCKET, PUBLIC_URL } = require('../config/r2');
const openAIProvider         = require('./providers/openAIProvider');
const { runPreflightChecks } = require('./preflightChecks');
const { segmentFloor }       = require('./samProvider');
const { composite }          = require('./compositingEngine');
const { getRecipe }          = require('./chipColorData');
const db                     = require('../config/database');
const crypto                 = require('crypto');

function uuid() { return crypto.randomUUID(); }

const SIZES = [
  { w: 1536, h: 1024, label: '1536x1024' },
  { w: 1024, h: 1536, label: '1024x1536' },
  { w: 1024, h: 1024, label: '1024x1024' },
];

async function preprocessImage(inputBuffer) {
  let workingBuffer = inputBuffer;

  if (!workingBuffer || workingBuffer.length === 0) {
    throw Object.assign(new Error('No image data received. Please try uploading again.'), { userInput: true });
  }

  // Detect HEIC/HEIF by ftyp box + brand — sharp cannot reliably decode these
  if (workingBuffer.length >= 12 && workingBuffer.slice(4, 8).toString('ascii') === 'ftyp') {
    const brand = workingBuffer.slice(8, 12).toString('ascii').toLowerCase();
    if (brand.startsWith('hei') || brand.startsWith('hev') || brand === 'mif1') {
      throw Object.assign(
        new Error('Your photo is in HEIC format, which is not supported. On iPhone, go to Settings → Camera → Formats → Most Compatible to shoot in JPEG instead, then retake the photo.'),
        { userInput: true }
      );
    }
  }

  let meta;
  try {
    meta = await sharp(workingBuffer).metadata();
  } catch (sharpErr) {
    console.error('[preprocessImage] sharp failed:', sharpErr.message, 'buffer size:', workingBuffer.length);
    throw Object.assign(
      new Error('Could not read this photo. Please try a JPEG or PNG file.'),
      { userInput: true }
    );
  }

  let imgW = meta.width  || 1;
  let imgH = meta.height || 1;
  // EXIF orientations 5–8 are 90°/270° rotations — swap to get true display dimensions
  // (sharp.metadata() returns raw pixel dims, not display dims)
  if (meta.orientation >= 5 && meta.orientation <= 8) [imgW, imgH] = [imgH, imgW];
  const ratio = imgW / imgH;

  // Match output to input orientation — portrait in → portrait out, landscape in → landscape out
  let target;
  if (ratio > 1.0)      target = SIZES[0]; // landscape  → 1536×1024
  else if (ratio < 1.0) target = SIZES[1]; // portrait   → 1024×1536
  else                  target = SIZES[2]; // square     → 1024×1024

  const make = (w, h) =>
    sharp(workingBuffer)
      .rotate()
      .resize(w, h, { fit: 'cover', position: 'centre' })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

  let buf = await make(target.w, target.h);
  // If PNG is still too large (>20MB OpenAI limit), halve dimensions keeping same ratio
  let finalSize = target.label;
  if (buf.length > 18 * 1024 * 1024) {
    buf = await make(Math.round(target.w * 0.67), Math.round(target.h * 0.67));
    // ratio is preserved so the same OpenAI size label is still correct
  }
  return { buffer: buf, size: finalSize };
}

async function uploadToR2(key, buffer, contentType = 'image/png') {
  await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
  return `${PUBLIC_URL}/${key}`;
}

async function downloadUrl(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(resp.data);
}

// ── Single color composite (mask already known) ───────────────────────────────

async function compositeOneColor({ visualizationId, processedBuffer, maskBuffer, chipColor, companyId, originalUrl }) {
  const recipe = getRecipe(chipColor.name);
  if (!recipe || !recipe.length) {
    await db.query(
      `UPDATE visualizations SET status='failed', failure_type='error', error_message=$1 WHERE id=$2`,
      [`No blend recipe found for: ${chipColor.name}`, visualizationId]
    );
    return;
  }

  console.log(`[Visualizer] compositing "${chipColor.name}" → ${recipe.length} components`);
  const resultBuffer  = await composite({ processedBuffer, maskBuffer, recipe });
  const generatedKey  = `visualizer/generated/${companyId}/${uuid()}.png`;
  const generatedUrl  = await uploadToR2(generatedKey, resultBuffer);

  await db.query(
    `UPDATE visualizations
     SET status='complete', original_image_url=$1, generated_image_key=$2, generated_image_url=$3,
         rendering_provider='compositing', completed_at=NOW()
     WHERE id=$4`,
    [originalUrl || null, generatedKey, generatedUrl, visualizationId]
  );
}

// ── Compositing pipeline ──────────────────────────────────────────────────────

async function runCompositingPipeline({
  visualizationId, rawImageBuffer, chipColor, companyId,
  isLeader = false, followers = [],
}) {
  // 1. Preprocess
  const { buffer: processedBuffer } = await preprocessImage(rawImageBuffer);

  // 2. Pre-flight checks
  const preflightFail = await runPreflightChecks(processedBuffer);
  if (preflightFail) {
    const ids = [visualizationId, ...followers.map(f => f.visualizationId)];
    for (const id of ids) {
      await db.query(
        `UPDATE visualizations SET status='failed', failure_type='user_input', error_message=$1 WHERE id=$2`,
        [preflightFail.message, id]
      );
    }
    return;
  }

  // 3. Store original (shared across leader + all followers)
  const { width, height } = await sharp(processedBuffer).metadata();
  const originalKey = `visualizer/originals/${companyId}/${uuid()}.png`;
  const originalUrl = await uploadToR2(originalKey, processedBuffer);
  // Only update leader's record here — followers get originalUrl set in compositeOneColor
  await db.query(
    `UPDATE visualizations SET original_image_key=$1, original_image_url=$2 WHERE id=$3`,
    [originalKey, originalUrl, visualizationId]
  );

  // 4. SAM 2 floor segmentation — runs ONCE; followers reuse the mask
  let maskBuffer;
  try {
    const segResult = await segmentFloor(originalUrl, width, height);
    maskBuffer = segResult.maskBuffer;
  } catch (err) {
    const isUserInput = err.userInput === true;
    const ids = [visualizationId, ...followers.map(f => f.visualizationId)];
    for (const id of ids) {
      await db.query(
        `UPDATE visualizations SET status='failed', failure_type=$1, error_message=$2 WHERE id=$3`,
        [isUserInput ? 'user_input' : 'error', err.message, id]
      );
    }
    return;
  }

  // 5. Store mask on ALL visualizations in the batch so any complete viz
  //    can serve as a custom blend source without re-running SAM 2.
  const maskKey = `visualizer/masks/${companyId}/${uuid()}.png`;
  const maskUrl = await uploadToR2(maskKey, maskBuffer);
  const allBatchIds = [visualizationId, ...followers.map(f => f.visualizationId)];
  await Promise.all(allBatchIds.map(id =>
    db.query(`UPDATE visualizations SET mask_key=$1, mask_url=$2 WHERE id=$3`, [maskKey, maskUrl, id])
  ));

  // 6. Composite leader color
  await compositeOneColor({ visualizationId, processedBuffer, maskBuffer, chipColor, companyId, originalUrl });

  // 7. Composite all follower colors in parallel — same mask, no extra SAM 2 calls
  if (followers.length) {
    await Promise.all(followers.map(f =>
      compositeOneColor({
        visualizationId: f.visualizationId,
        processedBuffer,
        maskBuffer,
        chipColor:   f.chipColor,
        companyId,
        originalUrl,  // followers get same before-image so switching works
      }).catch(async err => {
        console.error(`[Pregenerate] follower ${f.visualizationId} failed:`, err.message);
        await db.query(
          `UPDATE visualizations SET status='failed', failure_type='error', error_message=$1 WHERE id=$2`,
          [err.message, f.visualizationId]
        ).catch(() => {});
      })
    ));
  }
}

// ── OpenAI fallback pipeline ──────────────────────────────────────────────────

async function runOpenAIPipeline({ visualizationId, rawImageBuffer, chipColor, companyId }) {
  const { buffer: processedBuffer, size } = await preprocessImage(rawImageBuffer);

  const originalKey = `visualizer/originals/${companyId}/${uuid()}.png`;
  const originalUrl = await uploadToR2(originalKey, processedBuffer);
  await db.query(
    `UPDATE visualizations SET original_image_key=$1, original_image_url=$2 WHERE id=$3`,
    [originalKey, originalUrl, visualizationId]
  );

  const result = await openAIProvider.generate({ imageBuffer: processedBuffer, chipColor, size });

  const generatedKey = `visualizer/generated/${companyId}/${uuid()}.png`;
  const generatedUrl = await uploadToR2(generatedKey, result.buffer);

  await db.query(
    `UPDATE visualizations
     SET status='complete', generated_image_key=$1, generated_image_url=$2,
         rendering_provider=$3, completed_at=NOW()
     WHERE id=$4`,
    [generatedKey, generatedUrl, result.provider, visualizationId]
  );
}

// ── Public entry point ────────────────────────────────────────────────────────

async function generateVisualization({
  visualizationId, rawImageBuffer, chipColor, companyId,
  isLeader = false, followers = [],
}) {
  const useOpenAI = process.env.VISUALIZATION_PROVIDER === 'openai';
  try {
    if (useOpenAI) {
      await runOpenAIPipeline({ visualizationId, rawImageBuffer, chipColor, companyId });
    } else {
      await runCompositingPipeline({
        visualizationId, rawImageBuffer, chipColor, companyId, isLeader, followers,
      });
    }
  } catch (err) {
    console.error(`[Visualizer] pipeline failed for id=${visualizationId}:`, err.message);
    await db.query(
      `UPDATE visualizations SET status='failed', failure_type='error', error_message=$1 WHERE id=$2`,
      [err.message, visualizationId]
    ).catch(() => {});
  }
}

// ── Custom blend composite (synchronous, reuses cached mask) ──────────────────
// recipe: [{ rgb: {r,g,b}, weight: 0–1 }] (already converted from hex before calling)

async function compositeCustomBlend({ sourceVisualizationId, companyId, recipe }) {
  const { rows } = await db.query(
    `SELECT original_image_url, mask_url FROM visualizations
     WHERE id=$1 AND company_id=$2 AND status='complete' AND mask_url IS NOT NULL`,
    [sourceVisualizationId, companyId]
  );
  if (!rows.length) {
    throw Object.assign(new Error('Source visualization not found or mask not ready'), { status: 404 });
  }

  const { original_image_url, mask_url } = rows[0];

  const [processedBuffer, maskBuffer] = await Promise.all([
    downloadUrl(original_image_url),
    downloadUrl(mask_url),
  ]);

  const resultBuffer  = await composite({ processedBuffer, maskBuffer, recipe });
  const generatedKey  = `visualizer/generated/${companyId}/${uuid()}.png`;
  const generatedUrl  = await uploadToR2(generatedKey, resultBuffer);

  const { rows: viz } = await db.query(
    `INSERT INTO visualizations
       (company_id, rendering_provider, status, original_image_url,
        generated_image_key, generated_image_url, completed_at)
     VALUES ($1, 'compositing-custom', 'complete', $2, $3, $4, NOW())
     RETURNING id`,
    [companyId, original_image_url, generatedKey, generatedUrl]
  );

  return {
    visualization_id: viz[0].id,
    generated_image_url: generatedUrl,
    original_image_url,
  };
}

// ── Internal CRM blend (full pipeline, new photo, background) ─────────────────
// recipe: [{ rgb: {r,g,b}, weight: 0–1 }] (already converted from hex)
// rawRecipe: [{ hex, percentage }] — original form, used for OpenAI path
// Returns { visualization_id } immediately; pipeline runs in background.

async function compositeInternalBlend({ leadId, companyId, recipe, rawRecipe, rawImageBuffer }) {
  const useOpenAI = process.env.VISUALIZATION_PROVIDER === 'openai';
  const provider = useOpenAI ? 'openai-internal' : 'compositing-internal';

  const { rows } = await db.query(
    `INSERT INTO visualizations (company_id, lead_id, rendering_provider, status)
     VALUES ($1, $2, $3, 'processing') RETURNING id`,
    [companyId, leadId || null, provider]
  );
  const visualizationId = rows[0].id;

  setImmediate(async () => {
    try {
      const { buffer: processedBuffer, size } = await preprocessImage(rawImageBuffer);

      const originalKey = `visualizer/originals/${companyId}/${uuid()}.png`;
      const originalUrl = await uploadToR2(originalKey, processedBuffer);
      await db.query(
        `UPDATE visualizations SET original_image_key=$1, original_image_url=$2 WHERE id=$3`,
        [originalKey, originalUrl, visualizationId]
      );

      if (useOpenAI) {
        const result = await openAIProvider.generateFromRecipe({
          imageBuffer: processedBuffer,
          recipe: rawRecipe || recipe.map(c => ({ hex: `#${Math.round(c.rgb.r).toString(16).padStart(2,'0')}${Math.round(c.rgb.g).toString(16).padStart(2,'0')}${Math.round(c.rgb.b).toString(16).padStart(2,'0')}`, percentage: Math.round(c.weight * 100) })),
          size,
        });
        const generatedKey = `visualizer/generated/${companyId}/${uuid()}.png`;
        const generatedUrl = await uploadToR2(generatedKey, result.buffer);
        await db.query(
          `UPDATE visualizations
           SET status='complete', generated_image_key=$1, generated_image_url=$2,
               rendering_provider=$3, completed_at=NOW()
           WHERE id=$4`,
          [generatedKey, generatedUrl, result.provider, visualizationId]
        );
        return;
      }

      const { runPreflightChecks } = require('./preflightChecks');
      const preflightFail = await runPreflightChecks(processedBuffer);
      if (preflightFail) {
        await db.query(
          `UPDATE visualizations SET status='failed', failure_type='user_input', error_message=$1 WHERE id=$2`,
          [preflightFail.message, visualizationId]
        );
        return;
      }

      const { width, height } = await sharp(processedBuffer).metadata();
      const segResult = await segmentFloor(originalUrl, width, height);
      const maskBuffer = segResult.maskBuffer;

      const maskKey = `visualizer/masks/${companyId}/${uuid()}.png`;
      const maskUrl = await uploadToR2(maskKey, maskBuffer);
      await db.query(
        `UPDATE visualizations SET mask_key=$1, mask_url=$2 WHERE id=$3`,
        [maskKey, maskUrl, visualizationId]
      );

      const resultBuffer = await composite({ processedBuffer, maskBuffer, recipe });
      const generatedKey = `visualizer/generated/${companyId}/${uuid()}.png`;
      const generatedUrl = await uploadToR2(generatedKey, resultBuffer);

      await db.query(
        `UPDATE visualizations
         SET status='complete', generated_image_key=$1, generated_image_url=$2,
             rendering_provider='compositing-internal', completed_at=NOW()
         WHERE id=$3`,
        [generatedKey, generatedUrl, visualizationId]
      );
    } catch (err) {
      console.error(`[Visualizer Internal] pipeline failed for id=${visualizationId}:`, err.message);
      const isUserInput = err.userInput === true;
      await db.query(
        `UPDATE visualizations SET status='failed', failure_type=$1, error_message=$2 WHERE id=$3`,
        [isUserInput ? 'user_input' : 'error', err.message, visualizationId]
      ).catch(() => {});
    }
  });

  return { visualization_id: visualizationId };
}

module.exports = { generateVisualization, compositeCustomBlend, compositeInternalBlend };
