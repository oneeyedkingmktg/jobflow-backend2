// ============================================================================
// File: src/CompanyContext.jsx
// Version: v4.5.1 – Harden update payload: strip undefined values before save
// ============================================================================

import { createContext, useContext, useState, useEffect } from "react";
import { CompaniesAPI } from "./api";
import { useAuth } from "./AuthContext";

const CompanyContext = createContext(null);

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
};

// ---------------------------------------------------------------------------
// Normalize company object ONCE here
// ---------------------------------------------------------------------------
const normalizeCompany = (c) => {
  if (!c || typeof c !== "object") return null;

  return {
    ...c,
    name: c.name ?? c.companyName ?? c.company_name ?? "",
  };
};

export const CompanyProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  // ============================================================================
  // Load companies automatically when logged in
  // ============================================================================
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setCompanies([]);
      setCurrentCompany(null);
      setLoading(false);
      return;
    }

    loadCompanies();
  }, [isAuthenticated, user]);

  // ============================================================================
  // Load companies
  // ============================================================================
  const loadCompanies = async () => {
    try {
      setLoading(true);

      if (user.role === "master") {
        const res = await CompaniesAPI.getAll();

        const raw = Array.isArray(res)
          ? res
          : Array.isArray(res?.companies)
          ? res.companies
          : [];

        const normalized = raw.map(normalizeCompany).filter(Boolean);

        setCompanies(normalized);
setCurrentCompany((prev) => {
  // Preserve explicitly selected company if it still exists
  if (prev && normalized.some((c) => c.id === prev.id)) {
    return prev;
  }

  // Only auto-select a company if none is currently set
  if (!prev && normalized.length > 0) {
    return normalized[0];
  }

  return null;
});

      } else {
        if (!user.companyId) {
          setCompanies([]);
          setCurrentCompany(null);
          return;
        }

        const res = await CompaniesAPI.get(user.companyId);
        const company = normalizeCompany(res.company);

        setCompanies(company ? [company] : []);
        setCurrentCompany(company);
      }
    } catch (err) {
      console.error("CompanyContext load error:", err);
      setCompanies([]);
      setCurrentCompany(null);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // Switch active company (MASTER ONLY)
  // ============================================================================
  const switchCompany = async (companyId) => {
    try {
      const res = await CompaniesAPI.get(companyId);
      setCurrentCompany(normalizeCompany(res.company));
    } catch (err) {
      console.error("Failed to switch company:", err);
    }
  };

  // ============================================================================
  // CREATE COMPANY (MASTER ONLY)
  // ============================================================================
  const createCompany = async (data) => {
    try {
      const name =
        data?.name ?? data?.company_name ?? data?.companyName ?? "";

      const res = await CompaniesAPI.create({
        company_name: name,
        phone: data?.phone || "",
        email: data?.email || "",
        website: data?.website || "",
        address: data?.address || "",
        city: data?.city || "",
        state: data?.state || "",
        zip: data?.zip || "",
        suspended: data?.suspended === true,
      });

      if (!res.company) {
        return { success: false, error: res.error || "Missing company from API" };
      }

      await loadCompanies();
      return { success: true, company: normalizeCompany(res.company) };
    } catch (err) {
      console.error("createCompany error:", err);
      return { success: false, error: err.message };
    }
  };

  // ============================================================================
  // UPDATE COMPANY
  // ============================================================================
  const updateCompany = async (companyId, updates) => {
    try {
      console.log("=== CompanyContext.updateCompany CALLED ===");
      console.log("Company ID:", companyId);
      console.log("Updates payload (raw):", JSON.stringify(updates, null, 2));

      // ----------------------------------------------------------------------
      // SAFETY: strip undefined values so partial updates cannot null fields
      // ----------------------------------------------------------------------
      const sanitizedUpdates = { ...updates };
      Object.keys(sanitizedUpdates).forEach((key) => {
        if (sanitizedUpdates[key] === undefined) {
          delete sanitizedUpdates[key];
        }
      });

      console.log(
        "Updates payload (sanitized):",
        JSON.stringify(sanitizedUpdates, null, 2)
      );

      const res = await CompaniesAPI.update(companyId, sanitizedUpdates);

      console.log("API response:", JSON.stringify(res, null, 2));

      if (!res.company) {
        console.error("No company in response!");
        return { success: false, error: res.error || "Failed to update company" };
      }

      const normalized = normalizeCompany(res.company);
      console.log("Normalized company:", JSON.stringify(normalized, null, 2));

      setCurrentCompany(normalized);

      if (user.role === "master") {
        await loadCompanies();
      }

      return { success: true, company: normalized };
    } catch (err) {
      console.error("updateCompany error:", err);
      return { success: false, error: err.message };
    }
  };

  // ============================================================================
  // Provider value
  // ============================================================================
  const value = {
    companies,
    currentCompany,
    loading,

    loadCompanies,
    switchCompany,
    createCompany,
    updateCompany,
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};
