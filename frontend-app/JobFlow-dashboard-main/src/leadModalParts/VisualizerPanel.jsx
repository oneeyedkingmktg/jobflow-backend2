// ============================================================================
// VisualizerPanel v3
// - Square tile grid for session blends (4 tiles tall scroll)
// - Isolated editing: hide session list while building/editing
// - Save modal: "Update" vs "Save as New" when editing existing blend
// - Blend selection modal before applying to photo
// ============================================================================
import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "../api";

const API_BASE = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;
function getToken() { return localStorage.getItem("authToken"); }

let _nextId = 1;
function newId() { return _nextId++; }

// ── Canvas chip/flake blend preview ─────────────────────────────────────────
// Jagged polygon chips, 100% coverage (no background showing), square canvas.
// showLabels=true → color legend below; mini=true → smaller tiles.
function ChipBlendPreview({ recipe, showLabels = false, mini = false, className = "" }) {
  const canvasRef = useRef(null);
  const items = recipe.filter(r => (parseFloat(r.percentage) || 0) > 0);
  const total = items.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0) || 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Build weighted color pool (600 entries for smooth distribution)
    const pool = [];
    for (const item of items) {
      const count = Math.max(1, Math.round((parseFloat(item.percentage) / total) * 600));
      for (let i = 0; i < count; i++) pool.push(item.hex);
    }
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Seed-based draw so we pull colors sequentially (not random index)
    let poolIdx = 0;
    const nextColor = () => pool[poolIdx++ % pool.length];

    // Draw one jagged polygon chip centered at (x, y)
    const drawChip = (x, y, rx, ry, angle) => {
      const verts = 4 + Math.floor(Math.random() * 4); // 4–7 sides
      ctx.beginPath();
      for (let i = 0; i < verts; i++) {
        // Spread vertices unevenly around the perimeter for jagged look
        const baseA = (i / verts) * Math.PI * 2 + angle;
        const jitterA = baseA + (Math.random() - 0.5) * (Math.PI * 1.1 / verts);
        const jitterR = 0.45 + Math.random() * 0.55;
        const px = x + Math.cos(jitterA) * rx * jitterR;
        const py = y + Math.sin(jitterA) * ry * jitterR;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };

    // ── Pass 1: dense offset-grid — guarantees full coverage ──────────────
    // Fill dominant color first so any tiny sub-pixel gap matches a chip color
    const dominant = items.reduce((a, b) =>
      parseFloat(a.percentage) > parseFloat(b.percentage) ? a : b
    );
    ctx.fillStyle = dominant.hex;
    ctx.fillRect(0, 0, W, H);

    const spacing = mini ? 5 : 9;
    const maxRX   = mini ? 6 : 11;
    const maxRY   = mini ? 4 : 7;

    for (let row = -1; row < H / spacing + 2; row++) {
      for (let col = -1; col < W / spacing + 2; col++) {
        const x = col * spacing
          + (row % 2 === 0 ? 0 : spacing * 0.5)
          + (Math.random() - 0.5) * spacing * 0.6;
        const y = row * spacing + (Math.random() - 0.5) * spacing * 0.6;
        const rx = maxRX * (0.55 + Math.random() * 0.45);
        const ry = maxRY * (0.55 + Math.random() * 0.45);
        ctx.fillStyle = nextColor();
        drawChip(x, y, rx, ry, Math.random() * Math.PI);
      }
    }

    // ── Pass 2: random overlay for natural scatter ─────────────────────────
    const overlay = mini ? 250 : 700;
    for (let i = 0; i < overlay; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const rx = maxRX * (0.35 + Math.random() * 0.65);
      const ry = maxRY * (0.35 + Math.random() * 0.65);
      ctx.fillStyle = nextColor();
      drawChip(x, y, rx, ry, Math.random() * Math.PI);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items.map(i => `${i.hex}:${i.percentage}`))]);

  if (!items.length) {
    return (
      <div className={`rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center aspect-square ${className}`}>
        <span className="text-xs text-gray-400">{mini ? '' : 'Add colors to see preview'}</span>
      </div>
    );
  }

  const px = mini ? 120 : 320;

  return (
    <div className={`rounded-xl overflow-hidden border border-gray-200 shadow-sm ${className}`}>
      <canvas
        ref={canvasRef}
        width={px}
        height={px}
        className="w-full aspect-square block"
      />
      {showLabels && (
        <div className="flex bg-white border-t border-gray-100">
          {items.map((c, i) => {
            const pct = Math.round((parseFloat(c.percentage) / total) * 100);
            return (
              <div key={i} style={{ width: `${(parseFloat(c.percentage) / total) * 100}%`, minWidth: 32 }} className="text-center py-1.5 overflow-hidden px-0.5">
                <div className="w-3 h-3 rounded-sm mx-auto mb-0.5 border border-gray-300" style={{ background: c.hex }} />
                <div className="text-xs font-bold text-gray-700 truncate leading-tight">{(c.name || '').split(' ').slice(-1)[0]}</div>
                <div className="text-xs text-gray-400 leading-tight">{pct}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Custom blend builder (color picker + sliders) ────────────────────────────
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
      setItems(prev => [...prev.map(c => ({ ...c, percentage: even })), { hex: p.hex, name: p.name, code: p.code, percentage: even }]);
    }
  };

  const setPct = (hex, val) => {
    setItems(prev => prev.map(c => c.hex === hex ? { ...c, percentage: Math.max(1, Math.min(99, parseInt(val) || 1)) } : c));
  };

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {items.map(c => (
            <div key={c.hex} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded flex-shrink-0 border border-gray-200 shadow-sm" style={{ background: c.hex }} />
              <span className="text-xs font-semibold text-gray-700 w-24 truncate flex-shrink-0">{c.name}</span>
              <input type="range" min="1" max="99" value={c.percentage} onChange={e => setPct(c.hex, e.target.value)} className="flex-1 accent-blue-500" />
              <span className="text-xs text-gray-500 w-7 text-right flex-shrink-0">{c.percentage}%</span>
              <button onClick={() => setItems(prev => prev.filter(x => x.hex !== c.hex))} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
            </div>
          ))}
        </div>
      )}
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
      {!items.length && <p className="text-xs text-gray-400 text-center">Tap a color to add it to the blend</p>}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function VisualizerPanel({ lead, canEdit, onClose }) {
  const [view, setView] = useState('build'); // 'build' | 'photo' | 'results'

  // Builder
  const [blendTab, setBlendTab] = useState('library');
  const [libraryColors, setLibraryColors] = useState([]);
  const [primitives, setPrimitives] = useState([]);
  const [selectedLibColor, setSelectedLibColor] = useState(null);
  const [libRecipe, setLibRecipe] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [blendName, setBlendName] = useState('');
  const [editingId, setEditingId] = useState(null); // null = creating new

  // Save-blend modal: null | { mode: 'new'|'edit', proposedName: string }
  const [saveModal, setSaveModal] = useState(null);

  // Session blends
  const [sessionBlends, setSessionBlends] = useState([]);

  // Blend selection modal (shown before photo step)
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [selectedBlendIds, setSelectedBlendIds] = useState(new Set());

  // Photo & results
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef();
  const [results, setResults] = useState({});
  const [actionState, setActionState] = useState({});

  // Swatch action state per blend id
  const [swatchState, setSwatchState] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isBuilding = blendTab === 'custom' ? customItems.length > 0 : !!selectedLibColor;
  const currentRecipe = blendTab === 'library' ? libRecipe : customItems;
  const hasRecipe = currentRecipe.length > 0;
  const isEditing = editingId !== null;
  // Show session list only when NOT actively building/editing
  const showSessionList = sessionBlends.length > 0 && !isBuilding && !isEditing;

  const leadEmail = lead?.email;

  useEffect(() => {
    apiRequest('/api/visualizer/admin/selections').then(d => setLibraryColors(d.colors || [])).catch(() => {});
    apiRequest('/api/visualizer/primitives').then(d => setPrimitives(d.colors || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedLibColor) { setLibRecipe([]); return; }
    apiRequest(`/api/visualizer/recipe/${selectedLibColor.id}`)
      .then(d => setLibRecipe(d.recipe || []))
      .catch(() => setLibRecipe([]));
  }, [selectedLibColor?.id]);

  // Customize library blend → fork into custom tab
  const customizeLibBlend = () => {
    if (!libRecipe.length) return;
    setCustomItems(libRecipe.map(r => ({ ...r })));
    setBlendName(selectedLibColor?.name || '');
    setBlendTab('custom');
  };

  // Open the save modal
  const openSaveModal = () => {
    if (!hasRecipe) return;
    const name = blendName.trim() || (editingId ? sessionBlends.find(b => b.id === editingId)?.name : '') || `Blend ${sessionBlends.length + 1}`;
    setSaveModal({ mode: isEditing ? 'edit' : 'new', proposedName: name });
  };

  // Commit a save (called from modal)
  const commitSave = (asNew) => {
    const name = saveModal.proposedName.trim() || `Blend ${sessionBlends.length + 1}`;
    const recipe = currentRecipe.map(r => ({ ...r }));

    if (!asNew && isEditing) {
      setSessionBlends(prev => prev.map(b => b.id === editingId ? { ...b, name, recipe } : b));
    } else {
      setSessionBlends(prev => [...prev, { id: newId(), name, recipe }]);
    }

    setSaveModal(null);
    resetBuilder();
  };

  const resetBuilder = () => {
    setEditingId(null);
    setBlendName('');
    setCustomItems([]);
    setSelectedLibColor(null);
    setLibRecipe([]);
    setBlendTab('library');
    setError(null);
  };

  const editBlend = (blend) => {
    setEditingId(blend.id);
    setBlendName(blend.name);
    setCustomItems(blend.recipe.map(r => ({ ...r })));
    setBlendTab('custom');
    setError(null);
  };

  const removeBlend = (id) => {
    setSessionBlends(prev => prev.filter(b => b.id !== id));
    setResults(prev => { const r = { ...prev }; delete r[id]; return r; });
    setSelectedBlendIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    if (editingId === id) resetBuilder();
  };

  // Open blend selection modal before going to photo
  const openSelectModal = () => {
    // Pre-select all blends
    setSelectedBlendIds(new Set(sessionBlends.map(b => b.id)));
    setShowSelectModal(true);
  };

  const toggleBlendSelect = (id) => {
    setSelectedBlendIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // Apply selected blends to photo
  const applyBlends = async () => {
    const blendsToRun = sessionBlends.filter(b => selectedBlendIds.has(b.id));
    if (!photoFile || !blendsToRun.length) return;
    setLoading(true);
    setError(null);

    const init = {};
    for (const b of blendsToRun) init[b.id] = { vizId: null, status: 'processing', generated: null, original: null, error: null };
    setResults(init);
    setView('results');
    setLoading(false);

    for (const blend of blendsToRun) {
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

  // Poll results
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Object.entries(results).map(([id, r]) => [id, r.vizId, r.status]))]);

  const saveVizToDrive = async (blendId, vizId) => {
    setActionState(p => ({ ...p, [vizId]: { ...p[vizId], savingDrive: true } }));
    try {
      await apiRequest('/api/visualizer/lead', { method: 'POST', body: JSON.stringify({ visualization_id: vizId, company_id: lead.company_id || lead.companyId, name: lead.name }) });
      setActionState(p => ({ ...p, [vizId]: { ...p[vizId], savedDrive: true } }));
    } catch (e) { setError(e.message); }
    finally { setActionState(p => ({ ...p, [vizId]: { ...p[vizId], savingDrive: false } })); }
  };

  const emailViz = async (blendId, vizId) => {
    setActionState(p => ({ ...p, [vizId]: { ...p[vizId], emailing: true } }));
    try {
      await apiRequest('/api/visualizer/send-email', { method: 'POST', body: JSON.stringify({ visualization_id: vizId, company_id: lead.company_id || lead.companyId, customer_email: leadEmail, customer_name: lead.name }) });
      setActionState(p => ({ ...p, [vizId]: { ...p[vizId], emailed: true } }));
    } catch (e) { setError(e.message); }
    finally { setActionState(p => ({ ...p, [vizId]: { ...p[vizId], emailing: false } })); }
  };

  const saveSwatchToDrive = async (blend) => {
    setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], saving: true } }));
    try {
      await apiRequest('/api/visualizer/swatch', { method: 'POST', body: JSON.stringify({ recipe: blend.recipe, lead_id: lead.id, blend_name: blend.name }) });
      setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], saved: true } }));
    } catch (e) { setError(e.message); }
    finally { setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], saving: false } })); }
  };

  const emailSwatch = async (blend) => {
    setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], emailing: true } }));
    try {
      const { swatch_url } = await apiRequest('/api/visualizer/swatch', { method: 'POST', body: JSON.stringify({ recipe: blend.recipe, blend_name: blend.name }) });
      await apiRequest('/api/visualizer/send-swatch-email', { method: 'POST', body: JSON.stringify({ swatch_url, lead_id: lead.id, blend_description: blend.name }) });
      setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], emailed: true } }));
    } catch (e) { setError(e.message); }
    finally { setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], emailing: false } })); }
  };

  const processingCount = Object.values(results).filter(r => r.status === 'processing').length;
  const completeCount   = Object.values(results).filter(r => r.status === 'complete').length;
  const runningBlends   = sessionBlends.filter(b => results[b.id]);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Main modal */}
      <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-4 px-2">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Floor Visualizer</h2>
              <p className="text-xs text-gray-400">{lead.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {view === 'results' && <button onClick={() => setView('photo')} className="text-xs text-blue-500 hover:underline">← Photo</button>}
              {view === 'photo'   && <button onClick={() => setView('build')} className="text-xs text-blue-500 hover:underline">← Blends</button>}
              <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-2xl font-light ml-1">×</button>
            </div>
          </div>

          <div className="px-4 py-4 space-y-4">

            {/* ── BUILD VIEW ──────────────────────────────────────────── */}
            {view === 'build' && (
              <>
                {/* Tab switcher — hidden while editing (keeps focus) */}
                {!isEditing && (
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                    <button
                      onClick={() => { setBlendTab('library'); setCustomItems([]); setBlendName(''); }}
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
                )}

                {/* Editing banner */}
                {isEditing && (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                    <span className="text-xs font-semibold text-blue-700">Editing: {sessionBlends.find(b => b.id === editingId)?.name}</span>
                    <button onClick={resetBuilder} className="text-xs text-blue-400 hover:text-blue-600">Cancel</button>
                  </div>
                )}

                {/* Library tab */}
                {blendTab === 'library' && !isEditing && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                      {libraryColors.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedLibColor(c); setBlendName(c.name); }}
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
                      {libraryColors.length === 0 && (
                        <div className="col-span-3 text-center py-6 text-xs text-gray-400">No library colors configured yet.</div>
                      )}
                    </div>

                    {selectedLibColor && (
                      <div className="space-y-3">
                        {libRecipe.length > 0
                          ? <ChipBlendPreview recipe={libRecipe} showLabels className="w-full" />
                          : <div className="w-full h-32 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center"><span className="text-xs text-gray-400">Loading blend…</span></div>
                        }
                        <input
                          type="text"
                          value={blendName}
                          onChange={e => setBlendName(e.target.value)}
                          placeholder="Blend name"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={openSaveModal}
                            disabled={!libRecipe.length}
                            className="flex-1 py-2 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-40"
                          >
                            Save Blend
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
                  </div>
                )}

                {/* Custom tab */}
                {blendTab === 'custom' && (
                  <div className="space-y-3">
                    <CustomBlendBuilder primitives={primitives} items={customItems} setItems={setCustomItems} />
                    <ChipBlendPreview recipe={customItems} showLabels className="w-full" />
                    <input
                      type="text"
                      value={blendName}
                      onChange={e => setBlendName(e.target.value)}
                      placeholder="Blend name (e.g. Light Gray Mix)"
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      onClick={openSaveModal}
                      disabled={!customItems.length}
                      className="w-full py-2 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-40"
                    >
                      Save Blend
                    </button>
                  </div>
                )}

                {error && <p className="text-xs text-red-500">{error}</p>}

                {/* Session blend tile grid */}
                {showSessionList && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Saved Blends</p>
                      <button
                        onClick={openSelectModal}
                        className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-600 transition"
                      >
                        Apply to Photo →
                      </button>
                    </div>

                    {/* 2-column tile grid, 4 rows visible (~320px) */}
                    <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                      {sessionBlends.map(blend => {
                        const ss = swatchState[blend.id] || {};
                        return (
                          <div key={blend.id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                            {/* Mini chip preview */}
                            <ChipBlendPreview recipe={blend.recipe} mini className="w-full" />
                            {/* Blend name + actions */}
                            <div className="px-2 py-2 space-y-1.5">
                              <p className="text-xs font-bold text-gray-800 truncate">{blend.name}</p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => editBlend(blend)}
                                  className="flex-1 py-1 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-100 transition"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => removeBlend(blend.id)}
                                  className="px-2 py-1 text-xs text-gray-300 hover:text-red-400 border border-gray-200 rounded bg-white transition"
                                >
                                  ✕
                                </button>
                              </div>
                              {canEdit && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => saveSwatchToDrive(blend)}
                                    disabled={ss.saving || ss.saved}
                                    className="flex-1 py-1 text-xs font-semibold bg-white border border-gray-200 text-gray-500 rounded hover:bg-gray-100 transition disabled:opacity-50"
                                  >
                                    {ss.saved ? '✓ Saved' : ss.saving ? '…' : 'Swatch →Drive'}
                                  </button>
                                  {leadEmail && (
                                    <button
                                      onClick={() => emailSwatch(blend)}
                                      disabled={ss.emailing || ss.emailed}
                                      className="flex-1 py-1 text-xs font-semibold bg-white border border-gray-200 text-gray-500 rounded hover:bg-gray-100 transition disabled:opacity-50"
                                    >
                                      {ss.emailed ? '✓ Sent' : ss.emailing ? '…' : 'Email'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Prompt to add first blend */}
                {sessionBlends.length === 0 && !isBuilding && !isEditing && blendTab === 'library' && !selectedLibColor && (
                  <p className="text-xs text-gray-400 text-center py-2">Select a library color above, or switch to Custom Blend to build your own.</p>
                )}
              </>
            )}

            {/* ── PHOTO VIEW ──────────────────────────────────────────── */}
            {view === 'photo' && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Upload a floor photo</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedBlendIds.size} blend{selectedBlendIds.size !== 1 ? 's' : ''} selected: {sessionBlends.filter(b => selectedBlendIds.has(b.id)).map(b => b.name).join(', ')}
                  </p>
                </div>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition"
                >
                  {photoFile
                    ? <p className="text-sm font-semibold text-gray-700">{photoFile.name}</p>
                    : <><p className="text-sm font-semibold text-gray-500">Tap to select photo</p><p className="text-xs text-gray-400 mt-1">JPG, PNG, or HEIC • Up to 20MB</p></>}
                </div>
                <input ref={fileRef} type="file" accept="image/*,.heic" className="hidden" onChange={e => setPhotoFile(e.target.files[0] || null)} />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  onClick={applyBlends}
                  disabled={!photoFile || loading}
                  className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 transition disabled:opacity-50"
                >
                  {loading ? 'Starting…' : `Run ${selectedBlendIds.size} Blend${selectedBlendIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {/* ── RESULTS VIEW ────────────────────────────────────────── */}
            {view === 'results' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Results</p>
                  {processingCount > 0
                    ? <span className="text-xs text-blue-500 animate-pulse">{processingCount} processing…</span>
                    : <span className="text-xs text-green-600 font-semibold">{completeCount}/{runningBlends.length} complete</span>}
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}

                {runningBlends.map(blend => {
                  const r  = results[blend.id] || { status: 'processing' };
                  const as = actionState[r.vizId] || {};
                  return (
                    <div key={blend.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                          <ChipBlendPreview recipe={blend.recipe} mini className="w-full h-full" />
                        </div>
                        <span className="text-xs font-bold text-gray-800 truncate">{blend.name}</span>
                        {r.status === 'processing' && <span className="text-xs text-blue-400 animate-pulse ml-auto">{r.vizId ? 'Processing…' : 'Queued…'}</span>}
                        {r.status === 'failed'     && <span className="text-xs text-red-500 ml-auto">Failed</span>}
                        {r.status === 'complete'   && <span className="text-xs text-green-500 ml-auto">✓ Done</span>}
                      </div>

                      {r.status === 'processing' && (
                        <div className="flex justify-center py-6">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}

                      {r.status === 'failed' && (
                        <p className="text-xs text-red-400 text-center py-2">{r.error}</p>
                      )}

                      {r.status === 'complete' && r.generated && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-gray-400 text-center mb-1 font-bold uppercase tracking-wide">Before</p>
                              <img src={r.original} alt="Before" className="w-full rounded-lg object-cover border border-gray-200" />
                            </div>
                            <div>
                              <p className="text-xs text-blue-500 text-center mb-1 font-bold uppercase tracking-wide">After</p>
                              <img src={r.generated} alt="After" className="w-full rounded-lg object-cover border border-gray-200" />
                            </div>
                          </div>
                          {canEdit && (
                            <div className="flex gap-1.5">
                              <button onClick={() => saveVizToDrive(blend.id, r.vizId)} disabled={as.savingDrive || as.savedDrive} className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition disabled:opacity-50">
                                {as.savedDrive ? '✓ Saved' : as.savingDrive ? '…' : 'Save to Drive'}
                              </button>
                              {leadEmail && (
                                <button onClick={() => emailViz(blend.id, r.vizId)} disabled={as.emailing || as.emailed} className="flex-1 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition disabled:opacity-50">
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
                  className="w-full py-2 text-xs text-gray-400 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                >
                  Start Over
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── SAVE BLEND MODAL ──────────────────────────────────────────────── */}
      {saveModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Save Blend</h3>
            <input
              type="text"
              value={saveModal.proposedName}
              onChange={e => setSaveModal(m => ({ ...m, proposedName: e.target.value }))}
              placeholder="Blend name"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="space-y-2">
              {saveModal.mode === 'edit' && (
                <button
                  onClick={() => commitSave(false)}
                  className="w-full py-2.5 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition"
                >
                  Update "{sessionBlends.find(b => b.id === editingId)?.name}"
                </button>
              )}
              <button
                onClick={() => commitSave(true)}
                className={`w-full py-2.5 text-sm font-semibold rounded-xl transition ${saveModal.mode === 'edit' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              >
                {saveModal.mode === 'edit' ? 'Save as New Blend' : 'Save Blend'}
              </button>
              <button onClick={() => setSaveModal(null)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BLEND SELECTION MODAL ─────────────────────────────────────────── */}
      {showSelectModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Select Blends to Preview</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {sessionBlends.map(blend => (
                <label key={blend.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedBlendIds.has(blend.id)}
                    onChange={() => toggleBlendSelect(blend.id)}
                    className="w-4 h-4 accent-blue-500 flex-shrink-0"
                  />
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                    <ChipBlendPreview recipe={blend.recipe} mini className="w-full h-full" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800 truncate">{blend.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowSelectModal(false)} className="flex-1 py-2 text-sm text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                Cancel
              </button>
              <button
                onClick={() => { setShowSelectModal(false); setView('photo'); }}
                disabled={selectedBlendIds.size === 0}
                className="flex-1 py-2 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition disabled:opacity-50"
              >
                Continue ({selectedBlendIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
