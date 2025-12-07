// controllers/ghlAPI

const fetch = require('node-fetch');
const db = require('../config/database');

// All GHL calls must use the company's stored API key + locationId
module.exports = {

    /**
     * Sync a lead TO GoHighLevel
     */
    syncLeadToGHL: async function (lead, company) {
        try {
            if (!company.api_key || !company.location_id) {
                console.log("No GHL API key or location ID for company:", company.id);
                await db.query(
                    `UPDATE leads 
                     SET ghl_sync_status = 'missing_api', ghl_last_synced = NOW() 
                     WHERE id = $1`,
                    [lead.id]
                );
                return;
            }

            // Correct GHL contacts API base URL
            const url = "https://rest.gohighlevel.com/v1/contacts/";

            // Build the contact payload
            const payload = {
                firstName: lead.first_name || "",
                lastName: lead.last_name || "",
                email: lead.email || "",
                phone: lead.phone || "",
                companyName: lead.company_name || "",
                address1: lead.address || "",
                city: lead.city || "",
                state: lead.state || "",
                postalCode: lead.zip || "",

                customField: {
                    "contact.buyer_type": lead.buyer_type || "",
                    "contact.project_type": lead.project_type || "",
                    "contact.preferred_means_of_contact": lead.preferred_contact || "",
                    "contact.project_notes": lead.notes || "",
                    "contact.contract_price": lead.contract_price || "",
                    "contact.referral_source": lead.lead_source || "",
                    "contact.customer_business_name": lead.company_name || "",
                    "contact.appointment_date": lead.appointment_date || "",
                },

                // MUST include locationId for creation
                locationId: company.location_id
            };

            // Determine if new contact or update
            let method = "POST";
            let ghlUrl = url;

            if (lead.ghl_contact_id) {
                method = "PUT";
                ghlUrl = `${url}${lead.ghl_contact_id}`;
            }

            // MAIN FIX: Correct headers required by GHL REST API
            const response = await fetch(ghlUrl, {
                method,
                headers: {
                    Authorization: `Bearer ${company.api_key}`,   // FIXED
                    Version: "2021-07-28",                         // FIXED
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("GHL sync failed:", data);
                await db.query(
                    `UPDATE leads 
                     SET ghl_sync_status = 'failed', ghl_last_synced = NOW() 
                     WHERE id = $1`,
                    [lead.id]
                );
                return;
            }

            const newGhlId = data.contact?.id || lead.ghl_contact_id;

            await db.query(
                `UPDATE leads
                 SET ghl_contact_id = $1,
                     ghl_sync_status = 'success',
                     ghl_last_synced = NOW()
                 WHERE id = $2`,
                [newGhlId, lead.id]
            );

            console.log("Lead synced to GHL successfully:", lead.id);

        } catch (err) {
            console.error("GHL sync error:", err);

            await db.query(
                `UPDATE leads 
                 SET ghl_sync_status = 'error', ghl_last_synced = NOW() 
                 WHERE id = $1`,
                [lead.id]
            );
        }
    },

    fetchGHLContact: async function () {
        return null;
    }
};
