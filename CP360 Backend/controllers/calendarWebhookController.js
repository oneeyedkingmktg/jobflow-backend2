const { pool } = require('../config/database');

const calendarWebhookController = {
  // Handle GHL calendar event webhook (appointments AND installs)
  handleGHLCalendar: async (req, res) => {
    let client;

    
    try {
      console.log('📅 GHL Calendar Webhook received:', JSON.stringify(req.body, null, 2));
      
      const webhookData = req.body;

// =======================================================
// STEP 1 — DETERMINE IF THIS IS CREATE OR UPDATE
// =======================================================

const calendarData = webhookData.calendar || {};
const eventId = calendarData.id || calendarData.eventId;

const ownershipClient = await pool.connect();

const contactId =
  webhookData.contactId ||
  webhookData.contact_id ||
  webhookData.contact?.id;


const ownershipCheck = await ownershipClient.query(
  `SELECT id FROM leads
   WHERE (appointment_calendar_event_id = $1
          OR install_calendar_event_id = $1)
     AND ghl_contact_id = $2`,
  [eventId, contactId]
);

const isUpdate = ownershipCheck.rows.length > 0;


console.log(
  isUpdate
    ? '🔄 [CALENDAR] Update event detected'
    : '🆕 [CALENDAR] New GHL event detected — will create in JF'
);

// DO NOT RETURN HERE — creation is handled later
// =======================================================
// END STEP 1
// =======================================================


      
      // Extract calendar event data - GHL nests it inside 'calendar' object
      
client = await pool.connect();


      const appointmentId = calendarData.appointmentId;
      const calendarName = calendarData.calendarName;

      const startTime = calendarData.startTime || calendarData.start_time;
      const endTime = calendarData.endTime || calendarData.end_time;
      const eventStatus = calendarData.status || calendarData.appointmentStatus;
      
      // Extract locationId
      let locationId = webhookData.locationId || 
                       webhookData.customData?.locationId || 
                       webhookData.location?.id;
      
      console.log('📅 [CALENDAR WEBHOOK] Event ID:', eventId);
      console.log('📅 [CALENDAR WEBHOOK] Appointment ID:', appointmentId);
      console.log('📅 [CALENDAR WEBHOOK] Calendar Name:', calendarName);
      console.log('📅 [CALENDAR WEBHOOK] Contact ID:', contactId);
      console.log('📅 [CALENDAR WEBHOOK] Start Time:', startTime);
      console.log('📅 [CALENDAR WEBHOOK] Status:', eventStatus);
      console.log('📅 [CALENDAR WEBHOOK] Location ID:', locationId);
      

      
      if (!locationId) {
        console.error('❌ No locationId in calendar webhook');
        return res.status(400).json({ error: 'Missing locationId' });
      }
      
      
      console.log('✅ [JOBFLOW EVENT] Event was created by JobFlow - processing');
      
      // Find company by location ID
const companyResult = await client.query(
  `SELECT id, name, ghl_appt_calendar, ghl_install_calendar 
   FROM companies 
   WHERE ghl_location_id = $1
   LIMIT 1`,
  [locationId]
);

if (companyResult.rows.length !== 1) {
  console.error('❌ Invalid company resolution for locationId:', locationId);
  return res.status(200).json({
    success: true,
    message: 'Webhook ignored (company could not be uniquely resolved)'
  });
}

      
      if (companyResult.rows.length === 0) {
        console.error(`❌ No company found for locationId: ${locationId}`);
        return res.status(404).json({ error: 'Company not found' });
      }
      
      const company = companyResult.rows[0];
      console.log(`✅ Found company: ${company.name} (ID: ${company.id})`);
      
      // Determine event type based on calendar name or by checking database
      let eventType = null;
      
      // First try to determine from calendar name
      if (calendarName) {
        const lowerName = calendarName.toLowerCase();
        if (lowerName.includes('appointment') || lowerName.includes('appt') || lowerName.includes('sales')) {
          eventType = 'appointment';
        } else if (lowerName.includes('install')) {
          eventType = 'install';
        }
      }
      
      // If we can't determine from name, check which field in DB has this event ID
      if (!eventType && eventId) {
        const apptCheck = await client.query(
          'SELECT id FROM leads WHERE company_id = $1 AND appointment_calendar_event_id = $2',
          [company.id, eventId]
        );
        
        const installCheck = await client.query(
          'SELECT id FROM leads WHERE company_id = $1 AND install_calendar_event_id = $2',
          [company.id, eventId]
        );
        
        if (apptCheck.rows.length > 0) {
          eventType = 'appointment';
        } else if (installCheck.rows.length > 0) {
          eventType = 'install';
        }
      }
      
      console.log('📅 [CALENDAR WEBHOOK] Event type determined:', eventType);
      
      if (!eventType) {
        console.log('⚠️ Could not determine event type from calendar name or database');
        return res.status(400).json({ error: 'Could not determine event type' });
      }
      
      // Find lead by event ID (we already know it exists from the check above)
      let lead = null;

      // =======================================================
// HARD CREATE GUARD — bypass update/cooldown completely
// =======================================================

if (!isUpdate) {
  console.log('🆕 [CREATE] New GHL event — bypassing update path');

  const leadResult = await client.query(
    `SELECT * FROM leads
     WHERE ghl_contact_id = $1
       AND company_id = $2
     LIMIT 1`,
    [contactId, company.id]
  );

  if (leadResult.rows.length === 0) {
    console.log('⚠️ No lead found for GHL contact — stopping');
    return res.status(200).json({
      success: true,
      message: 'No matching lead found for contact'
    });
  }

  const targetLead = leadResult.rows[0];

  if (eventType === 'appointment') {
    await client.query(
      `UPDATE leads
       SET appointment_calendar_event_id = $1
       WHERE id = $2`,
      [eventId, targetLead.id]
    );
  } else if (eventType === 'install') {
    await client.query(
      `UPDATE leads
       SET install_calendar_event_id = $1
       WHERE id = $2`,
      [eventId, targetLead.id]
    );
  }

console.log(`✅ [CREATE] Event linked to lead ${targetLead.id}`);

// allow flow to continue so dates/times are written below
lead = targetLead;

}

// =======================================================

      
      // =======================================================
// CREATE PATH — GHL CREATED EVENT (no existing JF record)
// =======================================================

if (!isUpdate) {
  console.log('🆕 [CREATE] Creating new calendar event in JF');

  // Find lead by contactId
const leadResult = await client.query(
  `SELECT * FROM leads
   WHERE ghl_contact_id = $1
   LIMIT 1`,
  [contactId]
);



  if (leadResult.rows.length === 0) {
    console.log('⚠️ No lead found for GHL contact — event ignored');
    return res.status(200).json({
      success: true,
      message: 'No matching lead found for contact'
    });
  }

  lead = leadResult.rows[0];

  // Assign calendar event ID to correct field
  if (eventType === 'appointment') {
    await client.query(
      `UPDATE leads
       SET appointment_calendar_event_id = $1
       WHERE id = $2`,
      [eventId, lead.id]
    );
  } else if (eventType === 'install') {
    await client.query(
      `UPDATE leads
       SET install_calendar_event_id = $1
       WHERE id = $2`,
      [eventId, lead.id]
    );
  }

  console.log(`✅ [CREATE] Linked ${eventType} event to lead ${lead.id}`);
}
// =======================================================


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
// Skip cooldown for CREATE events
if (isUpdate) {
  const SYNC_COOLDOWN = 2 * 60 * 1000;
  const lastSyncedField = eventType === 'appointment'
    ? 'last_synced_appointment_date'
    : 'last_synced_install_date';

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
}

      
      // Handle based on event status
      const isCancelled = eventStatus === 'cancelled' || 
                         eventStatus === 'canceled' || 
                         eventStatus === 'deleted' ||
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
  if (client) client.release();
}

  }
};

module.exports = calendarWebhookController;