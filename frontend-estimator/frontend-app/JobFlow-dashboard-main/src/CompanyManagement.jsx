// File: src/CompanyManagement.jsx
import React, { useState, useEffect } from "react";
import { CompaniesAPI } from "./api";
import { useAuth } from "./AuthContext";
import { useCompany } from "./CompanyContext";

export default function CompanyManagement({ onClose, onSelectCompany }) {
  const { user } = useAuth();
  const { switchCompany } = useCompany();

  const [companies, setCompanies] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  if (!user || user.role !== "master") {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-red-700 mb-4">Access Denied</h2>
        <p className="text-gray-700 mb-6">
          Only the master account can manage all companies.
        </p>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-700 text-white rounded-lg font-bold"
        >
          Back
        </button>
      </div>
    );
  }

  useEffect(() => {
    const fetchCompanies = async () => {
      setLoading(true);
      setError("");

      try {
        const result = await CompaniesAPI.getAll();

        const list = Array.isArray(result)
          ? result
          : Array.isArray(result?.companies)
          ? result.companies
          : [];

        setCompanies(list);
        setFiltered(list);
      } catch (err) {
        console.error("Error loading companies:", err);
        setError(err.message || "Failed to load companies");
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(companies);
      return;
    }

    const term = search.toLowerCase();

    setFiltered(
      companies.filter((c) => {
        const name = (c.company_name || c.name || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const addr = (c.address || "").toLowerCase();

        return (
          name.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          addr.includes(term)
        );
      })
    );
  }, [search, companies]);

  const handleAddCompany = () => {
    alert("New Company creation will be added later.");
  };

  const handleSelect = (company) => {
    // keep global context in sync so Manage Users can rely on currentCompany
    if (company?.id) {
      switchCompany(company.id);
    }
    if (onSelectCompany) {
      onSelectCompany(company);
    }
  };

  return (
    <div className="p-0">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl p-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Manage Companies</h2>
          <p className="text-blue-100 text-sm mt-1">
            View and manage all JobFlow companies.
          </p>
        </div>

        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black"
        >
          Back
        </button>
      </div>

      {/* BODY */}
      <div className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-600 text-red-800 rounded">
            {error}
          </div>
        )}

        {/* Search + Add */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg"
          />

          <button
            onClick={handleAddCompany}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
          >
            + Company
          </button>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center py-8 text-gray-600">Loading companies...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No companies found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            {filtered.map((company) => {
              const name = company.company_name || company.name || "";
              const isSuspended = !!company.suspended;

              return (
                <button
                  key={company.id}
                  onClick={() => handleSelect(company)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition text-left overflow-hidden"
                >
                  <div
                    className={`h-2 ${
                      isSuspended ? "bg-red-500" : "bg-emerald-500"
                    }`}
                  />
                  <div className="p-4 space-y-1">
                    <h3 className="text-lg font-bold text-gray-900">{name}</h3>

                    {company.phone && (
                      <p className="text-sm text-gray-700">
                        Phone: {company.phone}
                      </p>
                    )}

                    <p className="text-sm font-semibold">
                      Status:{" "}
                      <span
                        className={
                          isSuspended ? "text-red-600" : "text-emerald-600"
                        }
                      >
                        {isSuspended ? "Suspended" : "Active"}
                      </span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
