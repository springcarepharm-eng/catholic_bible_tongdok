export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const correct = process.env.APP_PIN;
  if (!correct) return res.status(503).json({ error: 'PIN not configured' });

  const { pin } = req.body || {};
  return pin === correct
    ? res.status(200).json({ ok: true })
    : res.status(401).json({ ok: false });
}
