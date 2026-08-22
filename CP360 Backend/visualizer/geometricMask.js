// Generates a feathered trapezoid floor mask without any API calls.
// Works for standard garage/floor photos taken from the entrance looking in.
//
// Shape: full-width at bottom, narrowing toward top (perspective), with
// a soft vertical fade at the floor-wall boundary.

const sharp = require('sharp');

// Where the floor begins (fraction from top of image)
const FLOOR_START_FRAC = 0.22;

// Horizontal perspective taper: very slight — floor is nearly full-width in most garage shots
const PERSPECTIVE_MARGIN = 0.04;

async function generateFloorMask(width, height) {
  const data = Buffer.allocUnsafe(width * height);

  for (let y = 0; y < height; y++) {
    const yFrac = y / height;

    if (yFrac < FLOOR_START_FRAC) {
      data.fill(0, y * width, (y + 1) * width);
      continue;
    }

    // Trapezoid: narrower at top of floor zone, full width at bottom
    const perspFrac = (yFrac - FLOOR_START_FRAC) / (1 - FLOOR_START_FRAC);
    const margin    = PERSPECTIVE_MARGIN * (1 - perspFrac);
    const xLeft     = Math.round(margin * width);
    const xRight    = Math.round((1 - margin) * width);

    for (let x = 0; x < width; x++) {
      data[y * width + x] = (x >= xLeft && x <= xRight) ? 255 : 0;
    }
  }

  return sharp(data, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

module.exports = { generateFloorMask };
