// ============================================================================
// Estimator Routes
// File: routes/estimator.js
// Version: v1.7.13 - Auto-create seeded config on GET when missing
// ============================================================================

const express = require("express");
const router = express.Router();

const { query } = require("../config/database");
const { calculateEstimate } = require("../estimator/calculateEstimate");

// ============================================================================
// DEFAULT ESTIMATOR CONFIG (seed new rows with current live behavior)
// NOTE: These are SAFE starter defaults so new companies don't begin with NULLs.
//       We can refine these later once we align to the new estimator page design.
// ============================================================================

function buildDefaultEstimatorConfig(companyId) {
  return {
    company_id: companyId,
    is_active: true,

    allow_garage_1: true,
    allow_garage_2: true,
    allow_garage_3: false,
    allow_garage_4: false,
    allow_patio: false,
    allow_basement: false,
    allow_custom: false,

    // Typical “current live” starting points; adjust later if your current UI differs
    avg_sf_1_car: 250,
    avg_sf_2_car: 400,
    avg_sf_3_car: 600,
    avg_sf_4_car: 800,

    offers_solid: true,
    offers_flake: true,
    offers_metallic: false,

    minimum_job_price: null,

    solid_price_per_sf_min: null,
    solid_price_per_sf_max: null,
    flake_price_per_sf_min: null,
    flake_price_per_sf_max: null,
    metallic_price_per_sf_min: null,
    metallic_price_per_sf_max: null,
    patio_price_per_sf_min: null,
    patio_price_per_sf_max: null,
    basement_price_per_sf_min: null,
    basement_price_per_sf_max: null,
    custom_price_per_sf_min: null,
    custom_price_per_sf_max: null,

    condition_good_multiplier: 1.0,
    condition_minor_multiplier: null,
    condition_major_multiplier: null,

    existing_coating_multiplier: null,
    existing_coating_flat_fee: null,

    font_family: "inherit",
    base_font_size: null,
    text_color: null,
    primary_button_color: null,
    primary_button_text_color: null,
    primary_button_radius: null,
    primary_button_hover_color: null,
    accent_color: null,
    muted_text_color: null,
    card_background_color: null,
    card_border_radius: null,
    card_shadow_strength: null,
    max_width: null,
    use_embedded_styles: true,

    disclaimer_text: null,
    min_job_info_text: null,
    standard_info_text: null,

    allow_commercial: false,
    ty_url_redirect: null,
  };
}

// ============================================================================
// GET /estimator/config
// ============================================================================

