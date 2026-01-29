// ============================================================================
// One-Time Script: Update Existing Estimator Configs
// File: scripts/updateEstimatorConfigs.js
// Version: v1.0.3 - Clear require cache
// ============================================================================

require('dotenv').config();

// Clear the require cache to ensure fresh config
delete require.cache[require.resolve("../estimator/defaultEstimatorConfig")];

const { query } = require("../config/database");
const { defaultEstimatorConfig } = require("../estimator/defaultEstimatorConfig");

async function updateEstimatorConfigs() {
  console.log("=== Updating Estimator Configs for Companies 1-4 ===");
  console.log("Database URL:", process.env.DATABASE_URL ? "✓ Loaded" : "✗ Missing");
  console.log("");

  // Step 1: Fix constraint violations first
  console.log("Step 1: Fixing constraint violations...\n");
  
  try {
    // Fix card_shadow_strength - change "md" to "medium"
    const fixResult = await query(
      `UPDATE estimator_configs 
       SET card_shadow_strength = 'medium' 
       WHERE card_shadow_strength NOT IN ('none', 'light', 'medium', 'heavy')`
    );
    console.log(`✓ Fixed ${fixResult.rowCount} rows with invalid card_shadow_strength\n`);
  } catch (err) {
    console.error("✗ Error fixing constraints:", err.message);
  }

  // Step 2: Update companies with defaults
  console.log("Step 2: Updating with default values...\n");
  
  const companyIds = [1, 2, 3, 4];

  for (const companyId of companyIds) {
    try {
      console.log(`Processing Company ${companyId}...`);

      const current = await query(
        "SELECT * FROM estimator_configs WHERE company_id = $1",
        [companyId]
      );

      if (current.rows.length === 0) {
        console.log(`  No config exists, creating new one...`);
        
        const defaults = defaultEstimatorConfig(companyId);
        
        // DEBUG
        console.log(`  DEBUG: card_shadow_strength =`, defaults.card_shadow_strength);
        
        const columns = Object.keys(defaults);
        const values = Object.values(defaults);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

        await query(
          `INSERT INTO estimator_configs (${columns.join(", ")})
           VALUES (${placeholders})`,
          values
        );

        console.log(`  ✓ Created new config for company ${companyId}\n`);
      } else {
        console.log(`  Config exists, updating with defaults...`);
        
        const defaults = defaultEstimatorConfig(companyId);
        
        // DEBUG
        console.log(`  DEBUG: card_shadow_strength from function =`, defaults.card_shadow_strength);
        
        const currentRow = current.rows[0];

        const updates = [];
        const updateValues = [];
        let paramIndex = 1;

        // Fields to skip - they either have valid values or have constraints
        const skipFields = ['company_id', 'id', 'created_at', 'updated_at'];

        for (const [key, defaultValue] of Object.entries(defaults)) {
          if (skipFields.includes(key)) continue;
          
          const currentValue = currentRow[key];
          
          // Special handling for card_shadow_strength - skip if it has any value
          if (key === 'card_shadow_strength' && currentValue) continue;
          
          // Update if current value is null, empty string, or 0 (except multipliers)
          const shouldUpdate = 
            currentValue === null ||
            currentValue === '' ||
            (typeof currentValue === 'number' && currentValue === 0 && !key.includes('multiplier'));

          if (shouldUpdate) {
            updates.push(`${key} = $${paramIndex}`);
            updateValues.push(defaultValue);
            paramIndex++;
            console.log(`    - Updating ${key}: ${currentValue} → ${defaultValue}`);
          }
        }

        if (updates.length > 0) {
          updateValues.push(companyId);
          
          await query(
            `UPDATE estimator_configs 
             SET ${updates.join(", ")}, updated_at = now()
             WHERE company_id = $${paramIndex}`,
            updateValues
          );

          console.log(`  ✓ Updated ${updates.length} fields for company ${companyId}\n`);
        } else {
          console.log(`  ℹ No fields needed updating for company ${companyId}\n`);
        }
      }
    } catch (err) {
      console.error(`  ✗ Error processing company ${companyId}:`, err.message);
      console.error(`     Full error:`, err);
    }
  }

  console.log("=== Update Complete ===");
  process.exit(0);
}

updateEstimatorConfigs().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});