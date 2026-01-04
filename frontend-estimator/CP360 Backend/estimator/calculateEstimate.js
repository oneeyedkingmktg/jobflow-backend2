// ============================================================================
// Estimator Calculation Engine
// File: estimator/calculateEstimate.js
// Version: v1.1.5 – Harden pricing ranges + guarantee display values
// ============================================================================

function calculateEstimate(config, input) {
  if (!config) throw new Error("CONFIG_REQUIRED");
  if (!input || !input.project || !input.selectedQuality) {
    throw new Error("INVALID_INPUT");
  }

  const { project, selectedQuality } = input;

  // ---------------------------------------------------------------------------
  // Resolve square footage
  // ---------------------------------------------------------------------------
  let squareFeet = null;

  if (Number(input.squareFeet) > 0) {
    squareFeet = Number(input.squareFeet);
  } else if (Number(input.length) > 0 && Number(input.width) > 0) {
    squareFeet = Number(input.length) * Number(input.width);
  } else {
    switch (project.type) {
      case "garage_1":
        squareFeet = Number(config.avg_sf_1_car);
        break;
      case "garage_2":
        squareFeet = Number(config.avg_sf_2_car);
        break;
      case "garage_3":
        squareFeet = Number(config.avg_sf_3_car);
        break;
      case "garage_4":
        squareFeet = Number(config.avg_sf_4_car);
        break;
      default:
        squareFeet = null;
    }
  }

  if (!squareFeet || squareFeet <= 0 || Number.isNaN(squareFeet)) {
    squareFeet = 400; // intentional hard fallback
  }

  // ---------------------------------------------------------------------------
  // Condition multiplier
  // ---------------------------------------------------------------------------
  let conditionMultiplier = 1.0;

  if (project.condition === "minor") {
    conditionMultiplier = Number(config.condition_minor_multiplier || 1);
  }

  if (project.condition === "major") {
    conditionMultiplier = Number(config.condition_major_multiplier || 1);
  }

  // ---------------------------------------------------------------------------
  // Existing coating adjustment
  // ---------------------------------------------------------------------------
  let coatingAdjustment = 1.0;

  if (project.existingCoating && config.existing_coating_multiplier) {
    coatingAdjustment = Number(config.existing_coating_multiplier);
  }

  // ---------------------------------------------------------------------------
  // Pricing helpers (HARDENED)
  // ---------------------------------------------------------------------------
  function calcRange(minPerSf, maxPerSf) {
    if (
      minPerSf === null ||
      maxPerSf === null ||
      minPerSf === undefined ||
      maxPerSf === undefined
    ) {
      return null;
    }

    const rawMin = squareFeet * Number(minPerSf);
    const rawMax = squareFeet * Number(maxPerSf);

    if (!rawMin || !rawMax) return null;

    const adjustedMin = rawMin * conditionMultiplier * coatingAdjustment;
    const adjustedMax = rawMax * conditionMultiplier * coatingAdjustment;

    return {
      min: Math.round(adjustedMin),
      max: Math.round(adjustedMax),
    };
  }

  const priceRanges = {
    solid: calcRange(
      config.solid_price_per_sf_min,
      config.solid_price_per_sf_max
    ),
    flake: calcRange(
      config.flake_price_per_sf_min,
      config.flake_price_per_sf_max
    ),
    metallic: calcRange(
      config.metallic_price_per_sf_min,
      config.metallic_price_per_sf_max
    ),
  };

  // ---------------------------------------------------------------------------
  // Quality validation (FINAL, HARD)
  // ---------------------------------------------------------------------------
  if (!priceRanges[selectedQuality]) {
    throw new Error("INVALID_QUALITY_SELECTION");
  }

  // ---------------------------------------------------------------------------
  // Minimum job enforcement
  // ---------------------------------------------------------------------------
  const minimumJob = Number(config.minimum_job_price || 0);

  let displayMin = Number(priceRanges[selectedQuality].min);
  let displayMax = Number(priceRanges[selectedQuality].max);
  let minimumJobApplied = false;

  if (minimumJob && displayMin < minimumJob) {
    displayMin = minimumJob;
    displayMax = minimumJob;
    minimumJobApplied = true;
  }

  // ---------------------------------------------------------------------------
  // Final response (GUARANTEED SHAPE)
  // ---------------------------------------------------------------------------
  return {
    calculatedSf: squareFeet,
    selectedQuality,
    displayPriceMin: displayMin,
    displayPriceMax: displayMax,
    allPriceRanges: priceRanges,
    minimumJobApplied,
  };
}

module.exports = {
  calculateEstimate,
};
