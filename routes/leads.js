// ============================================================================
// File: routes/leads.js
// Version: v2.2 - Fix snake_case field reading and add debug logging
// ============================================================================

const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

const clean = (v) => (v === "" || v === undefined ? null : v);

const toCamel = (row) => ({
  id: row.id,
  companyId: row.company_id,
  createdByUserId: row.created_by_user_id,

  name: row.name,
  fullName: row.full_name,
  firstName: row.first_name,
  lastName: row.last_name,

  phone: row.phone,
  email: row.email,
  preferredContact: row.preferred_contact,

  address: row.address,
  city: row.city,
  state: row.state,
  zip: row.zip,

  buyerType: row.buyer_type,
  companyName: row.company_name,
  projectType: row.project_type,

  leadSource: row.lead_source,
  referralSource: row.referral_source,

  status: row.status,
  notSoldReason: row.not_sold_reason,
  notes: row.notes,
  contractPrice: row.contract_price,

  appointmentDate: row.appointment_date,
  appointmentTime: row.appointment_time,
  installDate: row.install_date,
  installTentative: row.install_tentative,

  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function parseName(full) {
  if (!full || !full.trim()) return { first: "", last: "", full: "" };
  const parts = full.trim().split(" ");
  if (parts.length === 1)
    return { first: parts[0], last: "", full: parts[0] };
  return {
    first: parts[0],
    last: parts.slice(1).join(" "),
    full,
  };
}

const validateLead = (lead) => {
  if (!lead.name) return "Name is required.";
  if (!lead.phone) return "Phone is required.";
  return null;
};

// ============================================================================
// GET ALL LEADS - Master sees all, regular users see only their company
// ============================================================================
router.get("/", async (req, res) => {
  try {
    let result;

    if (req.user.role === 'master') {
      // Master admin sees ALL leads from ALL companies
      result = await pool.query(
        `SELECT * FROM leads 
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC`
      );
    } else {
      // Regular users see only their company's leads
      const companyId = req.user.company_id;
      result = await pool.query(
        `SELECT * FROM leads 
         WHERE company_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [companyId]
      );
    }

    res.json({ leads: result.rows.map(toCamel) });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Failed to fetch leads." });
  }
});

// ============================================================================
// GET SINGLE LEAD - Master can view any lead, regular users only their company
// ============================================================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM leads 
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found." });
    }

    const lead = result.rows[0];

    // Non-master users can only view leads from their company
    if (req.user.role !== 'master' && lead.company_id !== req.user.company_id) {
      return res.status(403).json({ error: "Access denied to this lead." });
    }

    res.json({ lead: toCamel(lead) });
  } catch (error) {
    console.error("Error fetching lead:", error);
    res.status(500).json({ error: "Failed to fetch lead." });
  }
});

// ============================================================================
// CREATE LEAD - Master can specify company, regular users use their own
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Master can specify company_id, regular users use their own
    let companyId;
    if (req.user.role === 'master') {
      companyId = req.body.company_id || req.user.company_id;
    } else {
      companyId = req.user.company_id;
    }

    const lead = req.body;
    
    console.log("CREATE LEAD - Body received:", JSON.stringify(lead, null, 2));
    console.log("CREATE LEAD - Company ID:", companyId);
    
    const error = validateLead(lead);
    if (error) return res.status(400).json({ error });

    const { first, last, full } = parseName(lead.name || lead.full_name);
    
    console.log("Parsed name - First:", first, "Last:", last, "Full:", full);

    const result = await pool.query(
      `INSERT INTO leads (
        company_id, created_by_user_id, 
        name, full_name, first_name, last_name,
        phone, email, preferred_contact,
        address, city, state, zip,
        buyer_type, company_name, project_type,
        lead_source, referral_source,
        status, not_sold_reason, notes, contract_price,
        appointment_date, appointment_time,
        install_date, install_tentative
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
      )
      RETURNING *`,
      [
        companyId,
        userId,
        full,
        full,
        first,
        last,
        clean(lead.phone),
        clean(lead.email),
        clean(lead.preferred_contact),
        clean(lead.address),
        clean(lead.city),
        clean(lead.state),
        clean(lead.zip),
        clean(lead.buyer_type),
        clean(lead.company_name),
        clean(lead.project_type),
        clean(lead.lead_source),
        clean(lead.referral_source),
        lead.status || "lead",
        clean(lead.not_sold_reason),
        clean(lead.notes),
        clean(lead.contract_price),
        clean(lead.appointment_date),
        clean(lead.appointment_time),
        clean(lead.install_date),
        lead.install_tentative || false,
      ]
    );

    console.log("CREATE result:", JSON.stringify(result.rows[0], null, 2));

    res.status(201).json({ lead: toCamel(result.rows[0]) });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({ error: "Failed to create lead." });
  }
});

// ============================================================================
// UPDATE LEAD - Master can update any lead, regular users only their company
// ============================================================================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const lead = req.body;

    console.log("UPDATE LEAD - ID:", id);
    console.log("UPDATE LEAD - Body received:", JSON.stringify(lead, null, 2));

    // Verify lead exists and check company access
    const checkResult = await pool.query(
      `SELECT id, company_id FROM leads WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found." });
    }

    const existingLead = checkResult.rows[0];

    // Non-master users can only update leads from their company
    if (req.user.role !== 'master' && existingLead.company_id !== req.user.company_id) {
      return res.status(403).json({ error: "Access denied to this lead." });
    }

    const { first, last, full } = parseName(lead.name || lead.full_name);

    console.log("Parsed name - First:", first, "Last:", last, "Full:", full);

    const result = await pool.query(
      `UPDATE leads SET
        name = COALESCE($1, name),
        full_name = COALESCE($2, full_name),
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        phone = COALESCE($5, phone),
        email = $6,
        preferred_contact = $7,
        address = $8,
        city = $9,
        state = $10,
        zip = $11,
        buyer_type = $12,
        company_name = $13,
        project_type = $14,
        lead_source = $15,
        referral_source = $16,
        status = COALESCE($17, status),
        not_sold_reason = $18,
        notes = $19,
        contract_price = $20,
        appointment_date = $21,
        appointment_time = $22,
        install_date = $23,
        install_tentative = COALESCE($24, install_tentative),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $25
      RETURNING *`,
      [
        full || null,
        full || null,
        first || null,
        last || null,
        clean(lead.phone),
        clean(lead.email),
        clean(lead.preferred_contact),
        clean(lead.address),
        clean(lead.city),
        clean(lead.state),
        clean(lead.zip),
        clean(lead.buyer_type),
        clean(lead.company_name),
        clean(lead.project_type),
        clean(lead.lead_source),
        clean(lead.referral_source),
        lead.status,
        clean(lead.not_sold_reason),
        clean(lead.notes),
        clean(lead.contract_price),
        clean(lead.appointment_date),
        clean(lead.appointment_time),
        clean(lead.install_date),
        lead.install_tentative,
        id,
      ]
    );

    console.log("UPDATE result rows:", result.rows.length);
    if (result.rows.length > 0) {
      console.log("Updated lead:", JSON.stringify(result.rows[0], null, 2));
    }

    res.json({ lead: toCamel(result.rows[0]) });
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({ error: "Failed to update lead." });
  }
});

// ============================================================================
// DELETE LEAD (soft delete) - Master can delete any lead, regular users only their company
// ============================================================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get the lead to check company ownership
    const checkResult = await pool.query(
      `SELECT id, company_id FROM leads WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found." });
    }

    const lead = checkResult.rows[0];

    // Non-master users can only delete leads from their company
    if (req.user.role !== 'master' && lead.company_id !== req.user.company_id) {
      return res.status(403).json({ error: "Access denied to this lead." });
    }

    const result = await pool.query(
      `UPDATE leads 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    res.json({ message: "Lead deleted successfully." });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: "Failed to delete lead." });
  }
});

// ============================================================================
// PHONE LOOKUP - Master searches all companies, regular users their own
// ============================================================================
router.get("/search/phone/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const digits = phone.replace(/\D/g, "");

    let result;

    if (req.user.role === 'master') {
      // Master searches across all companies
      result = await pool.query(
        `SELECT * FROM leads 
         WHERE deleted_at IS NULL
         AND phone LIKE $1
         ORDER BY created_at DESC`,
        [`%${digits}%`]
      );
    } else {
      // Regular users search within their company
      const companyId = req.user.company_id;
      result = await pool.query(
        `SELECT * FROM leads 
         WHERE company_id = $1 
         AND deleted_at IS NULL
         AND phone LIKE $2
         ORDER BY created_at DESC`,
        [companyId, `%${digits}%`]
      );
    }

    res.json({ leads: result.rows.map(toCamel) });
  } catch (error) {
    console.error("Error searching phone:", error);
    res.status(500).json({ error: "Failed to search phone." });
  }
});

module.exports = router;
