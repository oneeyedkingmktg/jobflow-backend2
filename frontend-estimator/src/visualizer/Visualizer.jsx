// ============================================================================
// Visualizer — customer-facing floor visualization widget
// Embed: <script src="..."></script> with ?mode=visualizer&company=COMPANY_ID
// ============================================================================

import { useState, useEffect } from "react";

const params = new URLSearchParams(window.location.search);
const companyId = params.get("company");
const API_BASE = import.meta.env.VITE_API_URL || "https://api.coatingpro360.com";

// ── Step 1: Upload ────────────────────────────────────────────────────────────
function UploadStep({ onNext }) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  function handleFile(f) {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Please upload an image file."); return; }
    if (f.size > 20 * 1024 * 1024) { setError("Image must be under 20MB."); return; }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">See Your Floor Transformed</h1>
        <p className="text-gray-500 mt-1 text-sm">Upload a photo of your garage and see it with a new epoxy floor.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50 hover:border-gray-400"
        }`}
        onClick={() => document.getElementById("viz-file-input").click()}
      >
        {preview ? (
          <img src={preview} alt="Your garage" className="max-h-64 mx-auto rounded-lg object-contain" />
        ) : (
          <>
            <div className="text-5xl mb-3">📷</div>
            <p className="font-semibold text-gray-700">Drop your photo here or click to browse</p>
            <p className="text-sm text-gray-400 mt-1">JPG, PNG, HEIC — up to 20MB</p>
          </>
        )}
        <input id="viz-file-input" type="file" accept="image/*" className="hidden"
          onChange={(e) => handleFile(e.target.files[0])} />
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      {preview && (
        <div className="space-y-2">
          <button onClick={() => onNext(file)}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl">
            Choose a Color →
          </button>
          <button onClick={() => { setPreview(null); setFile(null); }}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
            Use a different photo
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Chip color selection ──────────────────────────────────────────────
function ChipSelectStep({ imageFile, onNext, onBack }) {
  const [colors, setColors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/visualizer/chip-colors?company=${companyId}`)
      .then((r) => r.json())
      .then((d) => setColors(d.colors || []))
      .catch(() => setError("Failed to load color options."))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", imageFile);
      form.append("company_id", companyId);
      form.append("chip_color_id", selected.id);

      const res = await fetch(`${API_BASE}/api/visualizer/start`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      onNext(data.visualization_id);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) return <div className="text-center p-12 text-gray-400">Loading colors...</div>;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Back</button>
        <h2 className="text-2xl font-bold text-gray-900">Choose Your Chip Blend</h2>
        <p className="text-gray-500 text-sm mt-1">Pick the color mix you want to visualize on your floor.</p>
      </div>

      {colors.length === 0 && !error && (
        <p className="text-gray-400 text-center py-8">No chip colors configured yet.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {colors.map((c) => (
          <button key={c.id} onClick={() => setSelected(c)}
            className={`border-2 rounded-xl p-3 text-left transition-all ${
              selected?.id === c.id ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
            }`}>
            {c.reference_image_url && (
              <img src={c.reference_image_url} alt={c.name}
                className="w-full h-24 object-cover rounded-lg mb-2" />
            )}
            {!c.reference_image_url && (
              <div className="w-full h-24 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-2xl">🎨</div>
            )}
            <div className="font-semibold text-gray-800 text-sm">{c.name}</div>
            {c.description && <div className="text-xs text-gray-400 mt-0.5">{c.description}</div>}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button onClick={handleGenerate} disabled={!selected || submitting}
        className={`w-full py-3 font-bold rounded-xl text-white transition-colors ${
          selected && !submitting ? "bg-green-600 hover:bg-green-700" : "bg-gray-300 cursor-not-allowed"
        }`}>
        {submitting ? "Starting..." : "Generate My Visualization →"}
      </button>
    </div>
  );
}

// ── Step 3: Generating (polling) ──────────────────────────────────────────────
function GeneratingStep({ visualizationId, onDone }) {
  const [dots, setDots] = useState(".");
  const [error, setError] = useState("");

  useEffect(() => {
    const dotInterval = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      while (!stopped) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const res = await fetch(`${API_BASE}/api/visualizer/status/${visualizationId}`);
          const data = await res.json();
          if (data.status === "complete") { onDone(data); return; }
          if (data.status === "failed") { setError(data.error_message || "Generation failed."); return; }
        } catch {}
      }
    }
    poll();
    return () => { stopped = true; };
  }, [visualizationId]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
        <p className="text-gray-500 text-sm">{error}</p>
        <p className="text-gray-400 text-sm">Please try again or contact us for a free quote.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 text-center space-y-6">
      <div className="text-6xl animate-pulse">🎨</div>
      <h2 className="text-2xl font-bold text-gray-900">Creating Your Visualization{dots}</h2>
      <p className="text-gray-500 text-sm">Our AI is applying your selected chip blend to your floor.<br />This takes about 30 seconds.</p>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className="h-2 bg-green-500 rounded-full animate-pulse" style={{ width: "60%" }} />
      </div>
    </div>
  );
}

