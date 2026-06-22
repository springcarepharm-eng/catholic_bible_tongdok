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

  const base = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1`;
  console.log('DB base URL:', base);
  const h = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  };

  const { action, user_id } = req.body || {};
  if (!['chanseop', 'soyoun'].includes(user_id)) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }

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
      const r = await fetch(`${base}/entries?on_conflict=user_id,day`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ user_id, day, med: med||'', verse: verse||'', saved_at: saved_at||'' })
      });
      const body = await r.text();
      console.log('save_entry status:', r.status, 'body:', body);
      return res.status(r.ok ? 200 : r.status).json({});
    }

    if (action === 'save_note') {
      const { day, bg, homily } = req.body;
      const r = await fetch(`${base}/notes?on_conflict=user_id,day`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ user_id, day, bg: bg||'', homily: homily||'' })
      });
      return res.status(r.ok ? 200 : r.status).json({});
    }

    if (action === 'save_state') {
      const { completed, completed_dates, start_date, reminder_time } = req.body;
      const r = await fetch(`${base}/user_state?on_conflict=user_id`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ user_id, completed: completed||[], completed_dates: completed_dates||{}, start_date: start_date||'', reminder_time: reminder_time||'22:00' })
      });
      return res.status(r.ok ? 200 : r.status).json({});
    }

    if (action === 'bulk_save') {
      const { entries: ents, notes: nts, state: st } = req.body;
      const reqs = [];
      if (st) reqs.push(fetch(`${base}/user_state?on_conflict=user_id`, { method: 'POST', headers: h, body: JSON.stringify({ user_id, ...st }) }));
      if (ents && ents.length) reqs.push(fetch(`${base}/entries?on_conflict=user_id,day`, { method: 'POST', headers: h, body: JSON.stringify(ents.map(e => ({ user_id, ...e }))) }));
      if (nts && nts.length) reqs.push(fetch(`${base}/notes?on_conflict=user_id,day`, { method: 'POST', headers: h, body: JSON.stringify(nts.map(n => ({ user_id, ...n }))) }));
      await Promise.all(reqs);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
