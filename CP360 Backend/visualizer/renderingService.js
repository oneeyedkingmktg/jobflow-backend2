// ============================================================================
// Rendering service — orchestrates preprocess → AI call → R2 storage
// The rest of the app only calls generateVisualization(). The AI provider
// and storage details are invisible to callers.
// ============================================================================

const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2, BUCKET, PUBLIC_URL } = require('../config/r2');
const openAIProvider = require('./providers/openAIProvider');
const db = require('../config/database');
const crypto = require('crypto');

function uuid() {
  return crypto.randomUUID();
}

// Supported OpenAI output sizes for gpt-image-1
const SIZES = [
  { w: 1536, h: 1024, label: '1536x1024' }, // landscape
  { w: 1024, h: 1536, label: '1024x1536' }, // portrait
  { w: 1024, h: 1024, label: '1024x1024' }, // square
];

// Pick best output size based on input aspect ratio, then crop-fill to match
async function preprocessImage(inputBuffer) {
  const meta = await sharp(inputBuffer).metadata();
  const ratio = (meta.width || 1) / (meta.height || 1);

  let target;
  if (ratio >= 1.2)       target = SIZES[0]; // landscape
  else if (ratio <= 0.85) target = SIZES[1]; // portrait
  else                    target = SIZES[2]; // square

  const make = (w, h) =>
    sharp(inputBuffer)
      .rotate()                                          // auto-rotate from EXIF
      .resize(w, h, { fit: 'cover', position: 'centre' })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

  let buf = await make(target.w, target.h);
  // If still over 4MB, step down to 1024x1024
  if (buf.length > 4 * 1024 * 1024) buf = await make(1024, 1024);
  return { buffer: buf, size: target.label };
}

async function uploadToR2(key, buffer) {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  }));
  return `${PUBLIC_URL}/${key}`;
}

// Called from controller. Runs async after the HTTP response has already been sent.
async function generateVisualization({ visualizationId, rawImageBuffer, chipColor, companyId }) {
  try {
    const { buffer: processedBuffer, size } = await preprocessImage(rawImageBuffer);

    // Store original
    const originalKey = `visualizer/originals/${companyId}/${uuid()}.png`;
    const originalUrl = await uploadToR2(originalKey, processedBuffer);
    await db.query(
      `UPDATE visualizations SET original_image_key=$1, original_image_url=$2 WHERE id=$3`,
      [originalKey, originalUrl, visualizationId]
    );

    // Call AI provider
    const result = await openAIProvider.generate({ imageBuffer: processedBuffer, chipColor, size });

    // Store generated image
    const generatedKey = `visualizer/generated/${companyId}/${uuid()}.png`;
    const generatedUrl = await uploadToR2(generatedKey, result.buffer);

    await db.query(
      `UPDATE visualizations
       SET status='complete', generated_image_key=$1, generated_image_url=$2,
           rendering_provider=$3, completed_at=NOW()
       WHERE id=$4`,
      [generatedKey, generatedUrl, result.provider, visualizationId]
    );
  } catch (err) {
    console.error(`[Visualizer] generation failed for id=${visualizationId}:`, err.message);
    await db.query(
      `UPDATE visualizations SET status='failed', error_message=$1 WHERE id=$2`,
      [err.message, visualizationId]
    );
  }
}

module.exports = { generateVisualization };
