// ============================================================================
// File: src/company/BidderAdminSettings.jsx
// Company-level Bidder admin: item library + payment/T&C/notes settings
// ============================================================================

import React, { useEffect, useState } from 'react';
import { BidderAPI, CompaniesAPI } from '../api';


export default function BidderAdminSettings({ companyId }) {
  // ── Library state ──────────────────────────────────────────────────────────
  const [library, setLibrary] = useState([]);         // [{id, name, items:[...]}, ...]
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState({});

  // New category form
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  // Inline editing: category name
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');

  // Inline editing: library item
  const [editItemId, setEditItemId] = useState(null);
  const [editItemForm, setEditItemForm] = useState({});

  // New item form per category
  const [newItemCatId, setNewItemCatId] = useState(null);
  const [newItemForm, setNewItemForm] = useState({});

  // New system form per category
  const [newSystemCatId, setNewSystemCatId] = useState(null);
  const [newSystemForm, setNewSystemForm] = useState({});
  // Edit system component IDs (used when editing a system item)
  const [editSystemComponentIds, setEditSystemComponentIds] = useState([]);

  // CSV import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // { created, skipped, errors }

  // ── Settings state ─────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsForm, setSettingsForm] = useState({});
  const [designs, setDesigns] = useState([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // ── Feature enable ─────────────────────────────────────────────────────────
  const [bidderEnabled, setBidderEnabled]   = useState(false);
  const [enablingBidder, setEnablingBidder] = useState(false);
  const [enableMsg, setEnableMsg]           = useState('');

  // ── Active section ─────────────────────────────────────────────────────────
  const [section, setSection] = useState('library');

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadLibrary();
    loadSettings();
    loadDesigns();
    loadWarranties();
    if (companyId) {
      CompaniesAPI.get(companyId).then(res => {
        const c = res?.company;
        if (c) setBidderEnabled(c.bidderEnabled ?? c.bidder_enabled ?? false);
      }).catch(() => {});
    }
  }, [companyId]);

  async function loadLibrary() {
    setLibraryLoading(true);
    try {
      const data = await BidderAPI.getLibrary(companyId);
      setLibrary(data);
    } catch (e) {
      console.error('Failed to load library', e);
    } finally {
      setLibraryLoading(false);
    }
  }

  async function loadSettings() {
    setSettingsLoading(true);
    try {
      const data = await BidderAPI.getCompanySettings(companyId);
      setSettings(data);
      setSettingsForm({
        payment_processor: data.payment_processor || 'stripe',
        stripe_publishable_key: data.stripe_publishable_key || '',
        stripe_secret_key: '',
        stripe_secret_key_saved: data.stripe_secret_key_saved || false,
        paypal_client_id: data.paypal_client_id || '',
        paypal_secret_key: '',
        paypal_secret_key_saved: data.paypal_secret_key_saved || false,
        convenience_fee_percent: data.convenience_fee_percent ?? 0,
        include_payment_button: data.include_payment_button ?? true,
        down_payment_default_percent: data.down_payment_default_percent ?? 50,
        preferred_proposal_design_id: data.preferred_proposal_design_id || '',
        system_notes: data.system_notes || '',
        default_warranty: data.default_warranty || '',
        terms_and_conditions: data.terms_and_conditions || '',
        email_from_name: data.email_from_name || '',
        email_from_email: data.email_from_email || '',
        notification_emails: data.notification_emails || '',
        proposal_top_text: data.proposal_top_text || '',
        invoice_top_text: data.invoice_top_text || '',
        proposal_domain: data.proposal_domain || '',
        logo_url: data.logo_url || '',
        primary_color: data.primary_color || '',
        accent_color: data.accent_color || '',
      });
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function loadDesigns() {
    try {
      const data = await BidderAPI.getProposalDesigns();
      setDesigns(data);
    } catch (e) {
      // non-critical
    }
  }

  async function loadWarranties() {
    setWarrantiesLoading(true);
    try {
      const data = await BidderAPI.getWarranties(companyId);
      setWarranties(data);
    } catch (e) {
      console.error('Failed to load warranties', e);
    } finally {
      setWarrantiesLoading(false);
    }
  }

  // ── Bidder enable toggle ───────────────────────────────────────────────────
  async function handleToggleBidder(checked) {
    setBidderEnabled(checked);
    setEnablingBidder(true);
    setEnableMsg('');
    try {
      await CompaniesAPI.update(companyId, { bidder_enabled: checked });
      setEnableMsg(checked ? 'Bidder enabled' : 'Bidder disabled');
      setTimeout(() => setEnableMsg(''), 3000);
    } catch (e) {
      setBidderEnabled(!checked); // revert
      setEnableMsg('Failed to save');
    } finally {
      setEnablingBidder(false);
    }
  }

  // ── Category actions ───────────────────────────────────────────────────────
  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      await BidderAPI.createCategory({ name: newCatName.trim(), sort_order: library.length }, companyId);
      setNewCatName('');
      await loadLibrary();
    } catch (e) {
      alert('Failed to add category');
    } finally {
      setAddingCat(false);
    }
  }

  async function handleSaveCatName(catId) {
    if (!editCatName.trim()) return;
    try {
      const cat = library.find((c) => c.id === catId);
      await BidderAPI.updateCategory(catId, { name: editCatName.trim(), sort_order: cat.sort_order, is_active: cat.is_active }, companyId);
      setEditCatId(null);
      await loadLibrary();
    } catch (e) {
      alert('Failed to rename category');
    }
  }

  async function handleDeleteCategory(catId) {
    if (!window.confirm('Delete this category and all its items?')) return;
    try {
      await BidderAPI.deleteCategory(catId, companyId);
      await loadLibrary();
    } catch (e) {
      alert('Failed to delete category');
    }
  }

  async function handleReorderCategory(catId, direction) {
    const idx = library.findIndex((c) => c.id === catId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= library.length) return;
    const cat = library[idx];
    const swap = library[swapIdx];
    try {
      await Promise.all([
        BidderAPI.updateCategory(cat.id, { name: cat.name, sort_order: swap.sort_order, is_active: cat.is_active }, companyId),
        BidderAPI.updateCategory(swap.id, { name: swap.name, sort_order: cat.sort_order, is_active: swap.is_active }, companyId),
      ]);
      await loadLibrary();
    } catch (e) {
      alert('Failed to reorder categories');
    }
  }

  // ── Library item actions ───────────────────────────────────────────────────
  async function handleReorderItem(catId, itemId, direction) {
    const cat = library.find((c) => c.id === catId);
    if (!cat) return;
    const items = cat.items || [];
    const idx = items.findIndex((i) => i.id === itemId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const item = items[idx];
    const swap = items[swapIdx];
    try {
      await Promise.all([
        BidderAPI.updateLibraryItem(item.id, { ...item, sort_order: swap.sort_order }, companyId),
        BidderAPI.updateLibraryItem(swap.id, { ...swap, sort_order: item.sort_order }, companyId),
      ]);
      await loadLibrary();
    } catch (e) {
      alert('Failed to reorder items');
    }
  }

  function startAddItem(catId) {
    setNewSystemCatId(null);
    setNewItemCatId(catId);
    setNewItemForm({ name: '', default_unit_price: '', default_unit_label: 'per sqft', description: '', is_included: false, show_quantity: false, supplier: '', kit_price: '', sqft_per_kit: '', is_charge_only: false });
  }

  function startAddSystem(catId) {
    setNewItemCatId(null);
    setNewSystemCatId(catId);
    setNewSystemForm({ name: '', description: '', default_unit_price: '', default_unit_label: '', componentIds: [] });
  }

  async function handleAddSystem(catId) {
    if (!newSystemForm.name?.trim()) return;
    try {
      await BidderAPI.createLibraryItem({
        category_id: catId,
        name: newSystemForm.name.trim(),
        description: newSystemForm.description || null,
        default_unit_price: parseFloat(newSystemForm.default_unit_price) || 0,
        default_unit_label: newSystemForm.default_unit_label || null,
        is_system: true,
        component_ids: newSystemForm.componentIds,
        sort_order: library.find((c) => c.id === catId)?.items?.length || 0,
      }, companyId);
      setNewSystemCatId(null);
      await loadLibrary();
    } catch (e) {
      alert('Failed to add system');
    }
  }

  function toggleSystemComponent(ids, setIds, itemId) {
    setIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }

  async function handleAddItem(catId) {
    if (!newItemForm.name?.trim()) return;
    try {
      await BidderAPI.createLibraryItem({
        category_id: catId,
        name: newItemForm.name.trim(),
        description: newItemForm.description || null,
        default_unit_price: parseFloat(newItemForm.default_unit_price) || 0,
        default_unit_label: newItemForm.default_unit_label || null,
        is_included: newItemForm.is_included || false,
        show_quantity: newItemForm.show_quantity || false,
        sort_order: library.find((c) => c.id === catId)?.items?.length || 0,
        is_charge_only: newItemForm.is_charge_only || false,
        supplier: newItemForm.is_charge_only ? null : (newItemForm.supplier || null),
        kit_price: newItemForm.is_charge_only ? null : (newItemForm.kit_price !== '' ? parseFloat(newItemForm.kit_price) : null),
        sqft_per_kit: newItemForm.is_charge_only ? null : (newItemForm.sqft_per_kit !== '' ? parseFloat(newItemForm.sqft_per_kit) : null),
      }, companyId);
      setNewItemCatId(null);
      await loadLibrary();
    } catch (e) {
      alert('Failed to add item');
    }
  }

  function startEditItem(item) {
    setEditItemId(item.id);
    setEditItemForm({
      name: item.name,
      description: item.description || '',
      default_unit_price: item.default_unit_price,
      default_unit_label: item.default_unit_label || '',
      is_included: item.is_included,
      show_quantity: item.show_quantity,
      is_active: item.is_active,
      category_id: item.category_id,
      sort_order: item.sort_order,
      supplier: item.supplier || '',
      kit_price: item.kit_price != null ? item.kit_price : '',
      sqft_per_kit: item.sqft_per_kit != null ? item.sqft_per_kit : '',
      is_system: item.is_system || false,
      is_charge_only: item.is_charge_only || false,
    });
    setEditSystemComponentIds((item.components || []).map((c) => c.component_item_id));
  }

  async function handleSaveItem(itemId) {
    try {
      await BidderAPI.updateLibraryItem(itemId, {
        ...editItemForm,
        default_unit_price: parseFloat(editItemForm.default_unit_price) || 0,
        supplier: editItemForm.is_charge_only ? null : (editItemForm.supplier || null),
        kit_price: editItemForm.is_charge_only ? null : (editItemForm.kit_price !== '' ? parseFloat(editItemForm.kit_price) : null),
        sqft_per_kit: editItemForm.is_charge_only ? null : (editItemForm.sqft_per_kit !== '' ? parseFloat(editItemForm.sqft_per_kit) : null),
        is_charge_only: editItemForm.is_charge_only || false,
        component_ids: editItemForm.is_system ? editSystemComponentIds : undefined,
      }, companyId);
      setEditItemId(null);
      await loadLibrary();
    } catch (e) {
      alert('Failed to save item');
    }
  }

  async function handleDeleteItem(itemId) {
    if (!window.confirm('Delete this item?')) return;
    try {
      await BidderAPI.deleteLibraryItem(itemId, companyId);
      await loadLibrary();
    } catch (e) {
      alert('Failed to delete item');
    }
  }

  // ── Warranty library state ─────────────────────────────────────────────────
  const [warranties,        setWarranties]        = useState([]);
  const [warrantiesLoading, setWarrantiesLoading] = useState(true);
  const [warrantyModal,     setWarrantyModal]     = useState(null); // null | { mode:'add'|'edit', data:{} }
  const [warrantySaving,    setWarrantySaving]    = useState(false);
  const [warrantyMsg,       setWarrantyMsg]       = useState('');
  const [pdfUploading,      setPdfUploading]      = useState(false);

  // ── Logo upload ────────────────────────────────────────────────────────────
  const [logoUploading, setLogoUploading] = useState(false);

  // ── Warranty CRUD ──────────────────────────────────────────────────────────
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  async function handleWarrantyPdfChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Please upload a PDF file.'); return; }
    setPdfUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setWarrantyModal(prev => ({ ...prev, data: { ...prev.data, warranty_pdf_url: dataUrl } }));
    } finally {
      setPdfUploading(false);
      e.target.value = '';
    }
  }

  async function handleSaveWarranty() {
    const { mode, data } = warrantyModal;
    if (!data.internal_name?.trim()) { setWarrantyMsg('Internal name is required'); return; }
    if (!data.warranty_title?.trim()) { setWarrantyMsg('Warranty title is required'); return; }
    if (mode === 'add' && !data.warranty_pdf_url) { setWarrantyMsg('PDF upload is required'); return; }
    setWarrantySaving(true);
    setWarrantyMsg('');
    try {
      if (mode === 'add') {
        await BidderAPI.createWarranty({
          internal_name:    data.internal_name.trim(),
          warranty_title:   data.warranty_title.trim(),
          warranty_pdf_url: data.warranty_pdf_url,
          is_default:       data.is_default || false,
        }, companyId);
      } else {
        await BidderAPI.updateWarranty(data.id, {
          internal_name:    data.internal_name.trim(),
          warranty_title:   data.warranty_title.trim(),
          warranty_pdf_url: data.warranty_pdf_url || null,
          is_default:       data.is_default || false,
        }, companyId);
      }
      setWarrantyModal(null);
      await loadWarranties();
    } catch (e) {
      setWarrantyMsg(e.message || 'Failed to save warranty');
    } finally {
      setWarrantySaving(false);
    }
  }

  async function handleDeleteWarranty(id) {
    if (!window.confirm('Delete this warranty?')) return;
    try {
      await BidderAPI.deleteWarranty(id, companyId);
      await loadWarranties();
    } catch (e) {
      alert('Failed to delete warranty');
    }
  }

  async function handleLogoFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('logo', file);
      const qs = companyId ? `?company_id=${companyId}` : '';
      const res = await fetch(`${import.meta.env.APP_URL || import.meta.env.VITE_API_URL}/api/bidder/upload-logo${qs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setSettingsForm(p => ({ ...p, logo_url: url }));
    } catch (err) {
      alert('Logo upload failed. Please try again or paste a URL manually.');
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  }

  // ── Design (colors) save ───────────────────────────────────────────────────
  async function handleSaveDesign() {
    setSettingsSaving(true);
    setSettingsMsg('');
    try {
      const result = await BidderAPI.saveCompanyColors({
        preferred_proposal_design_id: settingsForm.preferred_proposal_design_id || null,
        primary_color: settingsForm.primary_color || null,
        accent_color:  settingsForm.accent_color  || null,
      }, companyId);
      setSettingsForm((p) => ({
        ...p,
        preferred_proposal_design_id: result.preferred_proposal_design_id
          ? String(result.preferred_proposal_design_id) : '',
        primary_color: result.primary_color || '',
        accent_color:  result.accent_color  || '',
      }));
      setSettingsMsg('Saved');
      setTimeout(() => setSettingsMsg(''), 3000);
    } catch (e) {
      setSettingsMsg('Failed to save');
    } finally {
      setSettingsSaving(false);
    }
  }

  // ── Settings save ──────────────────────────────────────────────────────────
  async function handleSaveSettings() {
    setSettingsSaving(true);
    setSettingsMsg('');

    // Validate: notification_emails must not contain the From Email
    const fromEmail = (settingsForm.email_from_email || '').trim().toLowerCase();
    const notifyList = (settingsForm.notification_emails || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (fromEmail && notifyList.includes(fromEmail)) {
      alert(
        `Duplicate email detected.\n\n"${settingsForm.email_from_email.trim()}" is already set as your From Email and cannot also be a notification recipient.\n\nRemove it from the Notification Emails field and save again.`
      );
      setSettingsSaving(false);
      return;
    }

    try {
      const payload = {
        ...settingsForm,
        down_payment_default_percent: parseFloat(settingsForm.down_payment_default_percent) || 50,
        convenience_fee_percent: parseFloat(settingsForm.convenience_fee_percent) || 0,
        preferred_proposal_design_id: settingsForm.preferred_proposal_design_id || null,
        proposal_domain: settingsForm.proposal_domain.trim() || null,
        primary_color: settingsForm.primary_color || null,
        accent_color: settingsForm.accent_color || null,
      };
      // Don't overwrite saved secret keys if the fields were left blank
      if (!payload.stripe_secret_key) delete payload.stripe_secret_key;
      delete payload.stripe_secret_key_saved;
      if (!payload.paypal_secret_key) delete payload.paypal_secret_key;
      delete payload.paypal_secret_key_saved;
      await BidderAPI.updateCompanySettings(payload, companyId);
      setSettingsMsg('Saved');
      setTimeout(() => setSettingsMsg(''), 3000);
    } catch (e) {
      setSettingsMsg('Failed to save');
    } finally {
      setSettingsSaving(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const tabBtn = (active) =>
    `px-4 py-2 rounded-lg font-semibold text-sm transition ${
      active ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50'
    }`;

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase mb-1';

  // ── Render: Library ────────────────────────────────────────────────────────
  // ── CSV import / template ──────────────────────────────────────────────────
  function downloadTemplate() {
    const headers = 'category,name,description,default_unit_price,default_unit_label,supplier,kit_price,sqft_per_kit,is_charge_only';
    const example = 'Coating Systems,PA 552 Polyaspartic,Polyaspartic topcoat,1.25,per sqft,Sherwin-Williams,45.00,400,no\n' +
                    'Prep Work,Coat Wooden Steps,Charge for coating wooden steps,50.00,per step,,,, yes';
    const blob = new Blob([headers + '\n' + example], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'item_library_template.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleImportCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setImportResult(null);
    try {
      const token = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('csv', file);
      const qs = companyId ? `?company_id=${companyId}` : '';
      const res = await fetch(
        `${import.meta.env.APP_URL || import.meta.env.VITE_API_URL}/api/bidder/library/import${qs}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResult(data);
      await loadLibrary();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  }

  const renderLibrary = () => {
    if (libraryLoading) return <p className="text-sm text-gray-500">Loading library…</p>;

    return (
      <div className="space-y-4">

        {/* Import / Template bar */}
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-auto">Bulk Import</span>
          <button
            onClick={downloadTemplate}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Download Template CSV
          </button>
          <label className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition ${importing ? 'bg-gray-200 text-gray-400 pointer-events-none' : 'bg-green-600 text-white hover:bg-green-700'}`}>
            {importing ? 'Importing…' : 'Upload CSV'}
            <input type="file" accept=".csv,text/csv" onChange={handleImportCSV} className="sr-only" />
          </label>
        </div>

        {/* Import result */}
        {importResult && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${importResult.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-800'}`}>
            {importResult.error ? (
              <p>{importResult.error}</p>
            ) : (
              <>
                <p className="font-semibold">{importResult.created} item{importResult.created !== 1 ? 's' : ''} imported{importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ''}.</p>
                {importResult.errors?.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </>
            )}
            <button onClick={() => setImportResult(null)} className="mt-1 text-xs underline opacity-60 hover:opacity-100">Dismiss</button>
          </div>
        )}

        {library.map((cat) => (
          <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
              {editCatId === cat.id ? (
                <>
                  <input
                    className="flex-1 px-2 py-1 border rounded text-sm"
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCatName(cat.id)}
                    autoFocus
                  />
                  <button onClick={() => handleSaveCatName(cat.id)} className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg">Save</button>
                  <button onClick={() => setEditCatId(null)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-lg">Cancel</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setExpandedCats((p) => ({ ...p, [cat.id]: !p[cat.id] }))}
                    className="flex-1 text-left font-semibold text-gray-800 text-sm flex items-center gap-2"
                  >
                    <span className={`transition-transform ${expandedCats[cat.id] ? 'rotate-90' : ''}`}>▶</span>
                    {cat.name}
                    <span className="text-gray-400 font-normal text-xs">({cat.items?.length || 0} items)</span>
                  </button>
                  <button
                    onClick={() => handleReorderCategory(cat.id, 'up')}
                    disabled={library.indexOf(cat) === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 text-sm leading-none"
                    title="Move up"
                  >▲</button>
                  <button
                    onClick={() => handleReorderCategory(cat.id, 'down')}
                    disabled={library.indexOf(cat) === library.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 px-1 text-sm leading-none"
                    title="Move down"
                  >▼</button>
                  <button
                    onClick={() => { setEditCatId(cat.id); setEditCatName(cat.name); }}
                    className="text-xs text-blue-600 hover:underline px-2"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="text-xs text-red-500 hover:underline px-2"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>

            {/* Items */}
            {expandedCats[cat.id] && (
              <div className="divide-y divide-gray-100">
                {(cat.items || []).map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    {editItemId === item.id ? (
                      /* Edit row */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Name *</label>
                            <input className={inputCls} value={editItemForm.name} onChange={(e) => setEditItemForm((p) => ({ ...p, name: e.target.value }))} />
                          </div>
                          <div>
                            <label className={labelCls}>Default Price</label>
                            <input className={inputCls} type="number" step="0.01" value={editItemForm.default_unit_price} onChange={(e) => setEditItemForm((p) => ({ ...p, default_unit_price: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Unit Label</label>
                          <input className={inputCls} value={editItemForm.default_unit_label} onChange={(e) => setEditItemForm((p) => ({ ...p, default_unit_label: e.target.value }))} placeholder="per sqft" />
                        </div>
                        <div>
                          <label className={labelCls}>Description</label>
                          <input className={inputCls} value={editItemForm.description} onChange={(e) => setEditItemForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional default description" />
                        </div>
                        {!editItemForm.is_system && (
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editItemForm.is_charge_only || false}
                              onChange={(e) => setEditItemForm((p) => ({ ...p, is_charge_only: e.target.checked }))}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700 font-medium">Charge Only <span className="text-gray-400 font-normal">(service/labor — no material cost)</span></span>
                          </label>
                        )}
                        {editItemForm.is_system ? (
                          <div>
                            <label className={labelCls}>Components <span className="text-gray-400 font-normal normal-case">(check all items that make up this system)</span></label>
                            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                              {library.flatMap((c) => c.items.filter((i) => !i.is_system && !i.is_charge_only && i.id !== item.id).map((i) => ({ ...i, catName: c.name }))).map((i) => (
                                <label key={i.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                                  <input
                                    type="checkbox"
                                    checked={editSystemComponentIds.includes(i.id)}
                                    onChange={() => setEditSystemComponentIds((prev) => prev.includes(i.id) ? prev.filter((x) => x !== i.id) : [...prev, i.id])}
                                    className="w-4 h-4 flex-shrink-0"
                                  />
                                  <span className="text-xs text-gray-500 w-24 flex-shrink-0">{i.catName}</span>
                                  <span className="text-sm text-gray-800">{i.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : !editItemForm.is_charge_only && (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className={labelCls}>Supplier</label>
                              <input className={inputCls} value={editItemForm.supplier} onChange={(e) => setEditItemForm((p) => ({ ...p, supplier: e.target.value }))} placeholder="e.g. Sherwin-Williams" />
                            </div>
                            <div>
                              <label className={labelCls}>Kit Price ($)</label>
                              <input className={inputCls} type="number" step="0.01" min="0" value={editItemForm.kit_price} onChange={(e) => setEditItemForm((p) => ({ ...p, kit_price: e.target.value }))} placeholder="0.00" />
                            </div>
                            <div>
                              <label className={labelCls}>SF per Kit</label>
                              <input className={inputCls} type="number" step="0.01" min="0" value={editItemForm.sqft_per_kit} onChange={(e) => setEditItemForm((p) => ({ ...p, sqft_per_kit: e.target.value }))} placeholder="0" />
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveItem(item.id)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Save</button>
                          <button onClick={() => setEditItemId(null)} className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      /* View row */
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-0.5 flex-shrink-0 pt-0.5">
                          <button
                            onClick={() => handleReorderItem(cat.id, item.id, 'up')}
                            disabled={(cat.items || []).indexOf(item) === 0}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs"
                            title="Move up"
                          >▲</button>
                          <button
                            onClick={() => handleReorderItem(cat.id, item.id, 'down')}
                            disabled={(cat.items || []).indexOf(item) === (cat.items || []).length - 1}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-xs"
                            title="Move down"
                          >▼</button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-gray-800">{item.name}</span>
                            {item.is_system && (
                              <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">System</span>
                            )}
                            {item.is_charge_only && (
                              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Charge Only</span>
                            )}
                            {!item.is_active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>}
                          </div>
                          {item.is_system ? (
                            <ul className="mt-1 space-y-0.5">
                              {(item.components || []).map((c) => (
                                <li key={c.component_item_id} className="text-xs text-gray-500 flex items-center gap-1">
                                  <span className="text-gray-300">↳</span> {c.name}
                                </li>
                              ))}
                              {(item.components || []).length === 0 && (
                                <li className="text-xs text-gray-400 italic">No components selected</li>
                              )}
                            </ul>
                          ) : (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              {item.description && <span className="text-xs text-gray-500 truncate">{item.description}</span>}
                              {!item.is_charge_only && item.supplier && <span className="text-xs text-gray-400">Supplier: {item.supplier}</span>}
                              {!item.is_charge_only && item.kit_price != null && <span className="text-xs text-gray-400">Kit: ${parseFloat(item.kit_price).toFixed(2)}</span>}
                              {!item.is_charge_only && item.sqft_per_kit != null && <span className="text-xs text-gray-400">{parseFloat(item.sqft_per_kit)} sf/kit</span>}
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                          ${parseFloat(item.default_unit_price || 0).toFixed(2)} {item.default_unit_label || ''}
                        </span>
                        <button onClick={() => startEditItem(item)} className="text-xs text-blue-600 hover:underline px-2">Edit</button>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-red-500 hover:underline px-2">Del</button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add item row */}
                {newItemCatId === cat.id ? (
                  <div className="px-4 py-3 bg-blue-50 space-y-3">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">New Item</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Name *</label>
                        <input className={inputCls} value={newItemForm.name} onChange={(e) => setNewItemForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
                      </div>
                      <div>
                        <label className={labelCls}>Default Price</label>
                        <input className={inputCls} type="number" step="0.01" value={newItemForm.default_unit_price} onChange={(e) => setNewItemForm((p) => ({ ...p, default_unit_price: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Unit Label</label>
                      <input className={inputCls} value={newItemForm.default_unit_label} onChange={(e) => setNewItemForm((p) => ({ ...p, default_unit_label: e.target.value }))} placeholder="per sqft" />
                    </div>
                    <div>
                      <label className={labelCls}>Description</label>
                      <input className={inputCls} value={newItemForm.description} onChange={(e) => setNewItemForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newItemForm.is_charge_only || false}
                        onChange={(e) => setNewItemForm((p) => ({ ...p, is_charge_only: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700 font-medium">Charge Only <span className="text-gray-400 font-normal">(service/labor — no material cost)</span></span>
                    </label>
                    {!newItemForm.is_charge_only && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>Supplier</label>
                          <input className={inputCls} value={newItemForm.supplier} onChange={(e) => setNewItemForm((p) => ({ ...p, supplier: e.target.value }))} placeholder="e.g. Sherwin-Williams" />
                        </div>
                        <div>
                          <label className={labelCls}>Kit Price ($)</label>
                          <input className={inputCls} type="number" step="0.01" min="0" value={newItemForm.kit_price} onChange={(e) => setNewItemForm((p) => ({ ...p, kit_price: e.target.value }))} placeholder="0.00" />
                        </div>
                        <div>
                          <label className={labelCls}>SF per Kit</label>
                          <input className={inputCls} type="number" step="0.01" min="0" value={newItemForm.sqft_per_kit} onChange={(e) => setNewItemForm((p) => ({ ...p, sqft_per_kit: e.target.value }))} placeholder="0" />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => handleAddItem(cat.id)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Add Item</button>
                      <button onClick={() => setNewItemCatId(null)} className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : newSystemCatId === cat.id ? (
                  <div className="px-4 py-3 bg-purple-50 space-y-3">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">New System</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>System Name *</label>
                        <input className={inputCls} value={newSystemForm.name} onChange={(e) => setNewSystemForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. System ABC" autoFocus />
                      </div>
                      <div>
                        <label className={labelCls}>Bid Price</label>
                        <input className={inputCls} type="number" step="0.01" value={newSystemForm.default_unit_price} onChange={(e) => setNewSystemForm((p) => ({ ...p, default_unit_price: e.target.value }))} placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Unit Label</label>
                      <input className={inputCls} value={newSystemForm.default_unit_label} onChange={(e) => setNewSystemForm((p) => ({ ...p, default_unit_label: e.target.value }))} placeholder="per sqft" />
                    </div>
                    <div>
                      <label className={labelCls}>Description (internal)</label>
                      <input className={inputCls} value={newSystemForm.description} onChange={(e) => setNewSystemForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional notes" />
                    </div>
                    <div>
                      <label className={labelCls}>Components <span className="text-gray-400 font-normal normal-case">(select all items that make up this system)</span></label>
                      <div className="border border-purple-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto bg-white">
                        {library.flatMap((c) => c.items.filter((i) => !i.is_system && !i.is_charge_only).map((i) => ({ ...i, catName: c.name }))).map((i) => (
                          <label key={i.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-purple-50">
                            <input
                              type="checkbox"
                              checked={newSystemForm.componentIds.includes(i.id)}
                              onChange={() => setNewSystemForm((p) => ({
                                ...p,
                                componentIds: p.componentIds.includes(i.id)
                                  ? p.componentIds.filter((x) => x !== i.id)
                                  : [...p.componentIds, i.id],
                              }))}
                              className="w-4 h-4 flex-shrink-0"
                            />
                            <span className="text-xs text-gray-400 w-28 flex-shrink-0">{i.catName}</span>
                            <span className="text-sm text-gray-800">{i.name}</span>
                          </label>
                        ))}
                        {library.flatMap((c) => c.items.filter((i) => !i.is_system)).length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-400">No standard items in library yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAddSystem(cat.id)} className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg">Add System</button>
                      <button onClick={() => setNewSystemCatId(null)} className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2 flex gap-4">
                    <button onClick={() => startAddItem(cat.id)} className="text-sm text-blue-600 hover:underline">+ Add Item</button>
                    <button onClick={() => startAddSystem(cat.id)} className="text-sm text-purple-600 hover:underline">+ Add System</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add category */}
        <div className="flex gap-2 pt-2">
          <input
            className={`${inputCls} flex-1`}
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name…"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <button
            onClick={handleAddCategory}
            disabled={addingCat || !newCatName.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {addingCat ? 'Adding…' : '+ Category'}
          </button>
        </div>
      </div>
    );
  };

  // ── Render: Warranties ────────────────────────────────────────────────────
  const renderWarranties = () => {
    if (warrantiesLoading) return <p className="text-sm text-gray-500">Loading warranties…</p>;

    return (
      <div className="space-y-4">
        {warranties.length === 0 ? (
          <div className="flex items-center justify-center h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-sm text-gray-400">No warranties yet — add one below.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {warranties.map(w => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-800">{w.internal_name}</span>
                    {w.is_default && <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Default</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{w.warranty_title}</p>
                </div>
                <button
                  onClick={() => setWarrantyModal({ mode: 'edit', data: { ...w, warranty_pdf_url: null } })}
                  className="text-xs text-blue-600 hover:underline px-2"
                >Edit</button>
                <button
                  onClick={() => handleDeleteWarranty(w.id)}
                  className="text-xs text-red-500 hover:underline px-2"
                >Delete</button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setWarrantyModal({ mode: 'add', data: { internal_name: '', warranty_title: '', warranty_pdf_url: null, is_default: false } })}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg"
        >
          + Add Warranty
        </button>

        {/* Add / Edit Modal */}
        {warrantyModal && (
          <div className="fixed inset-0 z-[1400] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setWarrantyModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
                <h3 className="font-bold text-gray-800">{warrantyModal.mode === 'add' ? 'Add Warranty' : 'Edit Warranty'}</h3>
                <button onClick={() => setWarrantyModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <div className="px-6 py-4 overflow-y-auto space-y-4">

                <div>
                  <label className={labelCls}>Internal Warranty Name *</label>
                  <input
                    className={inputCls}
                    value={warrantyModal.data.internal_name}
                    onChange={e => setWarrantyModal(p => ({ ...p, data: { ...p.data, internal_name: e.target.value } }))}
                    placeholder="e.g. Standard 1-Year Labor Warranty"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">Used internally — not shown to customers.</p>
                </div>

                <div>
                  <label className={labelCls}>Warranty Title *</label>
                  <input
                    className={inputCls}
                    value={warrantyModal.data.warranty_title}
                    onChange={e => setWarrantyModal(p => ({ ...p, data: { ...p.data, warranty_title: e.target.value } }))}
                    placeholder="e.g. 1-Year Workmanship Warranty"
                  />
                  <p className="text-xs text-gray-400 mt-1">Displayed on the proposal under the Warranty section.</p>
                </div>

                <div>
                  <label className={labelCls}>Warranty PDF {warrantyModal.mode === 'add' ? '*' : '(upload new to replace)'}</label>
                  <label className={`flex items-center gap-2 w-full px-4 py-2.5 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer hover:bg-blue-50 transition ${pdfUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-blue-600 font-medium">
                      {pdfUploading ? 'Reading…' : warrantyModal.data.warranty_pdf_url ? 'PDF selected ✓ (click to replace)' : 'Choose PDF file'}
                    </span>
                    <input type="file" accept="application/pdf" onChange={handleWarrantyPdfChange} className="sr-only" />
                  </label>
                  {warrantyModal.mode === 'edit' && !warrantyModal.data.warranty_pdf_url && (
                    <p className="text-xs text-gray-400 mt-1">Leave blank to keep the existing PDF.</p>
                  )}
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={warrantyModal.data.is_default || false}
                    onChange={e => setWarrantyModal(p => ({ ...p, data: { ...p.data, is_default: e.target.checked } }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Set as default warranty for new bids</span>
                </label>

                {warrantyMsg && <p className="text-xs text-red-500">{warrantyMsg}</p>}
              </div>
              <div className="px-6 pb-5 pt-3 border-t shrink-0 flex gap-3">
                <button onClick={() => setWarrantyModal(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl text-sm">Cancel</button>
                <button
                  onClick={handleSaveWarranty}
                  disabled={warrantySaving}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
                >
                  {warrantySaving ? 'Saving…' : 'Save Warranty'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Settings ───────────────────────────────────────────────────────
  const renderDesign = () => {
    if (settingsLoading) return <p className="text-sm text-gray-500">Loading…</p>;

    // Determine effective colors: custom override → selected template → hardcoded fallback
    const selectedTemplate = designs.find(
      (d) => String(d.id) === String(settingsForm.preferred_proposal_design_id)
    );
    const effectivePrimary = settingsForm.primary_color || selectedTemplate?.primary_color || '#1c2333';
    const effectiveAccent  = settingsForm.accent_color  || selectedTemplate?.accent_color  || '#f97316';
    const templatePlaceholderPrimary = selectedTemplate?.primary_color || '#1c2333';
    const templatePlaceholderAccent  = selectedTemplate?.accent_color  || '#f97316';

    return (
      <div className="space-y-6">

        {/* Template selector */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-1 text-sm uppercase tracking-wide">Proposal Template</h3>
          <p className="text-xs text-gray-500 mb-3">Choose the layout style for your proposals and invoices.</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Default option */}
            <label
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${
                !settingsForm.preferred_proposal_design_id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                name="template"
                value=""
                checked={!settingsForm.preferred_proposal_design_id}
                onChange={() => setSettingsForm((p) => ({ ...p, preferred_proposal_design_id: '' }))}
              />
              {/* Mini preview — default (white/blue) */}
              <div className="w-full rounded overflow-hidden border border-gray-200 text-[9px]">
                <div className="bg-blue-700 px-2 py-1 text-white font-bold">Company</div>
                <div className="bg-blue-200 h-1" />
                <div className="bg-white px-2 py-1.5 flex justify-between items-center">
                  <span className="text-gray-500">Customer</span>
                  <span className="bg-blue-700 text-white rounded px-1.5 py-0.5">Sign</span>
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-700">Default</span>
            </label>

            {/* One card per template in DB */}
            {designs.filter(d => d.visibility === 'public').map((d) => (
              <label
                key={d.id}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${
                  String(settingsForm.preferred_proposal_design_id) === String(d.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name="template"
                  value={d.id}
                  checked={String(settingsForm.preferred_proposal_design_id) === String(d.id)}
                  onChange={() => setSettingsForm((p) => ({ ...p, preferred_proposal_design_id: String(d.id) }))}
                />
                {/* Mini preview using template's base colors */}
                <div className="w-full rounded overflow-hidden border border-gray-200 text-[9px]">
                  <div style={{ background: d.primary_color }} className="px-2 py-1 text-white font-bold flex justify-between">
                    <span>Company</span>
                    <span style={{ color: d.accent_color }}>Proposal</span>
                  </div>
                  <div style={{ background: d.accent_color, height: 3 }} />
                  <div className="bg-white px-2 py-1.5 flex justify-between items-center">
                    <span className="text-gray-500">Customer</span>
                    <span style={{ background: d.accent_color }} className="text-white rounded px-1.5 py-0.5">Sign</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-700">{d.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Color overrides */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-1 text-sm uppercase tracking-wide">Custom Colors</h3>
          <p className="text-xs text-gray-500 mb-4">
            Override the template's default colors. Leave blank to use the template's colors.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls}>Header Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={effectivePrimary}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, primary_color: e.target.value }))}
                  className="h-9 w-12 rounded border border-gray-300 cursor-pointer p-0.5 flex-shrink-0"
                />
                <input
                  type="text"
                  value={settingsForm.primary_color || ''}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, primary_color: e.target.value }))}
                  placeholder={templatePlaceholderPrimary}
                  maxLength={7}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Accent Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={effectiveAccent}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, accent_color: e.target.value }))}
                  className="h-9 w-12 rounded border border-gray-300 cursor-pointer p-0.5 flex-shrink-0"
                />
                <input
                  type="text"
                  value={settingsForm.accent_color || ''}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, accent_color: e.target.value }))}
                  placeholder={templatePlaceholderAccent}
                  maxLength={7}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <div style={{ background: effectivePrimary }} className="px-5 py-3 flex items-center justify-between">
              <span className="text-white font-bold text-sm">Your Company Name</span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: effectiveAccent }}>
                Proposal
              </span>
            </div>
            <div style={{ background: effectiveAccent, height: 3 }} />
            <div className="bg-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">Customer Name</span>
              <span style={{ background: effectiveAccent }} className="px-4 py-1.5 text-white text-xs font-bold rounded-lg">
                Accept Proposal
              </span>
            </div>
            <div style={{ background: effectivePrimary }} className="px-5 py-2.5 text-center">
              <span className="text-xs font-semibold tracking-wide" style={{ color: effectiveAccent }}>
                Thank you for your business
              </span>
            </div>
          </div>

          {(settingsForm.primary_color || settingsForm.accent_color) && (
            <button
              type="button"
              onClick={() => setSettingsForm((p) => ({ ...p, primary_color: '', accent_color: '' }))}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Reset colors to template defaults
            </button>
          )}
        </div>

        {/* Save */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSaveDesign}
            disabled={settingsSaving}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {settingsSaving ? 'Saving…' : 'Save Design'}
          </button>
          {settingsMsg && (
            <span className={`text-sm font-medium ${settingsMsg === 'Saved' ? 'text-green-600' : 'text-red-500'}`}>
              {settingsMsg}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    if (settingsLoading) return <p className="text-sm text-gray-500">Loading settings…</p>;

    return (
      <div className="space-y-6">
        {/* Custom Proposal Domain */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Custom Proposal Domain</h3>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Subdomain for proposal links</label>
              <input
                className={inputCls}
                value={settingsForm.proposal_domain}
                onChange={(e) => setSettingsForm((p) => ({ ...p, proposal_domain: e.target.value }))}
                placeholder="sales.coatingpro360.com"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter the full subdomain — e.g. <strong>sales.yourcompany.com</strong>. Leave blank to use the default system URL.
                When set, proposal links emailed to customers will use this domain.
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-600 space-y-2">
              <p className="font-semibold text-gray-700">DNS Setup — 2 steps required</p>
              <p><strong>Step 1:</strong> Contact your JobFlow administrator to add the subdomain in Vercel first. Vercel will provide a unique CNAME target value specific to your domain.</p>
              <p><strong>Step 2:</strong> Log in to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add this DNS record using the value Vercel gave you:</p>
              <div className="bg-white border border-gray-300 rounded px-3 py-2 font-mono text-xs space-y-1">
                <div><span className="text-gray-400">Type:</span> CNAME</div>
                <div><span className="text-gray-400">Name:</span> sales <span className="text-gray-400">(the subdomain prefix you chose)</span></div>
                <div><span className="text-gray-400">Value:</span> <span className="italic text-gray-500">provided by Vercel — do not guess this value</span></div>
                <div><span className="text-gray-400">TTL:</span> Auto (or 3600)</div>
              </div>
              <p>DNS changes can take up to 48 hours to propagate but usually resolve within a few minutes.</p>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Payment</h3>
          <div className="space-y-3">

            {/* Processor selector */}
            <div className="w-64">
              <label className={labelCls}>Credit Card Processor</label>
              <select
                className={inputCls}
                value={settingsForm.payment_processor}
                onChange={(e) => setSettingsForm((p) => ({ ...p, payment_processor: e.target.value }))}
              >
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Choose one processor. Only the selected processor's button appears on proposals.</p>
            </div>

            {/* Stripe fields */}
            {settingsForm.payment_processor === 'stripe' && (
              <>
                <div>
                  <label className={labelCls}>Stripe Publishable Key</label>
                  <input
                    className={inputCls}
                    value={settingsForm.stripe_publishable_key}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, stripe_publishable_key: e.target.value.trim() }))}
                    placeholder="pk_live_..."
                  />
                  <p className="text-xs text-gray-400 mt-1">Your Stripe publishable key — starts with <code>pk_live_</code> or <code>pk_test_</code>.</p>
                </div>
                <div>
                  <label className={labelCls}>Stripe Secret Key</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={settingsForm.stripe_secret_key}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, stripe_secret_key: e.target.value.trim() }))}
                    placeholder={settingsForm.stripe_secret_key_saved ? '••••••••  (saved — paste new key to replace)' : 'sk_live_...'}
                  />
                  <p className="text-xs text-gray-400 mt-1">Your Stripe secret key — stored securely. Never shared with customers.</p>
                </div>
              </>
            )}

            {/* PayPal fields */}
            {settingsForm.payment_processor === 'paypal' && (
              <>
                <div>
                  <label className={labelCls}>PayPal Client ID</label>
                  <input
                    className={inputCls}
                    value={settingsForm.paypal_client_id}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, paypal_client_id: e.target.value.trim() }))}
                    placeholder="AaBbCc..."
                  />
                  <p className="text-xs text-gray-400 mt-1">Found in your PayPal Developer dashboard under My Apps &amp; Credentials.</p>
                </div>
                <div>
                  <label className={labelCls}>PayPal Secret Key</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={settingsForm.paypal_secret_key}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, paypal_secret_key: e.target.value.trim() }))}
                    placeholder={settingsForm.paypal_secret_key_saved ? '••••••••  (saved — paste new key to replace)' : 'PayPal secret...'}
                  />
                  <p className="text-xs text-gray-400 mt-1">Your PayPal app secret — stored securely. Never shared with customers.</p>
                </div>
              </>
            )}

            <div className="w-48">
              <label className={labelCls}>Online Payment Convenience Fee %</label>
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  value={settingsForm.convenience_fee_percent}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, convenience_fee_percent: e.target.value }))}
                />
                <span className="text-gray-500 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Added to the total when a customer pays online. Set 0 to disable.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.include_payment_button}
                onChange={(e) => setSettingsForm((p) => ({ ...p, include_payment_button: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Show payment button on proposals by default</span>
            </label>
            <div className="w-40">
              <label className={labelCls}>Default Down Payment %</label>
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="100"
                  value={settingsForm.down_payment_default_percent}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, down_payment_default_percent: e.target.value }))}
                />
                <span className="text-gray-500 text-sm">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Company Logo */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Company Logo</h3>
          <div className="space-y-3">

            {/* Preview */}
            {settingsForm.logo_url ? (
              <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-xl">
                <img
                  src={settingsForm.logo_url}
                  alt="Logo preview"
                  className="max-h-16 max-w-[180px] object-contain flex-shrink-0"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-2">Current logo</p>
                  <button
                    type="button"
                    onClick={() => setSettingsForm(p => ({ ...p, logo_url: '' }))}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove logo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-20 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
                <p className="text-sm text-gray-400">No logo set</p>
              </div>
            )}

            {/* Upload button */}
            <div>
              <label className={labelCls}>Upload Image</label>
              <label className={`flex items-center gap-2 w-full px-4 py-2.5 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer hover:bg-blue-50 transition ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-blue-600 font-medium">
                  {logoUploading ? 'Uploading…' : 'Choose image file (PNG, JPG, SVG)'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  onChange={handleLogoFileChange}
                  className="sr-only"
                />
              </label>
              <p className="text-xs text-gray-400 mt-1">Image is uploaded to cloud storage and will display in emails and proposals. Hit Save Settings after uploading.</p>
            </div>

            {/* URL input */}
            <div>
              <label className={labelCls}>Or paste image URL</label>
              <input
                className={inputCls}
                value={settingsForm.logo_url || ''}
                onChange={(e) => setSettingsForm((p) => ({ ...p, logo_url: e.target.value }))}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-gray-400 mt-1">Use a direct image link if your logo is already hosted online.</p>
            </div>

          </div>
        </div>

        {/* System Notes */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">System Notes</h3>
          <p className="text-xs text-gray-500 mb-2">Appears on every proposal above the line items.</p>
          <textarea
            className={`${inputCls} h-24 resize-y`}
            value={settingsForm.system_notes}
            onChange={(e) => setSettingsForm((p) => ({ ...p, system_notes: e.target.value }))}
            placeholder="e.g. All work includes a 1-year labor warranty…"
          />
        </div>

        {/* Terms & Conditions */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-1 text-sm uppercase tracking-wide">Terms &amp; Conditions</h3>
          <p className="text-xs text-gray-500 mb-2">Printed on a separate page. A note on the main proposal reads "See Terms &amp; Conditions on the following page."</p>
          <textarea
            className={`${inputCls} h-64 resize-y font-mono text-xs`}
            value={settingsForm.terms_and_conditions}
            onChange={(e) => setSettingsForm((p) => ({ ...p, terms_and_conditions: e.target.value }))}
          />
        </div>

        {/* Document Top Text */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Document Top Text</h3>
          <p className="text-xs text-gray-500 mb-3">Text that appears at the top of printed documents, below the customer address.</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Top Text for Proposals</label>
              <textarea
                className={`${inputCls} h-20 resize-y`}
                value={settingsForm.proposal_top_text}
                onChange={(e) => setSettingsForm((p) => ({ ...p, proposal_top_text: e.target.value }))}
                placeholder="e.g. Thank you for the opportunity to serve your home."
              />
            </div>
            <div>
              <label className={labelCls}>Top Text for Invoices</label>
              <textarea
                className={`${inputCls} h-20 resize-y`}
                value={settingsForm.invoice_top_text}
                onChange={(e) => setSettingsForm((p) => ({ ...p, invoice_top_text: e.target.value }))}
                placeholder="e.g. Payment is due upon receipt. Thank you for your business."
              />
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Email Settings</h3>
          <p className="text-xs text-gray-500 mb-3">Used as the "From" name and address when sending proposal emails to customers.</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>From Name</label>
              <input
                className={inputCls}
                value={settingsForm.email_from_name}
                onChange={(e) => setSettingsForm((p) => ({ ...p, email_from_name: e.target.value }))}
                placeholder="e.g. RFC Floors"
              />
            </div>
            <div>
              <label className={labelCls}>From Email</label>
              <input
                className={inputCls}
                type="email"
                value={settingsForm.email_from_email}
                onChange={(e) => setSettingsForm((p) => ({ ...p, email_from_email: e.target.value }))}
                placeholder="e.g. info@rfcfloors.com"
              />
              <p className="text-xs text-gray-400 mt-1">Must be an email address you control. Leave blank to use the system default.</p>
            </div>
            <div>
              <label className={labelCls}>Notification Emails</label>
              <input
                className={inputCls}
                type="text"
                value={settingsForm.notification_emails}
                onChange={(e) => setSettingsForm((p) => ({ ...p, notification_emails: e.target.value }))}
                placeholder="e.g. owner@rfcfloors.com, manager@rfcfloors.com"
              />
              <p className="text-xs text-gray-400 mt-1">
                Where to send contractor alerts (proposal accepted, payment received). Separate multiple addresses with a comma.
                Do not include the From Email address above.
              </p>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSaveSettings}
            disabled={settingsSaving}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {settingsSaving ? 'Saving…' : 'Save Settings'}
          </button>
          {settingsMsg && (
            <span className={`text-sm font-medium ${settingsMsg === 'Saved' ? 'text-green-600' : 'text-red-500'}`}>
              {settingsMsg}
            </span>
          )}
        </div>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Enable feature toggle */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Enable Bidder Feature</p>
          <p className="text-xs text-gray-500 mt-0.5">When enabled, this company can create proposals and invoices from the lead view.</p>
        </div>
        <div className="flex items-center gap-3">
          {enableMsg && (
            <span className={`text-xs font-medium ${enableMsg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>
              {enableMsg}
            </span>
          )}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={bidderEnabled}
              onChange={e => handleToggleBidder(e.target.checked)}
              disabled={enablingBidder}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-checked:bg-blue-600 rounded-full peer transition-colors peer-disabled:opacity-50
                            after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                            peer-checked:after:translate-x-5" />
          </label>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button className={tabBtn(section === 'library')} onClick={() => setSection('library')}>Item Library</button>
        <button className={tabBtn(section === 'warranties')} onClick={() => setSection('warranties')}>Warranties</button>
        <button className={tabBtn(section === 'settings')} onClick={() => setSection('settings')}>Settings</button>
        <button className={tabBtn(section === 'design')} onClick={() => setSection('design')}>Design</button>
      </div>

      {section === 'library'    && renderLibrary()}
      {section === 'warranties' && renderWarranties()}
      {section === 'settings'   && renderSettings()}
      {section === 'design'     && renderDesign()}
    </div>
  );
}
