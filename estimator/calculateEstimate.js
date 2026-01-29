// ============================================================================
// Estimator Calculation Engine
// File: estimator/calculateEstimate.js
// Version: v1.2.0 – Per-finish minimum job pricing with smart display logic
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
    squareFeet = 400;
  }

  // ---------------------------------------------------------------------------
  // Condition multiplier
  // ---------------------------------------------------------------------------
  let conditionMultiplier = 1;

  if (project.condition === "minor") {
    conditionMultiplier = Number(config.condition_minor_multiplier || 1);
  }

  if (project.condition === "major") {
    conditionMultiplier = Number(config.condition_major_multiplier || 1);
  }

  // ---------------------------------------------------------------------------
  // Existing coating multiplier
  // ---------------------------------------------------------------------------
  let coatingMultiplier = 1;

  if (project.existingCoating && Number(config.existing_coating_multiplier) > 0) {
    coatingMultiplier = Number(config.existing_coating_multiplier);
  }

  // ---------------------------------------------------------------------------
  // Pricing helper - rounds to nearest $25
  // ---------------------------------------------------------------------------
  function calcRange(minPerSf, maxPerSf) {
    if (minPerSf == null || maxPerSf == null) return null;

    const rawMin =
      squareFeet * Number(minPerSf) +
      squareFeet * Number(config.existing_coating_flat_fee || 0);

    const rawMax =
      squareFeet * Number(maxPerSf) +
      squareFeet * Number(config.existing_coating_flat_fee || 0);

    const adjustedMin = rawMin * conditionMultiplier * coatingMultiplier;
    const adjustedMax = rawMax * conditionMultiplier * coatingMultiplier;

    return {
      min: Math.round(adjustedMin / 25) * 25,
      max: Math.round(adjustedMax / 25) * 25,
    };
  }

  // ---------------------------------------------------------------------------
  // BUILD PRICE RANGES
  // ---------------------------------------------------------------------------
  let priceRanges = {};

  // COMMERCIAL OVERRIDE
  if (project.type === "commercial") {
    const commercialRange = calcRange(
      config.commercial_price_per_sf_min,
      config.commercial_price_per_sf_max
    );

    priceRanges = {
      solid: commercialRange,
      flake: commercialRange,
      metallic: commercialRange,
    };
  } else {
    priceRanges = {
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
  }

  if (!priceRanges[selectedQuality]) {
    throw new Error("INVALID_QUALITY_SELECTION");
  }

  // ---------------------------------------------------------------------------
  // Minimum job enforcement - APPLIED PER FINISH TYPE with smart display logic
  // ---------------------------------------------------------------------------
  const minimumJob = Number(config.minimum_job_price || 0);

  // Apply minimum to each finish type independently
  const adjustedPriceRanges = {};
  let selectedMinimumApplied = false;

  for (const finish in priceRanges) {
    if (!priceRanges[finish]) continue;

    let min = priceRanges[finish].min;
    let max = priceRanges[finish].max;
    let minimumApplied = false;

    // Only apply minimum if the calculated min is below the minimum job price
    if (minimumJob && min < minimumJob) {
      min = minimumJob;
      minimumApplied = true;

      // If max is also below minimum, set it to minimum
      // Otherwise keep the calculated max (creates range like "$1,000 - $1,200")
      if (max < minimumJob) {
        max = minimumJob;
      }
    }

    adjustedPriceRanges[finish] = {
      min,
      max,
      minimumApplied
    };

    // Track if selected finish has minimum applied
    if (finish === selectedQuality && minimumApplied) {
      selectedMinimumApplied = true;
    }
  }

  const selectedRange = adjustedPriceRanges[selectedQuality];

  // ---------------------------------------------------------------------------
  // FINAL RESPONSE
  // ---------------------------------------------------------------------------
  return {
    calculatedSf: squareFeet,
    selectedQuality,
    displayPriceMin: selectedRange.min,
    displayPriceMax: selectedRange.max,
    minimumJobApplied: selectedMinimumApplied,
    allPriceRanges: adjustedPriceRanges,
  };
}

module.exports = {
  calculateEstimate,
};