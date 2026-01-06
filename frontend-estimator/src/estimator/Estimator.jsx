// ============================================================================
// Estimator Main Component
// File: estimator/Estimator.jsx
// Version: v2.1.0 - FIXED: Now saves estimate to estimator_leads table
// ============================================================================

import { useState } from "react";
import useEstimatorConfig from "./hooks/useEstimatorConfig";
import SizeModal from "./components/SizeModal";
import EstimatorForm from "./components/EstimatorForm";
import EstimatorResults from "./components/EstimatorResults";

const params = new URLSearchParams(window.location.search);
const companyId = params.get("company");

export default function Estimator() {
  // Config hook - handles fetching and style generation
  const { config, customStyles, useCustomStyles } = useEstimatorConfig();

  // Screen state
  const [screen, setScreen] = useState(1);
  const [activeFinish, setActiveFinish] = useState("flake");

  // Form state
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

  // Size modal state
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [pendingProjectType, setPendingProjectType] = useState("");
  const [sizeMode, setSizeMode] = useState("dims");
  const [modalLength, setModalLength] = useState("");
  const [modalWidth, setModalWidth] = useState("");
  const [modalSf, setModalSf] = useState("");
  const [sizeError, setSizeError] = useState("");
  // Wait for config to load
  if (!config) {
    return <div>Loading...</div>;
  }

// No company parameter OR estimator not enabled - show promo
  if (!companyId || !config.estimatorEnabled) {
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

  // Estimator not enabled for this company - show promo
console.log("🔍 Config loaded:", config);
console.log("🔍 is_active value:", config?.is_active);
console.log("🔍 Showing splash?", !config.is_active);

if (!config.is_active) {
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

  // No company parameter - show splash screen
  if (!companyId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Floor Coating Estimator</h1>
        <p className="text-xl text-gray-600">Please access this estimator through your contractor's website.</p>
      </div>
    );
  }

  // Estimator not enabled for this company - show promo
  if (!config.estimatorEnabled) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-6">Push Button Marketing for Floor Coating Contractors</h1>
        <img 
          src="https://i.imgur.com/YOUR_UPLOADED_IMAGE.png" 
          alt="CoatingPro360" 
          className="w-64 h-64 mx-auto mb-6"
        />
        <a 
          href="https://coatingpro360.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-xl font-semibold"
        >
          Visit CoatingPro360.com
        </a>
      </div>
    );
  }

  // Modal handlers
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

  // Form submission
  async function submitEstimate() {
    setSubmitting(true);
    setError("");

    try {
      // 1️⃣ Get estimate preview
      console.log("🔍 Company ID from URL:", companyId);
      
const previewRes = await fetch("https://api.coatingpro360.com/estimator/preview", {




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
  status: "lead",
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
const leadRes = await fetch("https://api.coatingpro360.com/leads", {
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

      // 3️⃣ Show results
      setEstimate(previewData.estimate);
      setCompanyPhone(previewData.companyPhone || "");
      setScreen(2);

    } catch (err) {
      console.error("💥 SUBMIT ERROR:", err);
      setError(err.message);
    } finally {
      setSubmitting(false);
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
          />
        )}
      </div>
    </>
  );
}