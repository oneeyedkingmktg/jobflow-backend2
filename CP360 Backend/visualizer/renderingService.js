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

// Resize + pad to a square RGBA PNG under 4MB (DALL-E 2 / gpt-image-1 requirement)
async function preprocessImage(inputBuffer) {
  const make = (size) =>
    sharp(inputBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

  let buf = await make(1024);
  if (buf.length > 4 * 1024 * 1024) buf = await make(512);
  return buf;
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
    const processedBuffer = await preprocessImage(rawImageBuffer);

    // Store original
    const originalKey = `visualizer/originals/${companyId}/${uuid()}.png`;
    const originalUrl = await uploadToR2(originalKey, processedBuffer);
    await db.query(
      `UPDATE visualizations SET original_image_key=$1, original_image_url=$2 WHERE id=$3`,
      [originalKey, originalUrl, visualizationId]
    );

    // Call AI provider
    const result = await openAIProvider.generate({ imageBuffer: processedBuffer, chipColor });

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
