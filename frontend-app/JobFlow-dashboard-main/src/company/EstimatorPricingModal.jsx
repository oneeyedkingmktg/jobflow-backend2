// ============================================================================
// File: src/company/EstimatorPricingModal.jsx
// Version: v2.0.0 – Space-based pricing with 5 spaces × 4 finishes
// ============================================================================

import React, { useState, useEffect } from "react";

export default function EstimatorPricingModal({ company, onSave, onClose }) {
  const [mode, setMode] = useState("view");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Settings form (kept from old structure)
  const [settingsForm, setSettingsForm] = useState({
    allowGarage1: false,
    allowGarage2: false,
    allowGarage3: false,
    allowGarage4: false,
    allowPatio: false,
    allowBasement: false,
    allowCustom: false,
    customProjectLabel: "",
    allowCommercial: false,

    avgSf1Car: null,
    avgSf2Car: null,
    avgSf3Car: null,
    avgSf4Car: null,

    minimumJobPrice: null,

    conditionGoodMultiplier: 1.0,
    conditionMinorMultiplier: null,
    conditionMajorMultiplier: null,

    existingCoatingMultiplier: null,
    existingCoatingFlatFee: null,
  });

  // Pricing configs (new structure)
  const [pricingConfigs, setPricingConfigs] = useState([]);

  const SPACES = ['garage', 'patio', 'basement', 'commercial', 'custom'];
  const FINISHES = ['solid', 'flake', 'metallic', 'custom'];

  useEffect(() => {
    const loadData = async () => {
      if (!company?.id) return;

      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");

        // Load settings from old endpoint
        const settingsRes = await fetch(
          `${import.meta.env.VITE_API_URL}/estimator/config?company_id=${company.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (settingsRes.ok) {
          const d = await settingsRes.json();
          setSettingsForm({
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

            minimumJobPrice: d.minimum_job_price ?? null,

            conditionGoodMultiplier: d.condition_good_multiplier ?? 1.0,
            conditionMinorMultiplier: d.condition_minor_multiplier ?? null,
            conditionMajorMultiplier: d.condition_major_multiplier ?? null,

            existingCoatingMultiplier: d.existing_coating_multiplier ?? null,
            existingCoatingFlatFee: d.existing_coating_flat_fee ?? null,
          });
        }

        // Load pricing from new endpoint
        const pricingRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/estimator-pricing/${company.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (pricingRes.ok) {
          const configs = await pricingRes.json();
          setPricingConfigs(configs);
        }

      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [company]);

  const handleSettingsChange = (field, value) => {
    setSettingsForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const getPricingConfig = (space, finish) => {
    return pricingConfigs.find(
      (c) => c.space_type === space && c.finish_type === finish
    ) || { enabled: false, min_price_per_sf: null, max_price_per_sf: null };
  };

  const updatePricingConfig = (space, finish, field, value) => {
    setPricingConfigs((prev) => {
      const existing = prev.find(
        (c) => c.space_type === space && c.finish_type === finish
      );

      if (existing) {
        return prev.map((c) =>
          c.space_type === space && c.finish_type === finish
            ? { ...c, [field]: value }
            : c
        );
      } else {
        return [
          ...prev,
          {
            space_type: space,
            finish_type: finish,
            enabled: field === 'enabled' ? value : false,
            min_price_per_sf: field === 'min_price_per_sf' ? value : null,
            max_price_per_sf: field === 'max_price_per_sf' ? value : null,
          },
        ];
      }
    });
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

      // Save settings to old endpoint
      const settingsPayload = {
        company_id: company.id,
        allow_garage_1: settingsForm.allowGarage1,
        allow_garage_2: settingsForm.allowGarage2,
        allow_garage_3: settingsForm.allowGarage3,
        allow_garage_4: settingsForm.allowGarage4,
        allow_patio: settingsForm.allowPatio,
        allow_basement: settingsForm.allowBasement,
        allow_custom: settingsForm.allowCustom,
        custom_project_label: settingsForm.customProjectLabel || "Custom",
        allow_commercial: settingsForm.allowCommercial,

        avg_sf_1_car: toNumOrNull(settingsForm.avgSf1Car),
        avg_sf_2_car: toNumOrNull(settingsForm.avgSf2Car),
        avg_sf_3_car: toNumOrNull(settingsForm.avgSf3Car),
        avg_sf_4_car: toNumOrNull(settingsForm.avgSf4Car),

        minimum_job_price: toNumOrNull(settingsForm.minimumJobPrice),

        condition_good_multiplier: toNumOrNull(settingsForm.conditionGoodMultiplier),
        condition_minor_multiplier: toNumOrNull(settingsForm.conditionMinorMultiplier),
        condition_major_multiplier: toNumOrNull(settingsForm.conditionMajorMultiplier),

        existing_coating_multiplier: toNumOrNull(settingsForm.existingCoatingMultiplier),
        existing_coating_flat_fee: toNumOrNull(settingsForm.existingCoatingFlatFee),
      };

      const settingsRes = await fetch(
        `${import.meta.env.VITE_API_URL}/estimator/config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(settingsPayload),
        }
      );

      if (!settingsRes.ok) {
        const data = await settingsRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save settings");
      }

      // Save pricing to new endpoint
      const pricingPayload = {
        configs: pricingConfigs.map((c) => ({
          space_type: c.space_type,
          finish_type: c.finish_type,
          min_price_per_sf: toNumOrNull(c.min_price_per_sf),
          max_price_per_sf: toNumOrNull(c.max_price_per_sf),
          enabled: c.enabled ?? false,
        })),
      };

      const pricingRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/estimator-pricing/${company.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(pricingPayload),
        }
      );

      if (!pricingRes.ok) {
        const data = await pricingRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save pricing");
      }

      await onSave({});
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const toggleBox = (label, field) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={settingsForm[field]}
        onChange={(e) => handleSettingsChange(field, e.target.checked)}
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
          value={settingsForm[field] ?? ""}
          onChange={(e) => handleSettingsChange(field, e.target.value)}
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

  const renderSpacePricing = (space, displayName) => {
    return (
      <div className="bg-gray-50 rounded-lg p-4" key={space}>
        <h3 className="font-bold text-gray-900 mb-3">
          {displayName} Pricing (per sq ft)
        </h3>
        <div className="space-y-4">
          {FINISHES.map((finish) => {
            const config = getPricingConfig(space, finish);
            const finishLabel = finish.charAt(0).toUpperCase() + finish.slice(1);
            
            return (
              <div key={finish} className="border-l-4 border-blue-300 pl-4">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) =>
                      updatePricingConfig(space, finish, "enabled", e.target.checked)
                    }
                    disabled={mode === "view"}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    {finishLabel}
                  </span>
                </label>

                {config.enabled && (
                  <div className="grid grid-cols-2 gap-3 ml-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Min Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={config.min_price_per_sf ?? ""}
                          onChange={(e) =>
                            updatePricingConfig(
                              space,
                              finish,
                              "min_price_per_sf",
                              e.target.value
                            )
                          }
                          disabled={mode === "view"}
                          className="w-full pl-7 px-3 py-2 border rounded-lg text-sm disabled:bg-transparent disabled:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Max Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={config.max_price_per_sf ?? ""}
                          onChange={(e) =>
                            updatePricingConfig(
                              space,
                              finish,
                              "max_price_per_sf",
                              e.target.value
                            )
                          }
                          disabled={mode === "view"}
                          className="w-full pl-7 px-3 py-2 border rounded-lg text-sm disabled:bg-transparent disabled:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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

          {/* MINIMUM JOB PRICE */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Minimum Job Price</h3>
            {numberInput("Minimum Price", "minimumJobPrice", "$")}
          </div>

          {/* PRICING BY SPACE */}
          {renderSpacePricing('garage', 'Garage')}
          {renderSpacePricing('patio', 'Patio')}
          {renderSpacePricing('basement', 'Basement')}
          {renderSpacePricing('commercial', 'Commercial')}
          {renderSpacePricing('custom', settingsForm.customProjectLabel || 'Custom')}

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
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold"
          >
            Cancel
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