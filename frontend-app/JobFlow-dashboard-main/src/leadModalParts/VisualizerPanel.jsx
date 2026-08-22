// ============================================================================
// VisualizerPanel v2 — Internal CRM floor visualizer
// Views: build → photo → results
// Session workflow: create named blends → upload one photo → run all → compare
// ============================================================================
import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "../api";

const API_BASE = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;
function getToken() { return localStorage.getItem("authToken"); }

let _nextId = 1;
function newId() { return _nextId++; }

// ── Live swatch preview (CSS, instant, no server call) ───────────────────────
function SwatchBar({ recipe, className = "h-20" }) {
  const items = recipe.filter(r => (parseFloat(r.percentage) || 0) > 0);
  if (!items.length) return (
    <div className={`w-full rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center ${className}`}>
      <span className="text-xs text-gray-400">Add colors to see preview</span>
    </div>
  );
  const total = items.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0) || 1;
  return (
    <div className={`w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm ${className}`}>
      <div className="flex h-3/5">
        {items.map((c, i) => {
          const pct = ((parseFloat(c.percentage) || 0) / total) * 100;
          return <div key={i} style={{ background: c.hex, width: `${pct}%`, minWidth: 3 }} title={`${c.name} – ${Math.round(pct)}%`} />;
        })}
      </div>
      <div className="flex h-2/5 bg-white border-t border-gray-100">
        {items.map((c, i) => {
          const pct = ((parseFloat(c.percentage) || 0) / total) * 100;
          return (
            <div key={i} style={{ width: `${pct}%`, minWidth: 3 }} className="flex flex-col items-center justify-center overflow-hidden px-0.5">
              <div className="text-xs font-bold text-gray-700 truncate w-full text-center leading-tight">{(c.name || '').split(' ').slice(-1)[0]}</div>
              <div className="text-xs text-gray-400 leading-tight">{Math.round(pct)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mini swatch for session blend cards ──────────────────────────────────────
function MiniSwatch({ recipe }) {
  const items = recipe.filter(r => (parseFloat(r.percentage) || 0) > 0);
  const total = items.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0) || 1;
  return (
    <div className="flex h-8 rounded-lg overflow-hidden border border-gray-200 flex-1">
      {items.map((c, i) => {
        const pct = ((parseFloat(c.percentage) || 0) / total) * 100;
        return <div key={i} style={{ background: c.hex, width: `${pct}%`, minWidth: 2 }} />;
      })}
    </div>
  );
}

// ── Custom blend builder ──────────────────────────────────────────────────────
function CustomBlendBuilder({ primitives, items, setItems }) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? primitives.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    : primitives;

  const toggle = (p) => {
    if (items.find(c => c.hex === p.hex)) {
      setItems(prev => prev.filter(c => c.hex !== p.hex));
    } else {
      const n = items.length + 1;
      const even = Math.floor(100 / n);
      setItems(prev => [
        ...prev.map(c => ({ ...c, percentage: even })),
        { hex: p.hex, name: p.name, code: p.code, percentage: even },
      ]);
    }
  };

  const setPct = (hex, val) => {
    setItems(prev => prev.map(c => c.hex === hex ? { ...c, percentage: Math.max(1, Math.min(99, parseInt(val) || 1)) } : c));
  };

  return (
    <div className="space-y-3">
      {/* Selected items with sliders */}
      {items.length > 0 && (
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {items.map(c => (
            <div key={c.hex} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded flex-shrink-0 border border-gray-200 shadow-sm" style={{ background: c.hex }} />
              <span className="text-xs font-semibold text-gray-700 w-24 truncate flex-shrink-0">{c.name}</span>
              <input
                type="range" min="1" max="99" value={c.percentage}
                onChange={e => setPct(c.hex, e.target.value)}
                className="flex-1 accent-blue-500"
              />
              <span className="text-xs text-gray-500 w-7 text-right flex-shrink-0">{c.percentage}%</span>
              <button onClick={() => setItems(prev => prev.filter(x => x.hex !== c.hex))} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Search + grid */}
      <input
        type="text"
        placeholder="Search Torginol colors…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
        {filtered.map(p => {
          const sel = !!items.find(c => c.hex === p.hex);
          return (
            <button
              key={p.code}
              title={`${p.name} (${p.code})`}
              onClick={() => toggle(p)}
              className={`h-7 rounded border-2 transition-all ${sel ? 'border-blue-500 ring-2 ring-blue-200 scale-90' : 'border-transparent hover:border-gray-400'}`}
              style={{ background: p.hex }}
            />
          );
        })}
      </div>
      {!items.length && <p className="text-xs text-gray-400 text-center pt-1">Tap a color swatch to add it</p>}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function VisualizerPanel({ lead, canEdit, onClose }) {
  const [view, setView] = useState('build'); // 'build' | 'photo' | 'results'

  // Builder state
  const [blendTab, setBlendTab] = useState('library');
  const [libraryColors, setLibraryColors] = useState([]);
  const [primitives, setPrimitives] = useState([]);
  const [selectedLibColor, setSelectedLibColor] = useState(null);
  const [libRecipe, setLibRecipe] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [blendName, setBlendName] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Session blends
  const [sessionBlends, setSessionBlends] = useState([]);

  // Photo & results
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef();
  const [results, setResults] = useState({}); // { [blendId]: { vizId, status, generated, original, error } }
  const [actionState, setActionState] = useState({}); // { [vizId]: { savingDrive, savedDrive, emailing, emailed } }

  // Swatch actions per session blend id
  const [swatchState, setSwatchState] = useState({}); // { [blendId]: { saving, saved, emailing, emailed } }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentRecipe = blendTab === 'library' ? libRecipe : customItems;
  const hasRecipe = currentRecipe.length > 0;
  const leadEmail = lead?.email;

  // Load data
  useEffect(() => {
    apiRequest('/api/visualizer/admin/selections').then(d => setLibraryColors(d.colors || [])).catch(() => {});
    apiRequest('/api/visualizer/primitives').then(d => setPrimitives(d.colors || [])).catch(() => {});
  }, []);

  // Fetch recipe when library color is selected
  useEffect(() => {
    if (!selectedLibColor) { setLibRecipe([]); return; }
    apiRequest(`/api/visualizer/recipe/${selectedLibColor.id}`)
      .then(d => setLibRecipe(d.recipe || []))
      .catch(() => setLibRecipe([]));
  }, [selectedLibColor?.id]);

  // Customize library blend → copy recipe into custom tab
  const customizeLibBlend = () => {
    if (!libRecipe.length) return;
    setCustomItems(libRecipe.map(r => ({ ...r })));
    setBlendName(selectedLibColor?.name || '');
    setBlendTab('custom');
  };

  // Add current blend to session (or save edit)
  const addToSession = () => {
    if (!hasRecipe) return;
    const recipe = currentRecipe.map(r => ({ ...r }));
    const name   = blendName.trim() || `Blend ${sessionBlends.length + (editingId ? 0 : 1)}`;

    if (editingId !== null) {
      setSessionBlends(prev => prev.map(b => b.id === editingId ? { ...b, name, recipe } : b));
      setEditingId(null);
    } else {
      setSessionBlends(prev => [...prev, { id: newId(), name, recipe }]);
    }

    // Reset builder for next blend
    setBlendName('');
    setCustomItems([]);
    setSelectedLibColor(null);
    setLibRecipe([]);
    setBlendTab('library');
    setError(null);
  };

  // Load a session blend into the custom builder for editing
  const editBlend = (blend) => {
    setEditingId(blend.id);
    setBlendName(blend.name);
    setCustomItems(blend.recipe.map(r => ({ ...r })));
    setBlendTab('custom');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setBlendName('');
    setCustomItems([]);
    setSelectedLibColor(null);
    setLibRecipe([]);
    setBlendTab('library');
  };

  const removeBlend = (id) => {
    setSessionBlends(prev => prev.filter(b => b.id !== id));
    setResults(prev => { const r = { ...prev }; delete r[id]; return r; });
    if (editingId === id) cancelEdit();
  };

  // Apply all session blends to the uploaded photo
  const applyAllBlends = async () => {
    if (!photoFile || !sessionBlends.length) return;
    setLoading(true);
    setError(null);

    // Mark all as pending
    const init = {};
    for (const b of sessionBlends) init[b.id] = { vizId: null, status: 'processing', generated: null, original: null, error: null };
    setResults(init);
    setView('results');
    setLoading(false);

    // Launch each blend in parallel
    for (const blend of sessionBlends) {
      const fd = new FormData();
      fd.append('image', photoFile);
      fd.append('lead_id', lead.id);
      fd.append('recipe', JSON.stringify(blend.recipe.map(r => ({ hex: r.hex, percentage: r.percentage }))));

      fetch(`${API_BASE}/api/visualizer/apply-internal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setResults(prev => ({ ...prev, [blend.id]: { ...prev[blend.id], vizId: data.visualization_id } }));
        })
        .catch(err => {
          setResults(prev => ({ ...prev, [blend.id]: { ...prev[blend.id], status: 'failed', error: err.message } }));
        });
    }
  };

  // Poll all processing results
  useEffect(() => {
    const polling = Object.entries(results).filter(([, r]) => r.status === 'processing' && r.vizId);
    if (!polling.length) return;

    const timers = polling.map(([blendId, r]) =>
      setInterval(async () => {
        try {
          const data = await apiRequest(`/api/visualizer/status/${r.vizId}`);
          if (data.status === 'complete') {
            setResults(prev => ({ ...prev, [blendId]: { ...prev[blendId], status: 'complete', generated: data.generated_image_url, original: data.original_image_url } }));
          } else if (data.status === 'failed') {
            setResults(prev => ({ ...prev, [blendId]: { ...prev[blendId], status: 'failed', error: data.error_message || 'Failed' } }));
          }
        } catch {}
      }, 2500)
    );
    return () => timers.forEach(clearInterval);
  }, [JSON.stringify(Object.entries(results).map(([id, r]) => [id, r.vizId, r.status]))]);

  // Save viz to Drive
  const saveVizToDrive = async (blendId, vizId) => {
    setActionState(p => ({ ...p, [vizId]: { ...p[vizId], savingDrive: true } }));
    try {
      await apiRequest('/api/visualizer/lead', {
        method: 'POST',
        body: JSON.stringify({ visualization_id: vizId, company_id: lead.company_id || lead.companyId, name: lead.name }),
      });
      setActionState(p => ({ ...p, [vizId]: { ...p[vizId], savedDrive: true } }));
    } catch (e) { setError(e.message); }
    finally { setActionState(p => ({ ...p, [vizId]: { ...p[vizId], savingDrive: false } })); }
  };

  // Email viz
  const emailViz = async (blendId, vizId) => {
    setActionState(p => ({ ...p, [vizId]: { ...p[vizId], emailing: true } }));
    try {
      await apiRequest('/api/visualizer/send-email', {
        method: 'POST',
        body: JSON.stringify({ visualization_id: vizId, company_id: lead.company_id || lead.companyId, customer_email: leadEmail, customer_name: lead.name }),
      });
      setActionState(p => ({ ...p, [vizId]: { ...p[vizId], emailed: true } }));
    } catch (e) { setError(e.message); }
    finally { setActionState(p => ({ ...p, [vizId]: { ...p[vizId], emailing: false } })); }
  };

  // Save swatch to Drive
  const saveSwatchToDrive = async (blend) => {
    setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], saving: true } }));
    try {
      await apiRequest('/api/visualizer/swatch', {
        method: 'POST',
        body: JSON.stringify({ recipe: blend.recipe, lead_id: lead.id, blend_name: blend.name }),
      });
      setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], saved: true } }));
    } catch (e) { setError(e.message); }
    finally { setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], saving: false } })); }
  };

  // Email swatch
  const emailSwatch = async (blend) => {
    setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], emailing: true } }));
    try {
      const { swatch_url } = await apiRequest('/api/visualizer/swatch', {
        method: 'POST',
        body: JSON.stringify({ recipe: blend.recipe, blend_name: blend.name }),
      });
      await apiRequest('/api/visualizer/send-swatch-email', {
        method: 'POST',
        body: JSON.stringify({ swatch_url, lead_id: lead.id, blend_description: blend.name }),
      });
      setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], emailed: true } }));
    } catch (e) { setError(e.message); }
    finally { setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], emailing: false } })); }
  };

  const processingCount = Object.values(results).filter(r => r.status === 'processing').length;
  const completeCount   = Object.values(results).filter(r => r.status === 'complete').length;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-4 px-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Floor Visualizer</h2>
            <p className="text-xs text-gray-400">{lead.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {view !== 'build' && (
              <button onClick={() => setView('build')} className="text-xs text-blue-500 hover:underline">← Blends</button>
            )}
            {view === 'build' && sessionBlends.length > 0 && (
              <button onClick={() => setView('photo')} className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-600 transition">
                Apply to Photo →
              </button>
            )}
            {view === 'results' && (
              <button onClick={() => setView('photo')} className="text-xs text-blue-500 hover:underline">← Photo</button>
            )}
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-2xl font-light ml-1">×</button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">

          {/* ── BUILD VIEW ─────────────────────────────────────────────── */}
          {view === 'build' && (
            <>
              {/* Tabs */}
              <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => { setBlendTab('library'); if (editingId) cancelEdit(); }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${blendTab === 'library' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  Library Colors
                </button>
                <button
                  onClick={() => setBlendTab('custom')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${blendTab === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  Custom Blend
                </button>
              </div>

              {/* Library tab */}
              {blendTab === 'library' && (
                <div className="space-y-3">
                  {/* Color grid */}
                  <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                    {libraryColors.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedLibColor(c)}
                        className={`rounded-xl border-2 overflow-hidden transition text-left ${selectedLibColor?.id === c.id ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-gray-300'}`}
                      >
                        {c.reference_image_url
                          ? <img src={c.reference_image_url} alt={c.name} className="w-full h-20 object-cover" />
                          : <div className="w-full h-20 bg-gray-200 flex items-center justify-center"><span className="text-xs text-gray-400">No image</span></div>}
                        <div className="px-1.5 py-1 bg-white">
                          <p className="text-xs font-semibold text-gray-800 truncate">{c.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Selected color detail */}
                  {selectedLibColor && (
                    <div className="space-y-2">
                      {selectedLibColor.reference_image_url && (
                        <img
                          src={selectedLibColor.reference_image_url}
                          alt={selectedLibColor.name}
                          className="w-full h-40 object-cover rounded-xl border border-gray-200"
                        />
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={blendName}
                          onChange={e => setBlendName(e.target.value)}
                          placeholder={selectedLibColor.name}
                          className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={addToSession}
                          disabled={!libRecipe.length}
                          className="flex-1 py-2 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-40"
                        >
                          + Add to Session
                        </button>
                        <button
                          onClick={customizeLibBlend}
                          disabled={!libRecipe.length}
                          className="flex-1 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-40"
                        >
                          Customize →
                        </button>
                      </div>
                    </div>
                  )}
                  {libraryColors.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No library colors set up. Go to Settings → Visualizer to add chip colors.</p>
                  )}
                </div>
              )}

              {/* Custom tab */}
              {blendTab === 'custom' && (
                <div className="space-y-3">
                  {editingId && (
                    <div className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-2 rounded-lg">
                      Editing: {sessionBlends.find(b => b.id === editingId)?.name}
                    </div>
                  )}

                  <CustomBlendBuilder primitives={primitives} items={customItems} setItems={setCustomItems} />

                  {/* Live preview */}
                  <SwatchBar recipe={customItems} className="h-24" />

                  {/* Name + save */}
                  <input
                    type="text"
                    value={blendName}
                    onChange={e => setBlendName(e.target.value)}
                    placeholder="Blend name (e.g. Light Gray Mix)"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addToSession}
                      disabled={!customItems.length}
                      className="flex-1 py-2 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-40"
                    >
                      {editingId ? '✓ Save Changes' : '+ Add to Session'}
                    </button>
                    {editingId && (
                      <button onClick={cancelEdit} className="px-3 py-2 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}

              {/* Session blends list */}
              {sessionBlends.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Session Blends ({sessionBlends.length})</p>
                    <button
                      onClick={() => setView('photo')}
                      className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-600 transition"
                    >
                      Apply to Photo →
                    </button>
                  </div>

                  {sessionBlends.map(blend => {
                    const ss = swatchState[blend.id] || {};
                    return (
                      <div key={blend.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <MiniSwatch recipe={blend.recipe} />
                          <span className="text-xs font-semibold text-gray-800 min-w-0 truncate">{blend.name}</span>
                          <button onClick={() => editBlend(blend)} className="text-xs text-blue-500 hover:underline flex-shrink-0">Edit</button>
                          <button onClick={() => removeBlend(blend.id)} className="text-xs text-gray-400 hover:text-red-400 flex-shrink-0">✕</button>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => saveSwatchToDrive(blend)}
                              disabled={ss.saving || ss.saved}
                              className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                            >
                              {ss.saved ? '✓ Saved' : ss.saving ? '…' : 'Save Swatch'}
                            </button>
                            {leadEmail && (
                              <button
                                onClick={() => emailSwatch(blend)}
                                disabled={ss.emailing || ss.emailed}
                                className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                              >
                                {ss.emailed ? '✓ Emailed' : ss.emailing ? '…' : 'Email Swatch'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── PHOTO VIEW ─────────────────────────────────────────────── */}
          {view === 'photo' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">Upload a floor photo</p>
                <p className="text-xs text-gray-500">{sessionBlends.length} blend{sessionBlends.length !== 1 ? 's' : ''} will be applied: {sessionBlends.map(b => b.name).join(', ')}</p>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition"
              >
                {photoFile
                  ? <p className="text-sm font-semibold text-gray-700">{photoFile.name}</p>
                  : <>
                      <p className="text-sm font-semibold text-gray-500">Tap to select photo</p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG, or HEIC • Up to 20MB</p>
                    </>}
              </div>
              <input ref={fileRef} type="file" accept="image/*,.heic" className="hidden" onChange={e => setPhotoFile(e.target.files[0] || null)} />

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                onClick={applyAllBlends}
                disabled={!photoFile || loading}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 transition disabled:opacity-50"
              >
                {loading ? 'Starting…' : `Run ${sessionBlends.length} Blend${sessionBlends.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* ── RESULTS VIEW ───────────────────────────────────────────── */}
          {view === 'results' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">Results</p>
                {processingCount > 0 && (
                  <span className="text-xs text-blue-500 animate-pulse">{processingCount} processing…</span>
                )}
                {processingCount === 0 && completeCount > 0 && (
                  <span className="text-xs text-green-600 font-semibold">{completeCount}/{sessionBlends.length} complete</span>
                )}
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              {sessionBlends.map(blend => {
                const r = results[blend.id] || { status: 'processing' };
                const as = actionState[r.vizId] || {};

                return (
                  <div key={blend.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <MiniSwatch recipe={blend.recipe} />
                      <span className="text-xs font-bold text-gray-800 truncate">{blend.name}</span>
                    </div>

                    {r.status === 'processing' && (
                      <div className="flex items-center gap-2 py-4 justify-center">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-gray-500">{r.vizId ? 'Analyzing floor…' : 'Queued…'}</span>
                      </div>
                    )}

                    {r.status === 'failed' && (
                      <div className="py-3 text-center">
                        <p className="text-xs text-red-500 font-semibold">Failed</p>
                        <p className="text-xs text-gray-400 mt-1">{r.error}</p>
                      </div>
                    )}

                    {r.status === 'complete' && r.generated && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-gray-400 text-center mb-1 font-semibold uppercase tracking-wide">Before</p>
                            <img src={r.original} alt="Before" className="w-full rounded-lg object-cover border border-gray-200" />
                          </div>
                          <div>
                            <p className="text-xs text-blue-500 text-center mb-1 font-semibold uppercase tracking-wide">After</p>
                            <img src={r.generated} alt="After" className="w-full rounded-lg object-cover border border-gray-200" />
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => saveVizToDrive(blend.id, r.vizId)}
                              disabled={as.savingDrive || as.savedDrive}
                              className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                            >
                              {as.savedDrive ? '✓ Saved' : as.savingDrive ? '…' : 'Save to Drive'}
                            </button>
                            {leadEmail && (
                              <button
                                onClick={() => emailViz(blend.id, r.vizId)}
                                disabled={as.emailing || as.emailed}
                                className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                              >
                                {as.emailed ? '✓ Emailed' : as.emailing ? '…' : 'Email Customer'}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => { setResults({}); setPhotoFile(null); setView('build'); }}
                className="w-full py-2 text-xs text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
              >
                Start Over with New Blends
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