// ── Step 4: Result + lead capture ─────────────────────────────────────────────
function ResultStep({ result, visualizationId, onReset }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) { setError("Name and phone are required."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/visualizer/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visualization_id: visualizationId, company_id: companyId, name, phone, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 text-center">Your Floor Transformation</h2>

      {/* Side-by-side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1 text-center">Before</p>
          <img src={result.original_image_url} alt="Original floor"
            className="w-full rounded-xl object-cover" />
        </div>
        <div>
          <p className="text-xs font-semibold text-green-600 uppercase mb-1 text-center">After</p>
          <img src={result.generated_image_url} alt="Visualized floor"
            className="w-full rounded-xl object-cover" />
        </div>
      </div>

      {submitted ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-2">
          <div className="text-3xl">✅</div>
          <h3 className="font-bold text-green-800">We'll be in touch!</h3>
          <p className="text-sm text-green-700">Thank you, {name}. Someone will reach out shortly to discuss your project.</p>
          <button onClick={onReset} className="mt-2 text-sm text-green-600 underline">Try another color</button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900 text-center">Get a Free Quote for This Floor</h3>
          <div className="grid grid-cols-1 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your name *" className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm w-full focus:outline-none focus:border-green-500" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number *" type="tel" className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm w-full focus:outline-none focus:border-green-500" />
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)" type="email" className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm w-full focus:outline-none focus:border-green-500" />
          </div>
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button onClick={handleSubmit} disabled={submitting}
            className={`w-full py-3 font-bold rounded-xl text-white ${submitting ? "bg-gray-300 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}>
            {submitting ? "Sending..." : "Get My Free Quote →"}
          </button>
          <p className="text-xs text-gray-400 text-center">No spam. We'll only contact you about your floor project.</p>
        </div>
      )}

      {!submitted && (
        <button onClick={onReset} className="w-full text-sm text-gray-400 hover:text-gray-600">
          ← Try a different color or photo
        </button>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function Visualizer() {
  const [step, setStep] = useState(1);
  const [imageFile, setImageFile] = useState(null);
  const [visualizationId, setVisualizationId] = useState(null);
  const [result, setResult] = useState(null);

  function reset() {
    setStep(1);
    setImageFile(null);
    setVisualizationId(null);
    setResult(null);
  }

  if (!companyId) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Floor Visualizer</h1>
        <p className="text-gray-500">Missing company configuration.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {step === 1 && <UploadStep onNext={(f) => { setImageFile(f); setStep(2); }} />}
      {step === 2 && <ChipSelectStep imageFile={imageFile} onBack={() => setStep(1)}
        onNext={(id) => { setVisualizationId(id); setStep(3); }} />}
      {step === 3 && <GeneratingStep visualizationId={visualizationId}
        onDone={(r) => { setResult(r); setStep(4); }} />}
      {step === 4 && <ResultStep result={result} visualizationId={visualizationId} onReset={reset} />}
    </div>
  );
}