router.get("/config", async (req, res) => {
  try {
    const companyId = req.query.company_id;

    if (!companyId) {
      return res.status(400).json({ error: "company_id required" });
    }

    const result = await query(
      `
      SELECT *
      FROM estimator_configs
      WHERE company_id = $1
      LIMIT 1
      `,
      [companyId]
    );

    // ----------------------------------------------------------------------
    // AUTO-CREATE SEEDED ROW IF MISSING (so new companies start with defaults)
    // ----------------------------------------------------------------------
    if (result.rows.length === 0) {
      const d = buildDefaultEstimatorConfig(companyId);

      const columns = Object.keys(d);
      const values = Object.values(d);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

      await query(
        `
        INSERT INTO estimator_configs (${columns.join(", ")})
        VALUES (${placeholders})
        `,
        values
      );

      const created = await query(
        `
        SELECT *
        FROM estimator_configs
        WHERE company_id = $1
        LIMIT 1
        `,
        [companyId]
      );

      return res.json(created.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Estimator config error:", err);
    res.status(500).json({ error: "Estimator config failed" });
  }
});

// ============================================================================
// PUT /estimator/config  (UPSERT)
// ============================================================================

router.put("/config", async (req, res) => {
  try {
    // ----------------------------------------------------------------------
    // SAFETY: strip undefined keys so "missing" fields don't become NULL writes
    // ----------------------------------------------------------------------
    const b = {};
    Object.keys(req.body || {}).forEach((k) => {
      if (req.body[k] !== undefined) b[k] = req.body[k];
    });

    if (!b.company_id) {
      return res.status(400).json({ error: "company_id required" });
    }

    console.log("=== ESTIMATOR CONFIG SAVE ===");
    console.log("Version: v1.7.12");
    console.log("Payload keys:", Object.keys(b));

    // ----------------------------------------------------------------------
    // ENSURE ROW EXISTS (new companies may not have one yet)
    // ----------------------------------------------------------------------
    await query(
      `
      INSERT INTO estimator_configs (company_id)
      VALUES ($1)
      ON CONFLICT (company_id) DO NOTHING
      `,
      [b.company_id]
    );

    const sql = `
      INSERT INTO estimator_configs (
        company_id,
        is_active,

        allow_garage_1,
        allow_garage_2,
        allow_garage_3,
        allow_garage_4,
        allow_patio,
        allow_basement,
        allow_custom,

        avg_sf_1_car,
        avg_sf_2_car,
        avg_sf_3_car,
        avg_sf_4_car,

        offers_solid,
        offers_flake,
        offers_metallic,

        minimum_job_price,

        solid_price_per_sf_min,
        solid_price_per_sf_max,
        flake_price_per_sf_min,
        flake_price_per_sf_max,
        metallic_price_per_sf_min,
        metallic_price_per_sf_max,
        patio_price_per_sf_min,
        patio_price_per_sf_max,
        basement_price_per_sf_min,
        basement_price_per_sf_max,
        custom_price_per_sf_min,
        custom_price_per_sf_max,

        condition_good_multiplier,
        condition_minor_multiplier,
        condition_major_multiplier,

        existing_coating_multiplier,
        existing_coating_flat_fee,

        font_family,
        base_font_size,
        text_color,
        primary_button_color,
        primary_button_text_color,
        primary_button_radius,
        primary_button_hover_color,
        accent_color,
        muted_text_color,
        card_background_color,
        card_border_radius,
        card_shadow_strength,
        max_width,
        use_embedded_styles,

        disclaimer_text,
        min_job_info_text,
        standard_info_text,

        allow_commercial,
        ty_url_redirect
      )
      VALUES (
        $1,$2,
        $3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,
        $14,$15,$16,
        $17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,
        $30,$31,$32,
        $33,$34,
        $35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,
        $49,$50,$51,
        $52,$53
      )
      ON CONFLICT (company_id) DO UPDATE SET
        is_active = COALESCE(EXCLUDED.is_active, estimator_configs.is_active),

        allow_garage_1 = COALESCE(EXCLUDED.allow_garage_1, estimator_configs.allow_garage_1),
        allow_garage_2 = COALESCE(EXCLUDED.allow_garage_2, estimator_configs.allow_garage_2),
        allow_garage_3 = COALESCE(EXCLUDED.allow_garage_3, estimator_configs.allow_garage_3),
        allow_garage_4 = COALESCE(EXCLUDED.allow_garage_4, estimator_configs.allow_garage_4),
        allow_patio = COALESCE(EXCLUDED.allow_patio, estimator_configs.allow_patio),
        allow_basement = COALESCE(EXCLUDED.allow_basement, estimator_configs.allow_basement),
        allow_custom = COALESCE(EXCLUDED.allow_custom, estimator_configs.allow_custom),

        avg_sf_1_car = COALESCE(EXCLUDED.avg_sf_1_car, estimator_configs.avg_sf_1_car),
        avg_sf_2_car = COALESCE(EXCLUDED.avg_sf_2_car, estimator_configs.avg_sf_2_car),
        avg_sf_3_car = COALESCE(EXCLUDED.avg_sf_3_car, estimator_configs.avg_sf_3_car),
        avg_sf_4_car = COALESCE(EXCLUDED.avg_sf_4_car, estimator_configs.avg_sf_4_car),

        offers_solid = COALESCE(EXCLUDED.offers_solid, estimator_configs.offers_solid),
        offers_flake = COALESCE(EXCLUDED.offers_flake, estimator_configs.offers_flake),
        offers_metallic = COALESCE(EXCLUDED.offers_metallic, estimator_configs.offers_metallic),

        minimum_job_price = COALESCE(EXCLUDED.minimum_job_price, estimator_configs.minimum_job_price),

        solid_price_per_sf_min = COALESCE(EXCLUDED.solid_price_per_sf_min, estimator_configs.solid_price_per_sf_min),
        solid_price_per_sf_max = COALESCE(EXCLUDED.solid_price_per_sf_max, estimator_configs.solid_price_per_sf_max),
        flake_price_per_sf_min = COALESCE(EXCLUDED.flake_price_per_sf_min, estimator_configs.flake_price_per_sf_min),
        flake_price_per_sf_max = COALESCE(EXCLUDED.flake_price_per_sf_max, estimator_configs.flake_price_per_sf_max),
        metallic_price_per_sf_min = COALESCE(EXCLUDED.metallic_price_per_sf_min, estimator_configs.metallic_price_per_sf_min),
        metallic_price_per_sf_max = COALESCE(EXCLUDED.metallic_price_per_sf_max, estimator_configs.metallic_price_per_sf_max),
        patio_price_per_sf_min = COALESCE(EXCLUDED.patio_price_per_sf_min, estimator_configs.patio_price_per_sf_min),
        patio_price_per_sf_max = COALESCE(EXCLUDED.patio_price_per_sf_max, estimator_configs.patio_price_per_sf_max),
        basement_price_per_sf_min = COALESCE(EXCLUDED.basement_price_per_sf_min, estimator_configs.basement_price_per_sf_min),
        basement_price_per_sf_max = COALESCE(EXCLUDED.basement_price_per_sf_max, estimator_configs.basement_price_per_sf_max),
        custom_price_per_sf_min = COALESCE(EXCLUDED.custom_price_per_sf_min, estimator_configs.custom_price_per_sf_min),
        custom_price_per_sf_max = COALESCE(EXCLUDED.custom_price_per_sf_max, estimator_configs.custom_price_per_sf_max),

        condition_good_multiplier = COALESCE(EXCLUDED.condition_good_multiplier, estimator_configs.condition_good_multiplier),
        condition_minor_multiplier = COALESCE(EXCLUDED.condition_minor_multiplier, estimator_configs.condition_minor_multiplier),
        condition_major_multiplier = COALESCE(EXCLUDED.condition_major_multiplier, estimator_configs.condition_major_multiplier),

        existing_coating_multiplier = COALESCE(EXCLUDED.existing_coating_multiplier, estimator_configs.existing_coating_multiplier),
        existing_coating_flat_fee = COALESCE(EXCLUDED.existing_coating_flat_fee, estimator_configs.existing_coating_flat_fee),

        font_family = COALESCE(EXCLUDED.font_family, estimator_configs.font_family),
        base_font_size = COALESCE(EXCLUDED.base_font_size, estimator_configs.base_font_size),
        text_color = COALESCE(EXCLUDED.text_color, estimator_configs.text_color),
        primary_button_color = COALESCE(EXCLUDED.primary_button_color, estimator_configs.primary_button_color),
        primary_button_text_color = COALESCE(EXCLUDED.primary_button_text_color, estimator_configs.primary_button_text_color),
        primary_button_radius = COALESCE(EXCLUDED.primary_button_radius, estimator_configs.primary_button_radius),
        primary_button_hover_color = COALESCE(EXCLUDED.primary_button_hover_color, estimator_configs.primary_button_hover_color),
        accent_color = COALESCE(EXCLUDED.accent_color, estimator_configs.accent_color),
        muted_text_color = COALESCE(EXCLUDED.muted_text_color, estimator_configs.muted_text_color),
        card_background_color = COALESCE(EXCLUDED.card_background_color, estimator_configs.card_background_color),
        card_border_radius = COALESCE(EXCLUDED.card_border_radius, estimator_configs.card_border_radius),
        card_shadow_strength = COALESCE(EXCLUDED.card_shadow_strength, estimator_configs.card_shadow_strength),
        max_width = COALESCE(EXCLUDED.max_width, estimator_configs.max_width),
        use_embedded_styles = COALESCE(EXCLUDED.use_embedded_styles, estimator_configs.use_embedded_styles),

        disclaimer_text = COALESCE(EXCLUDED.disclaimer_text, estimator_configs.disclaimer_text),
        min_job_info_text = COALESCE(EXCLUDED.min_job_info_text, estimator_configs.min_job_info_text),
        standard_info_text = COALESCE(EXCLUDED.standard_info_text, estimator_configs.standard_info_text),

        allow_commercial = COALESCE(EXCLUDED.allow_commercial, estimator_configs.allow_commercial),
        ty_url_redirect = COALESCE(EXCLUDED.ty_url_redirect, estimator_configs.ty_url_redirect),

        updated_at = now()
    `;

    const values = [
      b.company_id,
      b.is_active,
      b.allow_garage_1,
      b.allow_garage_2,
      b.allow_garage_3,
      b.allow_garage_4,
      b.allow_patio,
      b.allow_basement,
      b.allow_custom,
      b.avg_sf_1_car,
      b.avg_sf_2_car,
      b.avg_sf_3_car,
      b.avg_sf_4_car,
      b.offers_solid,
      b.offers_flake,
      b.offers_metallic,
      b.minimum_job_price,
      b.solid_price_per_sf_min,
      b.solid_price_per_sf_max,
      b.flake_price_per_sf_min,
      b.flake_price_per_sf_max,
      b.metallic_price_per_sf_min,
      b.metallic_price_per_sf_max,
      b.patio_price_per_sf_min,
      b.patio_price_per_sf_max,
      b.basement_price_per_sf_min,
      b.basement_price_per_sf_max,
      b.custom_price_per_sf_min,
      b.custom_price_per_sf_max,
      b.condition_good_multiplier,
      b.condition_minor_multiplier,
      b.condition_major_multiplier,
      b.existing_coating_multiplier,
      b.existing_coating_flat_fee,
      b.font_family,
      b.base_font_size,
      b.text_color,
      b.primary_button_color,
      b.primary_button_text_color,
      b.primary_button_radius,
      b.primary_button_hover_color,
      b.accent_color,
      b.muted_text_color,
      b.card_background_color,
      b.card_border_radius,
      b.card_shadow_strength,
      b.max_width,
      b.use_embedded_styles,
      b.disclaimer_text,
      b.min_job_info_text,
      b.standard_info_text,
      b.allow_commercial,
      b.ty_url_redirect,
    ];

    console.log("SQL placeholders:", (sql.match(/\$/g) || []).length);
    console.log("Values length:", values.length);

    await query(sql, values);

    res.json({ success: true });
  } catch (err) {
    console.error("Save estimator config error:", err);
    res.status(500).json({ error: "Failed to save estimator config" });
  }
});

// ============================================================================
// POST /estimator/preview
// ============================================================================

router.post("/preview", async (req, res) => {
  try {
    const companyId = req.body.company_id;

    const configResult = await query(
      `
      SELECT *
      FROM estimator_configs
      WHERE company_id = $1
        AND is_active = true
      LIMIT 1
      `,
      [companyId]
    );

    if (configResult.rows.length === 0) {
      return res.status(400).json({ error: "NO_ACTIVE_ESTIMATOR_CONFIG" });
    }

    const estimate = calculateEstimate(configResult.rows[0], req.body);
    res.json(estimate);
  } catch (err) {
    console.error("Estimator preview error:", err);
    res.status(500).json({ error: "Estimator preview failed" });
  }
});

module.exports = router;
