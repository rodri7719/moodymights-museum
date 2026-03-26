// api/opensea.js — Vercel Serverless Function
// Proxies requests to OpenSea API so the key stays server-side
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.OPENSEA_API_KEY || '';
  const { action, limit = 20 } = req.query;

  const headers = { 'accept': 'application/json', 'x-api-key': apiKey };

  let url;
  if (action === 'listings') {
    url = `https://api.opensea.io/api/v2/listings/collection/moody-mights/all?limit=${limit}`;
  } else if (action === 'sales') {
    url = `https://api.opensea.io/api/v2/events/collection/moody-mights?event_type=sale&limit=${limit}`;
  } else {
    return res.status(400).json({ error: 'Missing or unknown action. Use: listings | sales' });
  }

  try {
    const r = await fetch(url, { headers });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error('OpenSea proxy error:', err);
    return res.status(500).json({ error: 'OpenSea request failed', detail: err.message });
  }
}
