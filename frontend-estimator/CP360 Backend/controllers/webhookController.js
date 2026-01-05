const { pool } = require('../config/database');

const webhookController = {
  // Handle GHL contact webhook
  handleGHLContact: async (req, res) => {
    const client = await pool.connect();
    
    try {
      console.log('📥 GHL Webhook received:', JSON.stringify(req.body, null, 2));
      
      const webhookData = req.body;
      
// DEBUG: Log the entire webhook payload
      console.log('🔍 [WEBHOOK DEBUG] Full webhook received:', JSON.stringify(webhookData, null, 2));
      
      // Extract locationId - check multiple possible locations
      let locationId = webhookData.locationId || 
                       webhookData.customData?.locationId || 
                       webhookData.location?.id;
      
      console.log('🔍 [WEBHOOK DEBUG] Extracted locationId:', locationId);
      
      if (!locationId) {
        console.error('❌ No locationId in webhook payload');
        console.error('❌ Available keys in webhookData:', Object.keys(webhookData));
        return res.status(400).json({ error: 'Missing locationId' });
      }
      
      // Find company by GHL location ID
      const companyResult = await client.query(
        'SELECT id, name FROM companies WHERE ghl_location_id = $1',
        [locationId]
      );
      
      if (companyResult.rows.length === 0) {
        console.error(`❌ No company found for locationId: ${locationId}`);
        return res.status(404).json({ error: 'Company not found for this location' });
      }
      
      const company = companyResult.rows[0];
      console.log(`✅ Found company: ${company.name} (ID: ${company.id})`);
      
      // Extract contact data from webhook
      const contactData = {
        ghl_contact_id: webhookData.id,
        name: `${webhookData.firstName || ''} ${webhookData.lastName || ''}`.trim(),
        phone: webhookData.phone || null,
        email: webhookData.email || null,
        address: webhookData.address1 || null,
        city: webhookData.city || null,
        state: webhookData.state || null,
        zip: webhookData.postalCode || null,
        referral_source: webhookData['contact.jf_lead_source'] || null,
        project_type: webhookData['contact.est_project_type'] || null,
        notes: webhookData['contact.jf_notes'] || null,
      };
      
      console.log('📋 Mapped contact data:', contactData);
      
      // Find existing lead - check ghl_contact_id first, then phone, then email
      let existingLead = null;
      
      if (contactData.ghl_contact_id) {
        const ghlIdResult = await client.query(
          'SELECT * FROM leads WHERE company_id = $1 AND ghl_contact_id = $2',
          [company.id, contactData.ghl_contact_id]
        );
        existingLead = ghlIdResult.rows[0];
        if (existingLead) console.log('✅ Found lead by ghl_contact_id');
      }
      
      if (!existingLead && contactData.phone) {
        const phoneResult = await client.query(
          'SELECT * FROM leads WHERE company_id = $1 AND phone = $2',
          [company.id, contactData.phone]
        );
        existingLead = phoneResult.rows[0];
        if (existingLead) console.log('✅ Found lead by phone');
      }
      
      if (!existingLead && contactData.email) {
        const emailResult = await client.query(
          'SELECT * FROM leads WHERE company_id = $1 AND email = $2',
          [company.id, contactData.email]
        );
        existingLead = emailResult.rows[0];
        if (existingLead) console.log('✅ Found lead by email');
      }
      
      let result;
      const now = new Date();
      
      if (existingLead) {
        // UPDATE existing lead
        console.log(`📝 Updating existing lead ID: ${existingLead.id}`);
        
        // Build update fields - exclude referral_source if already set (write-once)
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;
        
        // Always update these fields
        const fieldsToUpdate = {
          ghl_contact_id: contactData.ghl_contact_id,
          name: contactData.name,
          phone: contactData.phone,
          email: contactData.email,
          address: contactData.address,
          city: contactData.city,
          state: contactData.state,
          zip: contactData.zip,
          project_type: contactData.project_type,
          notes: contactData.notes,
          ghl_last_synced: now
        };
        
        // WRITE-ONCE RULE: Only update referral_source if it's currently empty
        if (!existingLead.referral_source && contactData.referral_source) {
          fieldsToUpdate.referral_source = contactData.referral_source;
          console.log('✍️ Setting referral_source (was empty):', contactData.referral_source);
        } else if (existingLead.referral_source) {
          console.log('🔒 Skipping referral_source (already set):', existingLead.referral_source);
        }
        
        // Build SQL UPDATE statement
        for (const [field, value] of Object.entries(fieldsToUpdate)) {
          updateFields.push(`${field} = $${paramCount}`);
          updateValues.push(value);
          paramCount++;
        }
        
        updateValues.push(existingLead.id); // WHERE clause
        
        result = await client.query(
          `UPDATE leads SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          updateValues
        );
        
        console.log('✅ Lead updated successfully');
        
      } else {
        // CREATE new lead
        console.log('➕ Creating new lead');
        
        result = await client.query(
          `INSERT INTO leads (
            company_id, ghl_contact_id, name, phone, email,
            address, city, state, zip, referral_source, project_type,
            notes, status, ghl_last_synced, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *`,
          [
            company.id,
            contactData.ghl_contact_id,
            contactData.name,
            contactData.phone,
            contactData.email,
            contactData.address,
            contactData.city,
            contactData.state,
            contactData.zip,
            contactData.referral_source,
            contactData.project_type,
            contactData.notes,
            'lead', // Default status
            now,
            now
          ]
        );
        
        console.log('✅ Lead created successfully');
      }
      
      res.status(200).json({
        success: true,
        message: existingLead ? 'Lead updated' : 'Lead created',
        lead_id: result.rows[0].id
      });
      
    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      client.release();
    }
  }
};

module.exports = webhookController;