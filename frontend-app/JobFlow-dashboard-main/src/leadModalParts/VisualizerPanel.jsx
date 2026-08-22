// ============================================================================
// VisualizerPanel — internal CRM floor visualizer inside a contact record
// Three steps: 1) Pick blend  2) Upload photo  3) View result
// ============================================================================

import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "../api";

const API_BASE = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;
function getToken() { return localStorage.getItem("authToken"); }

// ── Inline swatch preview (CSS, no server call) ───────────────────────────────
function SwatchPreview({ recipe }) {
  if (!recipe.length) return null;
  const total = recipe.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0) || 1;
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm mt-3">
      <div className="flex h-14">
        {recipe.map((c, i) => {
          const pct = ((parseFloat(c.percentage) || 0) / total) * 100;
          return (
            <div key={i} style={{ background: c.hex, width: `${pct}%`, minWidth: 4 }} title={`${c.name || c.hex} – ${Math.round(pct)}%`} />
          );
        })}
      </div>
      <div className="flex bg-white px-1">
        {recipe.map((c, i) => {
          const pct = ((parseFloat(c.percentage) || 0) / total) * 100;
          return (
            <div key={i} style={{ width: `${pct}%`, minWidth: 4 }} className="text-center py-1">
              <div className="text-xs font-semibold text-gray-700 truncate px-1">{c.name || c.hex}</div>
              <div className="text-xs text-gray-400">{Math.round(pct)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Custom blend builder — 126 primitives ─────────────────────────────────────
function CustomBlendBuilder({ primitives, customItems, setCustomItems }) {
  const [search, setSearch] = useState('');

  const filtered = primitives.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (p) => {
    if (customItems.find(c => c.hex === p.hex)) {
      setCustomItems(prev => prev.filter(c => c.hex !== p.hex));
    } else {
      const even = customItems.length ? Math.floor(100 / (customItems.length + 1)) : 100;
      const newItems = [...customItems.map(c => ({ ...c, percentage: even })), { hex: p.hex, name: p.name, percentage: even }];
      setCustomItems(newItems);
    }
  };

  const setPct = (hex, val) => {
    setCustomItems(prev => prev.map(c => c.hex === hex ? { ...c, percentage: Math.max(1, Math.min(99, parseInt(val) || 0)) } : c));
  };

  return (
    <div>
      {/* Search */}
      <input
        type="text"
        placeholder="Search colors…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full mb-3 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Selected items with sliders */}
      {customItems.length > 0 && (
        <div className="mb-3 space-y-2">
          {customItems.map((c, i) => (
            <div key={c.hex} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex-shrink-0 border border-gray-300" style={{ background: c.hex }} />
              <span className="text-xs font-semibold text-gray-700 w-28 truncate">{c.name}</span>
              <input
                type="range" min="1" max="99" value={c.percentage}
                onChange={e => setPct(c.hex, e.target.value)}
                className="flex-1"
              />
              <span className="text-xs text-gray-600 w-8 text-right">{c.percentage}%</span>
              <button onClick={() => toggle(c)} className="text-gray-400 hover:text-red-500 ml-1">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Color grid */}
      <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
        {filtered.map(p => {
          const selected = !!customItems.find(c => c.hex === p.hex);
          return (
            <button
              key={p.code}
              title={`${p.name} (${p.code})`}
              onClick={() => toggle(p)}
              className={`relative h-8 rounded border-2 transition ${selected ? 'border-blue-500 scale-90' : 'border-transparent hover:border-gray-400'}`}
              style={{ background: p.hex }}
            >
              {selected && <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function VisualizerPanel({ lead, canEdit, onClose }) {
  const [step, setStep] = useState(1);
  const [blendTab, setBlendTab] = useState('library');

  // Library colors
  const [libraryColors, setLibraryColors] = useState([]);
  const [selectedLibColor, setSelectedLibColor] = useState(null);

  // Primitives for custom blend
  const [primitives, setPrimitives] = useState([]);
  const [customItems, setCustomItems] = useState([]);

  // Active recipe (shared)
  const [recipe, setRecipe] = useState([]);

  // Swatch
  const [swatchUrl, setSwatchUrl] = useState(null);
  const [swatchLoading, setSwatchLoading] = useState(false);
  const [swatchSaved, setSwatchSaved] = useState(false);
  const [swatchEmailed, setSwatchEmailed] = useState(false);

  // Photo apply
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef();

  // Result
  const [vizId, setVizId] = useState(null);
  const [vizStatus, setVizStatus] = useState(null); // null | 'processing' | 'complete' | 'failed'
  const [vizResult, setVizResult] = useState(null);
  const [vizSaved, setVizSaved] = useState(false);
  const [vizEmailed, setVizEmailed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load library and primitives on mount
  useEffect(() => {
    apiRequest('/api/visualizer/admin/selections').then(d => setLibraryColors(d.colors || [])).catch(() => {});
    apiRequest('/api/visualizer/primitives').then(d => setPrimitives(d.colors || [])).catch(() => {});
  }, []);

  // When library color is selected, fetch its recipe
  useEffect(() => {
    if (!selectedLibColor) return;
    apiRequest(`/api/visualizer/recipe/${selectedLibColor.id}`)
      .then(d => setRecipe(d.recipe || []))
      .catch(() => setRecipe([]));
  }, [selectedLibColor?.id]);

  // Keep recipe in sync with custom items
  useEffect(() => {
    if (blendTab === 'custom') setRecipe(customItems);
  }, [blendTab, customItems]);

  const hasRecipe = recipe.length > 0;
  const leadEmail = lead?.email;

  // ── Swatch: generate + save to Drive ──────────────────────────────────────
  const generateSwatch = useCallback(async (saveToLead = false) => {
    if (!hasRecipe) return;
    setSwatchLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/visualizer/swatch', {
        method: 'POST',
        body: JSON.stringify({ recipe, lead_id: saveToLead ? lead.id : null }),
      });
      setSwatchUrl(data.swatch_url);
      if (saveToLead) setSwatchSaved(true);
    } catch (e) {
      setError(e.message || 'Failed to generate swatch');
    } finally {
      setSwatchLoading(false);
    }
  }, [recipe, lead.id, hasRecipe]);

  // ── Email swatch ──────────────────────────────────────────────────────────
  const emailSwatch = useCallback(async () => {
    if (!swatchUrl) return;
    setLoading(true);
    setError(null);
    try {
      const label = recipe.map(r => r.name || r.hex).join(' / ').slice(0, 60);
      await apiRequest('/api/visualizer/send-swatch-email', {
        method: 'POST',
        body: JSON.stringify({ swatch_url: swatchUrl, lead_id: lead.id, blend_description: label }),
      });
      setSwatchEmailed(true);
    } catch (e) {
      setError(e.message || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  }, [swatchUrl, recipe, lead.id]);

  // ── Apply blend to photo ──────────────────────────────────────────────────
  const applyBlend = useCallback(async () => {
    if (!photoFile || !hasRecipe) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', photoFile);
      formData.append('lead_id', lead.id);
      formData.append('recipe', JSON.stringify(recipe.map(r => ({ hex: r.hex, percentage: r.percentage }))));

      const res = await fetch(`${API_BASE}/api/visualizer/apply-internal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');

      setVizId(data.visualization_id);
      setVizStatus('processing');
      setStep(3);
    } catch (e) {
      setError(e.message || 'Failed to apply blend');
    } finally {
      setLoading(false);
    }
  }, [photoFile, recipe, lead.id, hasRecipe]);

  // ── Poll visualization status ─────────────────────────────────────────────
  useEffect(() => {
    if (!vizId || vizStatus !== 'processing') return;
    const timer = setInterval(async () => {
      try {
        const data = await apiRequest(`/api/visualizer/status/${vizId}`);
        if (data.status === 'complete') {
          setVizStatus('complete');
          setVizResult({ generated: data.generated_image_url, original: data.original_image_url });
          clearInterval(timer);
        } else if (data.status === 'failed') {
          setVizStatus('failed');
          setError(data.error_message || 'Visualization failed');
          clearInterval(timer);
        }
      } catch {}
    }, 2500);
    return () => clearInterval(timer);
  }, [vizId, vizStatus]);

  // ── Save visualization to Drive ───────────────────────────────────────────
  const saveVizToDrive = useCallback(async () => {
    if (!vizId) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/api/visualizer/lead', {
        method: 'POST',
        body: JSON.stringify({ visualization_id: vizId, company_id: lead.company_id || lead.companyId, name: lead.name }),
      });
      setVizSaved(true);
    } catch (e) {
      setError(e.message || 'Failed to save to Drive');
    } finally {
      setLoading(false);
    }
  }, [vizId, lead]);

  // ── Email visualization ───────────────────────────────────────────────────
  const emailViz = useCallback(async () => {
    if (!vizId || !leadEmail) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/api/visualizer/send-email', {
        method: 'POST',
        body: JSON.stringify({
          visualization_id: vizId,
          company_id: lead.company_id || lead.companyId,
          customer_email: leadEmail,
          customer_name: lead.name,
        }),
      });
      setVizEmailed(true);
    } catch (e) {
      setError(e.message || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  }, [vizId, leadEmail, lead]);

  const blendLabel = recipe.length ? recipe.map(r => `${r.name || r.hex} ${Math.round(r.percentage)}%`).join(', ') : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Floor Visualizer</h2>
            <p className="text-xs text-gray-500">{lead.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
        </div>

        {/* Step indicator */}
        <div className="flex px-5 pt-4 gap-3">
          {['Blend', 'Photo', 'Result'].map((label, i) => (
            <div key={i} className={`flex-1 text-center text-xs font-semibold pb-2 border-b-2 transition ${step === i + 1 ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400'}`}>
              {i + 1}. {label}
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 pt-4">
          {/* ── STEP 1: BLEND ──────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setBlendTab('library')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${blendTab === 'library' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Library Colors
                </button>
                <button
                  onClick={() => setBlendTab('custom')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${blendTab === 'custom' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Custom Blend
                </button>
              </div>

              {/* Library tab */}
              {blendTab === 'library' && (
                <div>
                  <p className="text-xs text-gray-500 mb-3">Select a color to see its chip recipe</p>
                  <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                    {libraryColors.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedLibColor(c)}
                        className={`flex flex-col items-center p-2 rounded-lg border-2 transition text-xs font-semibold ${selectedLibColor?.id === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}
                      >
                        {c.reference_image_url
                          ? <img src={c.reference_image_url} alt={c.name} className="w-full h-12 object-cover rounded mb-1" />
                          : <div className="w-full h-12 bg-gray-200 rounded mb-1" />}
                        <span className="text-center text-xs leading-tight">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom tab */}
              {blendTab === 'custom' && (
                <CustomBlendBuilder primitives={primitives} customItems={customItems} setCustomItems={setCustomItems} />
              )}

              {/* Swatch preview */}
              {hasRecipe && <SwatchPreview recipe={recipe} />}

              {/* Swatch actions */}
              {hasRecipe && canEdit && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button
                    onClick={() => generateSwatch(true)}
                    disabled={swatchLoading}
                    className="flex-1 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    {swatchSaved ? '✓ Saved to Drive' : swatchLoading ? 'Saving…' : 'Save to Drive'}
                  </button>
                  {leadEmail && (
                    <button
                      onClick={async () => { if (!swatchUrl) await generateSwatch(false); emailSwatch(); }}
                      disabled={loading || swatchEmailed}
                      className="flex-1 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                    >
                      {swatchEmailed ? '✓ Emailed' : 'Email Customer'}
                    </button>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

              {/* Next: Apply to Photo */}
              {hasRecipe && (
                <button
                  onClick={() => setStep(2)}
                  className="w-full mt-4 py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 transition"
                >
                  Apply to a Photo →
                </button>
              )}
            </div>
          )}

          {/* ── STEP 2: PHOTO ──────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">Upload a photo of the floor to apply the blend to.</p>
              <p className="text-xs text-gray-500 mb-3 font-medium">Blend: <span className="text-gray-700">{blendLabel}</span></p>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition"
              >
                {photoFile
                  ? <p className="text-sm font-semibold text-gray-700">{photoFile.name}</p>
                  : <>
                      <p className="text-sm font-semibold text-gray-500">Tap to select photo</p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG, or HEIC</p>
                    </>}
              </div>
              <input ref={fileRef} type="file" accept="image/*,.heic" className="hidden" onChange={e => setPhotoFile(e.target.files[0] || null)} />

              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

              <div className="flex gap-2 mt-4">
                <button onClick={() => { setStep(1); setError(null); }} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl font-semibold hover:bg-gray-200 transition">
                  ← Back
                </button>
                <button
                  onClick={applyBlend}
                  disabled={!photoFile || loading}
                  className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 transition disabled:opacity-50"
                >
                  {loading ? 'Starting…' : 'Apply Blend'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: RESULT ─────────────────────────────────────────── */}
          {step === 3 && (
            <div>
              {vizStatus === 'processing' && (
                <div className="text-center py-10">
                  <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-gray-600">Analyzing floor and applying blend…</p>
                  <p className="text-xs text-gray-400 mt-1">Usually takes 20–40 seconds</p>
                </div>
              )}

              {vizStatus === 'failed' && (
                <div className="text-center py-8">
                  <p className="text-sm font-semibold text-red-600 mb-2">Visualization Failed</p>
                  <p className="text-xs text-gray-500 mb-4">{error || 'Something went wrong. Try a different photo.'}</p>
                  <button onClick={() => { setStep(2); setVizStatus(null); setVizId(null); setError(null); }} className="text-sm text-blue-500 underline">
                    Try a Different Photo
                  </button>
                </div>
              )}

              {vizStatus === 'complete' && vizResult && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Blend: <span className="text-gray-700">{blendLabel}</span></p>

                  {/* Before / After */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <p className="text-xs text-gray-400 text-center mb-1 uppercase font-bold tracking-wide">Before</p>
                      <img src={vizResult.original} alt="Before" className="w-full rounded-lg object-cover border border-gray-200" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-500 text-center mb-1 uppercase font-bold tracking-wide">After</p>
                      <img src={vizResult.generated} alt="After" className="w-full rounded-lg object-cover border border-gray-200" />
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={saveVizToDrive}
                        disabled={loading || vizSaved}
                        className="flex-1 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                      >
                        {vizSaved ? '✓ Saved to Drive' : 'Save to Drive'}
                      </button>
                      {leadEmail && (
                        <button
                          onClick={emailViz}
                          disabled={loading || vizEmailed}
                          className="flex-1 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                        >
                          {vizEmailed ? '✓ Emailed' : 'Email Customer'}
                        </button>
                      )}
                    </div>
                  )}

                  {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

                  <button
                    onClick={() => { setStep(1); setVizStatus(null); setVizId(null); setVizResult(null); setVizSaved(false); setVizEmailed(false); setPhotoFile(null); setError(null); }}
                    className="w-full mt-3 py-2 text-sm text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                  >
                    Start Over
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
