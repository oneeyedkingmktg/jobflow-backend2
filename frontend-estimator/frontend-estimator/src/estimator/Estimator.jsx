// ============================================================================
// Estimator UI
// File: estimator/Estimator.jsx
// Version: v1.6.0 - Config-driven visibility (surgical only)
// ============================================================================

import { useEffect, useState } from "react";

export default function Estimator() {
  const [screen, setScreen] = useState(1);
  const [activeFinish, setActiveFinish] = useState("flake");
  const [customProjectLabel, setCustomProjectLabel] = useState("Other Project");
  const [customProjectEnabled, setCustomProjectEnabled] = useState(true);

  // ADDED (surgical)
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch("/estimator/config")
      .then(res => res.json())
      .then(data => {
        setConfig(data); // ADDED (surgical)

        const label = data.customProjectLabel || data.custom_project_label || "";
        if (label.trim()) {
          setCustomProjectLabel(label.trim());
          setCustomProjectEnabled(true);
        }
      })
      .catch(err => console.error("Config error:", err));
  }, []);

  const [projectType, setProjectType] = useState("");
  const [condition, setCondition] = useState(""); // CHANGED: was "none", now required
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [squareFeet, setSquareFeet] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showSizeModal, setShowSizeModal] = useState(false);
  const [pendingProjectType, setPendingProjectType] = useState("");
  const [sizeMode, setSizeMode] = useState("dims");
  const [modalLength, setModalLength] = useState("");
  const [modalWidth, setModalWidth] = useState("");
  const [modalSf, setModalSf] = useState("");
  const [sizeError, setSizeError] = useState("");

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const validPhone = (v) => /^\D*(\d\D*){10,}$/.test(v);

  // ADDED: Phone formatter
  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, "");
    const limited = cleaned.substring(0, 10);

    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    } else {
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  };

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

  function openSizeModal(nextType) {
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
    setProjectType("");
    setLength("");
    setWidth("");
    setSquareFeet("");
  }

  function saveSizeModal() {
    if (!pendingProjectType) return;

    if (pendingProjectType === "commercial") {
      const sf = Number(modalSf);
      if (!sf || sf <= 0) {
        setSizeError("Square footage is required.");
        return;
      }
      setProjectType(pendingProjectType);
      setSquareFeet(String(sf));
    } else if (sizeMode === "dims") {
      const l = Number(modalLength);
      const w = Number(modalWidth);
      if (!l || !w) {
        setSizeError("Length and width are required.");
        return;
      }
      setProjectType(pendingProjectType);
      setLength(String(l));
      setWidth(String(w));
      setSquareFeet("");
    } else {
      const sf = Number(modalSf);
      if (!sf) {
        setSizeError("Square footage is required.");
        return;
      }
      setProjectType(pendingProjectType);
      setSquareFeet(String(sf));
      setLength("");
      setWidth("");
    }

    setShowSizeModal(false);
    setPendingProjectType("");
    setSizeError("");
  }

  async function submitEstimate() {
    if (!formValid || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/estimator/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: { type: projectType, condition },
          length,
          width,
          squareFeet,
          selectedQuality: activeFinish,
          zip,
          contact: { name, email, phone }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to generate estimate");

      setEstimate(data);
      setScreen(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Pre-calculate all display values for Screen 2
  let projectLabel = "";
  let priceDisplay = "$0";
  let conditionLabel = "Good";
  let infoText = "This is an estimate based on the information provided.";
  let phoneDisplay = phone;
  let phoneTel = phone;

  if (screen === 2 && estimate) {
    // Project label
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
    } else {
      projectLabel = projectType;
    }

    // Price display
    if (estimate.allPriceRanges && estimate.allPriceRanges[activeFinish]) {
      const range = estimate.allPriceRanges[activeFinish];
      if (estimate.minimumJobApplied) {
        priceDisplay = "$" + estimate.displayPriceMin.toLocaleString();
      } else {
        priceDisplay = "$" + range.min.toLocaleString() + " – $" + range.max.toLocaleString();
      }
    }

    // Condition label
    if (condition === "minor") {
      conditionLabel = "A Few Cracks";
    } else if (condition === "major") {
      conditionLabel = "A Lot of Cracks";
    }

    // Info text
    if (estimate.minimumJobApplied && estimate.minJobInfoText) {
      infoText = estimate.minJobInfoText;
    } else if (!estimate.minimumJobApplied && estimate.standardInfoText) {
      infoText = estimate.standardInfoText;
    }

    // Phone formatting
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      phoneDisplay = "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
    }
    phoneTel = digits;
  }

  const dimsButtonClass = sizeMode === "dims" 
    ? "flex-1 py-2 px-4 rounded-lg font-medium bg-orange-500 text-white" 
    : "flex-1 py-2 px-4 rounded-lg font-medium bg-gray-100";

  const sfButtonClass = sizeMode === "sf"
    ? "flex-1 py-2 px-4 rounded-lg font-medium bg-orange-500 text-white"
    : "flex-1 py-2 px-4 rounded-lg font-medium bg-gray-100";

  const submitButtonClass = formValid
    ? "w-full font-bold py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white"
    : "w-full font-bold py-3 rounded-lg bg-gray-300 text-gray-500 cursor-not-allowed";

  return (
    <div className="max-w-3xl mx-auto p-6">
      {showSizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Enter Size</h3>

            {pendingProjectType !== "commercial" && (
              <div className="flex gap-2 mb-4">
                <button type="button" onClick={() => setSizeMode("dims")} className={dimsButtonClass}>
                  Length × Width
                </button>
                <button type="button" onClick={() => setSizeMode("sf")} className={sfButtonClass}>
                  Square Feet
                </button>
              </div>
            )}

            <div className="space-y-3 mb-4">
              {sizeMode === "dims" && pendingProjectType !== "commercial" ? (
                <div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Length (feet)</label>
                    <input
                      type="number"
                      value={modalLength}
                      onChange={(e) => setModalLength(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Width (feet)</label>
                    <input
                      type="number"
                      value={modalWidth}
                      onChange={(e) => setModalWidth(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="15"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Square Feet</label>
                  <input
                    type="number"
                    value={modalSf}
                    onChange={(e) => setModalSf(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="300"
                  />
                </div>
              )}
            </div>

            {sizeError && (
              <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded mb-4 text-sm text-red-700">
                {sizeError}
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={cancelSizeModal} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 rounded-lg">
                Cancel
              </button>
              <button type="button" onClick={saveSizeModal} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 rounded-lg">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 1 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          <h2 className="text-2xl font-bold text-center">Instant Price Estimator</h2>

          <div>
            <label className="font-semibold block mb-2">Your Project</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["garage_1", "garage_2", "garage_3", "garage_4", "patio", "basement", "commercial"].map((type) => {

                // ADDED (surgical)
                if (config) {
                  if (type === "garage_1" && config.allow_garage_1 === false) return null;
                  if (type === "garage_2" && config.allow_garage_2 === false) return null;
                  if (type === "garage_3" && config.allow_garage_3 === false) return null;
                  if (type === "garage_4" && config.allow_garage_4 === false) return null;
                  if (type === "patio" && config.allow_patio === false) return null;
                  if (type === "basement" && config.allow_basement === false) return null;
                  if (type === "commercial" && config.allow_commercial === false) return null;
                }

                const isSelected = projectType === type;
                const btnClass = isSelected
                  ? "rounded-lg border px-4 py-3 font-medium bg-orange-500 text-white border-orange-500"
                  : "rounded-lg border px-4 py-3 font-medium bg-white hover:bg-gray-50";

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      if (["patio", "basement", "commercial"].includes(type)) {
                        openSizeModal(type);
                      } else {
                        setProjectType(type);
                        setLength("");
                        setWidth("");
                        setSquareFeet("");
                      }
                    }}
                    className={btnClass}
                  >
                    {type === "garage_1" && "1 Car Garage"}
                    {type === "garage_2" && "2 Car Garage"}
                    {type === "garage_3" && "3 Car Garage"}
                    {type === "garage_4" && "4 Car Garage"}
                    {type === "patio" && "Patio"}
                    {type === "basement" && "Basement"}
                    {type === "commercial" && "Commercial"}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-2">Condition of Concrete</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "none", label: "Good" },
                { value: "minor", label: "A Few Cracks" },
                { value: "major", label: "A Lot of Cracks" }
              ].map((opt) => {
                const isSelected = condition === opt.value;
                const btnClass = isSelected
                  ? "rounded-lg border px-4 py-3 font-medium bg-orange-500 text-white border-orange-500"
                  : "rounded-lg border px-4 py-3 font-medium bg-white hover:bg-gray-50";

                return (
                  <button key={opt.value} type="button" onClick={() => setCondition(opt.value)} className={btnClass}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="border rounded px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
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

          <button onClick={submitEstimate} disabled={!formValid || submitting} className={submitButtonClass}>
            {submitting ? "Calculating…" : "Get My Free Estimate"}
          </button>
        </div>
      )}

      {screen === 2 && estimate && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-2xl font-bold text-center mb-6">Your Estimated Price</h2>

          <div className="border border-orange-300 rounded-lg overflow-hidden">
            <div className="p-5 text-center space-y-1">
              <div className="text-sm font-semibold text-gray-700">{projectLabel}</div>
              <div className="text-2xl font-bold">{priceDisplay}</div>
              <div className="text-sm text-gray-600">
                Your floor's current condition: <strong>{conditionLabel}</strong>
              </div>
            </div>

            <div className="px-5 pb-5">
              <div className="bg-yellow-50 border-l-4 border-orange-400 rounded-md px-4 py-4 text-sm">
                {infoText}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-4">
            {["flake", "solid", "metallic"].map((finish) => {

              // ADDED (surgical)
              if (config) {
                if (finish === "flake" && config.offers_flake === false) return null;
                if (finish === "solid" && config.offers_solid === false) return null;
                if (finish === "metallic" && config.offers_metallic === false) return null;
              }

              if (!estimate || !estimate.allPriceRanges || !estimate.allPriceRanges[finish]) {
                return null;
              }

              const isActive = activeFinish === finish;
              const tabClass = isActive
                ? "px-5 py-2 text-sm font-semibold rounded-t-md border bg-orange-500 text-white border-orange-500"
                : "px-5 py-2 text-sm font-semibold rounded-t-md border bg-white text-gray-600 border-gray-300";

              return (
                <button key={finish} onClick={() => setActiveFinish(finish)} className={tabClass}>
                  {finish.charAt(0).toUpperCase() + finish.slice(1)}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col md:flex-row gap-4">
            <button className="w-full md:w-1/2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg">
              Request an In-Person Estimate
            </button>
            <a href={"tel:" + phoneTel} className="w-full md:w-1/2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg text-center">
              Call me at {phoneDisplay}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
