// ============================================================================
// File: src/company/EstimatorPricingModal.jsx
// Version: v1.3.5 – Prevent partial-save nulling via pre-save merge
// ============================================================================

import React, { useState, useEffect } from "react";

export default function EstimatorPricingModal({ company, onSave, onClose }) {
  const [mode, setMode] = useState("view");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    // Project type toggles
    allowGarage1: false,
    allowGarage2: false,
    allowGarage3: false,
    allowGarage4: false,
    allowPatio: false,
    allowBasement: false,
    allowCustom: false,
    customProjectLabel: "",

    allowCommercial: false,

    // Average square footage
    avgSf1Car: null,
    avgSf2Car: null,
    avgSf3Car: null,
    avgSf4Car: null,

    // Coating type toggles
    offersSolid: false,
    offersFlake: false,
    offersMetallic: false,

    // Minimum job price
    minimumJobPrice: null,

    // Price per SF ranges
    solidPricePerSfMin: null,
    solidPricePerSfMax: null,
    flakePricePerSfMin: null,
    flakePricePerSfMax: null,
    metallicPricePerSfMin: null,
    metallicPricePerSfMax: null,
    patioPricePerSfMin: null,
    patioPricePerSfMax: null,
    basementPricePerSfMin: null,
    basementPricePerSfMax: null,
    customPricePerSfMin: null,
    customPricePerSfMax: null,
    commercialPricePerSfMin: null,
commercialPricePerSfMax: null,


    // Condition multipliers
    conditionGoodMultiplier: 1.0,
    conditionMinorMultiplier: null,
    conditionMajorMultiplier: null,

    // Existing coating
    existingCoatingMultiplier: null,
    existingCoatingFlatFee: null,
  });

  useEffect(() => {
    const loadConfig = async () => {
      if (!company?.id) return;

      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/estimator/config?company_id=${company.id}`,

          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // If no row exists yet, we keep defaults and allow user to edit + save.
        if (response.status === 404) {
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load estimator config");
        }

        const d = await response.json();

        setForm({
          allowGarage1: d.allow_garage_1 ?? false,
          allowGarage2: d.allow_garage_2 ?? false,
          allowGarage3: d.allow_garage_3 ?? false,
          allowGarage4: d.allow_garage_4 ?? false,
          allowPatio: d.allow_patio ?? false,
          allowBasement: d.allow_basement ?? false,
          allowCustom: d.allow_custom ?? false,
          customProjectLabel: d.custom_project_label ?? "Custom",
          allowCommercial: d.allow_commercial ?? false,

          avgSf1Car: d.avg_sf_1_car ?? null,
          avgSf2Car: d.avg_sf_2_car ?? null,
          avgSf3Car: d.avg_sf_3_car ?? null,
          avgSf4Car: d.avg_sf_4_car ?? null,

          offersSolid: d.offers_solid ?? false,
          offersFlake: d.offers_flake ?? false,
          offersMetallic: d.offers_metallic ?? false,

          minimumJobPrice: d.minimum_job_price ?? null,

          solidPricePerSfMin: d.solid_price_per_sf_min ?? null,
          solidPricePerSfMax: d.solid_price_per_sf_max ?? null,
          flakePricePerSfMin: d.flake_price_per_sf_min ?? null,
          flakePricePerSfMax: d.flake_price_per_sf_max ?? null,
          metallicPricePerSfMin: d.metallic_price_per_sf_min ?? null,
          metallicPricePerSfMax: d.metallic_price_per_sf_max ?? null,
          patioPricePerSfMin: d.patio_price_per_sf_min ?? null,
          patioPricePerSfMax: d.patio_price_per_sf_max ?? null,
          basementPricePerSfMin: d.basement_price_per_sf_min ?? null,
          basementPricePerSfMax: d.basement_price_per_sf_max ?? null,
          customPricePerSfMin: d.custom_price_per_sf_min ?? null,
          customPricePerSfMax: d.custom_price_per_sf_max ?? null,
          commercialPricePerSfMin: d.commercial_price_per_sf_min ?? null,
commercialPricePerSfMax: d.commercial_price_per_sf_max ?? null,


          conditionGoodMultiplier: d.condition_good_multiplier ?? 1.0,
          conditionMinorMultiplier: d.condition_minor_multiplier ?? null,
          conditionMajorMultiplier: d.condition_major_multiplier ?? null,

          existingCoatingMultiplier: d.existing_coating_multiplier ?? null,
          existingCoatingFlatFee: d.existing_coating_flat_fee ?? null,
        });
      } catch (err) {
        setError(err.message || "Failed to load pricing");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [company]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSave = async () => {
    if (saving) return;

    const toNumOrNull = (v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (s === "") return null;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    };

    try {
      setSaving(true);
      setError("");

      const token = localStorage.getItem("token");
      const url = `${import.meta.env.VITE_API_URL}/api/estimator/config`;


      // ----------------------------------------------------------------------
      // SAFETY: fetch existing config and merge so partial saves can't null fields
      // ----------------------------------------------------------------------
      let existing = {};
      try {
        const existingRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/estimator/config?company_id=${company.id}`,

          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (existingRes.ok) {
          existing = await existingRes.json();
        } else {
          // 404 is expected for new companies; keep existing as {}
          existing = {};
        }
      } catch (_) {
        // If the read fails for any reason, we still proceed with full payload from form.
        existing = {};
      }

      const payload = {
        // Merge existing to protect against backend overwriting missing keys
        ...existing,

        company_id: company.id,

        allow_garage_1: form.allowGarage1,
        allow_garage_2: form.allowGarage2,
        allow_garage_3: form.allowGarage3,
        allow_garage_4: form.allowGarage4,
        allow_patio: form.allowPatio,
        allow_basement: form.allowBasement,
        allow_custom: form.allowCustom,
        custom_project_label: form.customProjectLabel || "Custom",
        allow_commercial: form.allowCommercial,

        avg_sf_1_car: toNumOrNull(form.avgSf1Car),
        avg_sf_2_car: toNumOrNull(form.avgSf2Car),
        avg_sf_3_car: toNumOrNull(form.avgSf3Car),
        avg_sf_4_car: toNumOrNull(form.avgSf4Car),

        offers_solid: form.offersSolid,
        offers_flake: form.offersFlake,
        offers_metallic: form.offersMetallic,

        minimum_job_price: toNumOrNull(form.minimumJobPrice),

        solid_price_per_sf_min: toNumOrNull(form.solidPricePerSfMin),
        solid_price_per_sf_max: toNumOrNull(form.solidPricePerSfMax),
        flake_price_per_sf_min: toNumOrNull(form.flakePricePerSfMin),
        flake_price_per_sf_max: toNumOrNull(form.flakePricePerSfMax),
        metallic_price_per_sf_min: toNumOrNull(form.metallicPricePerSfMin),
        metallic_price_per_sf_max: toNumOrNull(form.metallicPricePerSfMax),

        patio_price_per_sf_min: toNumOrNull(form.patioPricePerSfMin),
        patio_price_per_sf_max: toNumOrNull(form.patioPricePerSfMax),
        basement_price_per_sf_min: toNumOrNull(form.basementPricePerSfMin),
        basement_price_per_sf_max: toNumOrNull(form.basementPricePerSfMax),
        custom_price_per_sf_min: toNumOrNull(form.customPricePerSfMin),
        custom_price_per_sf_max: toNumOrNull(form.customPricePerSfMax),
        commercial_price_per_sf_min: toNumOrNull(form.commercialPricePerSfMin),
commercial_price_per_sf_max: toNumOrNull(form.commercialPricePerSfMax),


        condition_good_multiplier: toNumOrNull(form.conditionGoodMultiplier),
        condition_minor_multiplier: toNumOrNull(form.conditionMinorMultiplier),
        condition_major_multiplier: toNumOrNull(form.conditionMajorMultiplier),

        existing_coating_multiplier: toNumOrNull(form.existingCoatingMultiplier),
        existing_coating_flat_fee: toNumOrNull(form.existingCoatingFlatFee),
      };

const response = await fetch(url, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save estimator config");
      }

      await onSave({}); // trigger parent refresh
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save estimator config");
    } finally {
      setSaving(false);
    }
  };

  const toggleBox = (label, field) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={form[field]}
        onChange={(e) => handleChange(field, e.target.checked)}
        disabled={mode === "view"}
        className="w-4 h-4 text-blue-600 rounded"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );

  const numberInput = (label, field, prefix = "", suffix = "") => (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-2.5 text-gray-500">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={form[field] ?? ""}
          onChange={(e) => handleChange(field, e.target.value)}
          disabled={mode === "view"}
          className={`w-full px-3 py-2 border rounded-lg text-sm disabled:bg-transparent disabled:border-transparent disabled:text-gray-900 disabled:opacity-100 disabled:cursor-default disabled:shadow-none disabled:ring-0 disabled:focus:ring-0 disabled:focus:outline-none ${
            prefix ? "pl-7" : ""
          }`}
        />
        {suffix && (
          <span className="absolute right-3 top-2.5 text-gray-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* HEADER */}
        <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl">
          <h2 className="text-xl font-bold">Estimator Pricing</h2>
          <p className="text-sm text-blue-100 mt-1">
            Configure pricing for your estimator tool
          </p>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* PROJECT TYPES */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Project Types</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {toggleBox("1 Car Garage", "allowGarage1")}
              {toggleBox("2 Car Garage", "allowGarage2")}
              {toggleBox("3 Car Garage", "allowGarage3")}
              {toggleBox("4 Car Garage", "allowGarage4")}
              {toggleBox("Patio", "allowPatio")}
              {toggleBox("Basement", "allowBasement")}
              {toggleBox("Custom", "allowCustom")}
              {toggleBox("Commercial", "allowCommercial")}
            </div>
          </div>

          {/* AVERAGE SQUARE FOOTAGE */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">
              Average Square Footage
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {numberInput("1 Car", "avgSf1Car", "", "sq ft")}
              {numberInput("2 Car", "avgSf2Car", "", "sq ft")}
              {numberInput("3 Car", "avgSf3Car", "", "sq ft")}
              {numberInput("4 Car", "avgSf4Car", "", "sq ft")}
            </div>
          </div>

          {/* COATING TYPES */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">
              Coating Types Offered
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {toggleBox("Solid Color", "offersSolid")}
              {toggleBox("Flake", "offersFlake")}
              {toggleBox("Metallic", "offersMetallic")}
            </div>
          </div>

          {/* MINIMUM JOB PRICE */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Minimum Job Price</h3>
            {numberInput("Minimum Price", "minimumJobPrice", "$")}
          </div>

          {/* GARAGE PRICING */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">
              Garage Pricing (per sq ft)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {numberInput("Solid Min", "solidPricePerSfMin", "$")}
              {numberInput("Solid Max", "solidPricePerSfMax", "$")}
              {numberInput("Flake Min", "flakePricePerSfMin", "$")}
              {numberInput("Flake Max", "flakePricePerSfMax", "$")}
              {numberInput("Metallic Min", "metallicPricePerSfMin", "$")}
              {numberInput("Metallic Max", "metallicPricePerSfMax", "$")}
            </div>
          </div>

          {/* PATIO PRICING */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">
              Patio Pricing (per sq ft)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {numberInput("Min", "patioPricePerSfMin", "$")}
              {numberInput("Max", "patioPricePerSfMax", "$")}
            </div>
          </div>

          {/* BASEMENT PRICING */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">
              Basement Pricing (per sq ft)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {numberInput("Min", "basementPricePerSfMin", "$")}
              {numberInput("Max", "basementPricePerSfMax", "$")}
            </div>
          </div>

{/* CUSTOM PRICING */}
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="font-bold text-gray-900 mb-3">
    {form.customProjectLabel || "Custom"} Pricing (per sq ft)
  </h3>

  <div className="mb-4">
    <label className="block text-xs font-semibold text-gray-700 mb-1">
      Custom Project Label
    </label>
    <input
      type="text"
      value={form.customProjectLabel ?? ""}
      onChange={(e) => handleChange("customProjectLabel", e.target.value)}
      disabled={mode === "view"}
      placeholder="e.g. Dance Floors"
      className="w-1/2 px-3 py-2 border rounded-lg text-sm disabled:bg-transparent disabled:border-transparent"
    />
  </div>

  <div className="grid grid-cols-2 gap-4">
    {numberInput("Min", "customPricePerSfMin", "$")}
    {numberInput("Max", "customPricePerSfMax", "$")}
  </div>
</div>

          {/* COMMERCIAL PRICING */}
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="font-bold text-gray-900 mb-3">
    Commercial Pricing (per sq ft)
  </h3>
  <div className="grid grid-cols-2 gap-4">
    {numberInput("Min", "commercialPricePerSfMin", "$")}
    {numberInput("Max", "commercialPricePerSfMax", "$")}
  </div>
</div>


          {/* CONDITION MULTIPLIERS */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">
              Condition Multipliers
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {numberInput("Good", "conditionGoodMultiplier")}
              {numberInput("Minor Issues", "conditionMinorMultiplier")}
              {numberInput("Major Issues", "conditionMajorMultiplier")}
            </div>
          </div>

          {/* EXISTING COATING */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">
              Existing Coating Pricing
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {numberInput("Multiplier", "existingCoatingMultiplier")}
              {numberInput("+ $ per sq ft", "existingCoatingFlatFee", "$")}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t px-6 py-4 flex justify-between">
          <button
            onClick={mode === "view" ? onClose : handleSave}
            disabled={mode !== "view" && saving}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold"
          >
            Save & Exit
          </button>
          {mode === "view" ? (
            <button
              onClick={() => setMode("edit")}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold"
            >
              {saving ? "Saving..." : "Save & Exit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
