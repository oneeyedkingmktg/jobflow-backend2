import React, { useState } from "react";

export default function PhoneLookupModal({
  leads,
  onCreateNew,        // returns: onCreateNew(phone)
  onSelectExisting,   // returns: onSelectExisting(lead)
  onClose,
}) {
  const [phoneInput, setPhoneInput] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (value) => {
    if (!value) return value;
    const digits = value.replace(/[^\d]/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6)
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const cleanPhone = (v) => (v ? v.replace(/[^\d]/g, "") : "");

  const handleSearch = () => {
    const cleaned = cleanPhone(phoneInput);
    if (!cleaned) return;

    setLoading(true);
    setHasSearched(true);

    const matches = leads.filter((lead) => {
      const p = lead.phone?.replace(/[^\d]/g, "") || "";
      return p.includes(cleaned);
    });

    setLookupResult({ matches });
    setLoading(false);
  };

  const handleProceed = () => {
    if (!lookupResult) return;

    if (lookupResult.matches?.length > 0) {
      onSelectExisting(lookupResult.matches[0]);
      return;
    }

    onCreateNew(cleanPhone(phoneInput));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="text-xl font-bold mb-4 text-center">Phone Lookup</h2>

        <input
          type="text"
          value={phoneInput}
          placeholder="Enter phone number"
          onChange={(e) => setPhoneInput(formatPhoneNumber(e.target.value))}
          className="w-full border rounded-lg p-3 shadow-inner mb-4"
        />

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-2 rounded-lg shadow hover:bg-emerald-700"
        >
          {loading ? "Searching..." : "Search"}
        </button>

        {hasSearched && (
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold text-lg">Results</h3>

            {lookupResult?.matches?.length > 0 ? (
              <div className="p-3 border rounded-lg bg-emerald-50">
                <p className="font-semibold">Existing Lead Found</p>
                <p>{lookupResult.matches[0].name}</p>
                <p>{lookupResult.matches[0].phone}</p>
              </div>
            ) : (
              <div className="p-3 border rounded-lg bg-gray-50">
                <p>No existing leads found.</p>
              </div>
            )}
          </div>
        )}

        {hasSearched && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded shadow hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleProceed}
              className="flex-1 bg-emerald-600 text-white py-2 rounded shadow hover:bg-emerald-700"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
