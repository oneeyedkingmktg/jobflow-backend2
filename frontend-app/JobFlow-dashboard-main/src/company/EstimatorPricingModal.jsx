// ============================================================================
// File: src/company/EstimatorPricingModal.jsx
// Version: v2.1.0 – Custom labels, auto-enable spaces, removed project types
// ============================================================================

import React, { useState, useEffect } from "react";

export default function EstimatorPricingModal({ company, onSave, onClose }) {
  const [mode, setMode] = useState("view");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    customProjectLabel: "Custom",
    customFinishLabel: "Custom",

    avgSf1Car: null,
    avgSf2Car: null,
    avgSf3Car: null,
    avgSf4Car: null,

    minimumJobPrice: null,

    conditionGoodMultiplier: 1.0,
    conditionMinorMultiplier: null,
    conditionMajorMultiplier: null,
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

        const token = localStorage.getItem("authToken");

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
            customProjectLabel: d.custom_project_label ?? "Custom",
            customFinishLabel: d.custom_finish_label ?? "Custom",

            avgSf1Car: d.avg_sf_1_car ?? null,
            avgSf2Car: d.avg_sf_2_car ?? null,
            avgSf3Car: d.avg_sf_3_car ?? null,
            avgSf4Car: d.avg_sf_4_car ?? null,

            minimumJobPrice: d.minimum_job_price ?? null,

            conditionGoodMultiplier: d.condition_good_multiplier ?? 1.0,
            conditionMinorMultiplier: d.condition_minor_multiplier ?? null,
            conditionMajorMultiplier: d.condition_major_multiplier ?? null,
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

      const token = localStorage.getItem("authToken");

      // Determine which spaces have ANY finish enabled
      const hasGarageFinish = pricingConfigs.some(
        (c) => c.space_type === 'garage' && c.enabled
      );
      const hasPatioFinish = pricingConfigs.some(
        (c) => c.space_type === 'patio' && c.enabled
      );
      const hasBasementFinish = pricingConfigs.some(
        (c) => c.space_type === 'basement' && c.enabled
      );
      const hasCommercialFinish = pricingConfigs.some(
        (c) => c.space_type === 'commercial' && c.enabled
      );
      const hasCustomFinish = pricingConfigs.some(
        (c) => c.space_type === 'custom' && c.enabled
      );

      // Save settings to old endpoint
      const settingsPayload = {
        company_id: company.id,
        custom_project_label: settingsForm.customProjectLabel || "Custom",
        custom_finish_label: settingsForm.customFinishLabel || "Custom",

        // Auto-enable garage types if ANY garage finish is enabled
        allow_garage_1: hasGarageFinish,
        allow_garage_2: hasGarageFinish,
        allow_garage_3: hasGarageFinish,
        allow_garage_4: hasGarageFinish,

        // Auto-enable other spaces if ANY finish is enabled
        allow_patio: hasPatioFinish,
        allow_basement: hasBasementFinish,
        allow_commercial: hasCommercialFinish,
        allow_custom: hasCustomFinish,

        avg_sf_1_car: toNumOrNull(settingsForm.avgSf1Car),
        avg_sf_2_car: toNumOrNull(settingsForm.avgSf2Car),
        avg_sf_3_car: toNumOrNull(settingsForm.avgSf3Car),
        avg_sf_4_car: toNumOrNull(settingsForm.avgSf4Car),

        minimum_job_price: toNumOrNull(settingsForm.minimumJobPrice),

        condition_good_multiplier: toNumOrNull(settingsForm.conditionGoodMultiplier),
        condition_minor_multiplier: toNumOrNull(settingsForm.conditionMinorMultiplier),
        condition_major_multiplier: toNumOrNull(settingsForm.conditionMajorMultiplier),
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

  const textInput = (label, field, placeholder = "") => (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={settingsForm[field] ?? ""}
        onChange={(e) => handleSettingsChange(field, e.target.value)}
        disabled={mode === "view"}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-transparent disabled:border-transparent disabled:text-gray-900 disabled:opacity-100 disabled:cursor-default"
      />
    </div>
  );

  const formatPrice = (min, max) => {
    const minNum = parseFloat(min);
    const maxNum = parseFloat(max);
    
    if (!minNum && !maxNum) return "Not set";
    if (!maxNum) return `$${minNum.toFixed(2)}`;
    if (!minNum) return `$${maxNum.toFixed(2)}`;
    if (minNum === maxNum) return `$${minNum.toFixed(2)}`;
    return `$${minNum.toFixed(2)} - $${maxNum.toFixed(2)}`;
  };

  const renderSpacePricing = (space, displayName) => {
    return (
      <div className="bg-gray-50 rounded-lg p-4" key={space}>
        <h3 className="font-bold text-gray-900 mb-3">
          {displayName} Pricing (per sq ft)
        </h3>
        <div className="space-y-4">
          {FINISHES.map((finish) => {
            const config = getPricingConfig(space, finish);
            
            // Display custom finish label if it's the custom finish
            const finishLabel = finish === 'custom' 
              ? (settingsForm.customFinishLabel || 'Custom')
              : finish.charAt(0).toUpperCase() + finish.slice(1);
            
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
                  {mode === "view" && config.enabled && (
                    <span className="text-sm text-gray-600 ml-2">
                      {formatPrice(config.min_price_per_sf, config.max_price_per_sf)}
                    </span>
                  )}
                </label>

                {config.enabled && mode === "edit" && (
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
                          className="w-full pl-7 px-3 py-2 border rounded-lg text-sm"
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
                          className="w-full pl-7 px-3 py-2 border rounded-lg text-sm"
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

          {/* CUSTOM LABELS */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Custom Labels</h3>
            <div className="grid grid-cols-2 gap-4">
              {textInput("Custom Space Name", "customProjectLabel", "e.g., Dance Floors")}
              {textInput("Custom Finish Name", "customFinishLabel", "e.g., Premium Coating")}
            </div>
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