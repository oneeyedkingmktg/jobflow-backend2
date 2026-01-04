// test-webhook.js - Production test

const https = require('https');

const testPayload = {
  locationId: "34aDq5td6waKO9PI60IX",
  id: "production-test-789",
  firstName: "Sarah",
  lastName: "Johnson",
  phone: "+15558887777",
  email: "sarah@prodtest.com",
  address1: "456 Production Ave",
  city: "Naperville",
  state: "IL",
  postalCode: "60540",
  "contact.jf_lead_source": "Estimator",
  "contact.est_project_type": "Metallic Floor",
  "contact.jf_notes": "Production webhook test"
};

const data = JSON.stringify(testPayload);

const options = {
  hostname: 'jobflow-backend-tw5u.onrender.com',
  port: 443,
  path: '/api/webhooks/ghl/contact',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Sending webhook test to https://jobflow-backend-tw5u.onrender.com/api/webhooks/ghl/contact');
console.log('Payload:', testPayload);
console.log('');

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
    try {
      const parsed = JSON.parse(responseData);
      console.log('Parsed:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Could not parse response as JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Request Error:', error.message);
});

req.write(data);
req.end();