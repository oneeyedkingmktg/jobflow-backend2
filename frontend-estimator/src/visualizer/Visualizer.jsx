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
    const ext = f.name.split('.').pop().toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];
    const isImage = f.type.startsWith("image/") || allowedExts.includes(ext);
    if (!isImage) { setError("Please upload an image file (JPG, PNG, or HEIC)."); return; }
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

// ── Custom Blend Panel ────────────────────────────────────────────────────────
function CustomBlendPanel({ preGens, blendItems, setBlendItems, onResult }) {
  const [primitives, setPrimitives] = useState([]);
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/visualizer/primitives`)
      .then(r => r.json())
      .then(d => setPrimitives(d.colors || []))
      .catch(() => {});
  }, []);

  const filtered = primitives.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  function distributeEvenly(items) {
    if (!items.length) return [];
    const perItem = Math.floor(100 / items.length);
    return items.map((b, i) => ({
      ...b,
      pct: i === 0 ? 100 - perItem * (items.length - 1) : perItem,
    }));
  }

  function addColor(color) {
    if (blendItems.find(b => b.code === color.code)) return;
    if (blendItems.length >= 5) return;
    setBlendItems(distributeEvenly([...blendItems, { ...color, pct: 0 }]));
  }

  function removeColor(code) {
    setBlendItems(distributeEvenly(blendItems.filter(b => b.code !== code)));
  }

  function adjustPct(idx, rawVal) {
    const val = Math.max(5, Math.min(90, parseInt(rawVal) || 5));
    setBlendItems(prev => {
      const remaining = 100 - val;
      const others = prev.filter((_, i) => i !== idx);
      const otherSum = others.reduce((s, x) => s + x.pct, 0);
      const next = prev.map((item, i) => {
        if (i === idx) return { ...item, pct: val };
        if (otherSum === 0) return { ...item, pct: Math.round(remaining / others.length) };
        return { ...item, pct: Math.round((item.pct / otherSum) * remaining) };
      });
      // Fix rounding drift
      const diff = 100 - next.reduce((s, x) => s + x.pct, 0);
      if (diff !== 0) {
        const fixIdx = next.findIndex((_, i) => i !== idx);
        if (fixIdx !== -1) next[fixIdx] = { ...next[fixIdx], pct: next[fixIdx].pct + diff };
      }
      return next;
    });
  }

  // Find any complete preGen — it has the cached mask we need
  const sourceViz = Object.values(preGens).find(pg => pg.status === "complete");
  const canPreview = blendItems.length > 0 && !!sourceViz;
  const maskPending = blendItems.length > 0 && !sourceViz;

  async function handlePreview() {
    if (!canPreview || generating) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/visualizer/composite-custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_visualization_id: sourceViz.visualization_id,
          company_id: companyId,
          recipe: blendItems.map(b => ({ hex: b.hex, percentage: b.pct })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      onResult(data, blendItems);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  const previewLabel = generating
    ? "Generating preview..."
    : blendItems.length === 0
    ? "Add colors below to preview"
    : maskPending
    ? "Waiting for background processing…"
    : "Preview on My Floor →";

  return (
    <div className="space-y-5">
      {/* Color library search + grid */}
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-2">
          Pick colors for your blend <span className="text-gray-400 font-normal">(up to 5)</span>
        </p>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or F-code…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-green-400"
        />
        <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
          {filtered.map(c => {
            const isAdded = !!blendItems.find(b => b.code === c.code);
            const maxed = !isAdded && blendItems.length >= 5;
            return (
              <button
                key={c.code}
                onClick={() => addColor(c)}
                disabled={isAdded || maxed}
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                  isAdded
                    ? "border-green-400 bg-green-50 cursor-default"
                    : maxed
                    ? "border-gray-100 opacity-40 cursor-not-allowed"
                    : "border-gray-200 hover:border-green-400 hover:bg-green-50 cursor-pointer"
                }`}
              >
                <div
                  className="w-5 h-5 rounded flex-shrink-0 border border-black/10"
                  style={{ backgroundColor: c.hex }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-800 truncate">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.code}</div>
                </div>
                {isAdded && <span className="ml-auto text-green-500 text-xs flex-shrink-0">✓</span>}
              </button>
            );
          })}
          {!filtered.length && (
            <p className="col-span-3 text-center text-sm text-gray-400 py-4">No colors match "{search}"</p>
          )}
        </div>
      </div>

      {/* Selected colors + percentage sliders */}
      {blendItems.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-2">Adjust percentages:</p>
          <div className="space-y-3">
            {blendItems.map((b, idx) => (
              <div key={b.code} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded flex-shrink-0 border border-black/10"
                  style={{ backgroundColor: b.hex }}
                />
                <span className="text-xs text-gray-700 w-20 flex-shrink-0 truncate">{b.name}</span>
                <input
                  type="range"
                  min="5"
                  max="90"
                  value={b.pct}
                  onChange={e => adjustPct(idx, e.target.value)}
                  className="flex-1 accent-green-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-gray-800 w-8 text-right flex-shrink-0">{b.pct}%</span>
                <button
                  onClick={() => removeColor(b.code)}
                  className="text-gray-300 hover:text-red-400 flex-shrink-0 text-xl leading-none font-light"
                >×</button>
              </div>
            ))}
          </div>

          {/* Blend swatch preview */}
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-1.5">Blend preview:</p>
            <div className="h-9 rounded-xl overflow-hidden flex border border-black/10 shadow-sm">
              {blendItems.map(b => (
                <div
                  key={b.code}
                  style={{ width: `${b.pct}%`, backgroundColor: b.hex }}
                  className="transition-all duration-150"
                />
              ))}
            </div>
            <div className="flex mt-1">
              {blendItems.map(b => (
                <div
                  key={b.code}
                  style={{ width: `${b.pct}%` }}
                  className="text-center text-xs text-gray-400 truncate px-0.5"
                >
                  {b.pct >= 15 ? `${b.pct}%` : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      {maskPending && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-center">
          Preview unlocks in ~30 sec once your first standard color finishes generating in the background.
        </p>
      )}

      <button
        onClick={handlePreview}
        disabled={!canPreview || generating}
        className={`w-full py-3 font-bold rounded-xl text-white transition-colors ${
          canPreview && !generating
            ? "bg-green-600 hover:bg-green-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        {previewLabel}
      </button>
    </div>
  );
}

// ── Step 2: Chip color selection + pre-generation ─────────────────────────────
function ChipSelectStep({ imageFile, preGens, onPreGensUpdate, onNext, onBack, onCustomBlendResult }) {
  const [colors, setColors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [mode, setMode] = useState("standard"); // "standard" | "custom"
  const [blendItems, setBlendItems] = useState([]);

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

    // Non-featured color — generate fresh
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
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setMode("standard")}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            mode === "standard"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Standard Colors
        </button>
        <button
          onClick={() => setMode("custom")}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            mode === "custom"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          ✨ Custom Blend
        </button>
      </div>

      {/* Standard mode */}
      {mode === "standard" && (
        <>
          <p className="text-gray-500 text-sm -mt-2">Top colors are generating in the background — pick one to get started.</p>

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
        </>
      )}

      {/* Custom blend mode */}
      {mode === "custom" && (
        <CustomBlendPanel
          preGens={preGens}
          blendItems={blendItems}
          setBlendItems={setBlendItems}
          onResult={onCustomBlendResult}
        />
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
function ResultStep({ result, currentVizId, currentChip, preGens, customResult, customBlendItems, onSwitchColor, onSwitchToCustom, onReset }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState(""); // email actually submitted
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

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
      setSubmittedEmail(email.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendEmail() {
    if (emailSending || emailSent || !submittedEmail) return;
    setEmailSending(true);
    setEmailError("");
    try {
      const res = await fetch(`${API_BASE}/api/visualizer/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visualization_id: currentVizId,
          company_id: companyId,
          customer_email: submittedEmail,
          customer_name: name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setEmailSent(true);
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setEmailSending(false);
    }
  }

  const preGenList = Object.values(preGens);
  const isCustomActive = customResult && currentVizId === customResult.visualization_id;

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
      {(preGenList.length > 0 || customResult) && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2 text-center">Switch Color</p>
          <div className="flex gap-2 overflow-x-auto pb-1">

            {/* Custom blend card */}
            {customResult && (
              <button
                onClick={() => onSwitchToCustom()}
                className={`flex-shrink-0 w-20 p-1.5 rounded-xl border-2 transition-all ${
                  isCustomActive
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-400 cursor-pointer"
                }`}
              >
                {/* Swatch showing blend colors */}
                <div className="w-full h-14 rounded-lg overflow-hidden flex border border-black/10 mb-1">
                  {customBlendItems.map(b => (
                    <div
                      key={b.code}
                      style={{ width: `${b.pct}%`, backgroundColor: b.hex }}
                    />
                  ))}
                </div>
                <div className="text-xs font-medium text-gray-700 text-center leading-tight">My Blend</div>
                {isCustomActive && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
              </button>
            )}

            {/* Standard preGen cards */}
            {preGenList.map((pg) => {
              const isCurrent = pg.visualization_id === currentVizId;
              const isReady = pg.status === "complete" && pg.result;
              const isProcessing = pg.status === "processing";

              return (
                <button key={pg.visualization_id}
                  onClick={() => handleColorSwitch(pg)}
                  disabled={!isReady || isCurrent}
                  className={`flex-shrink-0 w-20 p-1.5 rounded-xl border-2 transition-all relative ${
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
                    {isCurrent && !isCustomActive && (
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
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
          <div className="text-3xl">✅</div>
          <h3 className="font-bold text-green-800">We'll be in touch!</h3>
          <p className="text-sm text-green-700">Thank you, {name}. Someone will reach out shortly to discuss your project.</p>
          <p className="text-xs text-green-600">📁 Your visualization has been saved to your project folder.</p>

          {/* Email button — only if they gave us an email */}
          {submittedEmail && (
            <div className="pt-1">
              {emailSent ? (
                <p className="text-sm font-semibold text-green-700">📧 Images emailed to {submittedEmail}</p>
              ) : (
                <>
                  <button
                    onClick={handleSendEmail}
                    disabled={emailSending}
                    className={`w-full py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${
                      emailSending
                        ? "border-gray-200 text-gray-400 cursor-not-allowed"
                        : "border-green-500 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {emailSending ? "Sending…" : "📧 Email me the before & after images"}
                  </button>
                  {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
                </>
              )}
            </div>
          )}

          <button onClick={onReset} className="mt-1 text-sm text-green-600 underline">Try another color</button>
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
  const [preGens, setPreGens] = useState({});
  const [currentVizId, setCurrentVizId] = useState(null);
  const [currentChip, setCurrentChip] = useState(null);
  const [result, setResult] = useState(null);
  const [customResult, setCustomResult] = useState(null);
  const [customBlendItems, setCustomBlendItems] = useState([]);

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
    setCustomResult(null);
    setCustomBlendItems([]);
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

  function handleCustomBlendResult(data, blendItems) {
    setCustomResult(data);
    setCustomBlendItems(blendItems);
    setResult(data);
    setCurrentVizId(data.visualization_id);
    setCurrentChip(null);
    setStep(4);
  }

  function handleSwitchColor(newResult, newVizId, pg) {
    setResult(newResult);
    setCurrentVizId(newVizId);
    setCurrentChip({ id: pg.chip_color_id, name: pg.name });
  }

  function handleSwitchToCustom() {
    if (!customResult) return;
    setResult(customResult);
    setCurrentVizId(customResult.visualization_id);
    setCurrentChip(null);
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
          onCustomBlendResult={handleCustomBlendResult}
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
          customResult={customResult}
          customBlendItems={customBlendItems}
          onSwitchColor={handleSwitchColor}
          onSwitchToCustom={handleSwitchToCustom}
          onReset={reset}
        />
      )}
    </div>
  );
}
