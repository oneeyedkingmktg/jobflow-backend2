// Loads Torginol primitive color hex codes and blend recipes from CSV files.
// Both files are tiny — loaded once at startup, kept in memory.

const fs   = require('fs');
const path = require('path');

const COLORS_CSV  = path.join(__dirname, '../scripts/data/torgcolors.csv');
const RECIPES_CSV = path.join(__dirname, '../scripts/data/blend_recipes_raw.csv');

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  fields.push(current.trim());
  return fields;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// productCode (F-code) → { hex, rgb }
const colorMap = new Map();

// blendName (lowercase) → [{ rgb, weight }]
const recipeMap = new Map();

function load() {
  // --- primitive colors ---
  const colorLines = fs.readFileSync(COLORS_CSV, 'utf8').trim().split('\n');
  for (let i = 1; i < colorLines.length; i++) {
    const f = parseCSVLine(colorLines[i]);
    if (f.length < 3) continue;
    const [name, code, hex] = f;
    colorMap.set(code.trim(), { hex: hex.trim(), rgb: hexToRgb(hex.trim()), name: name.trim() });
  }

  // --- blend recipes (tidy: one row per component) ---
  const recipeLines = fs.readFileSync(RECIPES_CSV, 'utf8').trim().split('\n');
  // columns: blend_name(0), blend_code(1), slug(2), description(3), chip_sizes(4),
  //          component_code(5), component_name(6), percentage(7), notes(8)
  for (let i = 1; i < recipeLines.length; i++) {
    const f = parseCSVLine(recipeLines[i]);
    if (f.length < 8) continue;
    const blendName     = f[0].replace(/^"|"$/g, '').trim().toLowerCase();
    const componentCode = f[5].replace(/^"|"$/g, '').trim();
    const pct           = parseFloat(f[7].replace(/^"|"$/g, '')) || 0;
    if (!blendName || !componentCode || pct <= 0) continue;

    if (!recipeMap.has(blendName)) recipeMap.set(blendName, []);
    const color = colorMap.get(componentCode);
    if (color) {
      recipeMap.get(blendName).push({ hex: color.hex, name: color.name, rgb: color.rgb, weight: pct / 100 });
    }
  }
}

load();

// Returns [{ rgb, weight }] for the closest-matching blend name, or null.
function getRecipe(chipColorName) {
  if (!chipColorName) return null;
  const key = chipColorName.toLowerCase().trim();

  // Exact match first
  if (recipeMap.has(key)) return recipeMap.get(key);

  // Partial match — blend name contained in chip name or vice versa
  for (const [blendKey, recipe] of recipeMap) {
    if (key.includes(blendKey) || blendKey.includes(key)) return recipe;
  }

  // Single primitive color match
  for (const [code, color] of colorMap) {
    if (color.name.toLowerCase() === key) {
      return [{ hex: color.hex, name: color.name, code, rgb: color.rgb, weight: 1 }];
    }
  }

  return null;
}

function getAllPrimitives() {
  return Array.from(colorMap.entries()).map(([code, { hex, name }]) => ({ code, name, hex }));
}

module.exports = { getRecipe, getAllPrimitives, hexToRgb, colorMap, recipeMap };
