// SAM 2 floor segmentation via Replicate API.
// Uses axios (already a dependency) — no new npm packages required.
// Requires env var: REPLICATE_API_TOKEN
//
// Strategy: prompt a single point at center-x, 75% down the image (pixel coords).
// In most garage photos taken from the entrance this lands on the floor.

const axios = require('axios');

const REPLICATE_API    = 'https://api.replicate.com/v1';
const SAM2_VERSION     = 'fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83';
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS       = 90000;

const FAILURE_MESSAGES = {
  no_floor:        "We couldn't find a garage floor in this photo. Make sure the floor is clearly visible and take the photo while standing, looking slightly downward toward the center of the garage.",
  floor_too_small: "Very little floor is visible in your photo. Pull your vehicle outside the garage and take the photo again for the best result.",
  floor_unclear:   "We had trouble finding your floor boundary. Try opening the garage door for more natural light and contrast, or take the photo from a slightly lower angle.",
};

function userFail(code) {
  return Object.assign(new Error(FAILURE_MESSAGES[code]), { userInput: true, code });
}

async function replicateRequest(method, endpoint, data, isRetry = false) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN env var is not set');
  try {
    return await axios({
      method,
      url: `${REPLICATE_API}${endpoint}`,
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer':       'wait',
      },
      data,
    });
  } catch (err) {
    const status = err.response?.status;
    const body   = err.response?.data;

    // Rate limited — wait the requested time and retry once
    if (status === 429 && !isRetry) {
      const waitSec = (body?.retry_after || 10) + 2;
      console.log(`[SAM2] Rate limited (429). Waiting ${waitSec}s then retrying...`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      return replicateRequest(method, endpoint, data, true);
    }

    console.error('[SAM2] Replicate error', status, JSON.stringify(body));
    throw new Error(`Replicate ${status || 'network'}: ${JSON.stringify(body)}`);
  }
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
  const mean     = channels[0].mean; // 0–255
  const coverage = mean / 255;       // 0.0–1.0

  if (coverage < 0.005) throw userFail('no_floor'); // essentially empty

  return { coverage };
}

// Replicate's meta/sam-2 uses automatic mask generation (no point prompts).
// We run it with a coarse grid, download all individual masks, then score each
// by how much of the floor zone (bottom 65% of the image) it covers.
// The highest-scoring mask is the floor.
async function segmentFloor(imageUrl) {
  const sharp = require('sharp');

  const { data: prediction } = await replicateRequest('POST', '/predictions', {
    version: SAM2_VERSION,
    input: {
      image:                  imageUrl,
      points_per_side:        32,   // denser grid = more masks = better floor coverage
      pred_iou_thresh:        0.50, // permissive — large flat floors score low on IoU
      stability_score_thresh: 0.65, // permissive — concrete is uniform, low edge contrast
    },
  });

  const result = (prediction.status === 'succeeded')
    ? prediction
    : await pollPrediction(prediction.id);

  const maskUrls = result.output?.individual_masks;
  if (!Array.isArray(maskUrls) || !maskUrls.length) {
    throw new Error('SAM 2 returned no individual masks');
  }

  // Download all masks in parallel
  const maskBuffers = await Promise.all(maskUrls.map(downloadBuffer));

  // Score each mask by how floor-like it is:
  //   - What fraction of its ON pixels are in the bottom half of the image (floor zone)
  //   - Weighted by total mask size (bigger is better, up to a point)
  const scores = await Promise.all(maskBuffers.map(async (buf) => {
    const { data, info } = await sharp(buf)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels  = info.width * info.height;
    const floorRowStart = Math.round(info.height * 0.40); // bottom 60% = floor zone

    let totalOn = 0, floorOn = 0;
    for (let i = 0; i < totalPixels; i++) {
      if (data[i] > 128) {
        totalOn++;
        const y = Math.floor(i / info.width);
        if (y >= floorRowStart) floorOn++;
      }
    }
    if (totalOn === 0) return 0;

    // Score = fraction of mask in floor zone × size factor (prefer larger masks)
    const floorFraction = floorOn / totalOn;
    const sizeFactor    = Math.min(1, totalOn / (totalPixels * 0.10)); // normalize at 10% coverage
    return floorFraction * sizeFactor;
  }));

  const bestIdx   = scores.indexOf(Math.max(...scores));
  const bestScore = scores[bestIdx];

  console.log(`[SAM2] ${maskUrls.length} masks; best floor score: ${bestScore.toFixed(3)} (mask ${bestIdx})`);

  if (bestScore < 0.005) throw userFail('no_floor');

  const maskBuffer = maskBuffers[bestIdx];
  const { coverage } = await analyzeMask(maskBuffer);

  // Only reject if coverage is essentially the full image (SAM returned a full-frame mask)
  if (coverage > 0.97) throw userFail('floor_unclear');

  return { maskBuffer, coverage };
}

module.exports = { segmentFloor };
