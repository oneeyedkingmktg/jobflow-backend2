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

function isHeic(buffer) {
  return buffer.length > 8 && buffer.slice(4, 8).toString('ascii') === 'ftyp';
}

async function preprocessImage(inputBuffer) {
  let workingBuffer = inputBuffer;

  if (isHeic(inputBuffer)) {
    const heicConvert = require('heic-convert');
    workingBuffer = Buffer.from(
      await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.9 })
    );
  }

  const meta  = await sharp(workingBuffer).metadata();
  const ratio = (meta.width || 1) / (meta.height || 1);

  let target;
  if (ratio >= 1.2)       target = SIZES[0];
  else if (ratio <= 0.85) target = SIZES[1];
  else                    target = SIZES[2];

  const make = (w, h) =>
    sharp(workingBuffer)
      .rotate()
      .resize(w, h, { fit: 'cover', position: 'centre' })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

  let buf = await make(target.w, target.h);
  if (buf.length > 4 * 1024 * 1024) buf = await make(1024, 1024);
  return { buffer: buf, size: target.label };
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

  // 5. Store mask (for reference/debugging)
  const maskKey = `visualizer/masks/${companyId}/${uuid()}.png`;
  const maskUrl = await uploadToR2(maskKey, maskBuffer);
  await db.query(
    `UPDATE visualizations SET mask_key=$1, mask_url=$2 WHERE id=$3`,
    [maskKey, maskUrl, visualizationId]
  );

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

module.exports = { generateVisualization };
