// ============================================================================
// Estimator Main Component
// File: estimator/Estimator.jsx
// Version: v2.1.0 - FIXED: Now saves estimate to estimator_leads table
// ============================================================================

import { useState, useEffect } from "react";
import useEstimatorConfig from "./hooks/useEstimatorConfig";
import SizeModal from "./components/SizeModal";
import EstimatorForm from "./components/EstimatorForm";
import EstimatorResults from "./components/EstimatorResults";

const params = new URLSearchParams(window.location.search);
const companyId = params.get("company");
let utmSource = params.get("utm_source") || null;
let utmMedium = params.get("utm_medium") || null;
let utmCampaign = params.get("utm_campaign") || null;

// ============================================================================
// Modal shown when a returning customer already has 2 estimates on file
// ============================================================================
function TwoEstimatesModal({ estimates, config, onClose }) {
  const cta1Button = config?.cta1_button || "";
  const cta1Link = config?.cta1_link || "";
  const cta2Button = config?.cta2_button || "";
  const cta2Link = config?.cta2_link || "";

  function formatPrice(min, max) {
    if (!min || !max) return "N/A";
    return `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()}`;
  }

  function getProjectLabel(type) {
    if (!type) return "Unknown";
    if (type.startsWith("garage_")) return type.split("_")[1] + " Car Garage";
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">📋</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">You Already Have 2 Estimates</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Here are the estimates we have on file for you. If you need additional areas estimated, please give us a call.
        </p>
        <div className="space-y-3 text-left mb-6">
          {estimates.map((est, idx) => {
            let pr = {};
            try { pr = typeof est.all_price_ranges === "string" ? JSON.parse(est.all_price_ranges) : est.all_price_ranges || {}; } catch (e) {}
            const flake = pr.flake || {};
            return (
              <div key={est.id || idx} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs font-bold text-gray-500 uppercase mb-1">{getProjectLabel(est.project_type)}</div>
                <div className="font-bold text-gray-900">{formatPrice(flake.min || est.display_price_min, flake.max || est.display_price_max)}</div>
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          {cta1Button && cta1Link && (
            <a href={cta1Link} className="block w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold text-center hover:bg-orange-600">{cta1Button}</a>
          )}
          {cta2Button && cta2Link && (
            <a href={cta2Link} className="block w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold text-center hover:bg-orange-600">{cta2Button}</a>
          )}
          <button onClick={onClose} className="block w-full px-6 py-2 text-gray-500 text-sm font-semibold hover:text-gray-700">Close</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Second estimate mini-form (project type + condition + size — no contact info)
// ============================================================================
function SecondEstimateForm({ config, useCustomStyles, projectType2, setProjectType2, condition2, setCondition2, length2, width2, squareFeet2, openSizeModal, setLength2, setWidth2, setSquareFeet2, onSubmit, onBack, submitting, error }) {
  const customProjectLabel = config?.custom_project_label || "Other Project";
  const conditionGoodLabel = config?.condition_good_label || "Good";
  const conditionMinorLabel = config?.condition_minor_label || "A Few Cracks";
  const conditionMajorLabel = config?.condition_major_label || "A Lot of Cracks";
  const selectedButtonColor = config?.selected_button_color || "#f97316";
  const selectedButtonTextColor = config?.selected_button_text_color || "#ffffff";
  const unselectedButtonColor = config?.unselected_button_color || "#ffffff";
  const unselectedButtonTextColor = config?.unselected_button_text_color || "#4b5563";

  const cardClass = useCustomStyles ? "estimator-card p-6 space-y-6" : "bg-white rounded-xl shadow p-6 space-y-6";
  const selectedBtnClass = useCustomStyles ? "rounded-lg border px-4 py-3 font-medium text-sm" : "rounded-lg border px-4 py-3 font-medium text-sm bg-orange-500 text-white border-orange-500";
  const selectedBtnStyle = useCustomStyles ? { backgroundColor: selectedButtonColor, color: selectedButtonTextColor, borderColor: selectedButtonColor } : {};
  const unselectedBtnClass = useCustomStyles ? "rounded-lg border px-4 py-3 font-medium text-sm" : "rounded-lg border px-4 py-3 font-medium text-sm bg-white hover:bg-gray-50 border-gray-300";
  const unselectedBtnStyle = useCustomStyles ? { backgroundColor: unselectedButtonColor, color: unselectedButtonTextColor, borderColor: "#d1d5db" } : {};

  const needsSize = ["patio", "basement", "custom", "commercial"].includes(projectType2);
  const hasSize = (Number(length2) > 0 && Number(width2) > 0) || Number(squareFeet2) > 0;
  const formValid = projectType2 && condition2 && (!needsSize || hasSize);

  const projectTypes = ["garage_1", "garage_2", "garage_3", "garage_4", "patio", "basement", "commercial", "custom"];
  const projectLabels = { garage_1: "1 Car Garage", garage_2: "2 Car Garage", garage_3: "3 Car Garage", garage_4: "4 Car Garage", patio: "Patio", basement: "Basement", commercial: "Commercial", custom: customProjectLabel };
  const visibilityKeys = { garage_1: "allow_garage_1", garage_2: "allow_garage_2", garage_3: "allow_garage_3", garage_4: "allow_garage_4", patio: "allow_patio", basement: "allow_basement", commercial: "allow_commercial", custom: "allow_custom" };

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-gray-500 hover:text-gray-800 text-sm font-semibold">← Back</button>
        <h2 className="text-2xl font-bold">Add a Second Space</h2>
      </div>

      <div>
        <label className="font-semibold block mb-2">Project Type</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {projectTypes.map((type) => {
            if (!config) return null;
            if (config[visibilityKeys[type]] === false) return null;
            const isSelected = projectType2 === type;
            return (
              <button key={type} type="button"
                onClick={() => {
                  if (["patio", "basement", "custom", "commercial"].includes(type)) {
                    openSizeModal(type);
                  } else {
                    setProjectType2(type);
                    setLength2(""); setWidth2(""); setSquareFeet2("");
                  }
                }}
                className={isSelected ? selectedBtnClass : unselectedBtnClass}
                style={isSelected ? selectedBtnStyle : unselectedBtnStyle}
              >
                {projectLabels[type]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="font-semibold block mb-2">Condition of Concrete</label>
        <div className="grid grid-cols-3 gap-3">
          {[{ value: "none", label: conditionGoodLabel }, { value: "minor", label: conditionMinorLabel }, { value: "major", label: conditionMajorLabel }].map((opt) => {
            const isSelected = condition2 === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => setCondition2(opt.value)}
                className={isSelected ? selectedBtnClass : unselectedBtnClass}
                style={isSelected ? selectedBtnStyle : unselectedBtnStyle}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!formValid || submitting}
        className={formValid && !submitting ? (useCustomStyles ? "estimator-primary-btn w-full font-bold py-3 rounded-lg" : "bg-orange-500 hover:bg-orange-600 text-white w-full font-bold py-3 rounded-lg") : "w-full font-bold py-3 rounded-lg bg-gray-300 text-gray-500 cursor-not-allowed"}
      >
        {submitting ? "Calculating..." : "Get My Second Estimate"}
      </button>
    </div>
  );
}

// ============================================================================
// Combined results view — both estimates stacked
// ============================================================================
function CombinedResults({ config, useCustomStyles, estimate, projectType, condition, length, width, squareFeet, estimate2, projectType2, condition2, length2, width2, squareFeet2, activeFinish, setActiveFinish, activeFinish2, setActiveFinish2, companyPhone }) {
  const customProjectLabel = config?.custom_project_label || "Other Project";
  const conditionGoodLabel = config?.condition_good_label || "Good";
  const conditionMinorLabel = config?.condition_minor_label || "A Few Cracks";
  const conditionMajorLabel = config?.condition_major_label || "A Lot of Cracks";
  const combinedProjectMessage = config?.combined_project_message || "";
  const minJobInfoText = config?.min_job_info_text || "Minimum job pricing applied.";
  const standardInfoText = config?.standard_info_text || "This is an estimate based on the information provided.";
  const minimumJobPrice = Number(config?.minimum_job_price) || 0;
  const cta1Button = config?.cta1_button || "";
  const cta1Link = config?.cta1_link || "";
  const cta2Button = config?.cta2_button || "";
  const cta2Link = config?.cta2_link || "";

  const priceBoxBorderColor = config?.price_box_border_color || "#fdba74";
  const pricingInfoBoxBackground = config?.pricing_info_box_background || "#fefce8";
  const pricingInfoBoxStripeColor = config?.pricing_info_box_stripe_color || "#fb923c";
  const unselectedButtonTextColor = config?.unselected_button_text_color || "#4b5563";
  const primaryBtnClass = useCustomStyles ? "estimator-primary-btn font-bold py-3 rounded-lg" : "bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg";
  const cardClass = useCustomStyles ? "estimator-card p-6" : "bg-white rounded-xl shadow p-6";
  const selectedButtonColor = config?.selected_button_color || "#f97316";
  const selectedButtonTextColor = config?.selected_button_text_color || "#ffffff";
  const customFinishLabel = config?.custom_finish_label || "Custom";
  const finishTabs = ["solid", "flake", "metallic", "custom"];

  const priceBoxClass = useCustomStyles ? "rounded-lg overflow-hidden" : "border border-orange-300 rounded-lg overflow-hidden";
  const priceBoxStyle = useCustomStyles ? { borderColor: priceBoxBorderColor, borderWidth: "1px", borderStyle: "solid" } : {};

  const infoBoxClass = useCustomStyles
    ? "rounded-md px-4 py-3 text-sm"
    : "bg-yellow-50 border-l-4 border-orange-400 rounded-md px-4 py-3 text-sm";
  const infoBoxStyle = useCustomStyles
    ? { backgroundColor: pricingInfoBoxBackground, borderLeftColor: pricingInfoBoxStripeColor, borderLeftWidth: "4px", borderLeftStyle: "solid" }
    : {};

  function getProjectLabel(pt, l, w, sf) {
    if (!pt) return "";
    if (pt.startsWith("garage_")) return pt.split("_")[1] + " car garage";
    if (["patio", "basement"].includes(pt)) {
      if (Number(l) > 0 && Number(w) > 0) return `${l}' × ${w}' ${pt}`;
      if (Number(sf) > 0) return `${Number(sf).toLocaleString()} sq ft ${pt}`;
      return pt;
    }
    if (pt === "commercial") return Number(sf) > 0 ? `Commercial space (${Number(sf).toLocaleString()} sq ft)` : "Commercial space";
    if (pt === "custom") {
      if (Number(l) > 0 && Number(w) > 0) return `${l}' × ${w}' ${customProjectLabel}`;
      if (Number(sf) > 0) return `${Number(sf).toLocaleString()} sq ft ${customProjectLabel}`;
      return customProjectLabel;
    }
    return pt;
  }

  function getConditionLabel(c) {
    if (c === "minor") return conditionMinorLabel;
    if (c === "major") return conditionMajorLabel;
    return conditionGoodLabel;
  }

  function getFinishLabel(f) {
    return f === "custom" ? customFinishLabel : f.charAt(0).toUpperCase() + f.slice(1);
  }

  function getRanges(est) {
    if (!est) return {};
    return est.allPriceRanges || (typeof est.all_price_ranges === "string" ? JSON.parse(est.all_price_ranges) : est.all_price_ranges) || {};
  }

  function renderTabs(est, active, setActive) {
    return (
      <div className="flex justify-center gap-1 mb-3">
        {finishTabs.map((finish) => {
          const ranges = getRanges(est);
          if (!ranges[finish]) return null;
          const isActive = active === finish;
          const tabClass = useCustomStyles
            ? "px-4 py-2 text-sm font-semibold rounded-lg border"
            : isActive
              ? "px-4 py-2 text-sm font-semibold rounded-lg border bg-orange-500 text-white border-orange-500"
              : "px-4 py-2 text-sm font-semibold rounded-lg border bg-gray-100 text-gray-600 border-gray-300";
          const tabStyle = useCustomStyles
            ? isActive
              ? { backgroundColor: selectedButtonColor, color: selectedButtonTextColor, borderColor: selectedButtonColor }
              : { backgroundColor: "#f3f4f6", color: unselectedButtonTextColor, borderColor: "#d1d5db" }
            : {};
          return (
            <button key={finish} onClick={() => setActive(finish)} className={tabClass} style={tabStyle}>
              {getFinishLabel(finish)}
            </button>
          );
        })}
      </div>
    );
  }

  // Per-space range data
  const est1Ranges = getRanges(estimate);
  const est2Ranges = getRanges(estimate2);
  const r1 = est1Ranges[activeFinish];
  const r2 = est2Ranges[activeFinish2];

  // Per-space min job check: minimumApplied flag AND flat price (min === max)
  const space1MinApplied = r1?.minimumApplied && r1?.min === r1?.max;
  const space2MinApplied = r2?.minimumApplied && r2?.min === r2?.max;

  // Per-space price display
  function spacePrice(r) {
    if (!r) return "—";
    if (r.min === r.max) return `$${r.min.toLocaleString()}`;
    return `$${r.min.toLocaleString()} – $${r.max.toLocaleString()}`;
  }

  // Combined total
  const totalMin = (r1?.min || 0) + (r2?.min || 0);
  const totalMax = (r1?.max || 0) + (r2?.max || 0);

  // Combined min job check: if the combined total is below the minimum job price
  const combinedBelowMin = minimumJobPrice > 0 && totalMin < minimumJobPrice;
  const effectiveTotalMin = combinedBelowMin ? minimumJobPrice : totalMin;
  const effectiveTotalMax = combinedBelowMin ? minimumJobPrice : totalMax;
  const totalDisplay = effectiveTotalMin === effectiveTotalMax
    ? `$${effectiveTotalMin.toLocaleString()}`
    : `$${effectiveTotalMin.toLocaleString()} – $${effectiveTotalMax.toLocaleString()}`;
  const showCombinedMinNotice = combinedBelowMin || (space1MinApplied && space2MinApplied);

  return (
    <div className={cardClass}>
      <h2 className="text-xl font-bold text-center mb-6 leading-snug">The 2 Estimates You Requested</h2>

      {/* Estimate 1 card */}
      <div className={`${priceBoxClass} mb-3`} style={priceBoxStyle}>
        <div className="pt-4 px-4">
          {renderTabs(estimate, activeFinish, setActiveFinish)}
        </div>
        <div className="px-4 pb-4 text-center">
          <div className="text-lg font-semibold text-gray-700">{getProjectLabel(projectType, length, width, squareFeet)}</div>
          <div className="text-xl font-bold mt-1">
            {spacePrice(r1)}<span className="text-xs align-super">*</span>
          </div>
          <div className="text-sm text-gray-600 mt-1">Condition: {getConditionLabel(condition)}</div>
          {space1MinApplied && (
            <p className="text-xs text-gray-500 italic mt-2">{minJobInfoText}</p>
          )}
        </div>
      </div>

      {/* Estimate 2 card */}
      <div className={`${priceBoxClass} mb-4`} style={priceBoxStyle}>
        <div className="pt-4 px-4">
          {renderTabs(estimate2, activeFinish2, setActiveFinish2)}
        </div>
        <div className="px-4 pb-4 text-center">
          <div className="text-lg font-semibold text-gray-700">{getProjectLabel(projectType2, length2, width2, squareFeet2)}</div>
          <div className="text-xl font-bold mt-1">
            {spacePrice(r2)}<span className="text-xs align-super">*</span>
          </div>
          <div className="text-sm text-gray-600 mt-1">Condition: {getConditionLabel(condition2)}</div>
          {space2MinApplied && (
            <p className="text-xs text-gray-500 italic mt-2">{minJobInfoText}</p>
          )}
        </div>
      </div>

      {/* Combined total */}
      <div className="text-center mb-3">
        <div className="text-sm font-semibold text-gray-500 uppercase">Combined Total</div>
        <div className="text-3xl font-bold mt-1">{totalDisplay}</div>
        {showCombinedMinNotice && (
          <p className="text-xs text-gray-500 italic mt-1">{minJobInfoText}</p>
        )}
      </div>

      {/* Combined project message — below total */}
      {combinedProjectMessage && (
        <div className={`${infoBoxClass} mb-4`} style={infoBoxStyle}>
          {combinedProjectMessage}
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {cta1Button && cta1Link && <a href={cta1Link} className={`w-full md:w-1/2 ${primaryBtnClass} text-center`}>{cta1Button}</a>}
        {cta2Button && cta2Link && <a href={cta2Link} className={`w-full md:w-1/2 ${primaryBtnClass} text-center`}>{cta2Button}</a>}
      </div>

      {/* Standard info text footnote */}
      {standardInfoText && (
        <p className="text-xs text-gray-500 italic text-center">* {standardInfoText}</p>
      )}
    </div>
  );
}

export default function Estimator() {
  // Config hook - handles fetching and style generation
  const { config, customStyles, useCustomStyles } = useEstimatorConfig();

  // Screen state
  const [screen, setScreen] = useState(1);
  const [activeFinish, setActiveFinish] = useState("flake");
  const [activeFinish2, setActiveFinish2] = useState("flake");

  // Form state (estimate 1)
  const [projectType, setProjectType] = useState("");
  const [condition, setCondition] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [squareFeet, setSquareFeet] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [companyPhone, setCompanyPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outOfServiceArea, setOutOfServiceArea] = useState(false);
  const [outOfAreaBelowThreshold, setOutOfAreaBelowThreshold] = useState(false);
  const [showOutOfAreaDisclaimerModal, setShowOutOfAreaDisclaimerModal] = useState(false);
  const [isOutOfAreaLargeJob, setIsOutOfAreaLargeJob] = useState(false);
  const [leadId, setLeadId] = useState(null);

  // Second estimate state
  const [projectType2, setProjectType2] = useState("");
  const [condition2, setCondition2] = useState("");
  const [length2, setLength2] = useState("");
  const [width2, setWidth2] = useState("");
  const [squareFeet2, setSquareFeet2] = useState("");
  const [estimate2, setEstimate2] = useState(null);
  const [submitting2, setSubmitting2] = useState(false);
  const [error2, setError2] = useState("");

  // Returning customer state
  const [estimateCount, setEstimateCount] = useState(0); // how many estimates exist for this lead
  const [showTwoEstimatesModal, setShowTwoEstimatesModal] = useState(false);
  const [existingEstimatesForModal, setExistingEstimatesForModal] = useState([]);
  // estimate1FromDB — used when returning customer has 1 existing estimate
  const [estimate1FromDB, setEstimate1FromDB] = useState(null);

  // Size modal state (shared, sizeModalFor tracks which form it belongs to)
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [sizeModalFor, setSizeModalFor] = useState(1);
  const [pendingProjectType, setPendingProjectType] = useState("");
  const [sizeMode, setSizeMode] = useState("dims");
  const [modalLength, setModalLength] = useState("");
  const [modalWidth, setModalWidth] = useState("");
  const [modalSf, setModalSf] = useState("");
  const [sizeError, setSizeError] = useState("");

// Inject base tracking tags into <head> once config loads
  useEffect(() => {
    if (!config) return;

    if (config.google_base_tag) {
      const div = document.createElement("div");
      div.innerHTML = config.google_base_tag;
      Array.from(div.querySelectorAll("script")).forEach((oldScript) => {
        const newScript = document.createElement("script");
        if (oldScript.src) {
          newScript.src = oldScript.src;
          newScript.async = true;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        document.head.appendChild(newScript);
      });
    }

    if (config.meta_base_tag) {
      const div = document.createElement("div");
      div.innerHTML = config.meta_base_tag;
      Array.from(div.querySelectorAll("script")).forEach((oldScript) => {
        const newScript = document.createElement("script");
        if (oldScript.src) {
          newScript.src = oldScript.src;
          newScript.async = true;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        document.head.appendChild(newScript);
      });
    }
  }, [config]);

  // Wait for config to load
  if (!config) {
    return <div>Loading...</div>;
  }

  // Account suspended — show promo instead of estimator
  if (config.plan_type === 'suspended') {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center" style={{ paddingTop: '30px' }}>
        <h1 className="text-3xl font-bold mb-4">Get an Instant Estimate for Your Epoxy Floor</h1>
        <p className="text-gray-600 mb-2">This estimator is temporarily unavailable.</p>
        <p className="text-gray-600">Contact the contractor directly for a quote.</p>
      </div>
    );
  }

  // No company parameter OR estimator not enabled - show promo
  if (!companyId || !config.is_active) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-6">Push Button Marketing for Floor Coating Contractors</h1>
        <img 
          src="https://storage.googleapis.com/msgsndr/34aDq5td6waKO9PI60IX/media/695d5f8ac5c3f8ba328bae3b.png" 
          alt="CoatingPro360" 
          className="w-64 h-64 mx-auto mb-6"
        />
        <a 
          href="https://coatingpro360.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-xl font-semibold underline"
        >
          Visit CoatingPro360.com
        </a>
      </div>
    );
  }

  // Modal handlers
  function openSizeModal(nextType, forForm = 1) {
    setSizeModalFor(forForm);
    setPendingProjectType(nextType);
    setShowSizeModal(true);
    setSizeError("");
    setModalLength("");
    setModalWidth("");
    setModalSf("");
    setSizeMode(nextType === "commercial" ? "sf" : "dims");
  }

  function cancelSizeModal() {
    setShowSizeModal(false);
    setPendingProjectType("");
    setSizeError("");
    if (sizeModalFor === 1) {
      setProjectType("");
      setLength("");
      setWidth("");
      setSquareFeet("");
    } else {
      setProjectType2("");
      setLength2("");
      setWidth2("");
      setSquareFeet2("");
    }
  }

  function saveSizeModal() {
    if (!pendingProjectType) return;
    const setType = sizeModalFor === 1 ? setProjectType : setProjectType2;
    const setSf = sizeModalFor === 1 ? setSquareFeet : setSquareFeet2;
    const setL = sizeModalFor === 1 ? setLength : setLength2;
    const setW = sizeModalFor === 1 ? setWidth : setWidth2;

    if (pendingProjectType === "commercial") {
      const sf = Number(modalSf);
      if (!sf || sf <= 0) { setSizeError("Square footage is required."); return; }
      setType(pendingProjectType);
      setSf(String(sf));
    } else if (sizeMode === "dims") {
      const l = Number(modalLength);
      const w = Number(modalWidth);
      if (!l || !w) { setSizeError("Length and width are required."); return; }
      setType(pendingProjectType);
      setL(String(l));
      setW(String(w));
      setSf("");
    } else {
      const sf = Number(modalSf);
      if (!sf) { setSizeError("Square footage is required."); return; }
      setType(pendingProjectType);
      setSf(String(sf));
      setL("");
      setW("");
    }

    setShowSizeModal(false);
    setPendingProjectType("");
    setSizeError("");
  }

  const API_BASE = import.meta.env.VITE_API_URL || "https://api.coatingpro360.com";

  // Form submission
async function submitEstimate() {
    setOutOfServiceArea(false);
    setOutOfAreaBelowThreshold(false);
    setIsOutOfAreaLargeJob(false);

    const serviceZips = config?.service_area_zips;
    const isOutsideArea = serviceZips && Array.isArray(serviceZips) && serviceZips.length > 0
      && !serviceZips.map(String).includes(zip.trim());

    if (isOutsideArea && !config?.out_of_area_enabled) {
      setOutOfServiceArea(true);
      fetch(`${API_BASE}/estimator/out-of-area-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          homeowner_name: name,
          zip_code: zip,
          estimated_value: null,
          status: "outside_area_blocked"
        })
      }).catch(() => {});
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      // 1️⃣ Get estimate preview
      console.log("🔍 Company ID from URL:", companyId);
      
const previewRes = await fetch(`${API_BASE}/estimator/preview`, {




        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          project: { type: projectType, condition },
          length,
          width,
          squareFeet,
          selectedQuality: activeFinish,
          zip
        })
      });

      const previewData = await previewRes.json();
      if (!previewRes.ok) {
        throw new Error(previewData.error || "Unable to generate estimate");
      }

      console.log("📊 Estimate calculated:", previewData.estimate);

      // Sync active tab to whichever finish the backend resolved (handles no-flake configs)
      if (previewData.estimate?.selectedQuality) {
        setActiveFinish(previewData.estimate.selectedQuality);
      }

      // Out-of-area threshold check (only when feature is enabled and ZIP is outside area)
      let outOfAreaLargeJob = false;
      if (isOutsideArea && config?.out_of_area_enabled) {
        const flakeMin = previewData.estimate?.allPriceRanges?.flake?.min
          || previewData.estimate?.displayPriceMin
          || 0;
        const threshold = Number(config.out_of_area_large_job_threshold) || 0;
        if (threshold > 0 && flakeMin < threshold) {
          // Below threshold — log and show sorry message, no lead
          setOutOfAreaBelowThreshold(true);
          fetch(`${API_BASE}/estimator/out-of-area-log`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company_id: companyId,
              homeowner_name: name,
              zip_code: zip,
              estimated_value: flakeMin,
              status: "outside_area_below_threshold"
            })
          }).catch(() => {});
          return;
        }
        // Above threshold — mark as out-of-area large job
        outOfAreaLargeJob = true;
        setIsOutOfAreaLargeJob(true);
      }

      // 🔍 DEBUG: Log what we're about to send
const leadData = {
  company_id: companyId,
  name,
  email,
  phone,
  zip,
  project_type: projectType,
  lead_source: "estimator",
  referral_source: "estimator",
  status: "status_pre_lead",
  utm_source: utmSource,
  utm_medium: utmMedium,
  utm_campaign: utmCampaign,
  out_of_area_large_job: outOfAreaLargeJob,
  // 🆕 ADD ESTIMATE DATA
  estimate: {
    project_type: projectType,
    length_ft: length ? parseFloat(length) : null,
    width_ft: width ? parseFloat(width) : null,
    calculated_sf: previewData.estimate.calculatedSf,
    condition: condition,
    existing_coating: false,
    selected_quality: activeFinish,
    display_price_min: previewData.estimate.displayPriceMin,
    display_price_max: previewData.estimate.displayPriceMax,
    all_price_ranges: previewData.estimate.allPriceRanges,
    minimum_job_applied: previewData.estimate.minimumJobApplied || false
  }
};
      console.log("🚀 SENDING LEAD DATA WITH ESTIMATE:", leadData);

      // 2️⃣ Create lead (now includes estimate data)
const leadRes = await fetch(`${API_BASE}/leads`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(leadData)
});


      console.log("📡 LEAD RESPONSE STATUS:", leadRes.status);
      
let leadResData;
const leadText = await leadRes.text();

try {
  leadResData = JSON.parse(leadText);
} catch (e) {
  console.error("❌ Lead response not JSON:", leadText);
  throw new Error("Lead API did not return JSON");
}

      console.log("📦 LEAD RESPONSE DATA:", leadResData);

      if (!leadRes.ok) {
        console.error("❌ LEAD CREATION FAILED:", leadResData);
        throw new Error(leadResData.error || "Failed to create lead");
      }

// 3️⃣ Fire conversion events
      try {
        if (config.google_conversion_event) {
          // eslint-disable-next-line no-new-func
          new Function(config.google_conversion_event)();
        }
      } catch (e) {
        console.warn("Google conversion event error:", e);
      }

      try {
        if (config.meta_conversion_event && typeof fbq === 'function') {
          // eslint-disable-next-line no-new-func
          new Function(config.meta_conversion_event)();
        }
      } catch (e) {
        console.warn("Meta conversion event error:", e);
      }

      try {
        if (typeof gtag === 'function') {
          gtag('event', 'estimate_submitted');
        }
      } catch (e) {
        console.warn("GA4 event error:", e);
      }

      // Notify parent window so tags on contractor sites can fire.
      // Microsoft UET lives on the parent page (not inside the iframe),
      // so postMessage is the only correct path — do NOT also call it
      // directly here or it will double-fire.
      try {
        window.parent.postMessage({
          event: 'estimator_conversion',
          type: 'estimate_submitted',
          microsoftEventCode: config.microsoft_conversion_event || null
        }, '*');
      } catch (e) {
        console.warn("postMessage error:", e);
      }

      // 4️⃣ Handle response
      if (leadResData?.lead?.id) setLeadId(leadResData.lead.id);

      // Log out-of-area large job submission
      if (outOfAreaLargeJob) {
        const flakeMin = previewData.estimate?.allPriceRanges?.flake?.min
          || previewData.estimate?.displayPriceMin
          || 0;
        fetch(`${API_BASE}/estimator/out-of-area-log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: companyId,
            homeowner_name: name,
            zip_code: zip,
            estimated_value: flakeMin,
            status: "outside_area_large_job_submitted"
          })
        }).catch(() => {});
        setShowOutOfAreaDisclaimerModal(true);
      }
      setCompanyPhone(previewData.companyPhone || "");

      // Returning customer — 2 estimates already exist: show modal, don't proceed
      if (leadResData?.twoEstimatesExist) {
        setExistingEstimatesForModal(leadResData.estimates || []);
        setShowTwoEstimatesModal(true);
        return;
      }

      // Returning customer — had 1 existing estimate, new one saved as #2
      if (leadResData?.hasExistingEstimate && leadResData?.estimates?.length === 2) {
        const dbEst1 = leadResData.estimates[0];
        const pr1 = typeof dbEst1.all_price_ranges === "string" ? JSON.parse(dbEst1.all_price_ranges) : dbEst1.all_price_ranges;
        setEstimate1FromDB({ allPriceRanges: pr1, minimumJobApplied: dbEst1.minimum_job_applied });
        setEstimate(previewData.estimate); // new submission = estimate 2 visually
        setProjectType2(projectType);
        setCondition2(condition);
        setLength2(length);
        setWidth2(width);
        setSquareFeet2(squareFeet);
        setEstimate2(previewData.estimate);
        // populate estimate 1 display data from DB row
        setEstimateCount(2);
        setScreen(4);
        return;
      }

      // Normal first estimate
      setEstimate(previewData.estimate);
      setEstimateCount(1);
      setScreen(2);

    } catch (err) {
      console.error("💥 SUBMIT ERROR:", err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSecondEstimate() {
    if (!projectType2 || !condition2) { setError2("Please select a project type and condition."); return; }
    const needsSize = ["patio", "basement", "custom", "commercial"].includes(projectType2);
    const hasSize = (Number(length2) > 0 && Number(width2) > 0) || Number(squareFeet2) > 0;
    if (needsSize && !hasSize) { setError2("Please enter the size of the space."); return; }

    setSubmitting2(true);
    setError2("");
    try {
      const previewRes = await fetch(`${API_BASE}/estimator/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          project: { type: projectType2, condition: condition2 },
          length: length2,
          width: width2,
          squareFeet: squareFeet2,
          selectedQuality: activeFinish,
          zip
        })
      });
      const previewData = await previewRes.json();
      if (!previewRes.ok) throw new Error(previewData.error || "Unable to generate estimate");

      if (previewData.estimate?.selectedQuality) {
        setActiveFinish2(previewData.estimate.selectedQuality);
      }

      const token = localStorage.getItem("authToken");
      const saveRes = await fetch(`${API_BASE}/leads/${leadId}/second-estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          project_type: projectType2,
          condition: condition2,
          length_ft: length2 ? parseFloat(length2) : null,
          width_ft: width2 ? parseFloat(width2) : null,
          calculated_sf: previewData.estimate.calculatedSf,
          existing_coating: false,
          selected_quality: activeFinish,
          display_price_min: previewData.estimate.displayPriceMin,
          display_price_max: previewData.estimate.displayPriceMax,
          all_price_ranges: previewData.estimate.allPriceRanges,
          minimum_job_applied: previewData.estimate.minimumJobApplied || false
        })
      });
      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save second estimate");
      }

      setEstimate2(previewData.estimate);
      setEstimateCount(2);
      setScreen(4);
    } catch (err) {
      console.error("💥 SECOND ESTIMATE ERROR:", err);
      setError2(err.message);
    } finally {
      setSubmitting2(false);
    }
  }

  return (
    <>
      {useCustomStyles && <style>{customStyles}</style>}
      
      <div className={useCustomStyles ? "estimator-container mx-auto p-6" : "max-w-3xl mx-auto p-6"}>
        <SizeModal
          show={showSizeModal}
          config={config}
          useCustomStyles={useCustomStyles}
          pendingProjectType={pendingProjectType}
          sizeMode={sizeMode}
          setSizeMode={setSizeMode}
          modalLength={modalLength}
          setModalLength={setModalLength}
          modalWidth={modalWidth}
          setModalWidth={setModalWidth}
          modalSf={modalSf}
          setModalSf={setModalSf}
          sizeError={sizeError}
          onCancel={cancelSizeModal}
          onSave={saveSizeModal}
        />

        {screen === 1 && (
          <>
          <EstimatorForm
            config={config}
            useCustomStyles={useCustomStyles}
            projectType={projectType}
            setProjectType={setProjectType}
            condition={condition}
            setCondition={setCondition}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={setPhone}
            zip={zip}
            setZip={setZip}
            error={error}
            submitting={submitting}
            openSizeModal={openSizeModal}
            submitEstimate={submitEstimate}
            length={length}
            width={width}
            squareFeet={squareFeet}
            setLength={setLength}
            setWidth={setWidth}
            setSquareFeet={setSquareFeet}
          />
          {outOfServiceArea && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
                <div className="text-4xl mb-4">📍</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Outside Service Area</h2>
                <p className="text-gray-600 mb-6">
                  We're sorry, but we don't currently service the zip code <strong>{zip}</strong>. Please contact us to learn more about our coverage area.
                </p>
                <button
                  onClick={() => setOutOfServiceArea(false)}
                  className="px-6 py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {outOfAreaBelowThreshold && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
                <div className="text-4xl mb-4">📍</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Outside Service Area</h2>
                <p className="text-gray-600 mb-6">
                  {config?.out_of_area_sorry_message || "Thank you for your interest. Based on the ZIP code entered, this project appears to be outside our normal service area."}
                </p>
                <button
                  onClick={() => setOutOfAreaBelowThreshold(false)}
                  className="px-6 py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
          </>
        )}
        {/* Out-of-area price reveal disclaimer modal */}
        {showOutOfAreaDisclaimerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
              <div className="text-4xl mb-4">🧭</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Outside Our Normal Service Area</h2>
              <p className="text-gray-600 mb-6 text-sm">
                {config?.out_of_area_large_job_message || "You are outside our normal service area, but this project may still be worth reviewing. Please complete the form and we'll take a look."}
              </p>
              <button
                onClick={() => setShowOutOfAreaDisclaimerModal(false)}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700"
              >
                Got It — Show My Estimate
              </button>
            </div>
          </div>
        )}

        {/* Two estimates modal */}
        {showTwoEstimatesModal && (
          <TwoEstimatesModal
            estimates={existingEstimatesForModal}
            config={config}
            onClose={() => setShowTwoEstimatesModal(false)}
          />
        )}

        {screen === 2 && estimate && (
          <EstimatorResults
            config={config}
            useCustomStyles={useCustomStyles}
            estimate={estimate}
            projectType={projectType}
            condition={condition}
            length={length}
            width={width}
            squareFeet={squareFeet}
            companyPhone={companyPhone}
            activeFinish={activeFinish}
            setActiveFinish={setActiveFinish}
            onSecondEstimate={leadId && estimateCount < 2 ? () => setScreen(3) : undefined}
            estimateCount={estimateCount}
          />
        )}

        {/* Screen 3: Second estimate mini-form */}
        {screen === 3 && (
          <SecondEstimateForm
            config={config}
            useCustomStyles={useCustomStyles}
            projectType2={projectType2}
            setProjectType2={setProjectType2}
            condition2={condition2}
            setCondition2={setCondition2}
            length2={length2}
            width2={width2}
            squareFeet2={squareFeet2}
            openSizeModal={(type) => openSizeModal(type, 2)}
            setLength2={setLength2}
            setWidth2={setWidth2}
            setSquareFeet2={setSquareFeet2}
            onSubmit={submitSecondEstimate}
            onBack={() => setScreen(2)}
            submitting={submitting2}
            error={error2}
          />
        )}

        {/* Screen 4: Combined results */}
        {screen === 4 && estimate2 && (
          <CombinedResults
            config={config}
            useCustomStyles={useCustomStyles}
            estimate={estimate1FromDB || estimate}
            projectType={estimate1FromDB ? (existingEstimatesForModal[0]?.project_type || "") : projectType}
            condition={estimate1FromDB ? (existingEstimatesForModal[0]?.condition || "") : condition}
            length={""}
            width={""}
            squareFeet={""}
            estimate2={estimate2}
            projectType2={projectType2}
            condition2={condition2}
            length2={length2}
            width2={width2}
            squareFeet2={squareFeet2}
            activeFinish={activeFinish}
            setActiveFinish={setActiveFinish}
            activeFinish2={activeFinish2}
            setActiveFinish2={setActiveFinish2}
            companyPhone={companyPhone}
          />
        )}
      </div>
    </>
  );
}