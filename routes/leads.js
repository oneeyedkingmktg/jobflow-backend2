// FILE: leads.js (UPDATED)
const express = require('express');
const router = express.Router();
const db = require('../config/database');

const { authenticateToken } = require('../middleware/auth');
const ghlAPI = require('../controllers/ghlAPI.js');

// Correct middleware
router.use(authenticateToken);

/**
 * GET all leads for this user’s company
 */
router.get('/', async (req, res) => {
    try {
        const companyId = req.user.company_id;

        const result = await db.query(
            `
            SELECT
                *,
                COALESCE(full_name, CONCAT(first_name, ' ', last_name)) AS full_name
            FROM leads
            WHERE company_id = $1
            ORDER BY id DESC
            `,
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

        const full_name = `${first_name || ""} ${last_name || ""}`.trim();
        const name = full_name; // match webhook naming

        const insertQuery = `
            INSERT INTO leads
            (
                company_id,
                first_name,
                last_name,
                full_name,
                name,
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
                appointment_date,
                needs_sync,
                ghl_sync_status
            )
            VALUES
            (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,$17,$18,$19,
                TRUE,'pending'
            )
            RETURNING *;
        `;

        const params = [
            companyId,
            first_name,
            last_name,
            full_name,
            name,
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
        ];

        const result = await db.query(insertQuery, params);
        const lead = result.rows[0];

        res.json(lead);

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
 * UPDATE a lead
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

        const full_name = `${first_name || ""} ${last_name || ""}`.trim();
        const name = full_name;

        const updateQuery = `
            UPDATE leads SET
                first_name = $1,
                last_name = $2,
                full_name = $3,
                name = $4,
                email = $5,
                phone = $6,
                company_name = $7,
                address = $8,
                city = $9,
                state = $10,
                zip = $11,
                buyer_type = $12,
                project_type = $13,
                preferred_contact = $14,
                notes = $15,
                contract_price = $16,
                lead_source = $17,
                appointment_date = $18,
                needs_sync = TRUE,
                ghl_sync_status = 'pending'
            WHERE id = $19 AND company_id = $20
            RETURNING *;
        `;

        const params = [
            first_name,
            last_name,
            full_name,
            name,
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
            appointment_date,
            leadId,
            companyId
        ];

        const result = await db.query(updateQuery, params);
        const updatedLead = result.rows[0];

        if (!updatedLead) {
            return res.status(404).json({ error: "Lead not found" });
        }

        res.json(updatedLead);

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
