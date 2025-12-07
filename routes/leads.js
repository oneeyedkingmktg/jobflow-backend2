// routes/leads.js

const express = require('express');
const router = express.Router();
const db = require('../config/database');


const ghlAPI = require('../controllers/ghlAPI.js');

// Must be authenticated
router.use(authMiddleware);

/**
 * GET all leads for this user’s company
 */
router.get('/', async (req, res) => {
    try {
        const companyId = req.user.company_id;

        const result = await db.query(
            `SELECT * FROM leads WHERE company_id = $1 ORDER BY id DESC`,
            [companyId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching leads:", error);
        res.status(500).json({ error: "Failed to fetch leads" });
    }
});


/**
 * CREATE a new lead
 */
router.post('/', async (req, res) => {
    try {
        const companyId = req.user.company_id;

        const {
            first_name,
            last_name,
            email,
            phone,
            company_name,
            address,
            city,
            state,
            zip,
            buyer_type,
            project_type,
            preferred_contact,
            notes,
            contract_price,
            lead_source,
            appointment_date
        } = req.body;

        const insertQuery = `
            INSERT INTO leads
            (company_id, first_name, last_name, email, phone, company_name, address, city, state, zip, 
             buyer_type, project_type, preferred_contact, notes, contract_price, lead_source, appointment_date,
             needs_sync, ghl_sync_status)
            VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17,
             TRUE, 'pending')
            RETURNING *;
        `;

        const params = [
            companyId, first_name, last_name, email, phone, company_name, address, city, state, zip,
            buyer_type, project_type, preferred_contact, notes, contract_price, lead_source, appointment_date
        ];

        const result = await db.query(insertQuery, params);
        const lead = result.rows[0];

        res.json(lead);  // FRONTEND RETURNS IMMEDIATELY

        // Fire-and-forget GHL sync (non-blocking)
        setImmediate(async () => {
            try {
                const company = await db.query(
                    `SELECT * FROM companies WHERE id = $1`,
                    [companyId]
                );
                await ghlAPI.syncLeadToGHL(lead, company.rows[0]);
            } catch (err) {
                console.error("Async GHL sync error (create):", err);
            }
        });

    } catch (error) {
        console.error("Error creating lead:", error);
        res.status(500).json({ error: "Failed to create lead" });
    }
});


/**
 * UPDATE an existing lead
 */
router.put('/:id', async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const leadId = req.params.id;

        const {
            first_name,
            last_name,
            email,
            phone,
            company_name,
            address,
            city,
            state,
            zip,
            buyer_type,
            project_type,
            preferred_contact,
            notes,
            contract_price,
            lead_source,
            appointment_date
        } = req.body;

        const updateQuery = `
            UPDATE leads SET
                first_name = $1,
                last_name = $2,
                email = $3,
                phone = $4,
                company_name = $5,
                address = $6,
                city = $7,
                state = $8,
                zip = $9,
                buyer_type = $10,
                project_type = $11,
                preferred_contact = $12,
                notes = $13,
                contract_price = $14,
                lead_source = $15,
                appointment_date = $16,
                needs_sync = TRUE,
                ghl_sync_status = 'pending'
            WHERE id = $17 AND company_id = $18
            RETURNING *;
        `;

        const params = [
            first_name, last_name, email, phone, company_name, address, city, state, zip,
            buyer_type, project_type, preferred_contact, notes, contract_price, lead_source, appointment_date,
            leadId, companyId
        ];

        const result = await db.query(updateQuery, params);
        const updatedLead = result.rows[0];

        if (!updatedLead) {
            return res.status(404).json({ error: "Lead not found" });
        }

        res.json(updatedLead); // FRONTEND DOES NOT WAIT FOR GHL

        // Fire-and-forget GHL sync
        setImmediate(async () => {
            try {
                const company = await db.query(
                    `SELECT * FROM companies WHERE id = $1`,
                    [companyId]
                );
                await ghlAPI.syncLeadToGHL(updatedLead, company.rows[0]);
            } catch (err) {
                console.error("Async GHL sync error (update):", err);
            }
        });

    } catch (error) {
        console.error("Error updating lead:", error);
        res.status(500).json({ error: "Failed to update lead" });
    }
});


module.exports = router;
