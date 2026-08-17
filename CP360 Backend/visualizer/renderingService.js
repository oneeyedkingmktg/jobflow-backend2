// ============================================================================
// Rendering service — orchestrates the visualization pipeline.
//
// Default pipeline (VISUALIZATION_PROVIDER=compositing or unset):
//   preprocess → preflight → upload original → SAM 2 segment → composite → upload result
//
// Fallback (VISUALIZATION_PROVIDER=openai):
//   preprocess → upload original → OpenAI gpt-image-1 → upload result
// ============================================================================

const sharp = require('sharp');
const axios = require('axios');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { r2, BUCKET, PUBLIC_URL } = require('../config/r2');
const openAIProvider      = require('./providers/openAIProvider');
const { runPreflightChecks } = require('./preflightChecks');
const { segmentFloor }    = require('./samProvider');
const { composite }       = require('./compositingEngine');
const db                  = require('../config/database');
const crypto              = require('crypto');

function uuid() { return crypto.randomUUID(); }

const SIZES = [
  { w: 1536, h: 1024, label: '1536x1024' },
  { w: 1024, h: 1536, label: '1024x1536' },
  { w: 1024, h: 1024, label: '1024x1024' },
];

async function preprocessImage(inputBuffer) {
  const meta = await sharp(inputBuffer).metadata();
  const ratio = (meta.width || 1) / (meta.height || 1);

  let target;
  if (ratio >= 1.2)       target = SIZES[0];
  else if (ratio <= 0.85) target = SIZES[1];
  else                    target = SIZES[2];

  const make = (w, h) =>
    sharp(inputBuffer)
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

// ── Compositing pipeline ──────────────────────────────────────────────────────

async function runCompositingPipeline({ visualizationId, rawImageBuffer, chipColor, companyId }) {
  // 1. Preprocess
  const { buffer: processedBuffer, size } = await preprocessImage(rawImageBuffer);

  // 2. Pre-flight checks — fast, free, zero API calls
  const preflightFail = await runPreflightChecks(processedBuffer);
  if (preflightFail) {
    await db.query(
      `UPDATE visualizations SET status='failed', failure_type='user_input', error_message=$1 WHERE id=$2`,
      [preflightFail.message, visualizationId]
    );
    return;
  }

  // 3. Store original
  const { width: imgWidth, height: imgHeight } = await sharp(processedBuffer).metadata();
  const originalKey = `visualizer/originals/${companyId}/${uuid()}.png`;
  const originalUrl = await uploadToR2(originalKey, processedBuffer);
  await db.query(
    `UPDATE visualizations SET original_image_key=$1, original_image_url=$2 WHERE id=$3`,
    [originalKey, originalUrl, visualizationId]
  );

  // 4. SAM 2 floor segmentation — pass pixel dimensions for accurate point placement
  let maskBuffer;
  try {
    const segResult = await segmentFloor(originalUrl, imgWidth, imgHeight);
    maskBuffer = segResult.maskBuffer;
  } catch (err) {
    const isUserInput = err.userInput === true;
    await db.query(
      `UPDATE visualizations SET status='failed', failure_type=$1, error_message=$2 WHERE id=$3`,
      [isUserInput ? 'user_input' : 'error', err.message, visualizationId]
    );
    return;
  }

  // 5. Store floor mask
  const maskKey = `visualizer/masks/${companyId}/${uuid()}.png`;
  const maskUrl = await uploadToR2(maskKey, maskBuffer);
  await db.query(
    `UPDATE visualizations SET mask_key=$1, mask_url=$2 WHERE id=$3`,
    [maskKey, maskUrl, visualizationId]
  );

  // 6. Fetch chip texture from R2
  const textureBuffer = await downloadUrl(chipColor.reference_image_url);

  // 7. Composite texture onto floor
  const resultBuffer = await composite({ processedBuffer, maskBuffer, textureBuffer });

  // 8. Store result
  const generatedKey = `visualizer/generated/${companyId}/${uuid()}.png`;
  const generatedUrl = await uploadToR2(generatedKey, resultBuffer);

  await db.query(
    `UPDATE visualizations
     SET status='complete', generated_image_key=$1, generated_image_url=$2,
         rendering_provider='compositing', completed_at=NOW()
     WHERE id=$3`,
    [generatedKey, generatedUrl, visualizationId]
  );
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

async function generateVisualization({ visualizationId, rawImageBuffer, chipColor, companyId }) {
  const useOpenAI = process.env.VISUALIZATION_PROVIDER === 'openai';
  try {
    if (useOpenAI) {
      await runOpenAIPipeline({ visualizationId, rawImageBuffer, chipColor, companyId });
    } else {
      await runCompositingPipeline({ visualizationId, rawImageBuffer, chipColor, companyId });
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
