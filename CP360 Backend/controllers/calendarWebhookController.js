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

const contactId =
  webhookData.contactId ||
  webhookData.contact_id ||
  webhookData.contact?.id;

const ownershipClient = await pool.connect();


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
      

      
const companyResultEarly = await client.query(
  `SELECT id, name, ghl_appt_calendar, ghl_install_calendar 
   FROM companies 
   WHERE ghl_location_id = $1
   LIMIT 1`,
  [locationId]
);

if (companyResultEarly.rows.length !== 1) {
  return res.status(200).json({ success: true });
}

const companyEarly = companyResultEarly.rows[0];

const ownershipCheck = await client.query(
  `SELECT id FROM leads
   WHERE (appointment_calendar_event_id = $1
          OR install_calendar_event_id = $1)
     AND ghl_contact_id = $2
     AND company_id = $3`,
  [eventId, contactId, companyEarly.id]
);

const isUpdate = ownershipCheck.rows.length > 0;

console.log(
  isUpdate
    ? '🔄 [CALENDAR] Update event detected'
    : '🆕 [CALENDAR] New GHL event detected — will create in JF'
);

      
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
      
const company = companyEarly;

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
      lead = null;


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

  // Check if slot already has an event ID (event IDs are permanent)
  if (eventType === 'appointment') {
    const existingEventId = targetLead.appointment_calendar_event_id;
    
    if (existingEventId) {
      console.error(`❌ [CREATE REJECTED] Appointment slot already occupied with event ${existingEventId}`);
      return res.status(400).json({
        error: 'Slot occupied',
        message: 'Lead already has an appointment event ID - cannot create new appointment'
      });
    }
    
    await client.query(
      `UPDATE leads
       SET appointment_calendar_event_id = $1,
           sync_source = 'GHL'
       WHERE id = $2
         AND company_id = $3`,
      [eventId, targetLead.id, company.id]
    );
    console.log(`✅ [CREATE] Appointment event ${eventId} linked to lead ${targetLead.id}`);

  } else if (eventType === 'install') {
    const existingEventId = targetLead.install_calendar_event_id;
    
    if (existingEventId) {
      console.error(`❌ [CREATE REJECTED] Install slot already occupied with event ${existingEventId}`);
      return res.status(400).json({
        error: 'Slot occupied',
        message: 'Lead already has an install event ID - cannot create new install'
      });
    }
    
    await client.query(
      `UPDATE leads
       SET install_calendar_event_id = $1,
           sync_source = 'GHL'
       WHERE id = $2
         AND company_id = $3`,
      [eventId, targetLead.id, company.id]
    );
    console.log(`✅ [CREATE] Install event ${eventId} linked to lead ${targetLead.id}`);
  }

  lead = targetLead;
}

// =======================================================
// UPDATE PATH — Verify event ID matches stored ID
// =======================================================

if (isUpdate && !lead && contactId) {
  console.log('🔄 [UPDATE] Looking up lead by contact ID:', contactId);
  
  const contactResult = await client.query(
    'SELECT * FROM leads WHERE company_id = $1 AND ghl_contact_id = $2',
    [company.id, contactId]
  );
  
  if (contactResult.rows.length > 0) {
    const foundLead = contactResult.rows[0];
    
    // Event ID must match stored event ID (gospel rule)
    const storedEventId = eventType === 'appointment' 
      ? foundLead.appointment_calendar_event_id 
      : foundLead.install_calendar_event_id;
    
    if (!storedEventId) {
      console.error(`❌ [UPDATE REJECTED] Lead ${foundLead.id} has no ${eventType} event ID stored`);
      return res.status(400).json({
        error: 'No event ID stored',
        message: `Lead does not have a ${eventType} event ID stored`
      });
    }
    
    if (storedEventId !== eventId) {
      console.error(`❌ [UPDATE REJECTED] Event ID mismatch for lead ${foundLead.id}`);
      console.error(`   Stored: ${storedEventId}`);
      console.error(`   Incoming: ${eventId}`);
      return res.status(400).json({
        error: 'Event ID mismatch',
        message: 'Incoming event ID does not match stored event ID'
      });
    }
    
    lead = foundLead;
    console.log(`✅ [UPDATE] Event ID verified (${eventId}), updating lead ${lead.id}`);
  }
}

// =======================================================

      
if (!lead) {
  console.log('⚠️ Lead not found — ignoring webhook');
  return res.status(200).json({
    success: true,
    message: 'No matching lead — webhook acknowledged'
  });
}

      
// Prevent duplicate calendar echoes by value comparison
if (isUpdate && startTime) {
  // incoming values
  const incomingDate = startTime.split('T')[0];
  const incomingTime = startTime.split('T')[1] || null;

  // existing values
  let same = false;

  if (eventType === 'appointment' && lead.appointment_date && lead.appointment_time) {
    same =
      lead.appointment_date === incomingDate &&
      lead.appointment_time.startsWith(incomingTime?.substring(0, 5));
  }

  if (eventType === 'install' && lead.install_date) {
    same = lead.install_date === incomingDate;
  }

  if (same) {
    console.log('🔄 [WEBHOOK ECHO] Duplicate calendar event ignored (no change)');
    return res.status(200).json({ success: true });
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
       appointment_calendar_event_id = NULL,
       sync_source = 'GHL'
   WHERE id = $1
     AND company_id = $2`,
  [lead.id, company.id]
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
const appointmentTimestamp = new Date(startTime);
const appointmentTime = appointmentTimestamp.toISOString().substring(11, 19); // HH:MM:SS

await client.query(
  `UPDATE leads 
   SET appointment_date = $1,
       appointment_time = $2::time,
       last_synced_appointment_date = $3,
       last_synced_appointment_time = $2::time,
       sync_source = 'GHL'
   WHERE id = $4
     AND company_id = $5`,
  [
    dateOnly,
    appointmentTime,
    appointmentTimestamp,
    lead.id,
    company.id
  ]
);



        } else if (eventType === 'install') {
await client.query(
  `UPDATE leads 
   SET install_date = $1,
       last_synced_install_date = $1,
       sync_source = 'GHL'
   WHERE id = $2
     AND company_id = $3`,
  [dateOnly, lead.id, company.id]
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