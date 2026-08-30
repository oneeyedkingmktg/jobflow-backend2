// ============================================================================
// File: src/api.js
// Version: v1.3 - Added changePassword method
// ============================================================================

/* ============================================================================
   API Configuration
   ============================================================================
   v1.3 – Added changePassword method for secure password updates
============================================================================ */

const API_BASE_URL = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;


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
    let detail = null;
    try {
      const clone = response.clone();
      const json = await clone.json().catch(() => null);
      if (json?.message) message = json.message;
      if (json?.error) message = json.error;
      if (json?.detail) detail = json.detail;
    } catch (_) {}
    const err = new Error(message);
    err.detail = detail;
    throw err;
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

  changePassword: (data) =>
    apiRequest("/users/me/password", {
      method: "PUT",
      body: JSON.stringify(data), // Don't use toSnake - backend expects camelCase
    }),

  updatePermissions: (id, permissions) =>
    apiRequest(`/users/${id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),

  setPassword: (id, password) =>
    apiRequest(`/users/${id}/set-password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),

  delete: (id) =>
    apiRequest(`/users/${id}`, {
      method: "DELETE",
    }),

  getSalespeople: (companyId) => {
    const url = companyId ? `/users/salespeople?company_id=${companyId}` : "/users/salespeople";
    return apiRequest(url);
  },

  getCalendarPrefs: () => apiRequest("/users/me/calendar-prefs"),

  updateCalendarPrefs: (prefs) =>
    apiRequest("/users/me/calendar-prefs", {
      method: "PUT",
      body: JSON.stringify({ prefs }),
    }),
};

/* ============================================================================
   PERMISSION ROLES
============================================================================ */

export const PermissionRolesAPI = {
  getAll: (companyId) => {
    const url = companyId ? `/api/permission-roles?company_id=${companyId}` : "/api/permission-roles";
    return apiRequest(url);
  },

  create: (data) =>
    apiRequest("/api/permission-roles", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    apiRequest(`/api/permission-roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id) =>
    apiRequest(`/api/permission-roles/${id}`, {
      method: "DELETE",
    }),
};

/* ============================================================================
   CREWS
============================================================================ */

export const CrewsAPI = {
  getAll: (companyId) => {
    const url = companyId ? `/api/crews?company_id=${companyId}` : "/api/crews";
    return apiRequest(url);
  },

  create: (data) =>
    apiRequest("/api/crews", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    apiRequest(`/api/crews/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id) =>
    apiRequest(`/api/crews/${id}`, { method: "DELETE" }),

  getLeadAssignments: (companyId) => {
    const url = companyId ? `/api/crews/lead-assignments?company_id=${companyId}` : "/api/crews/lead-assignments";
    return apiRequest(url);
  },

  getLeadIndividualAssignments: (companyId) => {
    const url = companyId ? `/api/crews/lead-individual-assignments?company_id=${companyId}` : "/api/crews/lead-individual-assignments";
    return apiRequest(url);
  },

  addMember: (crewId, userId, isLead = false) =>
    apiRequest(`/api/crews/${crewId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, is_lead: isLead }),
    }),

  updateMember: (crewId, userId, isLead) =>
    apiRequest(`/api/crews/${crewId}/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ is_lead: isLead }),
    }),

  removeMember: (crewId, userId) =>
    apiRequest(`/api/crews/${crewId}/members/${userId}`, { method: "DELETE" }),
};

/* ============================================================================
   LEAD ASSIGNMENTS
============================================================================ */

