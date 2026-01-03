// ============================================================================
// File: src/api.js
// Version: v1.2 - Use console.error for better visibility
// ============================================================================

/* ============================================================================
   API Configuration
   ============================================================================
   v1.2 – Use console.error for diagnostic logging
============================================================================ */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/* Utility to convert camelCase → snake_case for payloads */
const toSnake = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const key in obj) {
    const snake = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    const value = obj[key] === "" ? null : obj[key];
    out[snake] = value;
  }
  return out;
};

/* Utility to convert snake_case → camelCase */
const toCamel = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const key in obj) {
    const camel = key.replace(/_([a-z])/g, (_, m) => m.toUpperCase());
    out[camel] = obj[key];
  }
  return out;
};

/* Generic API request handler */
export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem("authToken");

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "API request failed";
    try {
      const clone = response.clone();
      const json = await clone.json().catch(() => null);
      if (json?.message) message = json.message;
      if (json?.error) message = json.error;
    } catch (_) {}
    throw new Error(message);
  }

  try {
    const json = await response.json();

    if (json.token && json.user) {
      return {
        token: json.token,
        user: toCamel(json.user),
      };
    }

    if (json.company) return { company: toCamel(json.company) };
    if (json.companies) return { companies: json.companies.map(toCamel) };
    if (json.user) return { user: toCamel(json.user) };
    if (json.users) return { users: json.users.map(toCamel) };
    if (json.lead) return { lead: toCamel(json.lead) };
    if (json.leads) return { leads: json.leads.map(toCamel) };
    if (json.estimate) return { estimate: json.estimate };

    return json;
  } catch {
    return {};
  }
};

/* ============================================================================
   AUTH
============================================================================ */

export const AuthAPI = {
  login: (email, password) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => apiRequest("/auth/verify"),
};

/* ============================================================================
   USERS
============================================================================ */

export const UsersAPI = {
  getAll: (companyId) => {
    const url = companyId ? `/users?company_id=${companyId}` : "/users";
    return apiRequest(url);
  },
  get: (id) => apiRequest(`/users/${id}`),

  create: (data) =>
    apiRequest("/users", {
      method: "POST",
      body: JSON.stringify(toSnake(data)),
    }),

  update: (id, data) =>
    apiRequest(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(toSnake(data)),
    }),

  delete: (id) =>
    apiRequest(`/users/${id}`, {
      method: "DELETE",
    }),
};

/* ============================================================================
   COMPANIES
============================================================================ */

export const CompaniesAPI = {
  create: (data) =>
    apiRequest("/companies", {
      method: "POST",
      body: JSON.stringify(toSnake(data)),
    }),

  get: (id) => apiRequest(`/companies/${id}`),

  update: (id, data) => {
    console.error("🔍 CompaniesAPI.update called");
    console.error("ID:", id);
    console.error("Data BEFORE toSnake:", data);
    const snakeData = toSnake(data);
    console.error("Data AFTER toSnake:", snakeData);
    console.error("Full URL:", `/companies/${id}`);
    
    return apiRequest(`/companies/${id}`, {
      method: "PUT",
      body: JSON.stringify(snakeData),
    });
  },

  getAll: () => apiRequest("/companies"),
};

/* ============================================================================
   LEADS
============================================================================ */

export const LeadsAPI = {
  getAll: () => apiRequest("/leads"),
  get: (id) => apiRequest(`/leads/${id}`),
  getEstimate: (id) => apiRequest(`/leads/${id}/estimate`),

  create: (leadData) =>
    apiRequest("/leads", {
      method: "POST",
      body: JSON.stringify(toSnake(leadData)),
    }),

  update: (id, leadData) =>
    apiRequest(`/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(toSnake(leadData)),
    }),

  delete: (id) =>
    apiRequest(`/leads/${id}`, {
      method: "DELETE",
    }),
};