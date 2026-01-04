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

  // Typography
  fontFamily: "",
  baseFontSize: null,

  // Base colors
  textColor: "",
  accentColor: "",
  mutedTextColor: "",

  // Primary button
  primaryButtonColor: "",
  primaryButtonTextColor: "",
  primaryButtonRadius: null,
  primaryButtonHoverColor: "",

  // Form button colors
  selectedButtonColor: "",
  selectedButtonTextColor: "",
  unselectedButtonColor: "",
  unselectedButtonTextColor: "",

  // Card / layout
  cardBackgroundColor: "",
  cardBorderRadius: null,
  cardShadowStrength: "",
  maxWidth: null,
  useEmbeddedStyles: true,

// Results page styling
  priceBoxBorderColor: "",
  pricingInfoBoxBackgroundColor: "",
  pricingInfoBoxStripeColor: "",

// Text content
customProjectLabel: "",
disclaimerText: "",
minJobInfoText: "",
standardInfoText: "",

// Commercial pricing
commercialPricePerSfMin: null,
commercialPricePerSfMax: null,


  // Bottom CTA
  nextStepsButtonText: "",

  // Redirect
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
          `${API_BASE_URL}/estimator/config?company_id=${company.id}`,

          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.status === 404) return;

        if (!response.ok) throw new Error("Failed to load estimator config");

        const data = await response.json();
