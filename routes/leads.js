const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

// ============================================================================
// Helper: Normalize Name Fields
// ============================================================================
function parseName(fullName) {
  if (!fullName) return { first_name: "", last_name: "", full_name: "" };
  const parts = fullName.trim().split(" ");
  const first = parts.shift() || "";
  const last = parts.join(" ");
  return {
    first_name: first,
    last_name: last,
    full_name: fullName.trim(),
  };
}

// ============================================================================
// GET ALL LEADS (For Logged-In Company)
// ============================================================================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;

    const result = await pool.query(
      `
      SELECT *
      FROM leads
      WHERE company_id = $1
      ORDER BY created_at DESC
      `,
      [company_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET SINGLE LEAD
// ============================================================================
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.user;

    const result = await pool.query(
      `SELECT * FROM leads WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// CREATE LEAD
// ============================================================================
router.post("/", authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const { company_id, id: user_id } = req.user;

    const nameParts = parseName(data.name);

    const result = await pool.query(
      `
      INSERT INTO leads (
        company_id,
        created_by_user_id,
        name,
        full_name,
        first_name,
        last_name,
        phone,
        email,
        address,
        city,
        state,
        zip,
        buyer_type,
        company_name,
        project_type,
        lead_source,
        referral_source,
        status,
        not_sold_reason,
        contract_price,
        appointment_date,
        preferred_contact,
        notes,
        install_date,
        install_tentative,
        needs_sync
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,
        $24,$25,$26
      )
      RETURNING *
      `,
      [
        company_id,
        user_id,

        data.name || "",
        nameParts.full_name,
        nameParts.first_name,
        nameParts.last_name,

        data.phone || "",
        data.email || "",
        data.address || "",
        data.city || "",
        data.state || "",
        data.zip || "",

        data.buyer_type || "",
        data.company_name || "",
        data.project_type || "",
        data.lead_source || "",
        data.referral_source || "",

        data.status || "Lead",
        data.not_sold_reason || "",
        data.contract_price || null,

        data.appointment_date || null,
        data.preferred_contact || "",
        data.notes || "",

        data.install_date || null,
        data.install_tentative || false,

        false // needs_sync OFF because no GHL
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("CREATE ERROR", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// UPDATE LEAD
// ============================================================================
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const { company_id } = req.user;

    const nameParts = parseName(data.name);

    const result = await pool.query(
      `
      UPDATE leads SET
        name = $1,
        full_name = $2,
        first_name = $3,
        last_name = $4,
        phone = $5,
        email = $6,
        address = $7,
        city = $8,
        state = $9,
        zip = $10,
        buyer_type = $11,
        company_name = $12,
        project_type = $13,
        lead_source = $14,
        referral_source = $15,
        status = $16,
        not_sold_reason = $17,
        contract_price = $18,
        appointment_date = $19,
        preferred_contact = $20,
        notes = $21,
        install_date = $22,
        install_tentative = $23,
        updated_at = NOW()
      WHERE id = $24 AND company_id = $25
      RETURNING *
      `,
      [
        data.name || "",
        nameParts.full_name,
        nameParts.first_name,
        nameParts.last_name,

        data.phone || "",
        data.email || "",
        data.address || "",
        data.city || "",
        data.state || "",
        data.zip || "",

        data.buyer_type || "",
        data.company_name || "",
        data.project_type || "",
        data.lead_source || "",
        data.referral_source || "",

        data.status || "Lead",
        data.not_sold_reason || "",
        data.contract_price || null,

        data.appointment_date || null,
        data.preferred_contact || "",
        data.notes || "",

        data.install_date || null,
        data.install_tentative || false,

        id,
        company_id
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE ERROR", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE LEAD
// ============================================================================
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.user;

    await pool.query(`DELETE FROM leads WHERE id = $1 AND company_id = $2`, [
      id,
      company_id,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
