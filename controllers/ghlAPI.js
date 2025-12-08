// controllers/ghlAPI

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

/* -----------------------------------------------------------
   INTERNAL: GHL HTTP WRAPPER
----------------------------------------------------------- */
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

/* -----------------------------------------------------------
   INTERNAL: FIND OR CREATE CONTACT
----------------------------------------------------------- */
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
      if (result.contacts?.length > 0) existing = result.contacts[0];
    } catch (err) {
      console.warn('Search by phone failed:', err.message);
    }
  }

  if (!existing && email) {
    try {
      const result = await ghlRequest(company, '/contacts/', {
        method: 'GET',
        params: { query: email },
      });
      if (result.contacts?.length > 0) existing = result.contacts[0];
    } catch (err) {
      console.warn('Search by email failed:', err.message);
    }
  }

  const payload = {
    firstName: lead.first_name || '',
    lastName: lead.last_name || '',
    email: email || '',
    phone: phone || '',
    source: 'JobFlow',
  };

  if (existing?.id) {
    return await ghlRequest(company, `/contacts/${existing.id}`, {
      method: 'PUT',
      body: payload,
    });
  }

  return await ghlRequest(company, '/contacts/', {
    method: 'POST',
    body: payload,
  });
}

/* -----------------------------------------------------------
   INTERNAL: STATUS → TAG LOGIC
----------------------------------------------------------- */
function getTagForStatus(status) {
  switch (status) {
    case 'lead': return 'Lead';
    case 'appointment_set': return 'Appt Set';
    case 'sold': return 'Sold';
    case 'not_sold': return 'Not Sold';
    case 'completed': return 'Completed';
    default: return null;
  }
}

const ALL_STATUS_TAGS = ['Lead', 'Appt Set', 'Sold', 'Not Sold', 'Completed'];

/* -----------------------------------------------------------
   INTERNAL: APPLY TAGS
----------------------------------------------------------- */
async function applyStatusTag(company, contactId, status) {
  const newTag = getTagForStatus(status);
  if (!newTag) return;

  // 1. Remove all status tags
  for (const tag of ALL_STATUS_TAGS) {
    await ghlRequest(company, `/contacts/${contactId}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE'
    }).catch(() => {});
  }

  // 2. Add the correct tag
  await ghlRequest(company, `/contacts/${contactId}/tags/`, {
    method: 'POST',
    body: { tags: [newTag] }
  });
}

/* -----------------------------------------------------------
   PUBLIC: SYNC FROM DB → GHL
----------------------------------------------------------- */
module.exports = {
  syncLeadToGHL: async function (lead, company) {
    try {
      // Create or update contact
      const contact = await upsertContactFromLead(lead, company);

      // Apply tag based on DB status
      if (lead.status && contact?.id) {
        await applyStatusTag(company, contact.id, lead.status);
      }

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
