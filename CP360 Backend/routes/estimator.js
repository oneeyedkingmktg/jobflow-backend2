// ============================================================================
// Estimator Routes
// File: routes/estimator.js
// Version: v1.7.15 - Added form button color settings
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

const { defaultEstimatorConfig } = require("../estimator/defaultEstimatorConfig");

function buildDefaultEstimatorConfig(companyId) {
  return defaultEstimatorConfig(companyId);
}


// ============================================================================
// GET /estimator/config
// ============================================================================

router.get("/config", async (req, res) => {
  try {
    // FIXED: Accept both 'company' and 'company_id' for backwards compatibility
    const rawCompany = req.query.company || req.query.company_id;

    if (!rawCompany) {
      return res.status(400).json({ error: "company parameter required" });
    }

    // Resolve estimator_code to numeric company_id if needed
    let companyId = rawCompany;
    if (isNaN(rawCompany)) {
      const codeResult = await query(
        `SELECT id FROM companies WHERE estimator_code = $1 AND deleted_at IS NULL LIMIT 1`,
        [rawCompany]
      );
      if (codeResult.rows.length === 0) {
        return res.status(404).json({ error: "Company not found" });
      }
      companyId = codeResult.rows[0].id;
    }

    console.log("Fetching estimator config for company:", companyId);

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
      console.log("No config found, creating default for company:", companyId);
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

console.log("Created default config:", created.rows[0]);

const trackingResult2 = await query(
        `SELECT google_base_tag, meta_base_tag, google_conversion_event, meta_conversion_event, microsoft_base_tag, microsoft_conversion_event, service_area_zips, plan_type
         FROM companies WHERE id = $1 LIMIT 1`,
        [companyId]
      );
      const tracking2 = trackingResult2.rows[0] || {};
      return res.json({ ...created.rows[0], ...tracking2 });
    }

console.log("Config found for company:", companyId);

    // Fetch tracking fields from companies table
const trackingResult = await query(
      `SELECT google_base_tag, meta_base_tag, google_conversion_event, meta_conversion_event, microsoft_base_tag, microsoft_conversion_event, service_area_zips, plan_type
       FROM companies WHERE id = $1 LIMIT 1`,
      [companyId]
    );
    const tracking = trackingResult.rows[0] || {};
    res.json({ ...result.rows[0], ...tracking });
  } catch (err) {
    console.error("Estimator config error:", err);
    res.status(500).json({ error: "Estimator config failed", details: err.message });
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
    console.log("Version: v1.7.15");
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

        min_price_solid,
        min_price_flake,
        min_price_metallic,
        min_price_custom,

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
        commercial_price_per_sf_min,
        commercial_price_per_sf_max,

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
        selected_button_color,
        selected_button_text_color,
        unselected_button_color,
        unselected_button_text_color,
        accent_color,
        muted_text_color,
        card_background_color,
        card_border_radius,
        card_shadow_strength,
        max_width,
        use_embedded_styles,

        price_box_border_color,
        pricing_info_box_background,
        pricing_info_box_stripe_color,
        
        custom_project_label,
        custom_finish_label, 
        disclaimer_text,
        min_job_info_text,
        standard_info_text,
        solid_finish_description,
        flake_finish_description,
        metallic_finish_description,
        custom_finish_description,

next_steps_button_text,

        allow_commercial,
        ty_url_redirect,
        
        cta1_button,
        cta1_link,
        cta2_button,
        cta2_link,
        combined_project_message,
        large_project_sf_threshold,
        large_project_note,
        out_of_area_enabled,
        out_of_area_large_job_threshold,
        out_of_area_sorry_message,
        out_of_area_large_job_message,
        out_of_area_price_disclaimer
      )
VALUES (
  $1,$2,
  $3,$4,$5,$6,$7,$8,$9,
  $10,$11,$12,$13,
  $14,$15,$16,
  $17,$18,$19,$20,
  $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
  $33,$34,
  $35,$36,$37,
  $38,$39,
  $40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,
  $58,$59,$60,
  $61,$62,$63,$64,$65,$66,$67,$68,$69,
  $70,$71,$72,
  $73,$74,$75,$76,$77,$78,$79,$80,$81,$82,$83,$84
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

        min_price_solid = COALESCE(EXCLUDED.min_price_solid, estimator_configs.min_price_solid),
        min_price_flake = COALESCE(EXCLUDED.min_price_flake, estimator_configs.min_price_flake),
        min_price_metallic = COALESCE(EXCLUDED.min_price_metallic, estimator_configs.min_price_metallic),
        min_price_custom = COALESCE(EXCLUDED.min_price_custom, estimator_configs.min_price_custom),

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
        commercial_price_per_sf_min = COALESCE(EXCLUDED.commercial_price_per_sf_min, estimator_configs.commercial_price_per_sf_min),
        commercial_price_per_sf_max = COALESCE(EXCLUDED.commercial_price_per_sf_max, estimator_configs.commercial_price_per_sf_max),

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
        selected_button_color = COALESCE(EXCLUDED.selected_button_color, estimator_configs.selected_button_color),
        selected_button_text_color = COALESCE(EXCLUDED.selected_button_text_color, estimator_configs.selected_button_text_color),
        unselected_button_color = COALESCE(EXCLUDED.unselected_button_color, estimator_configs.unselected_button_color),
        unselected_button_text_color = COALESCE(EXCLUDED.unselected_button_text_color, estimator_configs.unselected_button_text_color),
        accent_color = COALESCE(EXCLUDED.accent_color, estimator_configs.accent_color),
        muted_text_color = COALESCE(EXCLUDED.muted_text_color, estimator_configs.muted_text_color),
        card_background_color = COALESCE(EXCLUDED.card_background_color, estimator_configs.card_background_color),
        card_border_radius = COALESCE(EXCLUDED.card_border_radius, estimator_configs.card_border_radius),
        card_shadow_strength = COALESCE(EXCLUDED.card_shadow_strength, estimator_configs.card_shadow_strength),
        max_width = COALESCE(EXCLUDED.max_width, estimator_configs.max_width),
        use_embedded_styles = COALESCE(EXCLUDED.use_embedded_styles, estimator_configs.use_embedded_styles),

        price_box_border_color = COALESCE(EXCLUDED.price_box_border_color, estimator_configs.price_box_border_color),
        pricing_info_box_background = COALESCE(EXCLUDED.pricing_info_box_background, estimator_configs.pricing_info_box_background),
        pricing_info_box_stripe_color = COALESCE(EXCLUDED.pricing_info_box_stripe_color, estimator_configs.pricing_info_box_stripe_color),
        
        custom_project_label = COALESCE(EXCLUDED.custom_project_label, estimator_configs.custom_project_label),
        custom_finish_label = COALESCE(EXCLUDED.custom_finish_label, estimator_configs.custom_finish_label), 
        disclaimer_text = COALESCE(EXCLUDED.disclaimer_text, estimator_configs.disclaimer_text),
        min_job_info_text = COALESCE(EXCLUDED.min_job_info_text, estimator_configs.min_job_info_text),
        standard_info_text = COALESCE(EXCLUDED.standard_info_text, estimator_configs.standard_info_text),
        solid_finish_description = COALESCE(NULLIF(EXCLUDED.solid_finish_description, ''), estimator_configs.solid_finish_description),
        flake_finish_description = COALESCE(NULLIF(EXCLUDED.flake_finish_description, ''), estimator_configs.flake_finish_description),
        metallic_finish_description = COALESCE(NULLIF(EXCLUDED.metallic_finish_description, ''), estimator_configs.metallic_finish_description),
        custom_finish_description = COALESCE(NULLIF(EXCLUDED.custom_finish_description, ''), estimator_configs.custom_finish_description),
        next_steps_button_text = COALESCE(EXCLUDED.next_steps_button_text, estimator_configs.next_steps_button_text),
        allow_commercial = COALESCE(EXCLUDED.allow_commercial, estimator_configs.allow_commercial),
        ty_url_redirect = COALESCE(EXCLUDED.ty_url_redirect, estimator_configs.ty_url_redirect),
        
cta1_button = COALESCE(EXCLUDED.cta1_button, estimator_configs.cta1_button),
cta1_link = COALESCE(EXCLUDED.cta1_link, estimator_configs.cta1_link),
cta2_button = COALESCE(EXCLUDED.cta2_button, estimator_configs.cta2_button),
cta2_link = COALESCE(EXCLUDED.cta2_link, estimator_configs.cta2_link),
        combined_project_message = COALESCE(EXCLUDED.combined_project_message, estimator_configs.combined_project_message),
        large_project_sf_threshold = COALESCE(EXCLUDED.large_project_sf_threshold, estimator_configs.large_project_sf_threshold),
        large_project_note = COALESCE(EXCLUDED.large_project_note, estimator_configs.large_project_note),
        out_of_area_enabled = COALESCE(EXCLUDED.out_of_area_enabled, estimator_configs.out_of_area_enabled),
        out_of_area_large_job_threshold = COALESCE(EXCLUDED.out_of_area_large_job_threshold, estimator_configs.out_of_area_large_job_threshold),
        out_of_area_sorry_message = COALESCE(EXCLUDED.out_of_area_sorry_message, estimator_configs.out_of_area_sorry_message),
        out_of_area_large_job_message = COALESCE(EXCLUDED.out_of_area_large_job_message, estimator_configs.out_of_area_large_job_message),
        out_of_area_price_disclaimer = COALESCE(EXCLUDED.out_of_area_price_disclaimer, estimator_configs.out_of_area_price_disclaimer),
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
      b.min_price_solid,
      b.min_price_flake,
      b.min_price_metallic,
      b.min_price_custom,
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
      b.commercial_price_per_sf_min,
      b.commercial_price_per_sf_max,
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
      b.selected_button_color,
      b.selected_button_text_color,
      b.unselected_button_color,
      b.unselected_button_text_color,
      b.accent_color,
      b.muted_text_color,
      b.card_background_color,
      b.card_border_radius,
      b.card_shadow_strength,
      b.max_width,
      b.use_embedded_styles,
      b.price_box_border_color,
      b.pricing_info_box_background,
      b.pricing_info_box_stripe_color,
      b.custom_project_label,
      b.custom_finish_label,
      b.disclaimer_text,
      b.min_job_info_text,
      b.standard_info_text,
      b.solid_finish_description,
      b.flake_finish_description,
      b.metallic_finish_description,
      b.custom_finish_description,
      b.next_steps_button_text,
      b.allow_commercial,
      b.ty_url_redirect,
      b.cta1_button,
      b.cta1_link,
      b.cta2_button,
      b.cta2_link,
      b.combined_project_message,
      b.large_project_sf_threshold || null,
      b.large_project_note || null,
      b.out_of_area_enabled ?? null,
      b.out_of_area_large_job_threshold ? Number(b.out_of_area_large_job_threshold) : null,
      b.out_of_area_sorry_message || null,
      b.out_of_area_large_job_message || null,
      b.out_of_area_price_disclaimer || null,
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
    let companyId = req.body.company_id;

    if (companyId && isNaN(companyId)) {
      const codeResult = await query(
        `SELECT id FROM companies WHERE estimator_code = $1 AND deleted_at IS NULL LIMIT 1`,
        [companyId]
      );
      if (codeResult.rows.length === 0) {
        return res.status(404).json({ error: "Company not found" });
      }
      companyId = codeResult.rows[0].id;
    }

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
      // Auto-create default config if missing, then continue
      const defaults = buildDefaultEstimatorConfig(companyId);

      const columns = Object.keys(defaults);
      const values = Object.values(defaults);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

      await query(
        `
        INSERT INTO estimator_configs (${columns.join(", ")})
        VALUES (${placeholders})
        `,
        values
      );

      const createdConfig = await query(
        `
        SELECT *
        FROM estimator_configs
        WHERE company_id = $1
          AND is_active = true
        LIMIT 1
        `,
        [companyId]
      );

      configResult.rows = createdConfig.rows;
    }

const config = configResult.rows[0];
    
    // Fetch pricing configs for this company
    const projectType = req.body.project?.type;
    
    // Map project type to space type
    let spaceType = projectType;
    if (projectType && projectType.startsWith('garage_')) {
      spaceType = 'garage';
    }
    
    const pricingResult = await query(
      `SELECT space_type, finish_type, min_price_per_sf, max_price_per_sf, enabled
       FROM estimator_pricing_configs
       WHERE company_id = $1 AND space_type = $2 AND enabled = true
       ORDER BY finish_type`,
      [companyId, spaceType]
    );
    
    // Build pricing map by finish type
    const pricingByFinish = {};
    pricingResult.rows.forEach(row => {
      pricingByFinish[row.finish_type] = {
        min: row.min_price_per_sf,
        max: row.max_price_per_sf
      };
    });
    
    const estimate = calculateEstimate(config, req.body, pricingByFinish);

    // Fetch company phone number
const companyResult = await query(
  `SELECT phone FROM companies WHERE id = $1 LIMIT 1`,
  [companyId]
);

const companyPhone = companyResult.rows[0]?.phone || null;

    res.json({
      estimate,
      companyPhone,
      display: {
        font_family: config.font_family,
        base_font_size: config.base_font_size,
        text_color: config.text_color,
        accent_color: config.accent_color,
        muted_text_color: config.muted_text_color,

        primary_button_color: config.primary_button_color,
        primary_button_text_color: config.primary_button_text_color,
        primary_button_radius: config.primary_button_radius,
        primary_button_hover_color: config.primary_button_hover_color,

        card_background_color: config.card_background_color,
        card_border_radius: config.card_border_radius,
        card_shadow_strength: config.card_shadow_strength,

        max_width: config.max_width,
      }
    });

  } catch (err) {
    console.error("Estimator preview error:", err);
    res.status(500).json({ error: "Estimator preview failed" });
  }
});

