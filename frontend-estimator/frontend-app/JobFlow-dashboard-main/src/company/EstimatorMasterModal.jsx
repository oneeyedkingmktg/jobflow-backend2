// ============================================================================
// File: src/company/EstimatorMasterModal.jsx
// Version: v1.5.2 – View-mode display blocks (non-editable visual state)
// ============================================================================

import React, { useState, useEffect } from "react";

export default function EstimatorMasterModal({ company, onSave, onClose }) {
  const [mode, setMode] = useState("view");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [form, setForm] = useState({
    estimatorEnabled: false,
    fontFamily: "",
    baseFontSize: null,
    textColor: "",
    primaryButtonColor: "",
    primaryButtonTextColor: "",
    primaryButtonRadius: null,
    primaryButtonHoverColor: "",
    accentColor: "",
    mutedTextColor: "",
    cardBackgroundColor: "",
    cardBorderRadius: null,
    cardShadowStrength: "",
    maxWidth: null,
    useEmbeddedStyles: true,
    disclaimerText: "",
    minJobInfoText: "",
    standardInfoText: "",
    tyUrlRedirect: "",
  });

  useEffect(() => {
    const loadConfig = async () => {
      if (!company?.id) return;
      
      try {
        setLoading(true);
        setError("");
        const token = localStorage.getItem("token");
const response = await fetch(
  `${import.meta.env.VITE_API_URL}/estimator/config?company_id=${company.id}`,
  { headers: { Authorization: `Bearer ${token}` } }
);


        if (response.status === 404) return;

        if (!response.ok) throw new Error("Failed to load estimator config");

        const data = await response.json();
        setForm({
          estimatorEnabled: data.is_active ?? false,
          fontFamily: data.font_family ?? "",
          baseFontSize: data.base_font_size ?? null,
          textColor: data.text_color ?? "",
          primaryButtonColor: data.primary_button_color ?? "",
          primaryButtonTextColor: data.primary_button_text_color ?? "",
          primaryButtonRadius: data.primary_button_radius ?? null,
          primaryButtonHoverColor: data.primary_button_hover_color ?? "",
          accentColor: data.accent_color ?? "",
          mutedTextColor: data.muted_text_color ?? "",
          cardBackgroundColor: data.card_background_color ?? "",
          cardBorderRadius: data.card_border_radius ?? null,
          cardShadowStrength: data.card_shadow_strength ?? "",
          maxWidth: data.max_width ?? null,
          useEmbeddedStyles: data.use_embedded_styles ?? true,
          disclaimerText: data.disclaimer_text ?? "",
          minJobInfoText: data.min_job_info_text ?? "",
          standardInfoText: data.standard_info_text ?? "",
          tyUrlRedirect: data.ty_url_redirect ?? "",
        });
      } catch (err) {
        setError(err.message || "Failed to load estimator config");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [company?.id]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  // ---------------------------------------------------------------------------
  // View-mode helpers
  // ---------------------------------------------------------------------------
  const displayValue = (value, suffix = "") =>
    value !== null && value !== "" ? `${value}${suffix}` : "— Not set —";

  const viewBlock = (label, value) => (
    <div>
      <div className="text-xs font-semibold text-gray-600 mb-1">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );

  const textInput = (label, field, placeholder = "") =>
    mode === "view"
      ? viewBlock(label, displayValue(form[field]))
      : (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
          <input
            type="text"
            value={form[field] ?? ""}
            onChange={(e) => handleChange(field, e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      );

  const numberInput = (label, field, suffix = "") =>
    mode === "view"
      ? viewBlock(label, displayValue(form[field], suffix ? ` ${suffix}` : ""))
      : (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
          <input
            type="number"
            value={form[field] ?? ""}
            onChange={(e) =>
              handleChange(field, e.target.value ? parseInt(e.target.value) : null)
            }
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      );

  const textArea = (label, field, placeholder = "", rows = 3) =>
    mode === "view"
      ? viewBlock(label, displayValue(form[field]))
      : (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
          <textarea
            value={form[field] ?? ""}
            onChange={(e) => handleChange(field, e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      );

  const handleSave = async () => {
    if (saving) return;

    try {
      setSaving(true);
      setError("");

      const payload = {
        company_id: company.id,
        is_active: form.estimatorEnabled,
        font_family: form.fontFamily || null,
        base_font_size: form.baseFontSize,
        text_color: form.textColor || null,
        primary_button_color: form.primaryButtonColor || null,
        primary_button_text_color: form.primaryButtonTextColor || null,
        primary_button_radius: form.primaryButtonRadius,
        primary_button_hover_color: form.primaryButtonHoverColor || null,
        accent_color: form.accentColor || null,
        muted_text_color: form.mutedTextColor || null,
        card_background_color: form.cardBackgroundColor || null,
        card_border_radius: form.cardBorderRadius,
        card_shadow_strength: form.cardShadowStrength || null,
        max_width: form.maxWidth,
        use_embedded_styles: form.useEmbeddedStyles,
        disclaimer_text: form.disclaimerText || null,
        min_job_info_text: form.minJobInfoText || null,
        standard_info_text: form.standardInfoText || null,
        ty_url_redirect: form.tyUrlRedirect || null,
      };

      const token = localStorage.getItem("token");
      const url = "http://localhost:3001/estimator/config";

      let response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 404) {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save estimator config");
      }

      await onSave({});
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save estimator config");
    } finally {
      setSaving(false);
    }
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
          <h2 className="text-xl font-bold">Estimator Admin</h2>
          <p className="text-sm text-blue-100 mt-1">Master configuration and styling</p>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {mode === "view" && (
            <div className="text-sm text-gray-600 italic">
              Viewing settings. Click <strong>Edit</strong> to make changes.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* ENABLE ESTIMATOR */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            {mode === "view"
              ? viewBlock("Enable Estimator", form.estimatorEnabled ? "Yes" : "No")
              : (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.estimatorEnabled}
                    onChange={(e) =>
                      handleChange("estimatorEnabled", e.target.checked)
                    }
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">
                      Enable Estimator
                    </div>
                    <div className="text-sm text-gray-600">
                      Allow company admins to access and configure estimator pricing
                    </div>
                  </div>
                </label>
              )}
          </div>

          {/* TYPOGRAPHY */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Typography</h3>
            <div className="grid grid-cols-2 gap-4">
              {textInput("Font Family", "fontFamily", "inherit")}
              {numberInput("Base Font Size", "baseFontSize", "px")}
            </div>
          </div>

          {/* COLORS */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Colors</h3>
            <div className="grid grid-cols-2 gap-4">
              {textInput("Text Color", "textColor")}
              {textInput("Accent Color", "accentColor")}
              {textInput("Muted Text Color", "mutedTextColor")}
            </div>
          </div>

          {/* PRIMARY BUTTON */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Primary Button</h3>
            <div className="grid grid-cols-2 gap-4">
              {textInput("Background Color", "primaryButtonColor")}
              {textInput("Text Color", "primaryButtonTextColor")}
              {textInput("Hover Color", "primaryButtonHoverColor")}
              {numberInput("Border Radius", "primaryButtonRadius", "px")}
            </div>
          </div>

          {/* CARD STYLING */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Card Styling</h3>
            <div className="grid grid-cols-3 gap-4">
              {textInput("Background Color", "cardBackgroundColor")}
              {numberInput("Border Radius", "cardBorderRadius", "px")}
              {textInput("Shadow Strength", "cardShadowStrength")}
            </div>
          </div>

          {/* LAYOUT */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Layout</h3>
            <div className="grid grid-cols-2 gap-4">
              {numberInput("Max Width", "maxWidth", "px")}
              {mode === "view"
                ? viewBlock("Use Embedded Styles", form.useEmbeddedStyles ? "Yes" : "No")
                : (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.useEmbeddedStyles}
                      onChange={(e) =>
                        handleChange("useEmbeddedStyles", e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Use Embedded Styles
                    </span>
                  </label>
                )}
            </div>
          </div>

          {/* TEXT CONTENT */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Text Content</h3>
            <div className="space-y-4">
              {textArea("Disclaimer Text", "disclaimerText")}
              {textArea("Minimum Job Info Text", "minJobInfoText")}
              {textArea("Standard Info Text", "standardInfoText")}
            </div>
          </div>

          {/* THANK YOU REDIRECT */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Thank You Page</h3>
            {textInput("Redirect URL", "tyUrlRedirect")}
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t px-6 py-3 flex justify-between items-center text-xs text-gray-500">
          <button
            onClick={mode === "view" ? onClose : handleSave}
            disabled={mode !== "view" && saving}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold text-sm"
          >
            Save & Exit
          </button>

          <span>
            Last Modified:{" "}
            {company?.updatedAt
              ? new Date(company.updatedAt).toLocaleString()
              : "—"}
          </span>

          {mode === "view" ? (
            <button
              onClick={() => setMode("edit")}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm"
            >
              {saving ? "Saving..." : "Save & Exit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
