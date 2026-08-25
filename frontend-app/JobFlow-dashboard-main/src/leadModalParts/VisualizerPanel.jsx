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

// ── Seeded PRNG (mulberry32) — same recipe → same layout at any canvas size ──
function _hash(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++)
    h = (Math.imul(h ^ str.charCodeAt(i), 0x01000193)) >>> 0;
  return h;
}
function _mkRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Shared chip rendering logic ───────────────────────────────────────────────
// Simulates real broadcast chip scatter: high chip count (~5x canvas area)
// guarantees no background shows through. All colors rendered as chips.
// Seeded PRNG + normalized coords = preview matches saved image exactly.
function renderChipsToCtx(ctx, W, H, recipe, mini = false) {
  const items = recipe.filter(r => (parseFloat(r.percentage) || 0) > 0);
  if (!items.length) return;
  const total = items.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0) || 1;

  const seed = _hash(items.map(r => `${r.hex}:${Math.round(parseFloat(r.percentage))}`).join(','));
  const rand = _mkRand(seed);

  // Use a perfect square chip count so the stratified grid fills every cell — no empty bottom rows
  const baseChips = mini ? 196 : 576; // 14² or 24² — perfect squares
  const gridSize  = Math.round(Math.sqrt(baseChips));
  const totalChips = gridSize * gridSize;

  // Pre-assign colors proportionally then Fisher-Yates shuffle
  const colorList = [];
  let assigned = 0;
  for (let ci = 0; ci < items.length; ci++) {
    const pct = (parseFloat(items[ci].percentage) || 0) / total;
    const count = ci === items.length - 1 ? totalChips - assigned : Math.round(pct * totalChips);
    for (let k = 0; k < count; k++) colorList.push(items[ci].hex);
    assigned += count;
  }
  for (let i = colorList.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [colorList[i], colorList[j]] = [colorList[j], colorList[i]];
  }

  // Chip radius 4–9% of canvas width
  const minRN = mini ? 0.052 : 0.040;
  const maxRN = mini ? 0.108 : 0.088;

  ctx.lineWidth = Math.max(0.4, W * 0.001);

  const drawChip = (xN, yN, rN, hex) => {
    const cx = xN * W;
    const cy = yN * H;
    const maxR = rN * W;
    const verts = 5 + Math.floor(rand() * 4);   // 5–8 vertices: broken shard
    const scaleY = 0.50 + rand() * 0.60;         // aspect ratio 0.5–1.1
    const rot = rand() * Math.PI * 2;             // full 360° — no directional bias
    ctx.beginPath();
    for (let i = 0; i < verts; i++) {
      const baseA = (i / verts) * Math.PI * 2;
      const jitter = (rand() - 0.5) * (Math.PI / verts) * 1.3;
      const a = baseA + jitter;
      // 65–100% of maxR keeps shapes convex-ish — avoids deep star-point concavities
      const r = maxR * (0.65 + rand() * 0.35);
      const lx = Math.cos(a) * r;
      const ly = Math.sin(a) * r * scaleY;
      const px = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
      const py = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = hex;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.stroke();
  };

  // Pre-compute chip positions (stratified for coverage) then shuffle draw order
  const chips = [];
  for (let i = 0; i < totalChips; i++) {
    const col = i % gridSize;
    const row = Math.floor(i / gridSize);
    chips.push({
      xN: (col + rand()) / gridSize,
      yN: (row + rand()) / gridSize,
      rN: minRN + rand() * (maxRN - minRN),
      hex: colorList[i],
    });
  }
  for (let i = chips.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [chips[i], chips[j]] = [chips[j], chips[i]];
  }
  for (const c of chips) drawChip(c.xN, c.yN, c.rN, c.hex);
}

// Renders recipe to an off-screen canvas and returns a PNG Blob (for swatch upload).
function renderChipsToBlob(recipe, size = 960) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    renderChipsToCtx(canvas.getContext('2d'), size, size, recipe);
    canvas.toBlob(resolve, 'image/png');
  });
}

