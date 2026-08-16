// ============================================================================
// Torginol chip color scraper
// Fetches 1/16" product images from torginol.com, uploads to R2, seeds chip_colors table
//
// Run from CP360 Backend directory:
//   node scripts/scrape-torginol.js
//
// Requires .env.local with R2 and DATABASE_URL vars set.
// Safe to re-run — uses ON CONFLICT DO NOTHING on name.
// ============================================================================

require('dotenv').config({ path: '.env.local' });

const axios = require('axios');
const { Pool } = require('pg');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2, BUCKET, PUBLIC_URL } = require('../config/r2');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DELAY_MS = 1500;

const PRODUCTS = [
  { slug: 'sand-dollar',   name: 'Sand Dollar',   code: 'FB-951'  },
  { slug: 'opal',          name: 'Opal',           code: 'FB-901'  },
  { slug: 'siberian',      name: 'Siberian',       code: 'FB-902'  },
  { slug: 'glacial',       name: 'Glacial',        code: 'FB-940'  },
  { slug: 'birch-bark',    name: 'Birch Bark',     code: 'FB-1005' },
  { slug: 'victorian',     name: 'Victorian',      code: 'FB-818'  },
  { slug: 'colonial',      name: 'Colonial',       code: 'FB-817'  },
  { slug: 'suave',         name: 'Suave',          code: 'FB-920'  },
  { slug: 'cannoli',       name: 'Cannoli',        code: 'FB-130'  },
  { slug: 'sea-crest',     name: 'Sea Crest',      code: 'FB-803'  },
  { slug: 'caraway',       name: 'Caraway',        code: 'FB-939'  },
  { slug: 'capricorn',     name: 'Capricorn',      code: 'FB-918'  },
  { slug: 'aviator',       name: 'Aviator',        code: 'FB-928'  },
  { slug: 'schist',        name: 'Schist',         code: 'F9307'   },
  { slug: 'cardamom',      name: 'Cardamom',       code: 'FB-935'  },
  { slug: 'soapstone',     name: 'Soapstone',      code: 'F9320'   },
  { slug: 'sprout',        name: 'Sprout',         code: 'FB-938'  },
  { slug: 'slalom',        name: 'Slalom',         code: 'FB-937'  },
  { slug: 'juniper',       name: 'Juniper',        code: 'FB-927'  },
  { slug: 'mercury',       name: 'Mercury',        code: 'FB-936'  },
  { slug: 'swan',          name: 'Swan',           code: 'FB-612'  },
  { slug: 'woven',         name: 'Woven',          code: 'FB-919'  },
  { slug: 'moon-mist',     name: 'Moon Mist',      code: 'FB-906'  },
  { slug: 'bramble',       name: 'Bramble',        code: 'FB-941'  },
  { slug: 'water-lily',    name: 'Water Lily',     code: 'FB-921'  },
  { slug: 'stinger',       name: 'Stinger',        code: 'FB-508'  },
  { slug: 'silver-bells',  name: 'Silver Bells',   code: 'FB-903'  },
  { slug: 'trailmix',      name: 'Trailmix',       code: 'FB-613'  },
  { slug: 'arkose',        name: 'Arkose',         code: 'F9318'   },
  { slug: 'submarine',     name: 'Submarine',      code: 'FB-608'  },
  { slug: 'lunar-2',       name: 'Lunar',          code: 'FB-904'  },
  { slug: 'rocky-ridge',   name: 'Rocky Ridge',    code: 'FB-801'  },
  { slug: 'nordic-green',  name: 'Nordic Green',   code: 'FB-514'  },
  { slug: 'snowfall',      name: 'Snowfall',       code: 'FB-602'  },
  { slug: 'sea-mist',      name: 'Sea Mist',       code: 'FB-802'  },
  { slug: 'tidal-wave',    name: 'Tidal Wave',     code: 'FB-807'  },
  { slug: 'arctic',        name: 'Arctic',         code: 'FB-704'  },
  { slug: 'stony-creek',   name: 'Stony Creek',    code: 'FB-806'  },
  { slug: 'morning-dew',   name: 'Morning Dew',    code: 'FB-609'  },
  { slug: 'magnolia',      name: 'Magnolia',       code: 'FB-942'  },
  { slug: 'stargazer',     name: 'Stargazer',      code: 'FB-908'  },
  { slug: 'feather-gray',  name: 'Feather Gray',   code: 'FB-905'  },
  { slug: 'quicksilver',   name: 'Quicksilver',    code: 'FB-424'  },
  { slug: 'nimbus',        name: 'Nimbus',         code: 'FB-922'  },
  { slug: 'blizzard',      name: 'Blizzard',       code: 'FB-6001' },
  { slug: 'prairie',       name: 'Prairie',        code: 'FB-509'  },
  { slug: 'citrine-2',     name: 'Citrine',        code: 'FB-978'  },
  { slug: 'steelcut',      name: 'Steelcut',       code: 'FB-720'  },
  { slug: 'cabin-fever',   name: 'Cabin Fever',    code: 'FB-127'  },
  { slug: 'anvil',         name: 'Anvil',          code: 'FB-726'  },
  { slug: 'chickadee',     name: 'Chickadee',      code: 'FB-967'  },
  { slug: 'coyote',        name: 'Coyote',         code: 'FB-513'  },
  { slug: 'gracious',      name: 'Gracious',       code: 'FB-916'  },
  { slug: 'shoreline',     name: 'Shoreline',      code: 'FB-421'  },
  { slug: 'bambi',         name: 'Bambi',          code: 'FB-959'  },
  { slug: 'stonehenge',    name: 'Stonehenge',     code: 'FB-427'  },
  { slug: 'gravel-2',      name: 'Gravel',         code: 'FB-414'  },
  { slug: 'rosy-finch',    name: 'Rosy-Finch',     code: 'FB-969'  },
  { slug: 'buffalo',       name: 'Buffalo',        code: 'FB-954'  },
  { slug: 'talus',         name: 'Talus',          code: 'F9319'   },
  { slug: 'waxwing',       name: 'Waxwing',        code: 'FB-968'  },
  { slug: 'spilite',       name: 'Spilite',        code: 'F9313'   },
  { slug: 'thyme',         name: 'Thyme',          code: 'FB-977'  },
  { slug: 'timberwolf',    name: 'Timberwolf',     code: 'FB-909'  },
  { slug: 'wild-dove',     name: 'Wild Dove',      code: 'FB-911'  },
  { slug: 'summit',        name: 'Summit',         code: 'FB-721'  },
  { slug: 'avalanche',     name: 'Avalanche',      code: 'FB-722'  },
  { slug: 'rapids',        name: 'Rapids',         code: 'FB-506'  },
  { slug: 'houndstooth',   name: 'Houndstooth',    code: 'FB-910'  },
  { slug: 'dovetail',      name: 'Dovetail',       code: 'FB-823'  },
  { slug: 'sycamore',      name: 'Sycamore',       code: 'FB-6002' },
  { slug: 'pumice',        name: 'Pumice',         code: 'F9303'   },
  { slug: 'creekbed',      name: 'Creekbed',       code: 'FB-716'  },
  { slug: 'mushroom',      name: 'Mushroom',       code: 'FB-714'  },
  { slug: 'polar',         name: 'Polar',          code: 'FB-330'  },
  { slug: 'madras',        name: 'Madras',         code: 'FB-706'  },
  { slug: 'oasis',         name: 'Oasis',          code: 'FB-712'  },
  { slug: 'galaxy',        name: 'Galaxy',         code: 'FB-907'  },
  { slug: 'wren',          name: 'Wren',           code: 'FB-970'  },
  { slug: 'loon',          name: 'Loon',           code: 'FB-966'  },
  { slug: 'comet',         name: 'Comet',          code: 'FB-711'  },
  { slug: 'domino',        name: 'Domino',         code: 'FB-411'  },
  { slug: 'outback',       name: 'Outback',        code: 'FB-517'  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getImageUrl(slug) {
  const url = `https://torginol.com/products/${slug}`;
  const resp = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
    timeout: 15000,
  });

  // Find first 1/16" chip texture image URL on the page
  const match = resp.data.match(/https:\/\/assets\.torginol\.com\/[^\s"'&]+_1\.16\.jpg/);
  return match ? match[0] : null;
}

async function downloadImage(imageUrl) {
  const resp = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
  });
  return Buffer.from(resp.data);
}

