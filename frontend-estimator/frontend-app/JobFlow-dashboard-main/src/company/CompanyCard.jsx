// File: src/company/CompanyCard.jsx

import React from "react";

export default function CompanyCard({ company, onClick }) {
  if (!company) return null;

  return (
    <div
      onClick={onClick}
      className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200 hover:shadow-md transition-all cursor-pointer"
    >
      <div>
        <h4 className="font-bold text-gray-900">
          {company.company_name || company.name}
        </h4>

        {company.email && (
          <p className="text-sm text-gray-600">{company.email}</p>
        )}

        {company.phone && (
          <p className="text-xs text-gray-500 mt-1">
            Phone: {company.phone}
          </p>
        )}

        {company.is_active === false && (
          <p className="text-xs text-red-600 font-semibold mt-1">
            Inactive
          </p>
        )}
      </div>
    </div>
  );
}
