// File: src/CompanyDetails.jsx
import React, { useState, useEffect } from "react";

export default function CompanyDetails({ company, onBack, onSave, saving }) {
const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    timezone: "",
    sales_calendar: "",
    //install_calendar: "",
    ghl_api_key: "",
    ghl_location_id: "",
    ghl_appt_calendar: "",
    ghl_install_calendar: "",
    ghl_appt_assigned_user: "",
    ghl_install_assigned_user: "",
    ghl_appt_title_template: "",
    ghl_install_title_template: "",
    ghl_appt_description_template: "",
ghl_install_description_template: "",
    suspended: false,
    plan_type: "pro",
    google_base_tag: "",
    meta_base_tag: "",
    google_conversion_event: "",
    meta_conversion_event: "",
    microsoft_base_tag: "",
    microsoft_conversion_event: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!company) return;

setFormData({
      name: company.company_name || company.name || "",
      phone: company.phone || "",
      email: company.email || "",
      address: company.address || "",
      timezone: company.timezone || "",
      sales_calendar: company.sales_calendar || "",
      ghl_api_key: company.ghl_api_key || "",
      ghl_location_id: company.ghl_location_id || "",
      ghl_appt_calendar: company.ghl_appt_calendar || "",
      ghl_install_calendar: company.ghl_install_calendar || "",
      ghl_appt_assigned_user: company.ghl_appt_assigned_user || "",
      ghl_install_assigned_user: company.ghl_install_assigned_user || "",
      ghl_appt_title_template: company.ghl_appt_title_template ?? "",
      ghl_install_title_template: company.ghl_install_title_template || "{{full_name}} - Install",
      ghl_appt_description_template: company.ghl_appt_description_template || "",
ghl_install_description_template: company.ghl_install_description_template || "",
      suspended: !!company.suspended,
      plan_type: company.plan_type || "pro",
      google_base_tag: company.google_base_tag || "",
      meta_base_tag: company.meta_base_tag || "",
      google_conversion_event: company.google_conversion_event || "",
      meta_conversion_event: company.meta_conversion_event || "",
      microsoft_base_tag: company.microsoft_base_tag || "",
      microsoft_conversion_event: company.microsoft_conversion_event || "",
    });
    setError("");
    setSuccess("");
  }, [company]);

  const handleChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleCheckbox = (field) =>
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleSave = async () => {
    setError("");
    setSuccess("");

    try {
      const { suspended: _suspended, ...safeFormData } = formData;
      const payload = {
        ...safeFormData,
        company_name: formData.name,
        name: formData.name,
      };

      await onSave(company.id, payload);

      setSuccess("Company updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to save company.");
    }
  };

  const isSuspended = !!formData.suspended;

  if (!company) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          No company selected
        </h2>
        <p className="text-gray-600 mb-4">
          Go back to the list and choose a company to edit.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-gray-700 text-white rounded-lg font-bold"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <>
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {formData.name || "Company Details"}
          </h2>
          <p className="text-blue-100 text-sm mt-1">Edit this company</p>
        </div>

        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black"
        >
          Back
        </button>
      </div>

      {/* BODY */}
      <div className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-600 rounded text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border-l-4 border-green-600 rounded text-green-800">
            {success}
          </div>
        )}

        {/* STATUS */}
        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isSuspended
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isSuspended ? "Suspended" : "Active"}
            </span>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.suspended}
                onChange={() => handleCheckbox("suspended")}
              />
              Suspended
            </label>

            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold">Plan:</label>
              <select
                value={formData.plan_type}
                onChange={(e) => handleChange("plan_type", e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="pro">Pro</option>
                <option value="estimator_only">Estimator Only</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {saving && <p className="text-xs text-gray-500">Saving…</p>}
        </div>

        {/* BASIC INFO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold">Company Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="ProShield Floors"
            />
          </div>

          <div>
            <label className="font-semibold">Phone</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="555-123-4567"
            />
          </div>

          <div>
            <label className="font-semibold">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="owner@email.com"
            />
          </div>

          <div>
            <label className="font-semibold">Timezone</label>
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="America/Chicago"
            />
          </div>
        </div>

        {/* ADDRESS */}
        <div>
          <label className="font-semibold">Address</label>
          <textarea
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className="w-full px-4 py-3 border rounded-lg h-24"
          />
        </div>

        {/* CALENDARS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold">Sales Calendar</label>
            <input
              type="text"
              value={formData.sales_calendar}
              onChange={(e) => handleChange("sales_calendar", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
            />
          </div>

          <div>
            <label className="font-semibold">Install Calendar</label>
            <input
              type="text"
              value={formData.ghl_install_calendar}
              onChange={(e) =>
                handleChange("ghl_install_calendar", e.target.value)
              }
              className="w-full px-4 py-3 border rounded-lg"
            />
          </div>
        </div>

{/* GHL */}
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-bold text-gray-800">GHL Integration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold">GHL API Key</label>
              <input
                type="text"
                value={formData.ghl_api_key}
                onChange={(e) => handleChange("ghl_api_key", e.target.value)}
                className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
              />
            </div>

            <div>
              <label className="font-semibold">GHL Location ID</label>
              <input
                type="text"
                value={formData.ghl_location_id}
                onChange={(e) => handleChange("ghl_location_id", e.target.value)}
                className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
              />
            </div>
          </div>

          {/* Appointment Calendar */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-bold text-gray-700 mb-3">Appointment Calendar</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold">Calendar ID</label>
                <input
                  type="text"
                  value={formData.ghl_appt_calendar}
                  onChange={(e) => handleChange("ghl_appt_calendar", e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
                />
              </div>

              <div>
                <label className="font-semibold">Assigned User ID</label>
                <input
                  type="text"
                  value={formData.ghl_appt_assigned_user}
                  onChange={(e) => handleChange("ghl_appt_assigned_user", e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
                  placeholder="User ID for appointments"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="font-semibold">Title Template</label>
              <input
                type="text"
                value={formData.ghl_appt_title_template}
                onChange={(e) => handleChange("ghl_appt_title_template", e.target.value)}
                className="w-full px-4 py-3 border rounded-lg"
                placeholder="{{full_name}} - Appointment"
              />
            </div>

            <div className="mt-3">
              <label className="font-semibold">Description Template</label>
              <textarea
                value={formData.ghl_appt_description_template}
                onChange={(e) => handleChange("ghl_appt_description_template", e.target.value)}
                className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
                rows="8"
                placeholder="Customer: {{full_name}}&#10;Phone: {{phone}}&#10;Email: {{email}}&#10;&#10;Service Address:&#10;{{address}}&#10;{{city}}, {{state}} {{zip}}"
              />
              <div className="text-xs text-gray-500 mt-1">
                Available: {`{{full_name}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{zip}}, {{square_footage}}, {{finish_type}}, {{notes}}`}
              </div>
            </div>
          </div>

          {/* Install Calendar */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-bold text-gray-700 mb-3">Install Calendar</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold">Calendar ID</label>
                <input
                  type="text"
                  value={formData.ghl_install_calendar}
                  onChange={(e) => handleChange("ghl_install_calendar", e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
                />
              </div>

              <div>
                <label className="font-semibold">Assigned User ID</label>
                <input
                  type="text"
                  value={formData.ghl_install_assigned_user}
                  onChange={(e) => handleChange("ghl_install_assigned_user", e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
                  placeholder="User ID for installs"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="font-semibold">Title Template</label>
              <input
                type="text"
                value={formData.ghl_install_title_template}
                onChange={(e) => handleChange("ghl_install_title_template", e.target.value)}
                className="w-full px-4 py-3 border rounded-lg"
                placeholder="{{full_name}} - Install"
              />
            </div>

            <div className="mt-3">
              <label className="font-semibold">Description Template</label>
              <textarea
                value={formData.ghl_install_description_template}
                onChange={(e) => handleChange("ghl_install_description_template", e.target.value)}
                className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
                rows="8"
                placeholder="Customer: {{full_name}}&#10;Phone: {{phone}}&#10;Email: {{email}}&#10;&#10;Service Address:&#10;{{address}}&#10;{{city}}, {{state}} {{zip}}"
              />
              <div className="text-xs text-gray-500 mt-1">
                Available: {`{{full_name}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{zip}}, {{square_footage}}, {{finish_type}}, {{notes}}`}
              </div>
            </div>
          </div>
        </div>

{/* CONVERSION TRACKING */}
        <div className="space-y-6 border-t pt-4">
          <h3 className="text-lg font-bold text-gray-800">Conversion Tracking</h3>

          {/* Google Base Tag */}
          <div className="space-y-2">
            <label className="font-semibold">Google / GA4 Base Tag</label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Where to find this code:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to <strong>Google Ads</strong> → Tools &amp; Settings → Audience Manager → Your Data Sources → Google tag</li>
                <li>Click <strong>Tag setup</strong> → Install the tag yourself</li>
                <li>Copy the two <code>&lt;script&gt;</code> blocks shown — paste both here</li>
              </ol>
              <p className="text-blue-700 mt-1">Also works with a Google Tag Manager container snippet if you use GTM instead.</p>
            </div>
            <textarea
              value={formData.google_base_tag}
              onChange={(e) => handleChange("google_base_tag", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
              rows="4"
              placeholder={'<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXX"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","AW-XXXXXXXXX");</script>'}
            />
          </div>

          {/* Google Conversion Event */}
          <div className="space-y-2">
            <label className="font-semibold">Google Conversion Event Code</label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Where to find this code:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to <strong>Google Ads</strong> → Goals → Conversions → click your conversion action</li>
                <li>Click <strong>Tag setup</strong> → Use Google tag → Install manually</li>
                <li>Copy only the <strong>event snippet</strong> line — it looks like:<br /><code>gtag('event', 'conversion', {'{'}'send_to': 'AW-XXXXXXXXX/XXXXXXXXX'{'}'});</code></li>
                <li>Paste just that one line here — no <code>&lt;script&gt;</code> tags</li>
              </ol>
              <p className="text-blue-700 mt-1">This fires automatically when a visitor submits the estimator form. It shows up in Google Ads under your conversion action.</p>
            </div>
            <textarea
              value={formData.google_conversion_event}
              onChange={(e) => handleChange("google_conversion_event", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
              rows="2"
              placeholder={"gtag('event', 'conversion', { send_to: 'AW-XXXXXXXXX/XXXXXXXXX' });"}
            />
          </div>

          {/* Meta Base Tag */}
          <div className="space-y-2">
            <label className="font-semibold">Meta (Facebook) Base Tag</label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Where to find this code:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to <strong>Meta Business Suite</strong> → Events Manager → your Pixel → click <strong>Add Events</strong> → From a new website</li>
                <li>Choose <strong>Install code manually</strong></li>
                <li>Copy the full <strong>base code</strong> block (the <code>!function(f,b,e,v...)</code> script including the <code>fbq('init', ...)</code> and <code>fbq('track', 'PageView')</code> lines)</li>
                <li>Paste the entire <code>&lt;script&gt;</code> block here</li>
              </ol>
              <p className="text-blue-700 mt-1">This loads the Facebook Pixel and tracks page views on the estimator. Your Pixel ID is the number inside <code>fbq('init', 'XXXXXXXXXXXXXXX')</code>.</p>
            </div>
            <textarea
              value={formData.meta_base_tag}
              onChange={(e) => handleChange("meta_base_tag", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
              rows="5"
              placeholder={'<script>\n!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){...};\nfbq(\'init\', \'XXXXXXXXXXXXXXX\');\nfbq(\'track\', \'PageView\');\n</script>'}
            />
          </div>

          {/* Meta Conversion Event */}
          <div className="space-y-2">
            <label className="font-semibold">Meta Conversion Event Code</label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Where to find this code:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to <strong>Meta Business Suite</strong> → Events Manager → your Pixel → <strong>Add Events</strong> → From a new website → Install code manually</li>
                <li>Scroll to the <strong>event code</strong> section and select <strong>Lead</strong> as the event type</li>
                <li>Copy only the event line: <code>fbq('track', 'Lead');</code></li>
                <li>Paste just that one line here — no <code>&lt;script&gt;</code> tags</li>
              </ol>
              <p className="text-blue-700 mt-1"><strong>'Lead'</strong> is Meta's standard event name for form submissions. It shows up in Events Manager as "Lead" and lets Meta optimize your ads to find people likely to fill out the estimator.</p>
            </div>
            <textarea
              value={formData.meta_conversion_event}
              onChange={(e) => handleChange("meta_conversion_event", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
              rows="2"
              placeholder={"fbq('track', 'Lead');"}
            />
          </div>

          {/* Microsoft Base Tag */}
          <div className="space-y-2">
            <label className="font-semibold">Microsoft (Bing) Base Tag</label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Where to find this code:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to <strong>Microsoft Advertising</strong> (ads.microsoft.com) → Tools → UET Tags</li>
                <li>Click your UET tag name (or create one if you don't have one yet)</li>
                <li>Click <strong>View tag</strong> → copy the full <code>&lt;script&gt;</code> block shown</li>
                <li>Paste the entire script block here</li>
              </ol>
              <p className="text-blue-700 mt-1">This loads the Microsoft UET tag on the estimator. It tracks page visits and is required before any conversion event will fire.</p>
            </div>
            <textarea
              value={formData.microsoft_base_tag}
              onChange={(e) => handleChange("microsoft_base_tag", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
              rows="4"
              placeholder={'<script>(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[];f=function(){var o={ti:"XXXXXXXXX"};o.q=w[u];w[u]=new UET(o);w[u].push("pageLoad")};n=d.createElement(t);n.src=r;n.async=1;n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)};i=d.getElementsByTagName(t)[0];i.parentNode.insertBefore(n,i)})(window,document,"script","//bat.bing.com/bat.js","uetq");</script>'}
            />
          </div>

          {/* Microsoft Conversion Event */}
          <div className="space-y-2">
            <label className="font-semibold">Microsoft Conversion Event Code</label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Where to find this code:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to <strong>Microsoft Advertising</strong> → Tools → Conversion Goals → click your goal (or create one)</li>
                <li>Set goal type to <strong>Event</strong></li>
                <li>The event code will look like: <code>window.uetq = window.uetq || []; window.uetq.push('event', 'submit_lead', {'{'}'{'}'});</code></li>
                <li>Copy just that line — no <code>&lt;script&gt;</code> tags — and paste here</li>
              </ol>
              <p className="text-blue-700 mt-1">This fires when a visitor submits the estimator form. It shows up in Microsoft Ads under your conversion goal and lets Bing optimize campaigns for leads.</p>
            </div>
            <textarea
              value={formData.microsoft_conversion_event}
              onChange={(e) => handleChange("microsoft_conversion_event", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg font-mono text-xs"
              rows="2"
              placeholder={"window.uetq = window.uetq || []; window.uetq.push('event', 'submit_lead', {});"}
            />
          </div>

        </div>

        {/* ACTIONS */}
        <div className="flex justify-between pt-4 border-t">
          <button
            onClick={onBack}
            className="px-8 py-3 bg-gray-600 text-white rounded-lg font-bold"
          >
            Back
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:bg-blue-300"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
