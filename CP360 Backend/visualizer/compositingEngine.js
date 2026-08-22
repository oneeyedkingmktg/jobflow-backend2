// Compositing engine — generates a procedural chip scatter texture with perspective
// and gloss, then blends it onto the floor area defined by the SAM 2 mask.

const sharp = require('sharp');

const BLEND_OPACITY    = 0.85;  // chip layer opacity — lets original lighting show through
const CONCRETE_COLOR   = { r: 175, g: 171, b: 163 };

// Chip size range — perspective makes chips smaller near vanishing point (top of mask)
// and larger near the camera (bottom of image)
const CHIP_RADIUS_NEAR = 0.0045;  // fraction of width at bottom (camera-side)
const CHIP_RADIUS_FAR  = 0.0018;  // fraction of width at top (vanishing-point-side)
const CHIP_COVERAGE    = 0.92;

// Gloss: simulates epoxy sheen with a soft radial highlight
const GLOSS_OPACITY    = 0.22;
const GLOSS_COLOR      = { r: 255, g: 255, b: 255 };

function pickColor(recipe, rnd) {
  let cumulative = 0;
  for (const item of recipe) {
    cumulative += item.weight;
    if (rnd < cumulative) return item.rgb;
  }
  return recipe[recipe.length - 1].rgb;
}

function varyBrightness(rgb, variance = 0.10) {
  const f = 1 + (Math.random() * 2 - 1) * variance;
  return {
    r: Math.min(255, Math.max(0, Math.round(rgb.r * f))),
    g: Math.min(255, Math.max(0, Math.round(rgb.g * f))),
    b: Math.min(255, Math.max(0, Math.round(rgb.b * f))),
  };
}

function generateChipTexture(width, height, recipe, maskRaw) {
  const totalWeight = recipe.reduce((s, c) => s + c.weight, 0);
  const normalized  = recipe.map(c => ({ rgb: c.rgb, weight: c.weight / totalWeight }));

  // Start with concrete background
  const buf = Buffer.allocUnsafe(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    buf[i * 3]     = CONCRETE_COLOR.r;
    buf[i * 3 + 1] = CONCRETE_COLOR.g;
    buf[i * 3 + 2] = CONCRETE_COLOR.b;
  }

  // Find vertical floor extent for perspective scaling
  let maskTop = height, maskBottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (maskRaw[y * width + x] > 128) {
        if (y < maskTop)    maskTop    = y;
        if (y > maskBottom) maskBottom = y;
        break;
      }
    }
  }
  if (maskTop >= maskBottom) { maskTop = 0; maskBottom = height - 1; }

  // Jittered grid — divide canvas into cells, one chip per cell at a random position.
  // This eliminates clustering/splotchiness from pure random placement.
  // Cell size based on the smallest chip (far end) so near-end chips naturally overlap slightly.
  const cellSize = Math.max(6, Math.round(CHIP_RADIUS_FAR * width * 2.2));

  for (let gy = 0; gy * cellSize < height; gy++) {
    for (let gx = 0; gx * cellSize < width; gx++) {
      // ~8% of cells left empty — shows concrete, natural variation
      if (Math.random() > CHIP_COVERAGE) continue;

      // Jittered position within the cell
      const cx = Math.min(width  - 1, Math.round(gx * cellSize + Math.random() * cellSize));
      const cy = Math.min(height - 1, Math.round(gy * cellSize + Math.random() * cellSize));

      // Skip if not on floor mask
      if (maskRaw[cy * width + cx] < 64) continue;

      // Perspective: chips scale from small (far/top) to large (near/bottom)
      const yFrac  = maskTop === maskBottom ? 0.5 :
                     Math.max(0, Math.min(1, (cy - maskTop) / (maskBottom - maskTop)));
      const chipR  = Math.max(1, Math.round(
        (CHIP_RADIUS_FAR + (CHIP_RADIUS_NEAR - CHIP_RADIUS_FAR) * yFrac) * width
      ));
      // Vertical foreshortening — chips compress vertically near vanishing point
      const chipRY = Math.max(1, Math.round(chipR * (0.35 + 0.65 * yFrac)));

      const rgb = varyBrightness(pickColor(normalized, Math.random()));
      const x0  = Math.max(0, cx - chipR);
      const x1  = Math.min(width  - 1, cx + chipR);
      const y0  = Math.max(0, cy - chipRY);
      const y1  = Math.min(height - 1, cy + chipRY);

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = (px - cx) / chipR;
          const dy = (py - cy) / chipRY;
          if (dx * dx + dy * dy <= 1) {
            const idx = (py * width + px) * 3;
            buf[idx]     = rgb.r;
            buf[idx + 1] = rgb.g;
            buf[idx + 2] = rgb.b;
          }
        }
      }
    }
  }

  return buf;
}

// Generates a soft radial gloss highlight simulating epoxy sheen.
// Highlight originates from upper-center (where light typically hits a floor).
function buildGlossLayer(width, height) {
  const buf = Buffer.allocUnsafe(width * height);
  // Gloss hotspot: upper-center of the image
  const hx = width  * 0.50;
  const hy = height * 0.15;
  // Radius of the gloss falloff
  const radius = Math.sqrt(width * width + height * height) * 0.65;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist  = Math.sqrt((x - hx) ** 2 + (y - hy) ** 2);
      const alpha = Math.max(0, 1 - dist / radius);
      // Quadratic falloff for smooth highlight
      buf[y * width + x] = Math.round(alpha * alpha * 255);
    }
  }
  return buf;
}

async function composite({ processedBuffer, maskBuffer, recipe }) {
  const { width, height } = await sharp(processedBuffer).metadata();

  const origRaw = await sharp(processedBuffer).removeAlpha().raw().toBuffer();

  const maskRaw = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();

  const chipRaw  = generateChipTexture(width, height, recipe, maskRaw);
  const glossRaw = buildGlossLayer(width, height);

  const resultRaw = Buffer.allocUnsafe(width * height * 3);

  for (let i = 0; i < width * height; i++) {
    const floorWeight = (maskRaw[i] / 255) * BLEND_OPACITY;

    if (floorWeight < 0.01) {
      // Outside floor — keep original pixel unchanged
      resultRaw[i * 3]     = origRaw[i * 3];
      resultRaw[i * 3 + 1] = origRaw[i * 3 + 1];
      resultRaw[i * 3 + 2] = origRaw[i * 3 + 2];
      continue;
    }

    // Blend chip texture onto floor
    let r = Math.round(origRaw[i*3]   * (1 - floorWeight) + chipRaw[i*3]   * floorWeight);
    let g = Math.round(origRaw[i*3+1] * (1 - floorWeight) + chipRaw[i*3+1] * floorWeight);
    let b = Math.round(origRaw[i*3+2] * (1 - floorWeight) + chipRaw[i*3+2] * floorWeight);

    // Add gloss highlight on floor pixels only
    const gloss = (glossRaw[i] / 255) * GLOSS_OPACITY * floorWeight;
    r = Math.min(255, Math.round(r + (GLOSS_COLOR.r - r) * gloss));
    g = Math.min(255, Math.round(g + (GLOSS_COLOR.g - g) * gloss));
    b = Math.min(255, Math.round(b + (GLOSS_COLOR.b - b) * gloss));

    resultRaw[i * 3]     = r;
    resultRaw[i * 3 + 1] = g;
    resultRaw[i * 3 + 2] = b;
  }

  return sharp(resultRaw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

module.exports = { composite };
