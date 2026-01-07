const { pool } = require('../config/database');

const calendarWebhookController = {
  // Handle GHL calendar event webhook (appointments AND installs)
  handleGHLCalendar: async (req, res) => {
    const client = await pool.connect();
    
    try {
      console.log('📅 GHL Calendar Webhook received:', JSON.stringify(req.body, null, 2));
      
          // 🔍 DEBUG: Log ALL field names so we can find the event ID
    console.log('📅 [DEBUG] Available fields:', Object.keys(req.body));
    console.log('📅 [DEBUG] Full payload:', req.body);
      
      const webhookData = req.body;
      
      // Extract event data (try multiple possible field names)
      const eventId = webhookData.id || webhookData.eventId || webhookData.appointment_id;
      const calendarId = webhookData.calendarId || webhookData.calendar_id;
      const contactId = webhookData.contactId || webhookData.contact_id;
      const startTime = webhookData.startTime || webhookData.start_time || webhookData.appointmentStartTime;
      const eventStatus = webhookData.status || webhookData.appointmentStatus;
      
      // Extract locationId
      let locationId = webhookData.locationId || 
                       webhookData.customData?.locationId || 
                       webhookData.location?.id;
      
      console.log('📅 [CALENDAR WEBHOOK] Event ID:', eventId);
      console.log('📅 [CALENDAR WEBHOOK] Calendar ID:', calendarId);
      console.log('📅 [CALENDAR WEBHOOK] Location ID:', locationId);
      
      if (!eventId) {
        console.error('❌ No event ID in calendar webhook');
        return res.status(400).json({ error: 'Missing event ID' });
      }
      
      if (!locationId) {
        console.error('❌ No locationId in calendar webhook');
        return res.status(400).json({ error: 'Missing locationId' });
      }
      
      // 🔒 OPTION 2: Only process events created by JobFlow
      const eventCheck = await client.query(
        `SELECT id, company_id FROM leads 
         WHERE appointment_calendar_event_id = $1 OR install_calendar_event_id = $1`,
        [eventId]
      );
      
      if (eventCheck.rows.length === 0) {
        console.log('⚠️ [EXTERNAL EVENT] Event not created by JobFlow - ignoring');
        return res.status(200).json({ 
          success: true,
          message: 'External event ignored (not created by JobFlow)' 
        });
      }
      
      console.log('✅ [JOBFLOW EVENT] Event was created by JobFlow - processing');
      
      // Find company by location ID
      const companyResult = await client.query(
        `SELECT id, name, ghl_appt_calendar, ghl_install_calendar 
         FROM companies 
         WHERE ghl_location_id = $1`,
        [locationId]
      );
      
      if (companyResult.rows.length === 0) {
        console.error(`❌ No company found for locationId: ${locationId}`);
        return res.status(404).json({ error: 'Company not found' });
      }
      
      const company = companyResult.rows[0];
      console.log(`✅ Found company: ${company.name} (ID: ${company.id})`);
      
      // Determine event type based on calendar ID
      let eventType = null;
      if (calendarId === company.ghl_appt_calendar) {
        eventType = 'appointment';
      } else if (calendarId === company.ghl_install_calendar) {
        eventType = 'install';
      }
      
      console.log('📅 [CALENDAR WEBHOOK] Event type determined:', eventType);
      
      // Find lead by event ID (we already know it exists from the check above)
      let lead = null;
      
      if (eventType === 'appointment') {
        const apptResult = await client.query(
          'SELECT * FROM leads WHERE company_id = $1 AND appointment_calendar_event_id = $2',
          [company.id, eventId]
        );
        if (apptResult.rows.length > 0) {
          lead = apptResult.rows[0];
          console.log('✅ Found lead by appointment event ID:', lead.id);
        }
      } else if (eventType === 'install') {
        const installResult = await client.query(
          'SELECT * FROM leads WHERE company_id = $1 AND install_calendar_event_id = $2',
          [company.id, eventId]
        );
        if (installResult.rows.length > 0) {
          lead = installResult.rows[0];
          console.log('✅ Found lead by install event ID:', lead.id);
        }
      }
      
      if (!lead) {
        console.log('⚠️ Lead not found (should not happen after event check)');
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Check cooldown to prevent loops (2 minute cooldown)
      const SYNC_COOLDOWN = 2 * 60 * 1000;
      const lastSyncedField = eventType === 'appointment' ? 'last_synced_appointment_date' : 'last_synced_install_date';
      const lastSynced = lead[lastSyncedField];
      
      if (lastSynced) {
        const timeSinceSync = Date.now() - new Date(lastSynced).getTime();
        if (timeSinceSync < SYNC_COOLDOWN) {
          console.log(`🔄 [WEBHOOK ECHO] Ignoring duplicate calendar sync - synced ${Math.round(timeSinceSync / 1000)}s ago`);
          return res.status(200).json({ 
            success: true,
            message: 'Duplicate calendar sync ignored (cooldown period)',
            lead_id: lead.id 
          });
        }
      }
      
      // Handle based on event status
      const isCancelled = eventStatus === 'cancelled' || 
                         eventStatus === 'canceled' || 
                         !startTime;
      
      if (isCancelled) {
        // Event was cancelled or deleted
        console.log(`🗑️ [CALENDAR] Event cancelled for ${eventType}`);
        
        if (eventType === 'appointment') {
          await client.query(
            `UPDATE leads 
             SET appointment_date = NULL,
                 appointment_time = NULL,
                 appointment_calendar_event_id = NULL
             WHERE id = $1`,
            [lead.id]
          );
        } else if (eventType === 'install') {
          await client.query(
            `UPDATE leads 
             SET install_date = NULL,
                 install_calendar_event_id = NULL
             WHERE id = $1`,
            [lead.id]
          );
        }
        
        console.log(`✅ Cleared ${eventType} from lead ${lead.id}`);
        
      } else if (startTime) {
        // Event was created or updated
        const eventDate = new Date(startTime);
        const dateOnly = eventDate.toISOString().split('T')[0];
        const timeOnly = eventDate.toISOString().split('T')[1].substring(0, 5); // HH:MM
        
        console.log(`📅 [CALENDAR] Updating ${eventType} to:`, dateOnly, timeOnly);
        
        if (eventType === 'appointment') {
          await client.query(
            `UPDATE leads 
             SET appointment_date = $1,
                 appointment_time = $2,
                 last_synced_appointment_date = $1,
                 last_synced_appointment_time = $2
             WHERE id = $3`,
            [dateOnly, timeOnly, lead.id]
          );
        } else if (eventType === 'install') {
          await client.query(
            `UPDATE leads 
             SET install_date = $1,
                 last_synced_install_date = $1
             WHERE id = $2`,
            [dateOnly, lead.id]
          );
        }
        
        console.log(`✅ Updated ${eventType} for lead ${lead.id}`);
      }
      
      res.status(200).json({
        success: true,
        message: `${eventType} updated from GHL calendar`,
        lead_id: lead.id,
        event_type: eventType
      });
      
    } catch (error) {
      console.error('❌ Calendar webhook error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      client.release();
    }
  }
};

module.exports = calendarWebhookController;