setForm({
  estimatorEnabled: data.is_active ?? false,

  // Typography
  fontFamily: data.font_family ?? "",
  baseFontSize: data.base_font_size ?? null,

  // Base colors
  textColor: data.text_color ?? "",
  accentColor: data.accent_color ?? "",
  mutedTextColor: data.muted_text_color ?? "",

  // Primary button
  primaryButtonColor: data.primary_button_color ?? "",
  primaryButtonTextColor: data.primary_button_text_color ?? "",
  primaryButtonRadius: data.primary_button_radius ?? null,
  primaryButtonHoverColor: data.primary_button_hover_color ?? "",

// Form button colors
  selectedButtonColor: data.selected_button_color ?? "",
  selectedButtonTextColor: data.selected_button_text_color ?? "",
  unselectedButtonColor: data.unselected_button_color ?? "",
  unselectedButtonTextColor: data.unselected_button_text_color ?? "",

  // Card / layout
  cardBackgroundColor: data.card_background_color ?? "",
  cardBorderRadius: data.card_border_radius ?? null,
  cardShadowStrength: data.card_shadow_strength ?? "",
  maxWidth: data.max_width ?? null,
  useEmbeddedStyles: data.use_embedded_styles ?? true,

  // Results page styling
  priceBoxBorderColor: data.price_box_border_color ?? "",
  pricingInfoBoxBackgroundColor: data.pricing_info_box_background_color ?? "",
  pricingInfoBoxStripeColor: data.pricing_info_box_stripe_color ?? "",

// Text content
disclaimerText: data.disclaimer_text ?? "",
minJobInfoText: data.min_job_info_text ?? "",
standardInfoText: data.standard_info_text ?? "",

// Commercial pricing
commercialPricePerSfMin: data.commercial_price_per_sf_min ?? null,
commercialPricePerSfMax: data.commercial_price_per_sf_max ?? null,


  // Bottom CTA
  nextStepsButtonText: data.next_steps_button_text ?? "",

  // Redirect
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

  // ---------------------------------------------------------------------------
// Color input with live swatch preview
// ---------------------------------------------------------------------------
const colorInput = (label, field) =>
  mode === "view"
    ? viewBlock(label, displayValue(form[field]))
    : (
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={form[field] ?? ""}
            onChange={(e) => handleChange(field, e.target.value)}
            placeholder="#ffffff"
className="w-1/2 px-3 py-2 border rounded-lg text-sm"

          />
          <div
            className="w-6 h-6 rounded border"
            style={{ backgroundColor: form[field] || "#ffffff" }}
          />
        </div>
      </div>
    );

// ---------------------------------------------------------------------------
// Standard text input
// ---------------------------------------------------------------------------
const textInput = (label, field, placeholder = "") =>
  mode === "view"
    ? viewBlock(label, displayValue(form[field]))
    : (
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          {label}
        </label>
        <input
          type="text"
          value={form[field] ?? ""}
          onChange={(e) => handleChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-1/2 px-3 py-2 border rounded-lg text-sm"

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
className="w-1/2 px-3 py-2 border rounded-lg text-sm"

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

  // Typography
  font_family: form.fontFamily || null,
  base_font_size: form.baseFontSize,

  // Base colors
  text_color: form.textColor || null,
  accent_color: form.accentColor || null,
  muted_text_color: form.mutedTextColor || null,

  // Primary button
  primary_button_color: form.primaryButtonColor || null,
  primary_button_text_color: form.primaryButtonTextColor || null,
  primary_button_radius: form.primaryButtonRadius,
  primary_button_hover_color: form.primaryButtonHoverColor || null,

// Form button colors
  selected_button_color: form.selectedButtonColor || null,
  selected_button_text_color: form.selectedButtonTextColor || null,
  unselected_button_color: form.unselectedButtonColor || null,
  unselected_button_text_color: form.unselectedButtonTextColor || null,

  // Card / layout
  card_background_color: form.cardBackgroundColor || null,
  card_border_radius: form.cardBorderRadius,
  card_shadow_strength: form.cardShadowStrength || null,
  max_width: form.maxWidth,
  use_embedded_styles: form.useEmbeddedStyles,

  // Results page styling
// Results page styling
  price_box_border_color: form.priceBoxBorderColor || null,
  pricing_info_box_background:
    form.pricingInfoBoxBackgroundColor || null,
  pricing_info_box_stripe_color:
    form.pricingInfoBoxStripeColor || null,
    
// Text content
custom_project_label: form.customProjectLabel || null,
disclaimer_text: form.disclaimerText || null,
min_job_info_text: form.minJobInfoText || null,
standard_info_text: form.standardInfoText || null,

// Commercial pricing
commercial_price_per_sf_min: form.commercialPricePerSfMin,
commercial_price_per_sf_max: form.commercialPricePerSfMax,


  // Bottom CTA
  next_steps_button_text: form.nextStepsButtonText || null,

  // Redirect
  ty_url_redirect: form.tyUrlRedirect || null,
};


      const token = localStorage.getItem("token");
      const url = `${API_BASE_URL}/estimator/config`;


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
  {colorInput("Text Color", "textColor")}
  {colorInput("Accent Color", "accentColor")}
  {colorInput("Muted Text Color", "mutedTextColor")}
</div>

          </div>

          {/* COLORS */}
{/* COLORS */}
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="font-bold text-gray-900 mb-3">Colors</h3>
  <div className="grid grid-cols-2 gap-4">
    {colorInput("Text Color", "textColor")}
    {colorInput("Accent Color", "accentColor")}
    {colorInput("Muted Text Color", "mutedTextColor")}
  </div>
</div>


          {/* PRIMARY BUTTON */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Primary Button</h3>
            <div className="grid grid-cols-2 gap-4">
{colorInput("Background Color", "primaryButtonColor")}
{colorInput("Text Color", "primaryButtonTextColor")}
{colorInput("Hover Color", "primaryButtonHoverColor")}

              {numberInput("Border Radius", "primaryButtonRadius", "px")}
            </div>
          </div>
          
          {/* FORM BUTTONS */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3">Form Buttons (Project/Condition Selectors)</h3>
            <div className="grid grid-cols-2 gap-4">
              {colorInput("Selected Button Color", "selectedButtonColor")}
              {colorInput("Selected Button Text Color", "selectedButtonTextColor")}
              {colorInput("Unselected Button Color", "unselectedButtonColor")}
              {colorInput("Unselected Button Text Color", "unselectedButtonTextColor")}
            </div>
          </div>

{/* CARD STYLING */}
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="font-bold text-gray-900 mb-3">Card Styling</h3>

  {/* Row 1 */}
  <div className="grid grid-cols-2 gap-4 mb-4">
    {colorInput("Background Color", "cardBackgroundColor")}
    {numberInput("Border Radius", "cardBorderRadius", "px")}
  </div>

  {/* Row 2 */}
  <div className="grid grid-cols-2 gap-4">
    {textInput("Shadow Strength", "cardShadowStrength")}
  </div>
</div>

{/* RESULTS PAGE STYLING */}
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="font-bold text-gray-900 mb-3">Results Page</h3>
  <div className="grid grid-cols-2 gap-4">
 { colorInput("Price Box Border Color", "priceBoxBorderColor") }
{ colorInput("Pricing Info Box Background", "pricingInfoBoxBackgroundColor") }
{ colorInput("Pricing Info Box Stripe Color", "pricingInfoBoxStripeColor") }

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
    {textInput("Custom Floor Display Name", "customProjectLabel", "e.g. Dance Floors")}
    {textArea("Disclaimer Text", "disclaimerText")}
    {textArea("Minimum Job Info Text", "minJobInfoText")}
    {textArea("Standard Info Text", "standardInfoText")}
  </div>
</div>


{/* CALL TO ACTION */}
<div className="bg-gray-50 rounded-lg p-4">
  <h3 className="font-bold text-gray-900 mb-3">Call To Action</h3>

  <div className="grid grid-cols-2 gap-4 mb-4">
    {textInput("Final CTA Button Text", "nextStepsButtonText", "e.g. Next Steps")}
  </div>

  <div className="mt-4">
    {textInput("Thank You Page Redirect URL", "tyUrlRedirect")}
  </div>
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
