// ============================================================================
// Estimator Results Component (Screen 2)
// File: estimator/components/EstimatorResults.jsx
// Version: v2.3.0 - Add Custom finish tab + finish descriptions + mobile tab rotate + inline links
// ============================================================================

import { formatPhoneDisplay } from "../utils/validators";

/**
 * Parses inline link syntax inside text:
 *   "Normal text (https://example.com,learn more) more text"
 * Supports multiple links.
 * Links open in the same tab/window (no target _blank).
 */
function renderTextWithInlineLinks(text) {
  if (!text || typeof text !== "string") return null;

  const parts = [];
  const re = /\((https?:\/\/[^,\s]+)\s*,\s*([^)]+)\)/g;

  let lastIndex = 0;
  let match;
  let linkIndex = 0;

  while ((match = re.exec(text)) !== null) {
    const [fullMatch, url, linkText] = match;
    const start = match.index;
    const end = start + fullMatch.length;

    // Plain text before the link
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    // Link
    parts.push(
      <a
        key={`inline-link-${linkIndex++}`}
        href={url}
        className="underline"
      >
        {linkText}
      </a>
    );

    lastIndex = end;
  }

  // Remaining trailing text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no matches, return original string
  if (parts.length === 0) return text;

  // Wrap to preserve spacing around links
  return parts.map((p, i) => (typeof p === "string" ? <span key={`txt-${i}`}>{p}</span> : p));
}

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
  setActiveFinish,
  onSecondEstimate,
  estimateCount = 1,
}) {
  // Get labels from config
  const customProjectLabel = config?.custom_project_label || "Other Project";
  const conditionGoodLabel = config?.condition_good_label || "Good";
  const conditionMinorLabel = config?.condition_minor_label || "A Few Cracks";
  const conditionMajorLabel = config?.condition_major_label || "A Lot of Cracks";
  const minJobInfoText = config?.min_job_info_text || "Minimum job pricing applied.";
  const standardInfoText = config?.standard_info_text || "This is an estimate based on the information provided.";
  const largeProjectSfThreshold = config?.large_project_sf_threshold ? Number(config.large_project_sf_threshold) : null;
  const largeProjectNote = config?.large_project_note || null;
  const cta1Button = config?.cta1_button || "";
const cta1Link = config?.cta1_link || "";
const cta2Button = config?.cta2_button || "";
const cta2Link = config?.cta2_link || "";


// Finish descriptions (already exist in DB; not yet wired into admin UI)
  const solidFinishDescription = config?.solid_finish_description || "";
  const flakeFinishDescription = config?.flake_finish_description || "";
  const metallicFinishDescription = config?.metallic_finish_description || "";
  const customFinishDescription = config?.custom_finish_description || "";

  // Custom finish label (admin-defined display name)
  const customFinishLabel = config?.custom_finish_label || "Custom";

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
  const showMinJobText =
    currentFinishMinimumApplied &&
    estimate.allPriceRanges[activeFinish]?.min === estimate.allPriceRanges[activeFinish]?.max;

  const isLargeProject = largeProjectSfThreshold && estimate?.calculatedSf >= largeProjectSfThreshold;
  const infoText = showMinJobText ? minJobInfoText : (isLargeProject && largeProjectNote ? largeProjectNote : standardInfoText);

  // Finish-specific description (based on active tab)
  let finishDescriptionText = "";
  if (activeFinish === "solid") finishDescriptionText = solidFinishDescription;
  if (activeFinish === "flake") finishDescriptionText = flakeFinishDescription;
  if (activeFinish === "metallic") finishDescriptionText = metallicFinishDescription;
  if (activeFinish === "custom") finishDescriptionText = customFinishDescription;

  const hasFinishDescription = Boolean(finishDescriptionText && String(finishDescriptionText).trim().length > 0);
  console.log("[EstimatorResults] activeFinish:", activeFinish, "| desc:", finishDescriptionText, "| config.solid_finish_description:", config?.solid_finish_description);

  const phoneDisplay = formatPhoneDisplay(companyPhone);
  const phoneTel = companyPhone.replace(/\D/g, "");

  // Style classes


// Style classes
const cardClass = useCustomStyles
  ? "estimator-card p-6"
  : "bg-white rounded-xl shadow p-6";


  const primaryBtnClass = useCustomStyles
    ? "estimator-primary-btn font-bold py-3 rounded-lg"
    : "bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg";

  // Price box border style
  const priceBoxStyle = useCustomStyles
    ? { borderColor: priceBoxBorderColor, borderWidth: "1px", borderStyle: "solid" }
    : {};

  const priceBoxClass = useCustomStyles
    ? "rounded-lg overflow-hidden"
    : "border border-orange-300 rounded-lg overflow-hidden";

  // Info box styles (shared colors with standard info text box)
  const infoBoxStyle = useCustomStyles
    ? {
        backgroundColor: pricingInfoBoxBackground,
        borderLeftColor: pricingInfoBoxStripeColor,
        borderLeftWidth: "4px",
        borderLeftStyle: "solid"
      }
    : {};

const infoBoxClass = useCustomStyles
  ? "rounded-md px-4 py-4 text-sm"
  : "bg-yellow-50 border-l-4 border-orange-400 rounded-md px-4 py-4 text-sm";


  const renderCTA = (label, link) => {
    if (!label || !link) return null;

    return (
      <a
        href={link}
        className={`w-full ${primaryBtnClass} text-center`}
      >
        {label}
      </a>
    );
  };



  // Finish tabs list (include custom)
  const finishTabs = ["solid", "flake", "metallic", "custom"];

  // Tab label helper
  const getFinishLabel = (finish) => {
    if (finish === "custom") return customFinishLabel;
    return finish.charAt(0).toUpperCase() + finish.slice(1);
  };

  // Mobile contingency:
  // - Only rotate text on very narrow screens to save tab width
  // - Uses Tailwind arbitrary breakpoint (max-[420px]) so most phones benefit when needed
  const tabTextClass = "max-[420px]:[writing-mode:vertical-rl] max-[420px]:leading-none";

  return (
    <div className={cardClass}>
      <h2 className="text-2xl font-bold text-center mb-6">Your Estimated Price</h2>

      {/* Tabs at top like file folders */}
      <div className="flex justify-center gap-1">
{finishTabs.map((finish) => {
          if (!config) return null;
          // Check if finish has pricing in new system
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
              <span className={tabTextClass}>{getFinishLabel(finish)}</span>
            </button>
          );
        })}
      </div>

{/* Price box connects to active tab */}
<div className={priceBoxClass} style={{ ...priceBoxStyle, marginTop: "-1px" }}>
  <div className="p-5 text-center space-y-2">
    <div className="text-lg font-semibold text-gray-700">
      {projectLabel}
    </div>

    <div className="text-2xl font-bold">
      {priceDisplay}
      <span className="text-sm align-super">*</span>
    </div>

    <div className="text-sm text-gray-600">
      Your floor's current condition:{" "}
      <strong>{conditionLabel}</strong>
    </div>

    {hasFinishDescription && (
      <div className="text-sm text-gray-600 pt-1">
        {renderTextWithInlineLinks(String(finishDescriptionText))}
      </div>
    )}

    {infoText && (
      <div className="text-xs text-gray-500 italic pt-1">
        * {infoText}
      </div>
    )}
  </div>
</div>

{/* BOTTOM CTA BUTTONS */}
<div className="mt-8 flex flex-col md:flex-row gap-4">
  {cta1Button && cta1Link && (
    <a
      href={cta1Link}
      className={`w-full md:w-1/2 ${primaryBtnClass} text-center`}
    >
      {cta1Button}
    </a>
  )}

  {cta2Button && cta2Link && (
    <a
      href={cta2Link}
      className={`w-full md:w-1/2 ${primaryBtnClass} text-center`}
    >
      {cta2Button}
    </a>
  )}
</div>

{/* Have another space? — only if fewer than 2 estimates exist */}
{estimateCount >= 2 ? (
  <div className="mt-4 text-center">
    <p className="text-sm text-gray-500">
      Here are the 2 estimates you requested — if you need more areas estimated, call us.
    </p>
  </div>
) : onSecondEstimate ? (
  <div className="mt-4 text-center">
    <button
      type="button"
      onClick={onSecondEstimate}
      className="text-sm font-semibold underline text-gray-600 hover:text-gray-900"
    >
      Have another space? Add a second estimate
    </button>
  </div>
) : null}

    </div>
  );
}
