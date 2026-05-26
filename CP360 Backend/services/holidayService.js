const axios = require('axios');
const pool  = require('../config/database');

// Nager.Date — free, no API key, US federal holidays
async function fetchAndStoreYear(year) {
  const res = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`, { timeout: 10000 });
  const holidays = res.data; // [{ date, name, ... }]

  for (const h of holidays) {
    await pool.query(
      `INSERT INTO holidays (date, name) VALUES ($1, $2)
       ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name`,
      [h.date, h.name]
    );
  }

  console.log(`✅ Holidays: loaded ${holidays.length} entries for ${year}`);
  return holidays.length;
}

// Called on Jan 1 each year — stores year+1 so we always have 2 years ahead
async function refreshNextYear() {
  const nextYear = new Date().getFullYear() + 1;
  await fetchAndStoreYear(nextYear);
}

// Called once at first deploy — seeds current year and next year
async function seedInitial() {
  const year = new Date().getFullYear();
  await fetchAndStoreYear(year);
  await fetchAndStoreYear(year + 1);
}

module.exports = { fetchAndStoreYear, refreshNextYear, seedInitial };
