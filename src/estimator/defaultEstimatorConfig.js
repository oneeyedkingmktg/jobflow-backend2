// ============================================================================
// Estimator Default Config
// File: estimator/defaultEstimatorConfig.js
// Version: v1.2.0 – Added results + coating button styling fields
// ============================================================================

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
    allow_garage_3: true,
    allow_garage_4: true,
    allow_patio: true,
    allow_basement: true,
    allow_custom: false,
    allow_commercial: false,

    // ------------------------------------------------------------------------
    // Average SF for garage types
    // ------------------------------------------------------------------------
    avg_sf_1_car: 250,
    avg_sf_2_car: 450,
    avg_sf_3_car: 650,
    avg_sf_4_car: 850,

    // ------------------------------------------------------------------------
    // Offered finishes (tabs)
    // ------------------------------------------------------------------------
    offers_solid: true,
    offers_flake: true,
    offers_metallic: true,

    // ------------------------------------------------------------------------
    // Minimum job pricing
    // ------------------------------------------------------------------------
    minimum_job_price: 1500,

// ------------------------------------------------------------------------
// Price per SF ranges
// ------------------------------------------------------------------------
solid_price_per_sf_min: 5.0,
solid_price_per_sf_max: 8.0,

flake_price_per_sf_min: 7.0,
flake_price_per_sf_max: 10.0,

metallic_price_per_sf_min: 10.0,
metallic_price_per_sf_max: 15.0,

patio_price_per_sf_min: 8.0,
patio_price_per_sf_max: 12.0,

basement_price_per_sf_min: 6.0,
basement_price_per_sf_max: 9.0,

custom_price_per_sf_min: 7.0,
custom_price_per_sf_max: 11.0,

commercial_price_per_sf_min: 4.5,
commercial_price_per_sf_max: 7.0,


    // ------------------------------------------------------------------------
    // Condition multipliers
    // ------------------------------------------------------------------------
    condition_good_multiplier: 1.0,
    condition_minor_multiplier: 1.15,
    condition_major_multiplier: 1.3,

    // ------------------------------------------------------------------------
    // Existing coating adjustments
    // ------------------------------------------------------------------------
    existing_coating_multiplier: 1.25,
    existing_coating_flat_fee: 2.0,

    // ------------------------------------------------------------------------
    // Custom labels
    // ------------------------------------------------------------------------
    custom_project_label: "Other Project",

    condition_good_label: "Good",
    condition_minor_label: "A Few Cracks",
    condition_major_label: "A Lot of Cracks",

    // ------------------------------------------------------------------------
    // Visual styling – base
    // ------------------------------------------------------------------------
    font_family:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    base_font_size: 16,
    text_color: "#1f2937",

    primary_button_color: "#f97316",
    primary_button_text_color: "#ffffff",
    primary_button_hover_color: "#ea580c",
    primary_button_radius: 8,

    accent_color: "#f97316",
    muted_text_color: "#6b7280",

    card_background_color: "#ffffff",
    card_border_radius: 12,
    card_shadow_strength: "medium",

    max_width: 768,
    use_embedded_styles: false,

    // ------------------------------------------------------------------------
    // Results page styling
    // ------------------------------------------------------------------------
    price_box_border_color: "#e5e7eb",

    pricing_info_box_background_color: "#f8fafc",
    pricing_info_box_stripe_color: "#f97316",

    // ------------------------------------------------------------------------
    // Coating type buttons (flake / solid / metallic)
    // ------------------------------------------------------------------------
    coating_type_button_bg_color: "#ffffff",
    coating_type_button_selected_bg_color: "#f97316",
    coating_type_button_text_color: "#1f2937",
    coating_type_button_selected_text_color: "#ffffff",

    // ------------------------------------------------------------------------
    // Messaging / disclaimer
    // ------------------------------------------------------------------------
    disclaimer_text:
      "This is an estimate based on the information provided. Final pricing may vary after an in-person inspection.",
    min_job_info_text:
      "Minimum job pricing has been applied to this estimate.",
    standard_info_text:
      "This estimate is based on average costs for your project type and condition. Contact us for a precise quote!",

    // ------------------------------------------------------------------------
    // Bottom CTA
    // ------------------------------------------------------------------------
    next_steps_button_text: "Next Steps",

    // ------------------------------------------------------------------------
    // Redirect
    // ------------------------------------------------------------------------
    ty_url_redirect: "",
  };
}

module.exports = { defaultEstimatorConfig };
