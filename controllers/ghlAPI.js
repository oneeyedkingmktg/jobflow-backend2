// controllers/ghlAPI.js

const fetch = require('node-fetch');
const db = require('../config/database');

const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1';

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
  } catch (e) {
    data = text;
  }

  if (!res.ok) {
    console.error('GHL API Error:', {
      status: res.status,
      statusText: res.statusText,
      endpoint: url.toString(),
      response: data,
    });
    throw new Error(`GHL API error ${res.status}`);
  }

  return data;
}

// --------------------------------------------------------
// STATUS → TAG MAP
// --------------------------------------------------------
const STATUS_TAGS = {
  lead: "status - lead",
  appointment_set: "status - appointment set",
  sold: "status - sold",
  not_sold: "status - not sold",
  completed: "status - complete",
};

async function applyStatusTags(contactId, newStatusTag, existingTags, company) {
  const allStatusTags = Object.values(STATUS_TAGS);

  const tagsToRemove = existingTags.filter((t) => allStatusTags.includes(t));

  for (const tag of tagsToRemove) {
    await ghlRequest(company, `/contacts/${contactId}/tags/${encodeURIComponent(tag)}`, {
      method: "DELETE"
    });
  }

  if (newStatusTag) {
    await ghlRequest(company, `/contacts/${contactId}/tags/`, {
      method: "POST",
      body: { tags: [newStatusTag] }
    });
  }
}

// --------------------------------------------------------
// CREATE OR UPDATE CONTACT
// --------------------------------------------------------
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
    } catch (err) {}
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
    } catch (err) {}
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

  const contactId = contact.id;

  const existingTags = Array.isArray(contact.tags) ? contact.tags : [];

  const jfStatus = lead.status;
  const tagToAssign = STATUS_TAGS[jfStatus] || null;

  await applyStatusTags(contactId, tagToAssign, existingTags, company);

  return contact;
}

// --------------------------------------------------------
// PUBLIC EXPORTS
// --------------------------------------------------------
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

    const result = await ghlRequest(company, '/contacts/', {
      method: 'GET',
      params: { query: normalized },
    });

    return result;
  },

  fetchGHLContact: async function (contactId, company) {
    if (!contactId) return null;

    return await ghlRequest(company, `/contacts/${contactId}`, {
      method: 'GET',
    });
  },
};
