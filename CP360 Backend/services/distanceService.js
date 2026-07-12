const https = require('https');

/**
 * Returns estimated drive time in minutes from originAddress to destinationZip.
 * Uses Google Maps Distance Matrix API.
 * Returns null if the API call fails or no result is available.
 */
async function getDriveTime(originAddress, destinationZip) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[distanceService] GOOGLE_MAPS_API_KEY not set');
    return null;
  }
  if (!originAddress || !destinationZip) return null;

  const origin = encodeURIComponent(originAddress);
  const destination = encodeURIComponent(destinationZip);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=driving&key=${apiKey}`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const element = parsed?.rows?.[0]?.elements?.[0];
          if (element?.status === 'OK' && element?.duration?.value) {
            resolve(Math.round(element.duration.value / 60));
          } else {
            console.warn('[distanceService] No result:', element?.status, destinationZip);
            resolve(null);
          }
        } catch (e) {
          console.error('[distanceService] Parse error:', e.message);
          resolve(null);
        }
      });
    }).on('error', (e) => {
      console.error('[distanceService] Request error:', e.message);
      resolve(null);
    });
  });
}

module.exports = { getDriveTime };