// ── Canvas chip/flake blend preview ─────────────────────────────────────────
function ChipBlendPreview({ recipe, showLabels = false, mini = false, className = "", placeholder = "Add colors to see preview" }) {
  const canvasRef = useRef(null);
  const items = recipe.filter(r => (parseFloat(r.percentage) || 0) > 0);
  const total = items.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0) || 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !items.length) return;
    renderChipsToCtx(canvas.getContext('2d'), canvas.width, canvas.height, items, mini);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items.map(i => `${i.hex}:${i.percentage}`))]);

  if (!items.length) {
    return (
      <div className={`rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center aspect-square ${className}`}>
        <span className="text-xs text-gray-400">{mini ? '' : placeholder}</span>
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
      {showLabels && items.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-2.5 py-2 bg-white border-t border-gray-100">
          {items.map((c, i) => {
            const pct  = Math.round((parseFloat(c.percentage) / total) * 100);
            const code = c.code || (c.name || '').match(/F-\d+/)?.[0] || '';
            const name = (c.name || '').split(' ').filter(w => !/F-\d+/.test(w) && w.toLowerCase() !== 'torginol').join(' ') || code;
            return (
              <div key={i} className="flex items-center gap-1 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-gray-200" style={{ background: c.hex }} />
                {code && <span className="font-mono text-gray-400">{code}</span>}
                <span className="font-semibold text-gray-700">{name}</span>
                <span className="text-gray-400">{pct}%</span>
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
  const [showPicker, setShowPicker] = useState(items.length === 0);

  const filtered = search
    ? primitives.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    : primitives;

  // Extract short label: prefer code (F-101), else extract from name, else last word
  const shortLabel = (c) => c.code || (c.name || '').match(/F-\d+/)?.[0] || (c.name || '').split(' ').slice(-1)[0];

  const toggle = (p) => {
    if (items.find(c => c.hex === p.hex)) {
      setItems(prev => prev.filter(c => c.hex !== p.hex));
      return;
    }
    if (items.length === 0) {
      setItems([{ hex: p.hex, name: p.name, code: p.code, percentage: 100 }]);
      return;
    }
    // New color starts at 10%; scale existing colors proportionally to make room
    const newPct = 10;
    const currentTotal = items.reduce((s, c) => s + (parseFloat(c.percentage) || 0), 0);
    const scale = (currentTotal - newPct) / currentTotal;
    setItems(prev => [
      ...prev.map(c => ({ ...c, percentage: Math.max(1, Math.round(c.percentage * scale)) })),
      { hex: p.hex, name: p.name, code: p.code, percentage: newPct },
    ]);
  };

  const setPct = (hex, val) => {
    setItems(prev => prev.map(c => c.hex === hex ? { ...c, percentage: Math.max(1, Math.min(99, parseInt(val) || 1)) } : c));
  };

  const total = items.reduce((s, c) => s + (parseFloat(c.percentage) || 0), 0) || 1;

  return (
    <div className="space-y-3">
      {/* Live custom blend summary */}
      {items.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Custom Blend</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {items.map((c, i) => (
              <span key={i} className="text-xs text-gray-600 flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm border border-gray-300 flex-shrink-0" style={{ background: c.hex }} />
                <span className="font-mono text-gray-500">{shortLabel(c)}</span>
                <span className="text-gray-700 font-semibold">{(c.name || '').split(' ').filter(w => !/F-\d+/.test(w) && w !== 'Torginol').join(' ')}</span>
                <span className="text-gray-400">{Math.round((parseFloat(c.percentage) / total) * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {items.map(c => (
            <div key={c.hex} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded flex-shrink-0 border border-gray-200 shadow-sm" style={{ background: c.hex }} />
              <span className="text-xs font-semibold text-gray-700 w-24 truncate flex-shrink-0">{(c.name || '').split(' ').filter(w => !/F-\d+/.test(w) && w !== 'Torginol').join(' ')}</span>
              <input type="range" min="1" max="99" value={c.percentage} onChange={e => setPct(c.hex, e.target.value)} className="flex-1 accent-blue-500" />
              <button onClick={() => setItems(prev => prev.filter(x => x.hex !== c.hex))} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <button
          onClick={() => setShowPicker(p => !p)}
          className="w-full py-1.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
        >
          {showPicker ? '▲ Hide Color Picker' : '+ Add Color'}
        </button>
      )}
      {showPicker && (
      <input
        type="text"
        placeholder="Search Torginol colors…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      )}
      {showPicker && (
      <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto">
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
      )}
      {showPicker && !items.length && <p className="text-xs text-gray-400 text-center">Tap a color to add it to the blend</p>}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function VisualizerPanel({ lead, canEdit, onClose }) {
  const [view, setView] = useState('build'); // 'build' | 'photo' | 'results'

  // Builder
  const [blendTab, setBlendTab] = useState('standards'); // 'standards' | 'custom' | 'shortlist'
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

  const [selectedBlendIds, setSelectedBlendIds] = useState(new Set());

  // Library UI
  const [showAllBlends, setShowAllBlends] = useState(false);

  // Photo & results
  const [photoFile, setPhotoFile] = useState(null);
  const fileRef = useRef();
  const [results, setResults] = useState({});
  const [actionState, setActionState] = useState({});

  // Drive save modal
  const [driveModal, setDriveModal] = useState(null); // null | { vizId, blendId, blendName }
  const [driveModalName, setDriveModalName] = useState('');
  const [savedBeforeNames, setSavedBeforeNames] = useState(new Set());

  // Email viz modal — confirm/edit email before sending
  const [emailVizModal, setEmailVizModal] = useState(null); // null | { blendId, vizId, email }
  // Email swatch modal
  const [emailSwatchModal, setEmailSwatchModal] = useState(null); // null | { blend, email }

  // Company-level saved custom blends + search
  const [blendSearch, setBlendSearch] = useState('');
  const [companyBlends, setCompanyBlends] = useState([]);
  const [showMyBlends, setShowMyBlends] = useState(false);

  // Swatch action state per blend id
  const [swatchState, setSwatchState] = useState({});

  // Previously-generated mockups for this lead
  const [mockups, setMockups] = useState([]);
  // Blend shown in fullscreen chip preview (shortlist single-click)
  const [previewBlend, setPreviewBlend] = useState(null);
  // URL shown in fullscreen image overlay (mockups tap)
  const [fullscreenImage, setFullscreenImage] = useState(null);
  // Timer refs for single vs double-click on shortlist tiles
  const clickTimersRef = useRef({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isBuilding = blendTab === 'custom' ? customItems.length > 0 : !!selectedLibColor;
  const currentRecipe = blendTab === 'standards' ? libRecipe : customItems;
  const hasRecipe = currentRecipe.length > 0;
  const isEditing = editingId !== null;
  // Show session list only when NOT actively building/editing


  const leadEmail = lead?.email;

  useEffect(() => {
    apiRequest('/api/visualizer/admin/selections').then(d => setLibraryColors(d.colors || [])).catch(() => {});
    apiRequest('/api/visualizer/primitives').then(d => setPrimitives(d.colors || [])).catch(() => {});
    apiRequest('/api/visualizer/company-blends').then(d => setCompanyBlends(d.blends || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedLibColor) { setLibRecipe([]); return; }
    // Company-level saved blends carry their recipe directly — no API call needed
    if (selectedLibColor._recipe) { setLibRecipe(selectedLibColor._recipe); return; }
    apiRequest(`/api/visualizer/recipe/${selectedLibColor.id}`)
      .then(d => setLibRecipe(d.recipe || []))
      .catch(() => setLibRecipe([]));
  }, [selectedLibColor?.id]);

  // Load saved blends + past mockups from DB when visualizer opens
  useEffect(() => {
    if (!lead?.id) return;
    apiRequest(`/api/visualizer/lead-blends?lead_id=${lead.id}`)
      .then(d => {
        const loaded = (d.blends || []).map(b => ({ id: newId(), name: b.name, recipe: b.recipe }));
        if (loaded.length) setSessionBlends(loaded);
      })
      .catch(() => {});
    apiRequest(`/api/visualizer/lead-mockups?lead_id=${lead.id}`)
      .then(d => setMockups(d.mockups || []))
      .catch(() => {});
  }, [lead?.id]);

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

  // Commit a save (called from modal) — auto-saves swatch to Drive
  const commitSave = (asNew) => {
    const name = saveModal.proposedName.trim() || `Blend ${sessionBlends.length + 1}`;
    const recipe = currentRecipe.map(r => ({ ...r }));

    let savedBlend;
    if (!asNew && isEditing) {
      savedBlend = { id: editingId, name, recipe };
      setSessionBlends(prev => prev.map(b => b.id === editingId ? savedBlend : b));
    } else {
      savedBlend = { id: newId(), name, recipe };
      setSessionBlends(prev => [...prev, savedBlend]);
    }

    setSaveModal(null);
    resetBuilder('shortlist');
    setSelectedBlendIds(prev => new Set([...prev, savedBlend.id]));
    saveSwatchToDrive(savedBlend); // auto-save blend recipe to Drive
  };

  const resetBuilder = (targetTab = 'standards') => {
    setEditingId(null);
    setBlendName('');
    setCustomItems([]);
    setSelectedLibColor(null);
    setLibRecipe([]);
    setBlendTab(targetTab);
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

  const toggleBlendSelect = (id) => {
    setSelectedBlendIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // Single click → open blend preview; double click → toggle selection
  const handleTileClick = (blend) => {
    if (clickTimersRef.current[blend.id]) {
      clearTimeout(clickTimersRef.current[blend.id]);
      delete clickTimersRef.current[blend.id];
      toggleBlendSelect(blend.id);
    } else {
      clickTimersRef.current[blend.id] = setTimeout(() => {
        delete clickTimersRef.current[blend.id];
        setPreviewBlend(blend);
      }, 280);
    }
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
      fd.append('blend_name', blend.name);
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
            const blName = sessionBlends.find(b => String(b.id) === String(blendId))?.name || null;
            setMockups(prev => {
              if (prev.some(m => m.id === data.id)) return prev;
              return [{ id: data.id, generated_image_url: data.generated_image_url, original_image_url: data.original_image_url, blend_name: blName, completed_at: new Date().toISOString() }, ...prev];
            });
            // Auto-save to Drive
            if (blName) {
              apiRequest('/api/visualizer/save-viz-to-drive', {
                method: 'POST',
                body: JSON.stringify({ visualization_id: data.id, blend_name: blName, save_as_name: blName }),
              }).catch(() => {});
            }
          } else if (data.status === 'failed') {
            setResults(prev => ({ ...prev, [blendId]: { ...prev[blendId], status: 'failed', error: data.error_message || 'Failed' } }));
          }
        } catch {}
      }, 2500)
    );
    return () => timers.forEach(clearInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Object.entries(results).map(([id, r]) => [id, r.vizId, r.status]))]);

  const saveVizToDrive = (blendId, vizId) => {
    const blendName = sessionBlends.find(b => b.id === blendId)?.name || 'Custom Blend';
    setDriveModalName('');
    setDriveModal({ vizId, blendId, blendName });
  };

  const confirmDriveSave = async () => {
    if (!driveModal) return;
    const { vizId, blendName } = driveModal;
    const saveAsName = driveModalName.trim() || blendName || 'Session';
    const skipBefore = savedBeforeNames.has(saveAsName);
    setDriveModal(null);
    setActionState(p => ({ ...p, [vizId]: { ...p[vizId], savingDrive: true } }));
    try {
      await apiRequest('/api/visualizer/save-viz-to-drive', {
        method: 'POST',
        body: JSON.stringify({ visualization_id: vizId, blend_name: blendName, save_as_name: saveAsName, skip_before: skipBefore }),
      });
      setActionState(p => ({ ...p, [vizId]: { ...p[vizId], savedDrive: true } }));
      setSavedBeforeNames(prev => new Set([...prev, saveAsName]));
    } catch (e) { setError(e.message); }
    finally { setActionState(p => ({ ...p, [vizId]: { ...p[vizId], savingDrive: false } })); }
  };

  const emailViz = async (blendId, vizId, toEmail) => {
    setEmailVizModal(null);
    setActionState(p => ({ ...p, [vizId]: { ...p[vizId], emailing: true } }));
    try {
      await apiRequest('/api/visualizer/send-email', { method: 'POST', body: JSON.stringify({ visualization_id: vizId, company_id: lead.company_id || lead.companyId, customer_email: toEmail || leadEmail, customer_name: lead.name }) });
      setActionState(p => ({ ...p, [vizId]: { ...p[vizId], emailed: true } }));
    } catch (e) { setError(e.message); }
    finally { setActionState(p => ({ ...p, [vizId]: { ...p[vizId], emailing: false } })); }
  };

  // Build the swatch FormData: render chip canvas client-side, POST image + metadata
  const buildSwatchForm = async (blend, includeLeadId = false) => {
    const blob = await renderChipsToBlob(blend.recipe, 960);
    const fd = new FormData();
    fd.append('image', blob, 'swatch.png');
    fd.append('blend_name', blend.name);
    fd.append('recipe', JSON.stringify(blend.recipe));
    if (includeLeadId && lead?.id) fd.append('lead_id', lead.id);
    return fd;
  };

  const saveSwatchToDrive = async (blend) => {
    setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], saving: true } }));
    try {
      const fd = await buildSwatchForm(blend, true);
      const result = await fetch(`${API_BASE}/api/visualizer/swatch`, {
        method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
      }).then(r => r.json());
      if (result.error) throw new Error(result.error);
      setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], saved: true } }));
    } catch (e) { setError(e.message); }
    finally { setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], saving: false } })); }
  };

  const emailSwatch = async (blend, toEmail) => {
    setEmailSwatchModal(null);
    setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], emailing: true } }));
    try {
      const fd = await buildSwatchForm(blend, false);
      const { swatch_url } = await fetch(`${API_BASE}/api/visualizer/swatch`, {
        method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
      }).then(r => r.json());
      if (!swatch_url) throw new Error('Swatch generation failed');
      await fetch(`${API_BASE}/api/visualizer/send-swatch-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ swatch_url, lead_id: lead?.id, blend_description: blend.name, customer_email: toEmail }),
      });
      setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], emailed: true } }));
    } catch (e) { setError(e.message); }
    finally { setSwatchState(p => ({ ...p, [blend.id]: { ...p[blend.id], emailing: false } })); }
  };

  const saveToMyBlends = async () => {
    if (!customItems.length) return;
    const name = (blendName.trim() || `My Blend ${companyBlends.length + 1}`);
    setSaveModal({ mode: 'myblend', proposedName: name });
  };

  const commitSaveToMyBlends = async (name) => {
    try {
      const data = await apiRequest('/api/visualizer/company-blends', {
        method: 'POST',
        body: JSON.stringify({ name, recipe: customItems }),
      });
      setCompanyBlends(prev => [...prev, data.blend]);
      setSaveModal(null);
    } catch (err) {
      setError('Failed to save to My Blends. Please try again.');
      setSaveModal(null);
    }
  };

  const removeFromMyBlends = async (id) => {
    try {
      await apiRequest(`/api/visualizer/company-blends/${id}`, { method: 'DELETE' });
      setCompanyBlends(prev => prev.filter(b => b.id !== id));
      if (selectedLibColor?.id === `cb-${id}`) { setSelectedLibColor(null); }
    } catch {}
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
                {/* 4-tab switcher */}
                <div className="flex gap-0.5 bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => { setBlendTab('standards'); setCustomItems([]); setBlendName(''); }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${blendTab === 'standards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => setBlendTab('custom')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${blendTab === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                  >
                    Custom
                  </button>
                  <button
                    onClick={() => setBlendTab('shortlist')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${blendTab === 'shortlist' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                  >
                    Blends{sessionBlends.length > 0 ? ` (${sessionBlends.length})` : ''}
                  </button>
                  <button
                    onClick={() => setBlendTab('mockups')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${blendTab === 'mockups' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                  >
                    Previews{mockups.length > 0 ? ` (${mockups.length})` : ''}
                  </button>
                </div>

                {/* ── STANDARD COLORS TAB ── */}
                {blendTab === 'standards' && (
                  <div className="space-y-3">
                    {/* Search */}
                    <input
                      type="text"
                      placeholder="Search blends…"
                      value={blendSearch}
                      onChange={e => { setBlendSearch(e.target.value); setSelectedLibColor(null); }}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    {(() => {
                      const q = blendSearch.toLowerCase();
                      const standards = libraryColors.filter(c => c.selected  && (!q || c.name.toLowerCase().includes(q)));
                      const others    = libraryColors.filter(c => !c.selected && (!q || c.name.toLowerCase().includes(q)));
                      const myBlends  = companyBlends.filter(b => !q || b.name.toLowerCase().includes(q));
                      const noResults = q && !standards.length && !others.length && !myBlends.length;
                      return (
                        <>
                          {!q && standards.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">No standard colors configured yet.</p>
                          )}
                          {noResults && (
                            <p className="text-xs text-gray-400 text-center py-4">No blends match "{blendSearch}"</p>
                          )}

                          {/* Company standard blends */}
                          {standards.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                              {standards.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => { setSelectedLibColor(c); setBlendName(c.name); setShowAllBlends(false); }}
                                  className={`rounded-xl border-2 overflow-hidden transition text-left ${selectedLibColor?.id === c.id ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-gray-300'}`}
                                >
                                  {c.reference_image_url
                                    ? <img src={c.reference_image_url} alt={c.name} className="w-full h-20 object-cover" />
                                    : <div className="w-full h-20 bg-gray-200 flex items-center justify-center"><span className="text-xs text-gray-400">No img</span></div>}
                                  <div className="px-1.5 py-1 bg-white">
                                    <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{c.name}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* See All Blends */}
                          {others.length > 0 && (
                            <div>
                              <button
                                onClick={() => { setShowAllBlends(p => !p); setSelectedLibColor(null); }}
                                className="flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:text-blue-700 transition"
                              >
                                <span>{(showAllBlends || q) ? '▲' : '▼'}</span>
                                {(showAllBlends || q) ? 'Hide' : 'See All Blends'} ({others.length} more)
                              </button>
                              {(showAllBlends || q) && (
                                <div className="grid grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto pr-0.5">
                                  {others.map(c => (
                                    <button
                                      key={c.id}
                                      onClick={() => { setSelectedLibColor(c); setBlendName(c.name); }}
                                      className={`rounded-xl border-2 overflow-hidden transition text-left ${selectedLibColor?.id === c.id ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-gray-300'}`}
                                    >
                                      {c.reference_image_url
                                        ? <img src={c.reference_image_url} alt={c.name} className="w-full h-20 object-cover" />
                                        : <div className="w-full h-20 bg-gray-200 flex items-center justify-center"><span className="text-xs text-gray-400">No img</span></div>}
                                      <div className="px-1.5 py-1 bg-white">
                                        <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{c.name}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* My Saved Custom Blends */}
                          {companyBlends.length > 0 && (
                            <div>
                              <button
                                onClick={() => setShowMyBlends(p => !p)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-800 transition"
                              >
                                <span>{(showMyBlends || q) ? '▲' : '▼'}</span>
                                My Saved Custom Blends ({companyBlends.length})
                              </button>
                              {(showMyBlends || q) && (
                                <div className="grid grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto pr-0.5">
                                  {myBlends.map(b => (
                                    <div key={b.id} className="relative group">
                                      <button
                                        onClick={() => {
                                          setSelectedLibColor({ id: `cb-${b.id}`, name: b.name, _recipe: b.recipe });
                                          setBlendName(b.name);
                                        }}
                                        className={`w-full rounded-xl border-2 overflow-hidden transition text-left ${selectedLibColor?.id === `cb-${b.id}` ? 'border-green-500 shadow-md' : 'border-transparent hover:border-gray-300'}`}
                                      >
                                        <div className="w-full h-20 overflow-hidden">
                                          <ChipBlendPreview recipe={b.recipe} mini className="w-full" />
                                        </div>
                                        <div className="px-1.5 py-1 bg-white">
                                          <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{b.name}</p>
                                        </div>
                                      </button>
                                      <button
                                        onClick={() => removeFromMyBlends(b.id)}
                                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/80 text-gray-300 hover:text-red-400 text-xs leading-none opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                                        title="Remove"
                                      >×</button>
                                    </div>
                                  ))}
                                  {myBlends.length === 0 && q && (
                                    <p className="text-xs text-gray-400 col-span-3 text-center py-2">No saved blends match this search.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Always-visible blend preview */}
                          <div className="space-y-3 pt-1">
                            <ChipBlendPreview
                              recipe={libRecipe}
                              showLabels={libRecipe.length > 0}
                              className="w-full"
                              placeholder="Select a blend for preview"
                            />
                            {selectedLibColor && libRecipe.length === 0 && (
                              <p className="text-xs text-gray-400 text-center">Loading blend…</p>
                            )}
                            {selectedLibColor && libRecipe.length > 0 && (
                              <div className="flex gap-2">
                                <button
                                  onClick={openSaveModal}
                                  className="flex-1 py-2 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                                >
                                  Save to Short List
                                </button>
                                <button
                                  onClick={customizeLibBlend}
                                  className="flex-1 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                                >
                                  Customize →
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* ── CUSTOM BLEND TAB ── */}
                {blendTab === 'custom' && (
                  <div className="space-y-3">
                    {/* Editing banner */}
                    {isEditing && (
                      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                        <span className="text-xs font-semibold text-blue-700">Editing: {sessionBlends.find(b => b.id === editingId)?.name}</span>
                        <button onClick={() => resetBuilder('shortlist')} className="text-xs text-blue-400 hover:text-blue-600">Cancel</button>
                      </div>
                    )}
                    <CustomBlendBuilder primitives={primitives} items={customItems} setItems={setCustomItems} />
                    <ChipBlendPreview recipe={customItems} showLabels className="w-full" />
                    <div className="flex gap-2">
                      <button
                        onClick={openSaveModal}
                        disabled={!customItems.length}
                        className="flex-1 py-2 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-40"
                      >
                        Save to Short List
                      </button>
                      <button
                        onClick={saveToMyBlends}
                        disabled={!customItems.length}
                        className="flex-1 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-40"
                      >
                        Save to My Blends
                      </button>
                    </div>
                  </div>
                )}

                {/* ── SHORTLIST TAB ── */}
                {blendTab === 'shortlist' && (
                  <div className="space-y-3">
                    {sessionBlends.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">No blends saved yet. Pick a standard color or build a custom blend.</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{sessionBlends.length} Blend{sessionBlends.length !== 1 ? 's' : ''}</p>
                          <button
                            onClick={() => setView('photo')}
                            disabled={selectedBlendIds.size === 0}
                            className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-600 transition disabled:opacity-40"
                          >
                            Apply to Photo ({selectedBlendIds.size}) →
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                          {sessionBlends.map(blend => {
                            const ss      = swatchState[blend.id] || {};
                            const checked = selectedBlendIds.has(blend.id);
                            return (
                              <div key={blend.id} className={`rounded-xl border-2 overflow-hidden transition ${checked ? 'border-blue-400' : 'border-gray-200'} bg-gray-50`}>
                                {/* Chip preview — single tap: open preview, double tap: toggle selection */}
                                <div className="relative cursor-pointer" onClick={() => handleTileClick(blend)}>
                                  <ChipBlendPreview recipe={blend.recipe} className="w-full" />
                                  {checked && (
                                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-blue-500 border-2 border-blue-500 flex items-center justify-center pointer-events-none">
                                      <span className="text-white text-xs font-bold leading-none">✓</span>
                                    </div>
                                  )}
                                  <div className="absolute bottom-1 left-0 right-0 flex justify-center pointer-events-none">
                                    <span className="text-white/60 text-[9px] bg-black/20 rounded px-1">tap · ·tap to select</span>
                                  </div>
                                </div>
                                <div className="px-2 py-2 space-y-1.5">
                                  <p className="text-xs font-bold text-gray-800 truncate">{blend.name}</p>
                                  <p className="text-xs text-gray-400 leading-tight">{ss.saved ? '✓ Saved to Drive' : ss.saving ? 'Saving…' : ''}</p>
                                  <div className="flex gap-1">
                                    <button onClick={() => editBlend(blend)} className="flex-1 py-1 text-xs font-semibold bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-100 transition">Edit</button>
                                    <button onClick={() => removeBlend(blend.id)} className="px-2 py-1 text-xs text-gray-300 hover:text-red-400 border border-gray-200 rounded bg-white transition">✕</button>
                                  </div>
                                  {canEdit && leadEmail && (
                                    <button
                                      onClick={() => !ss.emailed && !ss.emailing && setEmailSwatchModal({ blend, email: leadEmail })}
                                      disabled={ss.emailing || ss.emailed}
                                      className="w-full py-1 text-xs font-semibold bg-white border border-gray-200 text-gray-500 rounded hover:bg-gray-100 transition disabled:opacity-50"
                                    >
                                      {ss.emailed ? '✓ Emailed' : ss.emailing ? '…' : 'Email Swatch'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── MOCKUPS TAB ── */}
                {blendTab === 'mockups' && (
                  <div className="space-y-3">
                    {mockups.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">No floor previews yet. Apply blends to a photo to create visualizations.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                        {mockups.map(m => {
                          const mas = actionState[m.id] || {};
                          return (
                            <div key={m.id} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                              <img
                                src={m.generated_image_url}
                                alt={m.blend_name || 'Preview'}
                                className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition"
                                onClick={() => setFullscreenImage(m.generated_image_url)}
                              />
                              <div className="px-2 py-1.5 space-y-1.5">
                                <p className="text-xs font-bold text-gray-800 truncate">{m.blend_name || 'Floor Preview'}</p>
                                <p className="text-xs text-gray-400">{m.completed_at ? new Date(m.completed_at).toLocaleDateString() : ''}</p>
                                <button
                                  onClick={() => !mas.emailed && !mas.emailing && setEmailVizModal({ blendId: null, vizId: m.id, email: leadEmail || '' })}
                                  disabled={mas.emailing || mas.emailed}
                                  className="w-full py-1 text-xs font-semibold bg-white border border-gray-200 text-gray-500 rounded hover:bg-gray-100 transition disabled:opacity-50"
                                >
                                  {mas.emailed ? '✓ Emailed' : mas.emailing ? '…' : 'Email Customer'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {error && <p className="text-xs text-red-500">{error}</p>}
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
                    : <><p className="text-sm font-semibold text-gray-500">Tap to select photo</p><p className="text-xs text-gray-400 mt-1">JPG or PNG • Up to 20MB</p></>}
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
                                <button
                                  onClick={() => !as.emailed && !as.emailing && setEmailVizModal({ blendId: blend.id, vizId: r.vizId, email: leadEmail })}
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
            <h3 className="text-sm font-bold text-gray-900">
              {saveModal.mode === 'edit' ? 'Save Changes' : saveModal.mode === 'myblend' ? 'Save to My Blends' : 'Name Your Blend'}
            </h3>
            <input
              type="text"
              value={saveModal.proposedName}
              onChange={e => setSaveModal(m => ({ ...m, proposedName: e.target.value }))}
              placeholder="Blend name"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {saveModal.mode === 'myblend' && (
              <p className="text-xs text-gray-400">This blend will appear in your library across all leads.</p>
            )}
            <div className="space-y-2">
              {saveModal.mode === 'edit' ? (
                <>
                  <button
                    onClick={() => commitSave(false)}
                    className="w-full py-2.5 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition"
                  >
                    Save Changes to "{sessionBlends.find(b => b.id === editingId)?.name}"
                  </button>
                  <button
                    onClick={() => commitSave(true)}
                    className="w-full py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
                  >
                    Save as New Blend
                  </button>
                </>
              ) : saveModal.mode === 'myblend' ? (
                <button
                  onClick={() => commitSaveToMyBlends(saveModal.proposedName.trim() || `My Blend ${companyBlends.length + 1}`)}
                  className="w-full py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition"
                >
                  Save to My Blends
                </button>
              ) : (
                <button
                  onClick={() => commitSave(true)}
                  className="w-full py-2.5 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition"
                >
                  Add to Short List
                </button>
              )}
              <button onClick={() => setSaveModal(null)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL VIZ CONFIRMATION MODAL ─────────────────────────────────── */}
      {emailVizModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4" onClick={() => setEmailVizModal(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900">Send Floor Preview</h3>
            <p className="text-xs text-gray-500">Confirm or edit the customer's email address.</p>
            <input
              type="email"
              value={emailVizModal.email}
              onChange={e => setEmailVizModal(m => ({ ...m, email: e.target.value }))}
              autoFocus
              placeholder="customer@email.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex gap-2">
              <button onClick={() => setEmailVizModal(null)} className="flex-1 py-2 text-sm font-semibold bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition">Cancel</button>
              <button
                onClick={() => emailViz(emailVizModal.blendId, emailVizModal.vizId, emailVizModal.email)}
                disabled={!emailVizModal.email.trim()}
                className="flex-1 py-2 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition disabled:opacity-40"
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL SWATCH CONFIRMATION MODAL ──────────────────────────────── */}
      {emailSwatchModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4" onClick={() => setEmailSwatchModal(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900">Email Blend Swatch</h3>
            <p className="text-xs text-gray-500">Confirm or edit the customer's email address.</p>
            <input
              type="email"
              value={emailSwatchModal.email}
              onChange={e => setEmailSwatchModal(m => ({ ...m, email: e.target.value }))}
              autoFocus
              placeholder="customer@email.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex gap-2">
              <button onClick={() => setEmailSwatchModal(null)} className="flex-1 py-2 text-sm font-semibold bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition">Cancel</button>
              <button
                onClick={() => emailSwatch(emailSwatchModal.blend, emailSwatchModal.email)}
                disabled={!emailSwatchModal.email.trim()}
                className="flex-1 py-2 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition disabled:opacity-40"
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BLEND PREVIEW MODAL (shortlist single-click) ─────────────────── */}
      {previewBlend && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center px-4" onClick={() => setPreviewBlend(null)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">{previewBlend.name}</h3>
              <button onClick={() => setPreviewBlend(null)} className="text-gray-300 hover:text-gray-500 text-xl font-light leading-none">×</button>
            </div>
            <ChipBlendPreview recipe={previewBlend.recipe} showLabels className="w-full" />
            <button
              onClick={() => { toggleBlendSelect(previewBlend.id); setPreviewBlend(null); }}
              className={`w-full mt-3 py-2 text-xs font-semibold rounded-xl transition ${selectedBlendIds.has(previewBlend.id) ? 'bg-blue-50 text-blue-600 border border-blue-300' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
            >
              {selectedBlendIds.has(previewBlend.id) ? '✓ Selected for Photo — Tap to Deselect' : 'Select for Photo'}
            </button>
          </div>
        </div>
      )}

      {/* ── FULLSCREEN MOCKUP IMAGE ─────────────────────────────────────── */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="Mockup" className="max-w-full max-h-full rounded-xl object-contain" />
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-lg font-light hover:bg-white/40 transition"
          >×</button>
        </div>
      )}

      {/* ── DRIVE SAVE MODAL ─────────────────────────────────────────────── */}
      {driveModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Save to Drive</h3>
            <p className="text-xs text-gray-500">Give this session a name — a folder will be created containing the Before photo and each saved blend variation.</p>
            <input
              type="text"
              value={driveModalName}
              onChange={e => setDriveModalName(e.target.value)}
              placeholder={driveModal.blendName || 'Session name'}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmDriveSave()}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {savedBeforeNames.has((driveModalName.trim() || driveModal.blendName || 'Session')) && (
              <p className="text-xs text-blue-500">Before image already saved for this session — only the After will be added.</p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDriveModal(null)} className="flex-1 py-2 text-sm font-semibold bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition">Cancel</button>
              <button onClick={confirmDriveSave} className="flex-1 py-2 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition">Save</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
