import React from "react";

export default function LeadSearchBar({
  searchTerm,
  setSearchTerm,
  setActiveTab,
  includeJunk,
  setIncludeJunk,
}) {

  return (
    <div className="max-w-7xl mx-auto px-4 mt-5 mb-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">

        <input
          type="text"
          placeholder="Search by name, phone or city"
          value={searchTerm}
onChange={(e) => {
  const value = e.target.value;
  setSearchTerm(value);
  if (value) {
    setActiveTab("All");
  }
}}
          className="flex-1 px-4 py-3 border rounded-lg shadow-sm"
        />

        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={includeJunk}
            onChange={(e) => setIncludeJunk(e.target.checked)}
            className="w-4 h-4 accent-orange-500"
          />
          Include Junk
        </label>

      </div>
    </div>
  );
}
