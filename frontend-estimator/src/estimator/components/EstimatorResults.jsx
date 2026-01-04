// ============================================================================
// Estimator Results Component (Screen 2)
// File: estimator/components/EstimatorResults.jsx
// Version: v2.2.0 - Tabbed file-folder design
// ============================================================================

import { formatPhoneDisplay } from "../utils/validators";

export default function EstimatorResults({
  config,
  useCustomStyles,
  estimate,
  projectType,
  condition,
  length,
  width,
  squareFeet,
  companyPhone,
  activeFinish,
  setActiveFinish
}) {
  // Get labels from config
  const customProjectLabel = config?.custom_project_label || "Other Project";
  const conditionGoodLabel = config?.condition_good_label || "Good";
  const conditionMinorLabel = config?.condition_minor_label || "A Few Cracks";
  const conditionMajorLabel = config?.condition_major_label || "A Lot of Cracks";
  const minJobInfoText = config?.min_job_info_text || "Minimum job pricing applied.";
  const standardInfoText = config?.standard_info_text || "This is an estimate based on the information provided.";

 // Get Results Page colors from config
  const priceBoxBorderColor = config?.price_box_border_color || "#fdba74";
  const pricingInfoBoxBackground = config?.pricing_info_box_background || "#fefce8";
  const pricingInfoBoxStripeColor = config?.pricing_info_box_stripe_color || "#fb923c";
  const textColor = config?.text_color || "#111827";

  // Get button colors from config (for finish tabs)
  const selectedButtonColor = config?.selected_button_color || "#f97316";
  const selectedButtonTextColor = config?.selected_button_text_color || "#ffffff";
  const unselectedButtonColor = config?.unselected_button_color || "#ffffff";
  const unselectedButtonTextColor = config?.unselected_button_text_color || "#4b5563";

  // Calculate display values
  let projectLabel = "";
  if (projectType.startsWith("garage_")) {
    projectLabel = projectType.split("_")[1] + " car garage";
  } else if (["patio", "basement"].includes(projectType)) {
    if (Number(length) > 0 && Number(width) > 0) {
      projectLabel = length + "' × " + width + "' " + projectType;
    } else if (Number(squareFeet) > 0) {
      projectLabel = Number(squareFeet).toLocaleString() + " sq ft " + projectType;
    } else {
      projectLabel = projectType;
    }
  } else if (projectType === "commercial") {
    if (Number(squareFeet) > 0) {
      projectLabel = "Commercial space (" + Number(squareFeet).toLocaleString() + " sq ft)";
    } else {
      projectLabel = "Commercial space";
    }
  } else if (projectType === "custom") {
    if (Number(length) > 0 && Number(width) > 0) {
      projectLabel = length + "' × " + width + "' " + customProjectLabel;
    } else if (Number(squareFeet) > 0) {
      projectLabel = Number(squareFeet).toLocaleString() + " sq ft " + customProjectLabel;
    } else {
      projectLabel = customProjectLabel;
    }
  } else {
    projectLabel = projectType;
  }

let priceDisplay = "$0";
  let currentFinishMinimumApplied = false;
  
  if (estimate.allPriceRanges && estimate.allPriceRanges[activeFinish]) {
    const range = estimate.allPriceRanges[activeFinish];
    currentFinishMinimumApplied = range.minimumApplied || false;
    
    // Show single price only if min === max
    if (range.min === range.max) {
      priceDisplay = "$" + range.min.toLocaleString();
    } else {
      priceDisplay = "$" + range.min.toLocaleString() + " – $" + range.max.toLocaleString();
    }
  }

  let conditionLabel = conditionGoodLabel;
  if (condition === "minor") {
    conditionLabel = conditionMinorLabel;
  } else if (condition === "major") {
    conditionLabel = conditionMajorLabel;
  }

  // Show min job text only if minimum was applied AND it's a flat price (min === max)
  const showMinJobText = currentFinishMinimumApplied && 
    estimate.allPriceRanges[activeFinish]?.min === estimate.allPriceRanges[activeFinish]?.max;
  const infoText = showMinJobText ? minJobInfoText : standardInfoText;
  const phoneDisplay = formatPhoneDisplay(companyPhone);
  const phoneTel = companyPhone.replace(/\D/g, "");

  // Style classes
  const cardClass = useCustomStyles
    ? "estimator-card p-6"
    : "bg-white rounded-xl shadow p-6";

  const primaryBtnClass = useCustomStyles
    ? "estimator-primary-btn font-bold py-3 rounded-lg"
    : "bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg";

  // Price box border style
  const priceBoxStyle = useCustomStyles
    ? { borderColor: priceBoxBorderColor, borderWidth: '1px', borderStyle: 'solid' }
    : {};
  
  const priceBoxClass = useCustomStyles
    ? "rounded-lg overflow-hidden"
    : "border border-orange-300 rounded-lg overflow-hidden";

  // Info box styles
  const infoBoxStyle = useCustomStyles
    ? { 
        backgroundColor: pricingInfoBoxBackground,
        borderLeftColor: pricingInfoBoxStripeColor,
        borderLeftWidth: '4px',
        borderLeftStyle: 'solid'
      }
    : {};
  
  const infoBoxClass = useCustomStyles
    ? "rounded-md px-4 py-4 text-sm"
    : "bg-yellow-50 border-l-4 border-orange-400 rounded-md px-4 py-4 text-sm";

  return (
    <div className={cardClass}>
      <h2 className="text-2xl font-bold text-center mb-6">Your Estimated Price</h2>

      {/* Tabs at top like file folders */}
      <div className="flex justify-center gap-1">
        {["solid", "flake", "metallic"].map((finish) => {

          if (!config) return null;

          if (finish === "flake" && config.offers_flake === false) return null;
          if (finish === "solid" && config.offers_solid === false) return null;
          if (finish === "metallic" && config.offers_metallic === false) return null;

          if (!estimate || !estimate.allPriceRanges || !estimate.allPriceRanges[finish]) {
            return null;
          }

          const isActive = activeFinish === finish;
          
const tabClass = useCustomStyles
            ? isActive
              ? "px-5 py-3 text-sm font-semibold rounded-t-lg border border-b-0"
              : "px-5 py-3 text-sm font-semibold rounded-t-lg border"
            : isActive
              ? "px-5 py-3 text-sm font-semibold rounded-t-lg border border-b-0 bg-white text-gray-900"
              : "px-5 py-3 text-sm font-semibold rounded-t-lg border bg-gray-100 text-gray-600 border-gray-300";

const tabStyle = useCustomStyles
            ? isActive
              ? {
                  backgroundColor: "#ffffff",
                  color: textColor || "#111827",
                  borderColor: priceBoxBorderColor,
                  borderBottomColor: "transparent"
                }
              : {
                  backgroundColor: "#f3f4f6",
                  color: unselectedButtonTextColor,
                  borderColor: "#d1d5db",
                  borderBottomColor: priceBoxBorderColor
                }
            : isActive
              ? { borderColor: priceBoxBorderColor, borderBottomColor: "transparent" }
              : { borderBottomColor: priceBoxBorderColor };

          return (
            <button 
              key={finish} 
              onClick={() => setActiveFinish(finish)} 
              className={tabClass}
              style={tabStyle}
            >
              {finish.charAt(0).toUpperCase() + finish.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Price box connects to active tab */}
      <div className={priceBoxClass} style={{...priceBoxStyle, marginTop: '-1px'}}>
        <div className="p-5 text-center space-y-1">
          <div className="text-sm font-semibold text-gray-700">{projectLabel}</div>
          <div className="text-2xl font-bold">{priceDisplay}</div>
          <div className="text-sm text-gray-600">
            Your floor's current condition: <strong>{conditionLabel}</strong>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className={infoBoxClass} style={infoBoxStyle}>
            {infoText}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col md:flex-row gap-4">
        {config?.ty_url_redirect ? (
          <a 
            href={config.ty_url_redirect}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full md:w-1/2 ${primaryBtnClass} text-center`}
          >
            {config?.next_steps_button_text || "Request an In-Person Estimate"}
          </a>
        ) : (
          <button className={`w-full md:w-1/2 ${primaryBtnClass}`}>
            {config?.next_steps_button_text || "Request an In-Person Estimate"}
          </button>
        )}
        <a 
          href={"tel:" + phoneTel} 
          className={`w-full md:w-1/2 ${primaryBtnClass} text-center`}
        >
          Call me at {phoneDisplay}
        </a>
      </div>
    </div>
  );
}