async function uploadToR2(buffer, slug) {
  const key = `visualizer/chip-library/${slug}.jpg`;
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
  }));
  return { key, url: `${PUBLIC_URL}/${key}` };
}

async function insertChipColor({ name, code, key, url, sortOrder }) {
  await pool.query(
    `INSERT INTO chip_colors (name, description, product_code, source, reference_image_key, reference_image_url, sort_order, is_active)
     VALUES ($1, $2, $3, 'torginol', $4, $5, $6, true)
     ON CONFLICT (LOWER(name)) DO UPDATE
       SET reference_image_key = EXCLUDED.reference_image_key,
           reference_image_url = EXCLUDED.reference_image_url,
           product_code = EXCLUDED.product_code`,
    [name, `${name} (${code}) — Torginol 1/16" vinyl chip blend`, code, key, url, sortOrder]
  );
}

async function main() {
  console.log(`Torginol scraper — ${PRODUCTS.length} colors to process\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < PRODUCTS.length; i++) {
    const product = PRODUCTS[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${PRODUCTS.length}] ${product.name.padEnd(15)} `);

    try {
      const imageUrl = await getImageUrl(product.slug);
      if (!imageUrl) {
        console.log('SKIP — no 1/16" image found');
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      const buffer = await downloadImage(imageUrl);
      const { key, url } = await uploadToR2(buffer, product.slug);
      await insertChipColor({ name: product.name, code: product.code, key, url, sortOrder: i });

      console.log(`OK — ${key}`);
      success++;
    } catch (err) {
      console.log(`FAIL — ${err.message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone: ${success} uploaded, ${skipped} skipped, ${failed} failed`);
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
