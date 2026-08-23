// Fetches https://torginol.com/products/flake-flooring, extracts all /products/ slugs,
// compares with chip_colors in DB, and seeds any missing ones.
// Run: node scripts/discover-torginol.js [--seed]
//
// With --seed: fetches each missing product page, finds the _1.16.jpg image, uploads to R2, inserts to DB
// Without --seed (default): just prints the diff

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const fetch = require('node-fetch');
const { Pool } = require('pg');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2, BUCKET, PUBLIC_URL } = require('../config/r2');

const SEED = process.argv.includes('--seed');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
};

async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function getSlugsFromCategoryPage() {
  // Try the flake-flooring page — might be a collection or a landing page
  const urls = [
    'https://torginol.com/products/flake-flooring',
    'https://torginol.com/collections/flake-flooring',
    'https://torginol.com/collections/vinyl-flake-chips',
    'https://torginol.com/collections/all-flake',
  ];

  const slugSet = new Set();

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      // Extract all /products/<slug> occurrences
      const matches = [...html.matchAll(/\/products\/([a-z0-9][a-z0-9-]+)/g)];
      for (const m of matches) {
        const slug = m[1];
        // Skip non-product pages
        if (['flake-flooring', 'cart', 'login', 'account', 'search', 'pages', 'blogs', 'contact'].includes(slug)) continue;
        if (slug.includes('flake-flooring')) continue;
        slugSet.add(slug);
      }
      console.log(`[${url}] found ${slugSet.size} slugs so far`);
    } catch (err) {
      console.log(`[skip] ${url}: ${err.message}`);
    }
  }

  // Also try Shopify JSON endpoint for collections
  const jsonUrls = [
    'https://torginol.com/collections/flake-flooring/products.json?limit=250',
    'https://torginol.com/collections/all/products.json?limit=250&sort_by=title',
  ];
  for (const url of jsonUrls) {
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 15000 });
      if (res.ok) {
        const data = await res.json();
        const products = data.products || [];
        for (const p of products) {
          if (p.handle) slugSet.add(p.handle);
        }
        console.log(`[JSON ${url}] +${products.length} products, total slugs: ${slugSet.size}`);
      }
    } catch (err) {
      console.log(`[skip JSON] ${url}: ${err.message}`);
    }
  }

  return [...slugSet];
}

async function getDbSlugs() {
  const { rows } = await pool.query(`SELECT LOWER(name) AS name, source FROM chip_colors WHERE is_active=true`);
  return rows;
}

async function fetchProductImage(slug) {
  const html = await fetchHtml(`https://torginol.com/products/${slug}`);
  // Look for _1.16.jpg pattern (Torginol product images)
  const m = html.match(/https?:\/\/[^"'\s]+_1\.16\.jpg/);
  if (m) return m[0];
  // Fallback: look for any .jpg image in the product section
  const m2 = html.match(/https?:\/\/cdn\.shopify\.com\/[^"'\s]+\.jpg/);
  return m2 ? m2[0] : null;
}

async function slugToName(slug) {
  // "torginol-fb-301-marble-white" → "Torginol FB-301 Marble White"
  return slug
    .replace(/-/g, ' ')
    .replace(/\b(fb|f9|fsc)\b/gi, m => m.toUpperCase())
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

async function seedSlug(slug) {
  const name = await slugToName(slug);
  console.log(`  Seeding: ${slug} → ${name}`);

  try {
    const imageUrl = await fetchProductImage(slug);
    let r2Url = null;

    if (imageUrl) {
      const imgRes = await fetch(imageUrl, { headers: HEADERS, timeout: 20000 });
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const key = `visualizer/chip-refs/torginol/${slug}.jpg`;
        await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: 'image/jpeg' }));
        r2Url = `${PUBLIC_URL}/${key}`;
        console.log(`    Image: ${r2Url}`);
      }
    } else {
      console.log(`    No image found for ${slug}`);
    }

    await pool.query(
      `INSERT INTO chip_colors (name, source, reference_image_url, is_active)
       VALUES ($1, 'torginol', $2, true)
       ON CONFLICT (LOWER(name)) DO UPDATE
         SET reference_image_url = COALESCE(EXCLUDED.reference_image_url, chip_colors.reference_image_url),
             is_active = true`,
      [name, r2Url]
    );
    console.log(`    DB: inserted/updated`);
  } catch (err) {
    console.error(`    Error seeding ${slug}:`, err.message);
  }
}

async function main() {
  console.log('Fetching Torginol category page(s)…');
  const categorySlugs = await getSlugsFromCategoryPage();
  console.log(`\nDiscovered ${categorySlugs.length} slugs from category pages`);

  const dbRows = await getDbSlugs();
  const dbNames = new Set(dbRows.map(r => r.name));

  const missing = [];
  for (const slug of categorySlugs) {
    // Skip category/type pages — only keep individual blend products
    if (slug.endsWith('-flooring') || slug === 'product-library') continue;
    const approxName = (await slugToName(slug)).toLowerCase();
    const inDb = dbNames.has(approxName) || dbRows.some(r => r.name.includes(slug.replace(/-/g, ' ')));
    if (!inDb) missing.push(slug);
  }

  console.log(`\nDB has ${dbRows.length} active chip colors`);
  console.log(`Category page has ${categorySlugs.length} products`);
  console.log(`Missing from DB: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\nMissing slugs:');
    missing.forEach(s => console.log('  -', s));
  }

  if (SEED && missing.length > 0) {
    console.log('\nSeeding missing products…');
    for (const slug of missing) {
      await seedSlug(slug);
    }
    console.log('\nDone!');
  } else if (!SEED && missing.length > 0) {
    console.log('\nRe-run with --seed to add them to the DB');
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
