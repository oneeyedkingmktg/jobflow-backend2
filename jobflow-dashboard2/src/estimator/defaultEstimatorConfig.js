// ============================================================================
// Estimator Default Config
// File: estimator/defaultEstimatorConfig.js
// Version: v1.0.0 – Canonical seeded defaults for new companies
// ============================================================================
//
// Purpose:
// - When a new contractor/company needs an estimator_configs row, we seed it
//   with explicit values (no guessing, no UI fallback).
// - Any numeric field that is not explicitly set should be 0,
//   except multipliers where 1 is the neutral default.
//
// Notes:
// - existing_coating_flat_fee is treated as ADDED $/SF (not a flat $ amount).
// - Pricing fields default to 0 to avoid fallback pricing.
// - card_shadow_strength is intentionally omitted (ambiguous / unused).
//

function defaultEstimatorConfig(companyId) {
  return {
    // ------------------------------------------------------------------------
    // Identity / status
    // ------------------------------------------------------------------------
    company_id: companyId,
    is_active: true,

    // ------------------------------------------------------------------------
    // Allowed project types (visibility)
    // ------------------------------------------------------------------------
    allow_garage_1: true,
    allow_garage_2: true,
    allow_garage_3: false,
    allow_garage_4: false,
    allow_patio: false,
    allow_basement: false,
    allow_custom: false,
    allow_commercial: false,

    // ------------------------------------------------------------------------
    // Average SF for garage types (used for calculations when garage_* selected)
    // Explicit, no UI fallback. Use 0 if unknown.
    // ------------------------------------------------------------------------
    avg_sf_1_car: 0,
    avg_sf_2_car: 0,
    avg_sf_3_car: 0,
    avg_sf_4_car: 0,

    // ------------------------------------------------------------------------
    // Offered finishes (tabs)
    // ------------------------------------------------------------------------
    offers_solid: true,
    offers_flake: true,
    offers_metallic: false,

    // ------------------------------------------------------------------------
    // Minimum job pricing (0 means disabled unless your calculator treats 0 as a floor)
    // ------------------------------------------------------------------------
    minimum_job_price: 0,

    // ------------------------------------------------------------------------
    // Price per SF ranges (NO fallback pricing; 0 means not set)
    // ------------------------------------------------------------------------
    solid_price_per_sf_min: 0,
    solid_price_per_sf_max: 0,

    flake_price_per_sf_min: 0,
    flake_price_per_sf_max: 0,

    metallic_price_per_sf_min: 0,
    metallic_price_per_sf_max: 0,

    patio_price_per_sf_min: 0,
    patio_price_per_sf_max: 0,

    basement_price_per_sf_min: 0,
    basement_price_per_sf_max: 0,

    custom_price_per_sf_min: 0,
    custom_price_per_sf_max: 0,

    // ------------------------------------------------------------------------
    // Condition multipliers
    // Neutral multiplier is 1.0 (not 0) so math stays neutral by default.
    // ------------------------------------------------------------------------
    condition_good_multiplier: 1.0,
    condition_minor_multiplier: 1.0,
    condition_major_multiplier: 1.0,

    // ------------------------------------------------------------------------
    // Existing coating adjustments
    // - multiplier applied first
    // - then add $/SF (existing_coating_flat_fee is actually ADDED $/SF)
    // ------------------------------------------------------------------------
    existing_coating_multiplier: 1.0,
    existing_coating_flat_fee: 0,

    // ------------------------------------------------------------------------
    // Custom labels (DB-driven display text)
    // ------------------------------------------------------------------------
    custom_project_label: "Other Project",

    condition_good_label: "Good",
    condition_minor_label: "A Few Cracks",
    condition_major_label: "A Lot of Cracks",

    // ------------------------------------------------------------------------
    // Visual styling (DB is source of truth; use explicit values)
    // If you want “inherit” behavior, keep text fields as "inherit" or "" intentionally.
    // ------------------------------------------------------------------------
    font_family: "inherit",
    base_font_size: 0,
    text_color: "",
    primary_button_color: "",
    primary_button_text_color: "",
    primary_button_radius: 0,
    primary_button_hover_color: "",
    accent_color: "",
    muted_text_color: "",
    card_background_color: "",
    card_border_radius: 0,
    max_width: 0,
    use_embedded_styles: true,

    // ------------------------------------------------------------------------
    // Messaging / disclaimer
    // ------------------------------------------------------------------------
    disclaimer_text: "",
    min_job_info_text: "",
    standard_info_text: "",

    // ------------------------------------------------------------------------
    // Redirect
    // ------------------------------------------------------------------------
    ty_url_redirect: "",
  };
}

module.exports = { defaultEstimatorConfig };
