// CalendarsSettings.jsx — Link GHL calendars to crews and salespeople (Phase 5)

import React, { useState, useEffect } from "react";
import { useCompany } from "../CompanyContext";
import { GhlAPI, CrewsAPI, UsersAPI } from "../api";

export default function CalendarsSettings({ onBack }) {
  const { currentCompany } = useCompany();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [ghlCalendars, setGhlCalendars] = useState([]);
  const [crews, setCrews] = useState([]);
  const [salespeople, setSalespeople] = useState([]);

  // Local editable state: { [id]: ghlCalendarId }
  const [crewCalendars, setCrewCalendars] = useState({});
  const [salesmanCalendars, setSalesmanCalendars] = useState({});

  const companyId = currentCompany?.id;

  useEffect(() => {
    if (!companyId) return;
    load();
  }, [companyId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [calRes, crewRes, salesRes] = await Promise.all([
        GhlAPI.getCalendars(companyId),
        CrewsAPI.getAll(companyId),
        UsersAPI.getSalespeople(companyId),
      ]);

      const cals = calRes?.calendars || [];
      setGhlCalendars(cals);

      const crewList = crewRes?.crews || [];
      setCrews(crewList);
      const crewMap = {};
      crewList.forEach((c) => { crewMap[c.id] = c.ghl_calendar_id || ""; });
      setCrewCalendars(crewMap);

      const salesList = salesRes?.salespeople || [];
      setSalespeople(salesList);
      const salesMap = {};
      salesList.forEach((s) => { salesMap[s.id] = s.ghl_calendar_id || ""; });
      setSalesmanCalendars(salesMap);
    } catch (err) {
      setError("Failed to load data. Make sure your GHL API key is connected in Company Settings.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      for (const crew of crews) {
        const newVal = crewCalendars[crew.id] || null;
        const existing = crew.ghl_calendar_id || null;
        if (newVal !== existing) {
          await CrewsAPI.update(crew.id, { ghl_calendar_id: newVal });
        }
      }
      for (const s of salespeople) {
        const newVal = salesmanCalendars[s.id] || null;
        const existing = s.ghl_calendar_id || null;
        if (newVal !== existing) {
          await UsersAPI.update(s.id, { ghl_calendar_id: newVal });
        }
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await load();
    } catch (err) {
      setError("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const calendarOptions = [
    { id: "", name: "— Not linked —" },
    ...ghlCalendars.map((c) => ({ id: c.id, name: c.name || c.id })),
  ];

  const Select = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      {calendarOptions.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-900">GHL Calendars</h2>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500">Loading calendar data...</div>
      )}

      {!loading && error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && ghlCalendars.length === 0 && !error && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          No GHL calendars found. Make sure your GHL API key is connected and the location has at least one calendar.
        </div>
      )}

      {!loading && (
        <>
          {/* Salespeople */}
          {salespeople.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Salesperson Calendars
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Appointments with an assigned salesperson will also be pushed to their linked GHL calendar.
              </p>
              <div className="space-y-3">
                {salespeople.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-40 shrink-0">
                      <span className="text-sm font-medium text-gray-800">{s.name}</span>
                    </div>
                    <div className="flex-1">
                      <Select
                        value={salesmanCalendars[s.id] || ""}
                        onChange={(val) =>
                          setSalesmanCalendars((prev) => ({ ...prev, [s.id]: val }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {salespeople.length === 0 && (
            <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm">
              No salespeople configured. Mark users as salespeople in User Management to link their calendars.
            </div>
          )}

          {/* Crews */}
          {crews.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Crew Calendars
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Installs assigned to a crew will also be pushed to the crew's linked GHL calendar.
              </p>
              <div className="space-y-3">
                {crews.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: c.color || "#6366f1" }}
                      />
                      <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    </div>
                    <div className="flex-1">
                      <Select
                        value={crewCalendars[c.id] || ""}
                        onChange={(val) =>
                          setCrewCalendars((prev) => ({ ...prev, [c.id]: val }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {crews.length === 0 && (
            <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm">
              No crews configured. Create crews in the Crews section to link their calendars.
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              Calendar links saved successfully.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || ghlCalendars.length === 0}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm border border-gray-300"
            >
              Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
}
