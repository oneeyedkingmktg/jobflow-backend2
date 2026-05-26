// One-time script: seeds US federal holidays for the current year and next year.
// Run once after deploying: node scripts/seed-holidays.js
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local' });

const { seedInitial } = require('../services/holidayService');

seedInitial()
  .then(() => { console.log('Seed complete.'); process.exit(0); })
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); });
