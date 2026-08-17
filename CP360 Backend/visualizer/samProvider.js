// SAM 2 floor segmentation via Replicate API.
// Uses axios (already a dependency) — no new npm packages required.
// Requires env var: REPLICATE_API_TOKEN
//
// Strategy: prompt a single point at center-x, 75% down the image.
// In most garage photos taken from the entrance this lands on the floor.

const axios = require('axios');

const REPLICATE_API = 'https://api.replicate.com/v1';
const SAM2_MODEL   = 'meta/sam-2';
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS       = 90000;

const FAILURE_MESSAGES = {
  no_floor:     "We couldn't find a garage floor in this photo. Make sure the floor is clearly visible and take the photo while standing, looking slightly downward toward the center of the garage.",
  floor_too_small: "Very little floor is visible in your photo. Pull your vehicle outside the garage and take the photo again for the best result.",
  floor_unclear: "We had trouble finding your floor boundary. Try opening the garage door for more natural light and contrast, or take the photo from a slightly lower angle.",
};

function userFail(code) {
  return Object.assign(new Error(FAILURE_MESSAGES[code]), { userInput: true, code });
}

async function replicateRequest(method, endpoint, data) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN env var is not set');
  return axios({
    method,
    url: `${REPLICATE_API}${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data,
  });
}

async function pollPrediction(predictionId) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const { data } = await replicateRequest('GET', `/predictions/${predictionId}`);
    if (data.status === 'succeeded') return data;
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`SAM 2 prediction ${data.status}: ${data.error || 'unknown'}`);
    }
  }
  throw new Error('SAM 2 segmentation timed out after 90 seconds');
}

async function downloadBuffer(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(resp.data);
}

async function analyzeMask(maskBuffer) {
  const sharp = require('sharp');
  const { channels } = await sharp(maskBuffer).greyscale().stats();
  const mean = channels[0].mean; // 0–255
  const coverage = mean / 255;   // 0.0–1.0

  if (coverage < 0.02)  throw userFail('no_floor');
  if (coverage < 0.05)  throw userFail('floor_too_small');
  if (coverage > 0.92)  throw userFail('floor_unclear');

  return { coverage };
}

async function segmentFloor(imageUrl) {
  // Start prediction — point prompt at center-x, 75% down
  const { data: prediction } = await replicateRequest('POST', '/predictions', {
    version: SAM2_MODEL,
    input: {
      image:         imageUrl,
      point_coords:  '[[0.5, 0.75]]',
      point_labels:  '[1]',
      multimask_output: false,
    },
  });

  const result = await pollPrediction(prediction.id);

  // SAM 2 returns an array of mask URLs; take the first
  const outputUrls = Array.isArray(result.output) ? result.output : [result.output];
  if (!outputUrls.length || !outputUrls[0]) {
    throw new Error('SAM 2 returned no mask output');
  }

  const maskBuffer = await downloadBuffer(outputUrls[0]);
  const { coverage } = await analyzeMask(maskBuffer);

  return { maskBuffer, coverage };
}

module.exports = { segmentFloor };
