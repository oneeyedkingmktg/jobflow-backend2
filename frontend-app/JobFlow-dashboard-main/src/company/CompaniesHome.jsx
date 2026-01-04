// File: src/company/CompaniesHome.jsx
// Version: v1.1.0 – Map name → company_name before save

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../AuthContext";
import { useCompany } from "../CompanyContext";
import CompanyCard from "./CompanyCard.jsx";
import CompanyModal from "./CompanyModal.jsx";

export default function CompaniesHome() {
  const { user, isAuthenticated } = useAuth();
  const {
    companies,
    currentCompany,
    loadCompanies,
    createCompany,
    updateCompany,
    switchCompany,
  } = useCompany();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [modalMode, setModalMode] = useState("view");

  const canManage = isAuthenticated && user?.role === "master";

  // ------------------------------------------------------------
  // LOAD companies
  // ------------------------------------------------------------
  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        await loadCompanies();
      } catch (err) {
        setError(err.message || "Failed to load companies");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [canManage]);

  const openViewCompany = (c) => {
    if (!c) return;
    setSelectedCompany(c);
    setModalMode("view");
    setShowModal(true);
  };

  const openCreateCompany = () => {
    setSelectedCompany(null);
    setModalMode("create");
    setShowModal(true);
  };

  // ------------------------------------------------------------
  // SAVE (ACTUAL FIX)
  // ------------------------------------------------------------
const handleSaveCompany = async (form) => {
  try {
    setError("");

    // 🔒 Backend expects company_name, not name
    const payload = {
      ...form,
      company_name: form.name,
    };
    delete payload.name;

    if (modalMode === "create") {
      await createCompany(payload);
      await loadCompanies();
      setShowModal(false);
      setSelectedCompany(null);
      setModalMode("view");
    } else if (selectedCompany) {
      // ✅ Save and get the updated company directly from API response
      const result = await updateCompany(selectedCompany.id, payload);
      
      // ✅ Use the fresh data from the API response immediately
      if (result?.company) {
        setSelectedCompany(result.company);
      }
      
      // Reload the companies list in the background
      await loadCompanies();
    }
  } catch (err) {
    setError(err.message || "Failed to save company");
  }
};
  // ------------------------------------------------------------
  // FILTER
  // ------------------------------------------------------------
  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companies;
    const term = search.toLowerCase();
    return companies.filter((c) =>
      (c.name || "").toLowerCase().includes(term)
    );
  }, [search, companies]);

  if (!canManage) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">
          Only the master account can manage companies.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="text-lg font-semibold text-gray-800">
          CoatingPro360 – Manage Companies
        </div>

        <button
          onClick={() => window.__setAppScreen?.("main")}
          className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg font-semibold"
        >
          Close
        </button>
      </div>

      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies..."
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-gray-500">
          Loading companies…
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="py-10 text-center text-gray-500">
          No companies found.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={openCreateCompany}
            className="h-[90px] flex flex-col items-center justify-center rounded-xl border-2 border-emerald-500 bg-emerald-50"
          >
            <div className="text-emerald-600 text-2xl font-bold">+</div>
            <div className="text-emerald-700 font-semibold mt-1">
              New Company
            </div>
          </button>

          {filteredCompanies.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              isActive={currentCompany?.id === c.id}
              onClick={() => openViewCompany(c)}
              onSetActive={() => switchCompany(c.id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <CompanyModal
          mode={modalMode}
          company={selectedCompany}
          onEdit={() => setModalMode("edit")}
          onClose={() => {
            setShowModal(false);
            setSelectedCompany(null);
            setModalMode("view");
          }}
          onSave={handleSaveCompany}
        />
      )}
    </div>
  );
}
