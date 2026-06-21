export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-pin');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const appPin = process.env.APP_PIN;
  if (appPin && req.headers['x-app-pin'] !== appPin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'DB not configured' });
  }

  const base = `${SUPABASE_URL}/rest/v1`;
  const h = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  const { action, user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    if (action === 'load') {
      const [er, nr, sr] = await Promise.all([
        fetch(`${base}/entries?user_id=eq.${user_id}&select=*`, { headers: h }),
        fetch(`${base}/notes?user_id=eq.${user_id}&select=*`, { headers: h }),
        fetch(`${base}/user_state?user_id=eq.${user_id}&select=*`, { headers: h })
      ]);
      const [entries, notes, stateArr] = await Promise.all([er.json(), nr.json(), sr.json()]);
      return res.status(200).json({ entries, notes, state: stateArr[0] || null });
    }

    if (action === 'save_entry') {
      const { day, med, verse, saved_at } = req.body;
      const r = await fetch(`${base}/entries`, {
        method: 'POST',
        headers: { ...h, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id, day, med: med||'', verse: verse||'', saved_at: saved_at||'' })
      });
      return res.status(r.ok ? 200 : r.status).json({});
    }

    if (action === 'save_note') {
      const { day, bg, homily } = req.body;
      const r = await fetch(`${base}/notes`, {
        method: 'POST',
        headers: { ...h, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id, day, bg: bg||'', homily: homily||'' })
      });
      return res.status(r.ok ? 200 : r.status).json({});
    }

    if (action === 'save_state') {
      const { completed, completed_dates, start_date, reminder_time } = req.body;
      const r = await fetch(`${base}/user_state`, {
        method: 'POST',
        headers: { ...h, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id, completed: completed||[], completed_dates: completed_dates||{}, start_date: start_date||'', reminder_time: reminder_time||'22:00' })
      });
      return res.status(r.ok ? 200 : r.status).json({});
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
