// Pre-flight image quality checks — runs before any API call, ~200ms, zero cost.
// Returns null on pass, or { code, message } on fail where message is user-facing.

const sharp = require('sharp');

const MESSAGES = {
  too_dark:       'Your photo is too dark. Turn your garage lights on and open the garage door, then try again.',
  overexposed:    'Your photo has too much glare. Try angling your camera slightly to avoid direct light reflections, then retake.',
  low_resolution: 'Your photo resolution is too low. Use your phone\'s main camera rather than a screenshot or compressed image.',
};

function fail(code) {
  return { code, message: MESSAGES[code] };
}

async function runPreflightChecks(buffer) {
  const meta = await sharp(buffer).metadata();

  // Resolution check
  if ((meta.width || 0) < 512 || (meta.height || 0) < 512) {
    return fail('low_resolution');
  }

  // Brightness + overexposure — single greyscale stats call
  const { channels } = await sharp(buffer).greyscale().stats();
  const mean = channels[0].mean; // 0–255

  if (mean < 50)  return fail('too_dark');
  if (mean > 220) return fail('overexposed');

  return null; // all checks passed
}

module.exports = { runPreflightChecks };
