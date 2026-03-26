// api/alchemy.js — Vercel Serverless Function
// Proxies requests to Alchemy API so the key stays server-side

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, contractAddress, tokenId, network = 'eth-mainnet', owner, pageKey, pageSize = 50 } = req.query;

  // Use env var if available, fallback to hardcoded key
  const apiKey = process.env.ALCHEMY_API_KEY || '';

  if (!action) {
    return res.status(400).json({ error: 'Missing action param' });
  }

  let url;

  if (action === 'metadata') {
    if (!contractAddress || !tokenId) {
      return res.status(400).json({ error: 'Missing contractAddress or tokenId' });
    }
    url = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?contractAddress=${encodeURIComponent(contractAddress)}&tokenId=${encodeURIComponent(tokenId)}&refreshCache=false`;

  } else if (action === 'wallet') {
    if (!owner || !contractAddress) {
      return res.status(400).json({ error: 'Missing owner or contractAddress' });
    }
    const suffix = pageKey ? `&pageKey=${encodeURIComponent(pageKey)}` : '';
    url = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${encodeURIComponent(owner)}&contractAddresses[]=${encodeURIComponent(contractAddress)}&withMetadata=true&pageSize=${encodeURIComponent(pageSize)}${suffix}`;

  } else {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  try {
    const r = await fetch(url);
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error('Alchemy proxy error:', err);
    return res.status(500).json({ error: 'Alchemy request failed', detail: err.message });
  }
}
