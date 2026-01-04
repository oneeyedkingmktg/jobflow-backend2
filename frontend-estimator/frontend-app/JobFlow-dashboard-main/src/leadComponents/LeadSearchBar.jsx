import React from "react";

export default function LeadSearchBar({
  searchTerm,
  setSearchTerm,
  searchArchived,
  setSearchArchived,
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 mt-5 mb-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        
        <input
          type="text"
          placeholder="Search by name, phone or city"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border rounded-lg shadow-sm"
        />

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={searchArchived}
            onChange={(e) => setSearchArchived(e.target.checked)}
          />
          Also search archived
        </label>
      </div>
    </div>
  );
}
