// ============================================================================
// Estimator Form Component (Screen 1)
// File: estimator/components/EstimatorForm.jsx
// Version: v2.2.0 - Fixed size clearing when switching project types
// ============================================================================

import { validEmail, validPhone, formatPhoneNumber } from "../utils/validators";

export default function EstimatorForm({
  config,
  useCustomStyles,
  projectType,
  setProjectType,
  condition,
  setCondition,
  name,
  setName,
  email,
  setEmail,
  phone,
  setPhone,
  zip,
  setZip,
  error,
  submitting,
  openSizeModal,
  submitEstimate,
  length,
  width,
  squareFeet,
  setLength,
  setWidth,
  setSquareFeet
}) {
  // Get labels from config
  const customProjectLabel = config?.custom_project_label || "Other Project";
  const conditionGoodLabel = config?.condition_good_label || "Good";
  const conditionMinorLabel = config?.condition_minor_label || "A Few Cracks";
  const conditionMajorLabel = config?.condition_major_label || "A Lot of Cracks";

  // Get button colors from config
  const selectedButtonColor = config?.selected_button_color || "#f97316";
  const selectedButtonTextColor = config?.selected_button_text_color || "#ffffff";
  const unselectedButtonColor = config?.unselected_button_color || "#ffffff";
  const unselectedButtonTextColor = config?.unselected_button_text_color || "#4b5563";

  // Validation
  const needsSizeModal = ["patio", "basement", "custom", "commercial"].includes(projectType);
  const isCommercial = projectType === "commercial";
  const isDimsProject = ["patio", "basement", "custom"].includes(projectType);

  const formValid =
    projectType &&
    condition &&
    name.trim() &&
    validEmail(email) &&
    validPhone(phone) &&
    zip.trim() &&
    (!needsSizeModal ||
      (isDimsProject && ((Number(length) > 0 && Number(width) > 0) || Number(squareFeet) > 0)) ||
      (isCommercial && Number(squareFeet) > 0));

  // Style classes
  const cardClass = useCustomStyles
    ? "estimator-card p-6 space-y-6"
    : "bg-white rounded-xl shadow p-6 space-y-6";

  // Button styling
  const selectedBtnClass = useCustomStyles
    ? "rounded-lg border px-4 py-3 font-medium"
    : "rounded-lg border px-4 py-3 font-medium bg-orange-500 text-white border-orange-500";

  const selectedBtnStyle = useCustomStyles
    ? {
        backgroundColor: selectedButtonColor,
        color: selectedButtonTextColor,
        borderColor: selectedButtonColor
      }
    : {};

  const unselectedBtnClass = useCustomStyles
    ? "rounded-lg border px-4 py-3 font-medium"
    : "rounded-lg border px-4 py-3 font-medium bg-white hover:bg-gray-50 border-gray-300";

  const unselectedBtnStyle = useCustomStyles
    ? {
        backgroundColor: unselectedButtonColor,
        color: unselectedButtonTextColor,
        borderColor: "#d1d5db" // gray-300 for border
      }
    : {};

  const submitBtnClass = formValid
    ? "estimator-primary-btn w-full font-bold py-3 rounded-lg"
    : "w-full font-bold py-3 rounded-lg bg-gray-300 text-gray-500 cursor-not-allowed";

  return (
    <div className={cardClass}>
      <h2 className="text-2xl font-bold text-center">Instant Price Estimator</h2>

      <div>
        <label className="font-semibold block mb-2">Your Project</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["garage_1", "garage_2", "garage_3", "garage_4", "patio", "basement", "commercial", "custom"].map((type) => {

            if (!config) return null;

            // Check visibility
            if (type === "garage_1" && config.allow_garage_1 === false) return null;
            if (type === "garage_2" && config.allow_garage_2 === false) return null;
            if (type === "garage_3" && config.allow_garage_3 === false) return null;
            if (type === "garage_4" && config.allow_garage_4 === false) return null;
            if (type === "patio" && config.allow_patio === false) return null;
            if (type === "basement" && config.allow_basement === false) return null;
            if (type === "commercial" && config.allow_commercial === false) return null;
            if (type === "custom" && config.allow_custom === false) return null;

            const isSelected = projectType === type;
            const btnClass = isSelected ? selectedBtnClass : unselectedBtnClass;
            const btnStyle = isSelected ? selectedBtnStyle : unselectedBtnStyle;

            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  if (["patio", "basement", "custom", "commercial"].includes(type)) {
                    openSizeModal(type);
                  } else {
                    setProjectType(type);
                    setLength("");
                    setWidth("");
                    setSquareFeet("");
                  }
                }}
                className={btnClass}
                style={btnStyle}
              >
                {type === "garage_1" && "1 Car Garage"}
                {type === "garage_2" && "2 Car Garage"}
                {type === "garage_3" && "3 Car Garage"}
                {type === "garage_4" && "4 Car Garage"}
                {type === "patio" && "Patio"}
                {type === "basement" && "Basement"}
                {type === "commercial" && "Commercial"}
                {type === "custom" && customProjectLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="font-semibold block mb-2">Condition of Concrete</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "none", label: conditionGoodLabel },
            { value: "minor", label: conditionMinorLabel },
            { value: "major", label: conditionMajorLabel }
          ].map((opt) => {
            const isSelected = condition === opt.value;
            const btnClass = isSelected ? selectedBtnClass : unselectedBtnClass;
            const btnStyle = isSelected ? selectedBtnStyle : unselectedBtnStyle;

            return (
              <button 
                key={opt.value} 
                type="button" 
                onClick={() => setCondition(opt.value)} 
                className={btnClass}
                style={btnStyle}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input 
          className="border rounded px-3 py-2" 
          placeholder="Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
        />
        <input 
          className="border rounded px-3 py-2" 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
        />
        <input 
          className="border rounded px-3 py-2" 
          placeholder="Phone" 
          value={phone} 
          onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
        />
        <input 
          className="border rounded px-3 py-2" 
          placeholder="ZIP Code" 
          value={zip} 
          onChange={(e) => {
            const cleaned = e.target.value.replace(/\D/g, "");
            setZip(cleaned.substring(0, 5));
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded text-red-700">
          {error}
        </div>
      )}

      <button 
        onClick={submitEstimate} 
        disabled={!formValid || submitting} 
        className={submitBtnClass}
      >
        {submitting ? "Calculating..." : "Get My Estimate"}
      </button>
    </div>
  );
}