export const LeadAssignmentsAPI = {
  getAll: (leadId) => apiRequest(`/leads/${leadId}/assignments`),

  addEmployee: (leadId, userId, role = "installer") =>
    apiRequest(`/leads/${leadId}/assignments`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, role }),
    }),

  addCrew: (leadId, crewId, role = "installer") =>
    apiRequest(`/leads/${leadId}/assignments`, {
      method: "POST",
      body: JSON.stringify({ crew_id: crewId, role }),
    }),

  updateRole: (leadId, userId, role) =>
    apiRequest(`/leads/${leadId}/assignments/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),

  remove: (leadId, userId) =>
    apiRequest(`/leads/${leadId}/assignments/${userId}`, { method: "DELETE" }),

  removeCrew: (leadId, crewId) =>
    apiRequest(`/leads/${leadId}/assignments/crew/${crewId}`, { method: "DELETE" }),
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

  phoneLookup: (phone, companyId, excludeLeadId = null) => {
    const params = new URLSearchParams({ phone, company_id: companyId });
    if (excludeLeadId) params.set("exclude_lead_id", excludeLeadId);
    return apiRequest(`/leads/phone-lookup?${params}`);
  },

  getCalendarDots: (companyId) =>
    apiRequest(`/leads/calendar-dots?company_id=${companyId}`),

  checkApptSlot: (companyId, date, time, excludeLeadId = null) => {
    const params = new URLSearchParams({ company_id: companyId, date, time });
    if (excludeLeadId) params.append("exclude_lead_id", excludeLeadId);
    return apiRequest(`/leads/appt-slot-check?${params.toString()}`);
  },

  checkSalesmanConflict: (salesmanUserId, date, time, excludeLeadId = null) => {
    const params = new URLSearchParams({ salesman_user_id: salesmanUserId, date, time });
    if (excludeLeadId) params.append("exclude_lead_id", excludeLeadId);
    return apiRequest(`/leads/salesman-conflict-check?${params.toString()}`);
  },

  getServiceCallsCalendar: (companyId) =>
    apiRequest(`/leads/service-calls-calendar?company_id=${companyId}`),
};

/* ============================================================================
   BIDDER
============================================================================ */

export const BidderAPI = {
  // Proposals
  getProposals: (leadId) => apiRequest(`/api/bidder/proposals/${leadId}`),
  getProposal: (id) => apiRequest(`/api/bidder/proposal/${id}`),
  createProposal: (data) => apiRequest('/api/bidder/proposal', { method: 'POST', body: JSON.stringify(data) }),
  updateProposal: (id, data) => apiRequest(`/api/bidder/proposal/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProposal: (id) => apiRequest(`/api/bidder/proposal/${id}`, { method: 'DELETE' }),

  // Items
  createItem: (data) => apiRequest('/api/bidder/item', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id, data) => apiRequest(`/api/bidder/item/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id) => apiRequest(`/api/bidder/item/${id}`, { method: 'DELETE' }),

  // Custom items
  createCustomItem: (data) => apiRequest('/api/bidder/custom-item', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomItem: (id, data) => apiRequest(`/api/bidder/custom-item/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomItem: (id) => apiRequest(`/api/bidder/custom-item/${id}`, { method: 'DELETE' }),

  // Discounts
  createDiscount: (data) => apiRequest('/api/bidder/discount', { method: 'POST', body: JSON.stringify(data) }),
  updateDiscount: (id, data) => apiRequest(`/api/bidder/discount/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDiscount: (id) => apiRequest(`/api/bidder/discount/${id}`, { method: 'DELETE' }),

  // Library — companyId required when caller is master viewing a specific company
  getLibrary: (companyId) => apiRequest(`/api/bidder/library${companyId ? `?company_id=${companyId}` : ''}`),
  createCategory: (data, companyId) => apiRequest(`/api/bidder/library/category${companyId ? `?company_id=${companyId}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data, companyId) => apiRequest(`/api/bidder/library/category/${id}${companyId ? `?company_id=${companyId}` : ''}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id, companyId) => apiRequest(`/api/bidder/library/category/${id}${companyId ? `?company_id=${companyId}` : ''}`, { method: 'DELETE' }),
  createLibraryItem: (data, companyId) => apiRequest(`/api/bidder/library/item${companyId ? `?company_id=${companyId}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  updateLibraryItem: (id, data, companyId) => apiRequest(`/api/bidder/library/item/${id}${companyId ? `?company_id=${companyId}` : ''}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLibraryItem: (id, companyId) => apiRequest(`/api/bidder/library/item/${id}${companyId ? `?company_id=${companyId}` : ''}`, { method: 'DELETE' }),

  // Company settings
  getCompanySettings: (companyId) => apiRequest(`/api/bidder/company-settings${companyId ? `?company_id=${companyId}` : ''}`),
  updateCompanySettings: (data, companyId) => apiRequest(`/api/bidder/company-settings${companyId ? `?company_id=${companyId}` : ''}`, { method: 'PUT', body: JSON.stringify(data) }),
  saveCompanyColors: (data, companyId) => apiRequest(`/api/bidder/company-colors${companyId ? `?company_id=${companyId}` : ''}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Proposal designs (master only for write, all for read)
  getProposalDesigns: () => apiRequest('/api/bidder/proposal-designs'),
  createProposalDesign: (data) => apiRequest('/api/bidder/proposal-designs', { method: 'POST', body: JSON.stringify(data) }),
  updateProposalDesign: (id, data) => apiRequest(`/api/bidder/proposal-designs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProposalDesign: (id) => apiRequest(`/api/bidder/proposal-designs/${id}`, { method: 'DELETE' }),

  // Payment schedules
  createPayment: (data) => apiRequest('/api/bidder/payment', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id, data) => apiRequest(`/api/bidder/payment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (id) => apiRequest(`/api/bidder/payment/${id}`, { method: 'DELETE' }),

  // Public proposal page
  getPublicProposal: (id) => apiRequest(`/api/bidder/public/${id}`),

  // Send proposal link email to customer
  sendProposalEmail: (id, email, type, invoiceNum = null) => apiRequest(`/api/bidder/proposal/${id}/send-email`, {
    method: 'POST',
    body: JSON.stringify({ ...(email ? { email } : {}), ...(type ? { type } : {}), ...(invoiceNum !== null ? { invoice_num: invoiceNum } : {}) }),
  }),

  // Warranty library
  getWarranties: (companyId) => apiRequest(`/api/bidder/warranties${companyId ? `?company_id=${companyId}` : ''}`),
  createWarranty: (data, companyId) => apiRequest(`/api/bidder/warranties${companyId ? `?company_id=${companyId}` : ''}`, { method: 'POST', body: JSON.stringify(data) }),
  updateWarranty: (id, data, companyId) => apiRequest(`/api/bidder/warranties/${id}${companyId ? `?company_id=${companyId}` : ''}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWarranty: (id, companyId) => apiRequest(`/api/bidder/warranties/${id}${companyId ? `?company_id=${companyId}` : ''}`, { method: 'DELETE' }),
  sendWarrantyEmail: (id, email) => apiRequest(`/api/bidder/proposal/${id}/send-warranty-email`, { method: 'POST', body: JSON.stringify({ email }) }),

  // Global supplier catalog (master-only)
  getGlobalSuppliers: () => apiRequest('/api/bidder/global-suppliers'),
  createGlobalSupplier: (data) => apiRequest('/api/bidder/global-suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateGlobalSupplier: (id, data) => apiRequest(`/api/bidder/global-suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGlobalSupplier: (id) => apiRequest(`/api/bidder/global-suppliers/${id}`, { method: 'DELETE' }),
  getSupplierProducts: (supplierId) => apiRequest(`/api/bidder/global-suppliers/${supplierId}/products`),
  createSupplierProduct: (supplierId, data) => apiRequest(`/api/bidder/global-suppliers/${supplierId}/products`, { method: 'POST', body: JSON.stringify(data) }),
  updateSupplierProduct: (id, data) => apiRequest(`/api/bidder/global-supplier-products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplierProduct: (id) => apiRequest(`/api/bidder/global-supplier-products/${id}`, { method: 'DELETE' }),
};

/* ============================================================================
   GHL
============================================================================ */

export const GhlAPI = {
  getCalendars: (companyId) => {
    const url = companyId ? `/ghl/calendars?company_id=${companyId}` : "/ghl/calendars";
    return apiRequest(url);
  },
};

/* ============================================================================
   TIME TRACKING
============================================================================ */

export const TimeAPI = {
  getJobs: (search) => {
    const url = search ? `/api/time/jobs?search=${encodeURIComponent(search)}` : "/api/time/jobs";
    return apiRequest(url);
  },

  clockIn: (data) =>
    apiRequest("/api/time/clock-in", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  clockOut: (entryId, notes) =>
    apiRequest(`/api/time/clock-out/${entryId}`, {
      method: "PUT",
      body: JSON.stringify(notes ? { notes } : {}),
    }),

  getToday: () => apiRequest("/api/time/today"),

  updateEntry: (entryId, data) =>
    apiRequest(`/api/time/entries/${entryId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getWeek: () => apiRequest("/api/time/week"),

  getLeadEntries: (leadId) => apiRequest(`/api/time/lead/${leadId}`),

  getCompanyEntries: (params = {}) => {
    const q = new URLSearchParams();
    if (params.userId) q.set("user_id", params.userId);
    if (params.start) q.set("start", params.start);
    if (params.end) q.set("end", params.end);
    const qs = q.toString();
    return apiRequest(`/api/time/company${qs ? `?${qs}` : ""}`);
  },
};

function cqUrl(url, companyId) {
  if (!companyId) return url;
  return `${url}${url.includes("?") ? "&" : "?"}company_id=${companyId}`;
}

export const JobReportsAPI = {
  getJobsWithLabor: (companyId, search) => {
    const base = cqUrl("/api/job-reports/jobs-with-labor", companyId);
    const url = search ? `${base}${companyId ? "&" : "?"}search=${encodeURIComponent(search)}` : base;
    return apiRequest(url);
  },

  getSummary: (leadId, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/summary`, companyId)),

  setLaborOverride: (leadId, userId, wage, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/labor-override`, companyId), {
      method: "PUT",
      body: JSON.stringify({ user_id: userId, wage }),
    }),

  getMaterials: (leadId, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/materials`, companyId)),

  addMaterial: (leadId, data, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/materials`, companyId), {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMaterial: (leadId, itemId, data, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/materials/${itemId}`, companyId), {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteMaterial: (leadId, itemId, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/materials/${itemId}`, companyId), {
      method: "DELETE",
    }),

  getLibrary: (companyId) =>
    apiRequest(cqUrl("/api/job-reports/library", companyId)),

  createCategory: (data, companyId) =>
    apiRequest(cqUrl("/api/job-reports/library/categories", companyId), {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createItem: (data, companyId) =>
    apiRequest(cqUrl("/api/job-reports/library/items", companyId), {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCategory: (id, data, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/library/categories/${id}`, companyId), {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteCategory: (id, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/library/categories/${id}`, companyId), {
      method: "DELETE",
    }),

  updateItem: (id, data, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/library/items/${id}`, companyId), {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteItem: (id, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/library/items/${id}`, companyId), {
      method: "DELETE",
    }),

  getUsers: (companyId) =>
    apiRequest(cqUrl("/users", companyId)),

  addManualTime: (leadId, data, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/manual-time`, companyId), {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTimeEntries: (leadId, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/time-entries`, companyId)),

  updateTimeEntry: (leadId, entryId, data, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/time-entries/${entryId}`, companyId), {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTimeEntry: (leadId, entryId, companyId) =>
    apiRequest(cqUrl(`/api/job-reports/${leadId}/time-entries/${entryId}`, companyId), {
      method: "DELETE",
    }),
};