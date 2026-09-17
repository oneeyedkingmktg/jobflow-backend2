// ============================================================================
// imageNormalizer.js — Pre-processes raw upload buffers before they enter
// the visualization pipeline.
//
// Responsibilities:
//   1. Convert HEIC/HEIF (iPhone default format) to JPEG via heic-convert
//   2. Auto-rotate based on EXIF orientation
//   3. Resize to max 2048px on longest side (no upscaling, no crop)
//   4. Encode as JPEG at quality 90 — metadata stripped automatically
//   5. Log original and optimized image stats for dev/debugging
//
// Returns { buffer } — a normalized JPEG buffer ready for preprocessImage().
// Throws a user-facing error (err.userInput = true) for unrecoverable inputs.
// ============================================================================

const sharp = require('sharp');

async function normalizeImage(rawBuffer, mimetype) {
  if (!rawBuffer || rawBuffer.length === 0) {
    throw Object.assign(new Error('No image data received. Please try uploading again.'), { userInput: true });
  }

  const originalSizeKB = Math.round(rawBuffer.length / 1024);

  // ── HEIC/HEIF detection + conversion ─────────────────────────────────────
  let workingBuffer = rawBuffer;
  const isHeic = isHeicBuffer(rawBuffer) || isHeicMimetype(mimetype);

  if (isHeic) {
    let heicConvert;
    try {
      heicConvert = require('heic-convert');
    } catch {
      throw Object.assign(
        new Error('HEIC photo support is not available on this server. Please export your photo as JPEG from your iPhone photo library and try again.'),
        { userInput: true }
      );
    }
    try {
      // heic-convert returns a Buffer; quality 1.0 = lossless for the conversion
      // step — sharp will apply the real quality setting below.
      const converted = await heicConvert({ buffer: rawBuffer, format: 'JPEG', quality: 1.0 });
      workingBuffer = Buffer.from(converted);
    } catch (heicErr) {
      console.error('[imageNormalizer] heic-convert failed:', heicErr.message);
      throw Object.assign(
        new Error('Could not process your HEIC photo. Please export it as JPEG from your iPhone photo library and try again.'),
        { userInput: true }
      );
    }
  }

  // ── Read original metadata for logging ───────────────────────────────────
  let originalMeta;
  try {
    originalMeta = await sharp(workingBuffer).metadata();
  } catch (err) {
    console.error('[imageNormalizer] could not read image metadata:', err.message);
    throw Object.assign(
      new Error('Could not read this photo. Please try a JPEG or PNG file.'),
      { userInput: true }
    );
  }

  // Report display dimensions — swap if EXIF rotation hasn't been applied yet
  let dispW = originalMeta.width  || 0;
  let dispH = originalMeta.height || 0;
  if (originalMeta.orientation >= 5 && originalMeta.orientation <= 8) [dispW, dispH] = [dispH, dispW];

  console.log(
    `[imageNormalizer] original: ${originalMeta.format || (isHeic ? 'heic' : '?')} ` +
    `${dispW}×${dispH} (${originalSizeKB} KB)`
  );

  // ── Normalize: rotate → resize → JPEG ────────────────────────────────────
  let optimizedBuffer, optimizedInfo;
  try {
    const result = await sharp(workingBuffer)
      .rotate()                                                   // EXIF auto-orient; clears orientation flag
      .resize({
        width:            2048,
        height:           2048,
        fit:              'inside',
        withoutEnlargement: true,                                // never upscale
      })
      .jpeg({ quality: 90 })                                      // metadata stripped automatically (no .withMetadata())
      .toBuffer({ resolveWithObject: true });

    optimizedBuffer = result.data;
    optimizedInfo   = result.info;
  } catch (err) {
    console.error('[imageNormalizer] sharp normalization failed:', err.message);
    throw Object.assign(
      new Error('Could not process this photo. Please try a JPEG or PNG file.'),
      { userInput: true }
    );
  }

  // ── Verify the output is a valid image ───────────────────────────────────
  try {
    await sharp(optimizedBuffer).metadata();
  } catch {
    throw Object.assign(
      new Error('Image optimization produced an invalid result. Please try a different photo.'),
      { userInput: true }
    );
  }

  const optimizedSizeKB = Math.round(optimizedBuffer.length / 1024);
  console.log(
    `[imageNormalizer] optimized: jpeg ` +
    `${optimizedInfo.width}×${optimizedInfo.height} (${optimizedSizeKB} KB)`
  );

  return { buffer: optimizedBuffer };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isHeicBuffer(buf) {
  if (buf.length < 12) return false;
  if (buf.slice(4, 8).toString('ascii') !== 'ftyp') return false;
  const brand = buf.slice(8, 12).toString('ascii').toLowerCase();
  return brand.startsWith('hei') || brand.startsWith('hev') || brand === 'mif1';
}

function isHeicMimetype(mimetype) {
  if (!mimetype) return false;
  const m = mimetype.toLowerCase();
  return m.includes('heic') || m.includes('heif');
}

module.exports = { normalizeImage };
