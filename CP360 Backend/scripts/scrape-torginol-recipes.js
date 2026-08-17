// ============================================================================
// Torginol blend recipe scraper
// Visits each product page, extracts component chips + percentages, writes CSV.
//
// Run from CP360 Backend directory:
//   node scripts/scrape-torginol-recipes.js
//
// Add --test to run only the first 3 products for inspection.
//
// Output files (created/overwritten each run):
//   scripts/data/blend_recipes_raw.csv   — one row per blend component
//   scripts/data/primitive_colors_raw.csv — unique component chips found
// ============================================================================

const path = require('path');
const fs = require('fs');
const axios = require('axios');

const DELAY_MS = 1500;
const DATA_DIR = path.join(__dirname, 'data');
const RECIPES_FILE = path.join(DATA_DIR, 'blend_recipes_raw.csv');
const PRIMITIVES_FILE = path.join(DATA_DIR, 'primitive_colors_raw.csv');

const IS_TEST = process.argv.includes('--test');

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

function csv(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

function extractPageData(html, product) {
  // Description
  const descMatch = html.match(/id="product-description"[^>]*>\s*([\s\S]*?)\s*<\/div>/);
  const description = descMatch
    ? descMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    : '';

  // Available chip sizes from the size selector buttons
  const sizeMap = { sizeProfile14: '1/4"', sizeProfile18: '1/8"', sizeProfile116: '1/16"' };
  const sizeMatches = [...html.matchAll(/data-id="(sizeProfile\d+)"/g)].map(m => m[1]);
  // Only include sizes from the selector section (deduplicate)
  const sizeSelector = html.match(/Select Profile Size([\s\S]*?)Get Sample As/);
  const chipSizes = sizeSelector
    ? [...new Set([...sizeSelector[1].matchAll(/data-id="(sizeProfile\d+)"/g)].map(m => sizeMap[m[1]]).filter(Boolean))].join(' | ')
    : [...new Set(sizeMatches.map(s => sizeMap[s]).filter(Boolean))].join(' | ');

  // Made Up Of section
  const madeUpOf = html.match(/<section class="made-up-of">([\s\S]*?)<\/section>/);
  if (!madeUpOf) {
    return { description, chipSizes, components: [] };
  }
  const section = madeUpOf[1];

  // Extract color names from alt text: alt="ColorName (CODE...) - Size"
  const altNames = [...section.matchAll(/alt="([^("]+)\s*\([^)]*\)[^"]*"/g)].map(m => m[1].trim());
  // Extract part codes
  const codes = [...section.matchAll(/<div class="partNumber">([^<]+)<\/div>/g)].map(m => m[1].trim());
  // Extract percentages
  const pcts = [...section.matchAll(/<span>(\d+)%<\/span>/g)].map(m => m[1].trim());

  const components = codes.map((code, i) => ({
    component_code: code,
    component_name: altNames[i] || '',
    percentage: pcts[i] || '',
  }));

  return { description, chipSizes, components };
}

async function scrapePage(product) {
  const url = `https://torginol.com/products/${product.slug}`;
  const resp = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
    timeout: 20000,
  });
  return extractPageData(resp.data, product);
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const products = IS_TEST ? PRODUCTS.slice(0, 3) : PRODUCTS;
  console.log(`Torginol recipe scraper — ${products.length} blends${IS_TEST ? ' (TEST MODE)' : ''}\n`);

  const recipeRows = [];
  const primitiveMap = new Map(); // code → name

  let success = 0;
  let noRecipe = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${products.length}] ${product.name.padEnd(16)} `);

    try {
      const { description, chipSizes, components } = await scrapePage(product);

      if (components.length === 0) {
        console.log('SKIP — no Made Up Of section found');
        // Write a placeholder row so this blend is still represented
        recipeRows.push({
          blend_name: product.name,
          blend_code: product.code,
          slug: product.slug,
          description,
          chip_sizes: chipSizes,
          component_code: '',
          component_name: '',
          percentage: '',
          notes: 'No Made Up Of section found on page',
        });
        noRecipe++;
      } else {
        const pctTotal = components.reduce((sum, c) => sum + (parseInt(c.percentage, 10) || 0), 0);
        const note = pctTotal !== 100 ? `percentages sum to ${pctTotal}` : '';

        for (const comp of components) {
          recipeRows.push({
            blend_name: product.name,
            blend_code: product.code,
            slug: product.slug,
            description,
            chip_sizes: chipSizes,
            component_code: comp.component_code,
            component_name: comp.component_name,
            percentage: comp.percentage,
            notes: note,
          });
          if (comp.component_code && !primitiveMap.has(comp.component_code)) {
            primitiveMap.set(comp.component_code, comp.component_name);
          }
        }

        console.log(`OK — ${components.length} components  [${components.map(c => `${c.component_name} ${c.percentage}%`).join(', ')}]`);
        success++;
      }
    } catch (err) {
      console.log(`FAIL — ${err.message}`);
      recipeRows.push({
        blend_name: product.name,
        blend_code: product.code,
        slug: product.slug,
        description: '',
        chip_sizes: '',
        component_code: '',
        component_name: '',
        percentage: '',
        notes: `Scrape error: ${err.message}`,
      });
      failed++;
    }

    if (i < products.length - 1) await sleep(DELAY_MS);
  }

  // Write blend_recipes_raw.csv
  const recipeHeader = 'blend_name,blend_code,slug,description,chip_sizes,component_code,component_name,percentage,notes';
  const recipeLines = [recipeHeader, ...recipeRows.map(r =>
    [r.blend_name, r.blend_code, r.slug, r.description, r.chip_sizes, r.component_code, r.component_name, r.percentage, r.notes]
      .map(csv).join(',')
  )];
  fs.writeFileSync(RECIPES_FILE, recipeLines.join('\r\n'), 'utf8');

  // Write primitive_colors_raw.csv
  const primHeader = 'component_code,component_name';
  const primLines = [primHeader, ...[...primitiveMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, name]) => `${csv(code)},${csv(name)}`)
  ];
  fs.writeFileSync(PRIMITIVES_FILE, primLines.join('\r\n'), 'utf8');

  console.log(`\n--- Done ---`);
  console.log(`${success} scraped successfully, ${noRecipe} missing recipe section, ${failed} errors`);
  console.log(`${primitiveMap.size} unique primitive chip colors found`);
  console.log(`\nOutput files:`);
  console.log(`  ${RECIPES_FILE}`);
  console.log(`  ${PRIMITIVES_FILE}`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
