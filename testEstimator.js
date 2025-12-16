const { calculateEstimate } = require("./src/estimator/calculateEstimate");

// ---- FAKE CONFIG (simulates estimator_configs row)
const config = {
  is_active: true,

  // Avg garage sizes
  avg_sf_1_car: 300,
  avg_sf_2_car: 500,
  avg_sf_3_car: 700,
  avg_sf_4_car: 900,

  // Finish availability
  offers_solid: true,
  offers_flake: true,
  offers_metallic: true,

  // Solid pricing
  solid_price_per_sf_min: 4.0,
  solid_price_per_sf_max: 5.0,

  // Flake pricing
  flake_price_per_sf_min: 5.0,
  flake_price_per_sf_max: 6.0,

  // Metallic pricing
  metallic_price_per_sf_min: 8.0,
  metallic_price_per_sf_max: 9.5,

  // Condition multipliers
  condition_good_multiplier: 1.0,
  condition_minor_multiplier: 1.15,
  condition_major_multiplier: 1.30,

  // Existing coating
  existing_coating_multiplier: null,
  existing_coating_flat_fee: null,

  // Minimum job
  minimum_job_price: 3500
};

// ---- FAKE USER INPUT (simulates form submission)
const input = {
  project: {
    type: "garage_2",
    condition: "good",
    existingCoating: false
  },
  selectedQuality: "flake"
};

// ---- RUN IT
try {
  const result = calculateEstimate(config, input);
  console.log("RESULT:");
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("ERROR:", err.message);
}
