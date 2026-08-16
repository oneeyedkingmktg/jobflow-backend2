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

// ── Step 2: Chip color selection + pre-generation ─────────────────────────────
function ChipSelectStep({ imageFile, preGens, onPreGensUpdate, onNext, onBack }) {
  const [colors, setColors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/visualizer/chip-colors?company=${companyId}`)
      .then((r) => r.json())
      .then((d) => setColors(d.colors || []))
      .catch(() => setError("Failed to load color options."))
      .finally(() => setLoading(false));
  }, []);

  // Kick off pre-generation once colors are loaded and haven't started yet
  useEffect(() => {
    if (!colors.length || Object.keys(preGens).length > 0) return;
    startPregenerate();
  }, [colors]);

  async function startPregenerate() {
    try {
      const form = new FormData();
      form.append("image", imageFile);
      form.append("company_id", companyId);
      const res = await fetch(`${API_BASE}/api/visualizer/pregenerate`, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.generations?.length) {
        const map = {};
        data.generations.forEach((g) => {
          map[g.visualization_id] = { ...g, status: "processing", result: null };
        });
        onPreGensUpdate(map);
      }
    } catch (err) {
      console.error("Pregenerate failed:", err);
    }
  }

  function getPreGen(chipId) {
    return Object.values(preGens).find((g) => g.chip_color_id === chipId) || null;
  }

  async function handleGenerate() {
    if (!selected || submitting) return;
    const pg = getPreGen(selected.id);

    if (pg?.status === "complete") {
      onNext(pg.visualization_id, selected, pg.result, true);
      return;
    }
    if (pg?.status === "processing") {
      onNext(pg.visualization_id, selected, null, false);
      return;
    }

    // Custom color — generate fresh
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
      onNext(data.visualization_id, selected, null, false);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  function getBarLabel() {
    if (submitting) return "Starting...";
    if (!selected) return "Select a color";
    const pg = getPreGen(selected.id);
    if (pg?.status === "complete") return "View instantly →";
    if (pg?.status === "processing") return "Almost ready...";
    return "Generate →";
  }

  function getBarNote() {
    if (!selected) return null;
    const pg = getPreGen(selected.id);
    if (pg?.status === "complete") return "Ready — no wait";
    if (pg?.status === "processing") return "Still generating in background...";
    if (!selected.featured) return "Custom color — takes ~30 seconds";
    return "AI-powered • ~30 seconds";
  }

  if (loading) return <div className="text-center p-12 text-gray-400">Loading colors...</div>;

  const featured = colors.filter((c) => c.featured);
  const displayed = showAll ? colors : featured;
  const extraCount = colors.length - featured.length;

  return (
    <div className="max-w-xl mx-auto p-6 pb-32 space-y-5">
      <div>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Back</button>
        <h2 className="text-2xl font-bold text-gray-900">Choose Your Chip Blend</h2>
        <p className="text-gray-500 text-sm mt-1">Top colors are generating in the background — pick one to get started.</p>
      </div>

      {colors.length === 0 && !error && (
        <p className="text-gray-400 text-center py-8">No chip colors configured yet.</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {displayed.map((c) => {
          const pg = getPreGen(c.id);
          const isComplete = pg?.status === "complete";
          const isProcessing = pg?.status === "processing";

          return (
            <button key={c.id} onClick={() => setSelected(c)}
              className={`border-2 rounded-xl p-2 text-left transition-all relative ${
                selected?.id === c.id ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
              }`}>
              <div className="relative mb-1.5">
                {c.reference_image_url ? (
                  <img src={c.reference_image_url} alt={c.name}
                    className="w-full h-16 object-cover rounded-lg" />
                ) : (
                  <div className="w-full h-16 bg-gray-100 rounded-lg" />
                )}
                {isComplete && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
                {isProcessing && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="font-semibold text-gray-800 text-xs leading-tight">{c.name}</div>
            </button>
          );
        })}
      </div>

      {!showAll && extraCount > 0 && (
        <button onClick={() => setShowAll(true)}
          className="w-full py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors">
          Show all {colors.length} colors →
        </button>
      )}
      {showAll && (
        <button onClick={() => setShowAll(false)}
          className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
          Show fewer colors
        </button>
      )}

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      {/* Sticky generate bar */}
      {selected && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-xl p-4 z-50">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-1.5">
              {selected.reference_image_url && (
                <img src={selected.reference_image_url} alt={selected.name}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400">Selected</div>
                <div className="font-bold text-gray-900 truncate">{selected.name}</div>
              </div>
              <button onClick={handleGenerate} disabled={submitting}
                className={`px-5 py-2.5 font-bold rounded-xl text-white transition-colors flex-shrink-0 ${
                  submitting ? "bg-gray-300 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                }`}>
                {getBarLabel()}
              </button>
            </div>
            {getBarNote() && <p className="text-xs text-center text-gray-400">{getBarNote()}</p>}
          </div>
        </div>
      )}
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

// ── Step 4: Result + color switcher + lead capture ────────────────────────────
function ResultStep({ result, currentVizId, currentChip, preGens, onSwitchColor, onReset }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null);

  async function handleColorSwitch(pg) {
    if (pg.visualization_id === currentVizId) return;
    if (pg.status !== "complete" || !pg.result) return;
    onSwitchColor(pg.result, pg.visualization_id, pg);
  }

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) { setError("Name and phone are required."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/visualizer/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visualization_id: currentVizId, company_id: companyId, name, phone, email }),
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

  const preGenList = Object.values(preGens);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white text-3xl font-bold leading-none"
            onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-900 text-center">Your Floor Transformation</h2>

      {/* Before / After */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1 text-center">Before</p>
          <img src={result.original_image_url} alt="Original floor"
            className="w-full rounded-xl object-cover cursor-zoom-in"
            onClick={() => setLightbox(result.original_image_url)} />
        </div>
        <div>
          <p className="text-xs font-semibold text-green-600 uppercase mb-1 text-center">After</p>
          <img src={result.generated_image_url} alt="Visualized floor"
            className="w-full rounded-xl object-cover cursor-zoom-in"
            onClick={() => setLightbox(result.generated_image_url)} />
        </div>
      </div>
      <p className="text-xs text-center text-gray-400 -mt-4">Tap image to expand</p>

      {/* Color switcher row */}
      {preGenList.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2 text-center">Switch Color</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {preGenList.map((pg) => {
              const isCurrent = pg.visualization_id === currentVizId;
              const isReady = pg.status === "complete" && pg.result;
              const isProcessing = pg.status === "processing";

              return (
                <button key={pg.visualization_id}
                  onClick={() => handleColorSwitch(pg)}
                  disabled={!isReady || isCurrent}
                  className={`flex-shrink-0 w-20 p-1.5 rounded-xl border-2 transition-all ${
                    isCurrent
                      ? "border-green-500 bg-green-50"
                      : isReady
                      ? "border-gray-200 hover:border-green-400 cursor-pointer"
                      : "border-gray-100 cursor-not-allowed opacity-50"
                  }`}>
                  <div className="relative mb-1">
                    <img src={pg.reference_image_url} alt={pg.name}
                      className="w-full h-14 object-cover rounded-lg" />
                    {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
                        <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-medium text-gray-700 text-center leading-tight truncate">{pg.name}</div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 text-center mt-1">
            {preGenList.filter(g => g.status === "processing").length > 0
              ? `${preGenList.filter(g => g.status === "processing").length} color(s) still generating...`
              : "All colors ready — tap to switch instantly"}
          </p>
        </div>
      )}

      {/* Lead capture */}
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
          ← Start over with a different photo
        </button>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function Visualizer() {
  const [step, setStep] = useState(1);
  const [imageFile, setImageFile] = useState(null);
  const [preGens, setPreGens] = useState({});       // { [viz_id]: { chip_color_id, name, ref_image_url, status, result } }
  const [currentVizId, setCurrentVizId] = useState(null);
  const [currentChip, setCurrentChip] = useState(null);
  const [result, setResult] = useState(null);

  // Poll all processing preGens from root — works across steps
  useEffect(() => {
    const processing = Object.keys(preGens).filter((id) => preGens[id].status === "processing");
    if (!processing.length) return;

    const interval = setInterval(async () => {
      for (const vizId of processing) {
        try {
          const res = await fetch(`${API_BASE}/api/visualizer/status/${vizId}`);
          const data = await res.json();
          if (data.status === "complete" || data.status === "failed") {
            setPreGens((prev) => ({
              ...prev,
              [vizId]: {
                ...prev[vizId],
                status: data.status,
                result: data.status === "complete" ? data : null,
              },
            }));
          }
        } catch {}
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [preGens]);

  function reset() {
    setStep(1);
    setImageFile(null);
    setPreGens({});
    setCurrentVizId(null);
    setCurrentChip(null);
    setResult(null);
  }

  function handleChipNext(vizId, chip, resultData, skipGenerating) {
    setCurrentVizId(vizId);
    setCurrentChip(chip);
    if (skipGenerating && resultData) {
      setResult(resultData);
      setStep(4);
    } else {
      setStep(3);
    }
  }

  function handleSwitchColor(newResult, newVizId, pg) {
    setResult(newResult);
    setCurrentVizId(newVizId);
    setCurrentChip({ id: pg.chip_color_id, name: pg.name });
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
      {step === 1 && (
        <UploadStep onNext={(f) => { setImageFile(f); setStep(2); }} />
      )}
      {step === 2 && (
        <ChipSelectStep
          imageFile={imageFile}
          preGens={preGens}
          onPreGensUpdate={setPreGens}
          onBack={() => setStep(1)}
          onNext={handleChipNext}
        />
      )}
      {step === 3 && (
        <GeneratingStep
          visualizationId={currentVizId}
          onDone={(r) => { setResult(r); setStep(4); }}
        />
      )}
      {step === 4 && (
        <ResultStep
          result={result}
          currentVizId={currentVizId}
          currentChip={currentChip}
          preGens={preGens}
          onSwitchColor={handleSwitchColor}
          onReset={reset}
        />
      )}
    </div>
  );
}
