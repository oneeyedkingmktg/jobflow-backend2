// ============================================================================
// File: src/company/EstimatorMasterModal.jsx
// Version: v1.5.2 – View-mode display blocks (non-editable visual state)
// ============================================================================

import React, { useState, useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

export default function EstimatorMasterModal({ company, onSave, onClose }) {
  const [mode, setMode] = useState("view");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outOfAreaLogs, setOutOfAreaLogs] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  
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
largeProjectSfThreshold: "",
largeProjectNote: "",
combinedProjectMessage: "",
outOfAreaEnabled: false,
outOfAreaLargeJobThreshold: "",
outOfAreaSorryMessage: "",
outOfAreaLargeJobMessage: "",
outOfAreaPriceDisclaimer: "",

// Finish-specific descriptions (Results page)
solidFinishDescription: "",
flakeFinishDescription: "",
metallicFinishDescription: "",
customFinishDescription: "",

// Finish label for the 4th tab
customFinishLabel: "",


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
customProjectLabel: data.custom_project_label ?? "",
disclaimerText: data.disclaimer_text ?? "",
minJobInfoText: data.min_job_info_text ?? "",
standardInfoText: data.standard_info_text ?? "",
largeProjectSfThreshold: data.large_project_sf_threshold ?? "",
largeProjectNote: data.large_project_note ?? "",
combinedProjectMessage: data.combined_project_message ?? "",
outOfAreaEnabled: data.out_of_area_enabled ?? false,
outOfAreaLargeJobThreshold: data.out_of_area_large_job_threshold ?? "",
outOfAreaSorryMessage: data.out_of_area_sorry_message ?? "",
outOfAreaLargeJobMessage: data.out_of_area_large_job_message ?? "",
outOfAreaPriceDisclaimer: data.out_of_area_price_disclaimer ?? "",
// Finish-specific descriptions
solidFinishDescription: data.solid_finish_description ?? "",
flakeFinishDescription: data.flake_finish_description ?? "",
metallicFinishDescription: data.metallic_finish_description ?? "",
customFinishDescription: data.custom_finish_description ?? "",

// Finish label for 4th tab
customFinishLabel: data.custom_finish_label ?? "",

// Commercial pricing
commercialPricePerSfMin: data.commercial_price_per_sf_min ?? null,
commercialPricePerSfMax: data.commercial_price_per_sf_max ?? null,


// Custom CTA Buttons
  cta1Button: data.cta1_button ?? "",
  cta1Link: data.cta1_link ?? "",
  cta2Button: data.cta2_button ?? "",
  cta2Link: data.cta2_link ?? "",
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
large_project_sf_threshold: form.largeProjectSfThreshold ? Number(form.largeProjectSfThreshold) : null,
large_project_note: form.largeProjectNote || null,
combined_project_message: form.combinedProjectMessage || null,
out_of_area_enabled: form.outOfAreaEnabled,
out_of_area_large_job_threshold: form.outOfAreaLargeJobThreshold ? Number(form.outOfAreaLargeJobThreshold) : null,
out_of_area_sorry_message: form.outOfAreaSorryMessage || null,
out_of_area_large_job_message: form.outOfAreaLargeJobMessage || null,
out_of_area_price_disclaimer: form.outOfAreaPriceDisclaimer || null,

// Finish-specific descriptions (Results page)
solid_finish_description: form.solidFinishDescription || null,
flake_finish_description: form.flakeFinishDescription || null,
metallic_finish_description: form.metallicFinishDescription || null,
custom_finish_description: form.customFinishDescription || null,

// Finish label for 4th tab
custom_finish_label: form.customFinishLabel || null,


// Commercial pricing
commercial_price_per_sf_min: form.commercialPricePerSfMin,
commercial_price_per_sf_max: form.commercialPricePerSfMax,


// Bottom CTA (deprecated - keeping for backwards compatibility)
  next_steps_button_text: form.nextStepsButtonText || null,
  ty_url_redirect: form.tyUrlRedirect || null,
  
  // Custom CTA Buttons
  cta1_button: form.cta1Button || null,
  cta1_link: form.cta1Link || null,
  cta2_button: form.cta2Button || null,
  cta2_link: form.cta2Link || null,
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

          {/* EMBED CODE */}
          {company?.estimatorCode && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-2">Estimator Embed Code</h3>
              <p className="text-xs text-gray-500 mb-2">Copy and paste this single line into any website or page to embed your estimator.</p>
              <div className="relative">
                <textarea
                  readOnly
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono bg-white text-gray-700"
                  value={`<!-- --- Start CoatingPro360 Estimator --- -->\n<script src="https://estimate.coatingpro360.com/embed.js?company=${company.estimatorCode}"><\/script>\n<!-- --- End CoatingPro360 Estimator --- -->`}
                />
                <div className="relative inline-block">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`<!-- --- Start CoatingPro360 Estimator --- -->\n<script src="https://estimate.coatingpro360.com/embed.js?company=${company.estimatorCode}"><\/script>\n<!-- --- End CoatingPro360 Estimator --- -->`);
                      setEmbedCopied(true);
                      setTimeout(() => setEmbedCopied(false), 2000);
                    }}
                    className="mt-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-lg"
                  >
                    Copy
                  </button>
                  {embedCopied && (
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      Copied!
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

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
    {textArea("Minimum Job Info Text", "minJobInfoText")}
    {textArea("Standard Info Text", "standardInfoText")}
    {textInput("Large Project SF Threshold", "largeProjectSfThreshold", "e.g. 3000 — show special note for jobs at or above this size")}
    {textArea("Large Project Note", "largeProjectNote", "Shown instead of Standard Info Text when job is at or above threshold")}
    {textArea("Combined Project Message", "combinedProjectMessage", "Message shown between two estimates on the dual-estimate results page")}

    <hr className="my-4" />

    <h4 className="font-semibold text-gray-700 text-sm">Out of Area / Large Job</h4>
    <p className="text-xs text-gray-500 mb-2">When enabled, ZIP codes outside the service area are still calculated. If the estimated value meets the threshold, the lead is accepted and tagged as out of area.</p>

    {mode === "view"
      ? <div className="text-xs text-gray-700"><span className="font-semibold">Out of Area Feature:</span> {form.outOfAreaEnabled ? "On" : "Off"}</div>
      : (
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.outOfAreaEnabled}
            onChange={(e) => handleChange("outOfAreaEnabled", e.target.checked)}
            className="w-4 h-4"
          />
          Out of Area Feature On/Off
        </label>
      )
    }

    {textInput("Out of Area Large Job Threshold ($)", "outOfAreaLargeJobThreshold", "e.g. 5000 — min flake floor price to still accept the lead")}
    {textArea("Sorry / Cannot Help Message", "outOfAreaSorryMessage", "Shown when job is below threshold", 2)}
    {textArea("Out of Area Large Job Message", "outOfAreaLargeJobMessage", "Shown in the price reveal modal for large jobs", 2)}
    {textArea("Out of Area Price Reveal Disclaimer", "outOfAreaPriceDisclaimer", "Fine print shown in the price reveal modal", 3)}

    <hr className="my-4" />

    <h4 className="font-semibold text-gray-700 text-sm">Call-to-Action Buttons</h4>
    <p className="text-xs text-gray-600 mb-2">These buttons appear below the price on the results page</p>
    
    {textInput("CTA Button 1 Text", "cta1Button", "e.g. Schedule In-Person Estimate")}
    {textInput("CTA Button 1 Link", "cta1Link", "https://...")}
    
    {textInput("CTA Button 2 Text", "cta2Button", "e.g. View Our Gallery")}
    {textInput("CTA Button 2 Link", "cta2Link", "https://...")}

    <hr className="my-4" />

    <h4 className="font-semibold text-gray-700 text-sm">Finish Descriptions on Results Page</h4>
    <p className="text-xs text-gray-500 mb-2">
      To add a clickable link inside a description, use this format:{" "}
      <code className="bg-gray-100 px-1 rounded">(url,text)</code>
      {" "}— example:{" "}
      <code className="bg-gray-100 px-1 rounded">(https://coatingpro360.com,learn more)</code>
    </p>

{textArea(
  "Solid Finish Description (Results Page)",
  "solidFinishDescription",
  "Shown when Solid tab is selected",
  4
)}

{textArea(
  "Flake Finish Description (Results Page)",
  "flakeFinishDescription",
  "Shown when Flake tab is selected",
  4
)}

{textArea(
  "Metallic Finish Description (Results Page)",
  "metallicFinishDescription",
  "Shown when Metallic tab is selected",
  4
)}

{textArea(
  `${form.customFinishLabel || "Custom"} Finish Description (Results Page)`,
  "customFinishDescription",
  "Shown when Custom tab is selected",
  4
)}


  </div>
</div>



        </div>

        {/* OUT OF AREA LOG */}
        <div className="border-t px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-gray-800 text-sm">Out of Area Log</h4>
            <button
              type="button"
              onClick={async () => {
                if (outOfAreaLogs) { setOutOfAreaLogs(null); return; }
                setLoadingLogs(true);
                try {
                  const res = await fetch(`${API_BASE_URL}/estimator/out-of-area-log/${company.id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` }
                  });
                  const data = await res.json();
                  setOutOfAreaLogs(data.logs || []);
                } catch {
                  setOutOfAreaLogs([]);
                } finally {
                  setLoadingLogs(false);
                }
              }}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
            >
              {outOfAreaLogs ? "Hide" : "View Log"}
            </button>
          </div>
          {loadingLogs && <p className="text-xs text-gray-500">Loading...</p>}
          {outOfAreaLogs && !loadingLogs && (
            outOfAreaLogs.length === 0
              ? <p className="text-xs text-gray-500">No out-of-area attempts logged.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-left">
                        <th className="px-2 py-1">Date</th>
                        <th className="px-2 py-1">Name</th>
                        <th className="px-2 py-1">ZIP</th>
                        <th className="px-2 py-1">Est. Value</th>
                        <th className="px-2 py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outOfAreaLogs.map((log) => (
                        <tr key={log.id} className="border-t border-gray-100">
                          <td className="px-2 py-1 whitespace-nowrap">{new Date(log.created_at).toLocaleDateString()}</td>
                          <td className="px-2 py-1">{log.homeowner_name || "—"}</td>
                          <td className="px-2 py-1">{log.zip_code || "—"}</td>
                          <td className="px-2 py-1">{log.estimated_value ? `$${Number(log.estimated_value).toLocaleString()}` : "—"}</td>
                          <td className="px-2 py-1">{log.status === "outside_area_large_job_submitted" ? "✅ Submitted" : "❌ Below threshold"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )}
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
