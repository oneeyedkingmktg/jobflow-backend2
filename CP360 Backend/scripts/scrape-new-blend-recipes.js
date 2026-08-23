// Scrapes recipe data (Made Up Of section) for Torginol blends not yet in blend_recipes_raw.csv
// and APPENDS rows to the existing CSV. Does not overwrite existing data.
//
// Run: node scripts/scrape-new-blend-recipes.js

const path = require('path');
const fs   = require('fs');
const axios = require('axios');

const DELAY_MS     = 1200;
const DATA_DIR     = path.join(__dirname, 'data');
const RECIPES_FILE = path.join(DATA_DIR, 'blend_recipes_raw.csv');

// New slugs to scrape — discovered from torginol.com/products/flake-flooring
const NEW_SLUGS = [
  'lunar-2', 'stargazer', 'citrine-2', 'gravel-2', 'rosy-finch', 'dingo', 'safari', 'sable',
  'sedum', 'current', 'crossbow', 'thunder', 'stonewash', 'keystone', 'weathered-gray', 'shadow',
  'basalt', 'osprey', 'metapelite', 'brickyard', 'wombat', 'heron', 'orbit', 'woodland',
  'lanai-gray', 'morel', 'burrow', 'koala', 'feldspar', 'java', 'fog', 'frostbite', 'voltage',
  'obsidian', 'dolerite', 'garnet', 'merino', 'robin', 'fig', 'gargoyle', 'smokey-blue',
  'nightfall', 'kismet', 'sparrow', 'lapis', 'magma', 'cast-iron', 'rainstorm', 'celestial',
  'moose', 'chicory', 'woodpecker', 'full-moon', 'black-ice', 'raven', 'carbon',
  'milwaukee', 'windy-city', 'the-land', 'jax', 'rampage', 'flipper', 'splash', 'gumbo',
  'swoop', 'steel-city', 'blitz', 'boom', 'viktor', 'skol', 'poe', 'conquer', 'rise',
  'charlotte', 'rowdy', 'pat', 'rebel', 'roary', 'gold-rush', 'tiger', 'growl', 'freddie',
  'talon', 'lambeau', 'yellow-jacket', 'hog', 'green-and-gold', 'soldier', 'sun-life',
  'paul-brown', 'cleveland-chomps', 'lp-field', 'miller', 'heinz', 'superdome', 'doak',
  'ford', 'madden', 'metrodome', 'coliseum', 'beaver', 'lucas', 'spangle', 'daredevil',
  'briar', 'reliant', 'bucky', 'montana', 'humphrey', 'everbank', 'carey', 'washington',
  'lincoln', 'cardinal-2', 'platteville', 'white-water', 'chenille', 'juneau', 'sandstone',
  'claystone', 'agate', 'husky', 'shale', 'armadillo', 'slate-2', 'blacktop', 'limestone',
];

// Find which of these are already in the CSV so we skip them
function getExistingSlugs() {
  if (!fs.existsSync(RECIPES_FILE)) return new Set();
  const lines = fs.readFileSync(RECIPES_FILE, 'utf8').trim().split('\n');
  const slugs = new Set();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    // slug is column index 2
    const slug = (parts[2] || '').replace(/"/g, '').trim();
    if (slug) slugs.add(slug);
  }
  return slugs;
}

function slugToName(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function csv(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

function extractPageData(html) {
  // Description
  const descMatch = html.match(/id="product-description"[^>]*>\s*([\s\S]*?)\s*<\/div>/);
  const description = descMatch
    ? descMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    : '';

  // Chip sizes
  const sizeMap = { sizeProfile14: '1/4"', sizeProfile18: '1/8"', sizeProfile116: '1/16"' };
  const sizeSelector = html.match(/Select Profile Size([\s\S]*?)Get Sample As/);
  const chipSizes = sizeSelector
    ? [...new Set([...sizeSelector[1].matchAll(/data-id="(sizeProfile\d+)"/g)].map(m => sizeMap[m[1]]).filter(Boolean))].join(' | ')
    : '';

  // Made Up Of section
  const madeUpOf = html.match(/<section class="made-up-of">([\s\S]*?)<\/section>/);
  if (!madeUpOf) return { description, chipSizes, components: [] };
  const section = madeUpOf[1];

  const altNames = [...section.matchAll(/alt="([^("]+)\s*\([^)]*\)[^"]*"/g)].map(m => m[1].trim());
  const codes    = [...section.matchAll(/<div class="partNumber">([^<]+)<\/div>/g)].map(m => m[1].trim());
  const pcts     = [...section.matchAll(/<span>(\d+)%<\/span>/g)].map(m => m[1].trim());

  const components = codes.map((code, i) => ({
    component_code: code,
    component_name: altNames[i] || '',
    percentage:     pcts[i]     || '',
  }));

  return { description, chipSizes, components };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const existing = getExistingSlugs();
  const toScrape = NEW_SLUGS.filter(s => !existing.has(s));
  console.log(`${toScrape.length} new slugs to scrape (${NEW_SLUGS.length - toScrape.length} already in CSV)\n`);

  if (!toScrape.length) { console.log('Nothing to do.'); return; }

  const newRows = [];
  let success = 0, noRecipe = 0, failed = 0;

  for (let i = 0; i < toScrape.length; i++) {
    const slug = toScrape[i];
    const name = slugToName(slug);
    process.stdout.write(`[${String(i + 1).padStart(3)}/${toScrape.length}] ${name.padEnd(20)} `);

    try {
      const resp = await axios.get(`https://torginol.com/products/${slug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
        timeout: 20000,
      });
      const { description, chipSizes, components } = extractPageData(resp.data);

      if (components.length === 0) {
        console.log('SKIP — no Made Up Of section');
        newRows.push(`${csv(name)},,${csv(slug)},${csv(description)},${csv(chipSizes)},,,,"No Made Up Of section found on page"`);
        noRecipe++;
      } else {
        const total = components.reduce((s, c) => s + (parseInt(c.percentage) || 0), 0);
        const note  = total !== 100 ? `percentages sum to ${total}` : '';
        for (const comp of components) {
          newRows.push(`${csv(name)},,${csv(slug)},${csv(description)},${csv(chipSizes)},${csv(comp.component_code)},${csv(comp.component_name)},${csv(comp.percentage)},${csv(note)}`);
        }
        console.log(`OK — ${components.length} components  [${components.map(c => `${c.component_name} ${c.percentage}%`).join(', ')}]`);
        success++;
      }
    } catch (err) {
      console.log(`FAIL — ${err.message}`);
      newRows.push(`${csv(name)},,${csv(slug)},,,,,,${csv('scrape error: ' + err.message)}`);
      failed++;
    }

    if (i < toScrape.length - 1) await sleep(DELAY_MS);
  }

  // Append to existing CSV (no header — header already present)
  if (newRows.length) {
    fs.appendFileSync(RECIPES_FILE, '\n' + newRows.join('\n'), 'utf8');
    console.log(`\nAppended ${newRows.length} rows to ${RECIPES_FILE}`);
  }

  console.log(`\nDone: ${success} with recipes, ${noRecipe} no-recipe, ${failed} failed`);
}

main().catch(err => { console.error(err); process.exit(1); });