// ============================================================================
// POST /estimator/out-of-area-log  (public — called from estimator widget)
// ============================================================================
router.post("/out-of-area-log", async (req, res) => {
  try {
    const { company_id, homeowner_name, zip_code, estimated_value, status } = req.body;
    if (!company_id) return res.status(400).json({ error: "company_id required" });

    let companyId = company_id;
    if (isNaN(companyId)) {
      const r = await query(
        `SELECT id FROM companies WHERE estimator_code = $1 AND deleted_at IS NULL LIMIT 1`,
        [companyId]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Company not found" });
      companyId = r.rows[0].id;
    }

    await query(
      `INSERT INTO out_of_area_logs (company_id, homeowner_name, zip_code, estimated_value, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [companyId, homeowner_name || null, zip_code || null, estimated_value || null, status || null]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Out-of-area log error:", err);
    res.status(500).json({ error: "Failed to log out-of-area attempt" });
  }
});

// ============================================================================
// GET /estimator/out-of-area-log/:companyId  (master admin)
// ============================================================================
router.get("/out-of-area-log/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    const result = await query(
      `SELECT l.id, l.created_at, l.homeowner_name, l.zip_code, l.estimated_value, l.status,
              c.name AS company_name
       FROM out_of_area_logs l
       LEFT JOIN companies c ON c.id = l.company_id
       WHERE l.company_id = $1
       ORDER BY l.created_at DESC
       LIMIT 200`,
      [companyId]
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error("Out-of-area log fetch error:", err);
    res.status(500).json({ error: "Failed to fetch out-of-area logs" });
  }
});

module.exports = router;