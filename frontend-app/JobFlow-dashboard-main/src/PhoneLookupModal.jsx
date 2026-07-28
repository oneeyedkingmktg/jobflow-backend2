import React, { useState, useRef } from "react";
import { LeadsAPI } from "./api";
import { useCompany } from "./CompanyContext";

function formatPhoneDisplay(value) {
  if (!value) return value;
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function cleanDigits(v) {
  return v ? v.replace(/[^\d]/g, "") : "";
}

export default function PhoneLookupModal({
  onCreateNew,
  onSelectExisting,
  onClose,
}) {
  const { currentCompany } = useCompany();
  const [phoneInput, setPhoneInput] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletedConfirm, setDeletedConfirm] = useState(null);
  const inputRef = useRef(null);

  const digits = cleanDigits(phoneInput);
  const isComplete = digits.length === 10 || digits.length === 11;

  const handleSearch = async () => {
    if (!isComplete) {
      setError("Please enter a complete 10-digit phone number.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await LeadsAPI.phoneLookup(digits, currentCompany.id);
      setResults(data);
    } catch (err) {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleSelectActive = (lead) => {
    onSelectExisting(lead);
  };

  const handleSelectDeleted = (lead) => {
    setDeletedConfirm(lead);
  };

  const handleOpenDeleted = () => {
    onSelectExisting(deletedConfirm);
  };

  const handleCreateNewFromDeleted = () => {
    setDeletedConfirm(null);
    onCreateNew(digits);
  };

  const hasAnyResults =
    results && (results.active.length > 0 || results.deleted.length > 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 text-lg"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
          Phone Lookup
        </h2>

        <input
          ref={inputRef}
          type="text"
          value={phoneInput}
          placeholder="Enter phone number"
          onChange={(e) => {
            setPhoneInput(formatPhoneDisplay(e.target.value));
            setResults(null);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl mb-1"
          autoFocus
        />

        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}
        {!error && <div className="mb-3" />}

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>

        {results && (
          <div className="mt-5 space-y-3 max-h-72 overflow-y-auto pr-1">
            {!hasAnyResults && (
              <div className="p-3 border rounded-lg bg-gray-50 text-gray-600 text-sm text-center">
                No existing contacts found with this number.
              </div>
            )}

            {results.active.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Active Contacts
                </p>
                <div className="space-y-2">
                  {results.active.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => handleSelectActive(lead)}
                      className="w-full text-left p-3 border rounded-lg bg-emerald-50 border-emerald-200 hover:bg-emerald-100 transition"
                    >
                      <p className="font-semibold text-gray-900">{lead.name}</p>
                      <p className="text-sm text-gray-500">
                        {lead.email || "No email"} · {lead.phone}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.deleted.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Deleted Contacts
                </p>
                <div className="space-y-2">
                  {results.deleted.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => handleSelectDeleted(lead)}
                      className="w-full text-left p-3 border rounded-lg bg-amber-50 border-amber-200 hover:bg-amber-100 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                          Deleted
                        </span>
                        <p className="font-semibold text-gray-900">{lead.name}</p>
                      </div>
                      <p className="text-sm text-gray-500">
                        {lead.email || "No email"} · {lead.phone}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => onCreateNew(digits, results?.active?.length > 0)}
                className="w-full px-4 py-3 bg-gray-100 text-gray-800 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                + Create New Contact
              </button>
            </div>
          </div>
        )}
      </div>

      {deletedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeletedConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1 text-center">
              This contact was deleted
            </h3>
            <p className="text-sm text-gray-500 mb-1 text-center font-medium">
              {deletedConfirm.name}
            </p>
            <p className="text-sm text-gray-400 mb-5 text-center">
              {deletedConfirm.email || "No email"} · {deletedConfirm.phone}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOpenDeleted}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition"
              >
                Open Their Record
              </button>
              <button
                onClick={handleCreateNewFromDeleted}
                className="w-full py-3 bg-gray-100 text-gray-800 rounded-xl font-semibold text-sm hover:bg-gray-200 transition"
              >
                Create New Contact
              </button>
              <button
                onClick={() => setDeletedConfirm(null)}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
