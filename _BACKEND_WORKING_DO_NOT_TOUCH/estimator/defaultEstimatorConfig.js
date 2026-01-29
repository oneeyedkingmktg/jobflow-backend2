// ============================================================================
// Default Estimator Config
// File: estimator/defaultEstimatorConfig.js
// Version: v2.2.0 - Added form button color settings
// Purpose: Seed new estimator configs with CURRENT live estimator behavior
// ============================================================================

function defaultEstimatorConfig(companyId) {
  return {
    company_id: companyId,
    is_active: true,

    // ------------------------------------------------------------------------
    // Project types enabled (match current UI)
    // ------------------------------------------------------------------------
    allow_garage_1: true,
    allow_garage_2: true,
    allow_garage_3: false,
    allow_garage_4: false,
    allow_patio: true,
    allow_basement: true,
    allow_custom: false,
    allow_commercial: true,

    // ------------------------------------------------------------------------
    // Average square footage (current estimator assumptions)
    // ------------------------------------------------------------------------
    avg_sf_1_car: 250,
    avg_sf_2_car: 400,
    avg_sf_3_car: 600,
    avg_sf_4_car: 800,

    // ------------------------------------------------------------------------
    // Flooring types offered
    // ------------------------------------------------------------------------
    offers_solid: true,
    offers_flake: true,
    offers_metallic: true,

    // ------------------------------------------------------------------------
    // Pricing (NO fallbacks — 0 means intentionally unset)
    // ------------------------------------------------------------------------
    minimum_job_price: 0,

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
    commercial_price_per_sf_min: 0,
    commercial_price_per_sf_max: 0,

    // ------------------------------------------------------------------------
    // Condition multipliers (buttons map directly)
    // ------------------------------------------------------------------------
    condition_good_multiplier: 1,
    condition_minor_multiplier: 1.15,
    condition_major_multiplier: 1.3,

    // ------------------------------------------------------------------------
    // Existing coating logic (multiplier FIRST, then $/sf)
    // ------------------------------------------------------------------------
    existing_coating_multiplier: 1,
    existing_coating_flat_fee: 0, // interpreted as $ per square foot

    // ------------------------------------------------------------------------
    // Visual / layout defaults (match current look & feel)
    // ------------------------------------------------------------------------
    font_family: "inherit",
    base_font_size: 16,
    text_color: "#111827",
    primary_button_color: "#f97316",
    primary_button_text_color: "#ffffff",
    primary_button_radius: 12,
    primary_button_hover_color: "#ea580c",
    selected_button_color: "#f97316",           // orange-500 (matches current selected state)
    selected_button_text_color: "#ffffff",      // white
    unselected_button_color: "#ffffff",         // white background
    unselected_button_text_color: "#4b5563",    // gray-600
    accent_color: "#f97316",
    muted_text_color: "#6b7280",
    card_background_color: "#ffffff",
    card_border_radius: 16,
    card_shadow_strength: "md",
    max_width: 768,
    use_embedded_styles: true,

    // ------------------------------------------------------------------------
    // Results Page Styling
    // ------------------------------------------------------------------------
    price_box_border_color: "#fdba74",        // orange-300
    pricing_info_box_background: "#fefce8",   // yellow-50
    pricing_info_box_stripe_color: "#fb923c", // orange-400

    // ------------------------------------------------------------------------
    // Messaging
    // ------------------------------------------------------------------------
    custom_project_label: "Other Project",
    disclaimer_text: "",
    min_job_info_text: "Minimum job pricing applied.",
    standard_info_text: "This is an estimate based on the information provided.",
    next_steps_button_text: "Request an In-Person Estimate",

    // ------------------------------------------------------------------------
    // Post-submit behavior
    // ------------------------------------------------------------------------
    ty_url_redirect: null,
  };
}

module.exports = { defaultEstimatorConfig };