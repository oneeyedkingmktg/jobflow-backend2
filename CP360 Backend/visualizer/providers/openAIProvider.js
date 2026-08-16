// ============================================================================
// OpenAI rendering provider — uses gpt-image-1 edit endpoint
// Swap this file to change AI vendors without touching anything else.
// ============================================================================

const OpenAI = require('openai');
const https = require('https');
const http = require('http');

function buildPrompt(chipColor) {
  return (
    `This is a photo of a garage. Replace ONLY the concrete floor with a professional ` +
    `decorative epoxy floor coating. Color blend: ${chipColor.name}. ` +
    `Apply a dense full-broadcast vinyl chip finish. Each individual chip flake must be ` +
    `very fine grain — approximately 3 to 5 millimeters in diameter, tightly packed. ` +
    `Preserve the original perspective, lighting, shadows, and floor reflections exactly. ` +
    `Keep all walls, garage doors, ceiling, cars, shelving, cabinets, tools, and all other ` +
    `objects completely unchanged. Change only the floor surface. ` +
    `The result must look like a real professional photograph of a completed epoxy floor installation.`
  );
}

async function generate({ imageBuffer, chipColor, size }) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { toFile } = require('openai');
  const imageFile = await toFile(imageBuffer, 'floor.png', { type: 'image/png' });

  const response = await client.images.edit({
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    image: imageFile,
    prompt: buildPrompt(chipColor),
    n: 1,
    size: size || '1536x1024',
  });

  const item = response.data[0];

  // gpt-image-1 returns b64_json; fall back to downloading URL for dall-e-2
  let buffer;
  if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64');
  } else if (item.url) {
    buffer = await downloadUrl(item.url);
  } else {
    throw new Error('OpenAI returned neither b64_json nor url');
  }

  return {
    buffer,
    provider: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  };
}

function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = { generate };
