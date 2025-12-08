// FILE: controllers/ghlAPI.js (UPDATED – DB → GHL status sync)

const fetch = require('node-fetch');
const db = require('../config/database');

const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1';

// ============================================================================
// HELPERS
// ============================================================================

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (!digits.startsWith('+')) return `+${digits}`;
  return digits;
}

async function ghlRequest(company, endpoint, options = {}) {
  const apiKey = company.api_key;
  const locationId = company.location_id;

  if (!apiKey || !locationId) {
    throw new Error('Missing GHL API key or location ID for company');
  }

  const url = new URL(`${GHL_BASE_URL}${endpoint}`);
  const params = options.params || {};

  if (!params.locationId) params.locationId = locationId;

  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value);
    }
  });

  const fetchOptions = {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url.toString(), fetchOptions);
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    console.error('GHL API Error:', {
      status: res.status,
      endpoint: url.toString(),
      response: data,
    });
    throw new Error(`GHL API error ${res.status}`);
  }

  return data;
}

// ============================================================================
// DB → GHL TAG SYNC (Pipeline Status)
// ============================================================================

function mapStatusToJFTag(status) {
  switch (status) {
    case 'lead':
      return 'JF-Lead';
    case 'appointment_set':
      return 'JF-ApptSet';
    case 'sold':
      return 'JF-Sold';
    case 'complete':
      return 'JF-Complete';
    case 'not_sold':
      return 'JF-NotSold';
    default:
      return 'JF-Lead';
  }
}

async function applyStatusTagsInGHL(contactId, newTag, company) {
  if (!contactId) return;

  try {
    const existing = await ghlRequest(company, `/contacts/${contactId}`, {
      method: 'GET',
    });

    const tags = existing.tags || [];
    const jfTags = [
      'JF-Lead',
      'JF-ApptSet',
      'JF-Sold',
      'JF-Complete',
      'JF-NotSold',
    ];

    const filteredTags = tags.filter((t) => !jfTags.includes(t));
    filteredTags.push(newTag);

    await ghlRequest(company, `/contacts/${contactId}`, {
      method: 'PUT',
      body: { tags: filteredTags },
    });
  } catch (err) {
    console.error('Error applying GHL status tags:', err.message);
  }
}

// ============================================================================
// CONTACT UPSERT (DB → GHL)
// ============================================================================

async function upsertContactFromLead(lead, company) {
  const phone = normalizePhone(lead.phone || lead.phone_number);
  const email = lead.email;

  let existing = null;

  if (phone) {
    try {
      const result = await ghlRequest(company, '/contacts/', {
        method: 'GET',
        params: { query: phone },
      });

      if (Array.isArray(result.contacts) && result.contacts.length > 0) {
        existing = result.contacts[0];
      }
    } catch {}
  }

  if (!existing && email) {
    try {
      const result = await ghlRequest(company, '/contacts/', {
        method: 'GET',
        params: { query: email },
      });

      if (Array.isArray(result.contacts) && result.contacts.length > 0) {
        existing = result.contacts[0];
      }
    } catch {}
  }

  const payload = {
    firstName: lead.first_name || '',
    lastName: lead.last_name || '',
    email: email || '',
    phone: phone || '',
    source: 'JobFlow',
  };

  let contact;

  if (existing && existing.id) {
    contact = await ghlRequest(company, `/contacts/${existing.id}`, {
      method: 'PUT',
      body: payload,
    });
  } else {
    contact = await ghlRequest(company, '/contacts/', {
      method: 'POST',
      body: payload,
    });
  }

  const jfTag = mapStatusToJFTag(lead.status);
  await applyStatusTagsInGHL(contact.id, jfTag, company);

  return contact;
}

// ============================================================================
// PUBLIC EXPORTED API
// ============================================================================

module.exports = {
  syncLeadToGHL: async function (lead, company) {
    try {
      const contact = await upsertContactFromLead(lead, company);

      await db.query(
        `UPDATE leads 
         SET ghl_sync_status = 'success',
             ghl_last_synced = NOW()
         WHERE id = $1`,
        [lead.id]
      );

      return contact;
    } catch (error) {
      console.error('syncLeadToGHL error:', error);

      await db.query(
        `UPDATE leads 
         SET ghl_sync_status = 'error',
             ghl_last_synced = NOW()
         WHERE id = $1`,
        [lead.id]
      );

      throw error;
    }
  },

  searchGHLContactByPhone: async function (phone, company) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;

    return await ghlRequest(company, '/contacts/', {
      method: 'GET',
      params: { query: normalized },
    });
  },

  fetchGHLContact: async function (contactId, company) {
    if (!contactId) return null;

    return await ghlRequest(company, `/contacts/${contactId}`, {
      method: 'GET',
    });
  },
};
