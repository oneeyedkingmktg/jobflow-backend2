// Compositing engine — tiles a chip texture onto a floor mask area using Sharp.
// No API calls. Runs entirely on CPU in under 1 second.
//
// blend: 'dest-in' cuts the tiled texture to the floor mask shape.
// blend: 'multiply' composites the masked texture onto the original photo,
//   preserving the original lighting, shadows, and reflections.

const sharp = require('sharp');

// Pre-boost factor applied to texture before multiply blend.
// Compensates for multiply darkening on neutral concrete (~128/255 gray).
// 255/128 ≈ 2.0 means the result is approximately the chip's natural color
// over an evenly-lit neutral floor.
const BRIGHTNESS_BOOST = 2.0;

async function tileTexture(textureBuffer, targetWidth, targetHeight) {
  const { width: tw, height: th } = await sharp(textureBuffer).metadata();

  const composites = [];
  for (let y = 0; y < targetHeight; y += th) {
    for (let x = 0; x < targetWidth; x += tw) {
      composites.push({ input: textureBuffer, left: x, top: y, blend: 'over' });
    }
  }

  return sharp({
    create: {
      width: targetWidth,
      height: targetHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function composite({ processedBuffer, maskBuffer, textureBuffer }) {
  const { width, height } = await sharp(processedBuffer).metadata();

  // Resize mask to match processed image dimensions
  const resizedMask = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .greyscale()
    .png()
    .toBuffer();

  // Tile the chip texture across the full image area
  const tiled = await tileTexture(textureBuffer, width, height);

  // Pre-boost brightness to compensate for multiply darkening
  const boosted = await sharp(tiled)
    .modulate({ brightness: BRIGHTNESS_BOOST })
    .png()
    .toBuffer();

  // Cut tiled texture to floor shape using mask
  const maskedTexture = await sharp(boosted)
    .composite([{ input: resizedMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Composite masked texture onto original photo — multiply preserves lighting
  return sharp(processedBuffer)
    .composite([{ input: maskedTexture, blend: 'multiply' }])
    .png()
    .toBuffer();
}

module.exports = { composite };
