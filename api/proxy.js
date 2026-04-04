export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');

  // Only allow our R2 buckets
  const allowed = [
    'pub-9e48c0c112364c929102a426b79d48d8.r2.dev',
    'pub-cc93c3a0717945fb90d8b40577934a22.r2.dev',
  ];
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).send('Invalid url'); }
  if (!allowed.some(h => parsed.hostname === h)) {
    return res.status(403).send('Domain not allowed');
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).send('Upstream error');

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).send('Proxy error');
  }
}
