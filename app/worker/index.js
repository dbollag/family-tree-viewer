// Cloudflare Worker: receives feedback from the app and keeps it in KV. Everything else is served from the built site (the ASSETS binding).
// The site sits behind Cloudflare Access, which adds the signed-in person's email as a header; nothing here changes the family data.
const MAX_TEXT = 2000;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/feedback') return env.ASSETS.fetch(request);
    const email = (request.headers.get('Cf-Access-Authenticated-User-Email') || '').toLowerCase();

    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
      const text = clip(body?.text, MAX_TEXT);
      if (!text) return json({ error: 'Empty message' }, 400);
      const about = body?.about && typeof body.about === 'object' ? { id: clip(body.about.id, 20), name: clip(body.about.name, 120) } : null;
      const record = { at: new Date().toISOString(), from: email || null, text, about: about?.id ? about : null, view: clip(body?.view, 20) };
      // newest first when listed: the key counts down from a large number
      const key = `fb:${String(9999999999999 - Date.now()).padStart(13, '0')}:${crypto.randomUUID().slice(0, 8)}`;
      await env.FEEDBACK.put(key, JSON.stringify(record));
      return json({ ok: true }, 201);
    }

    if (request.method === 'GET') {   // only the owner can read what came in
      if (!email || email !== String(env.OWNER_EMAIL || '').toLowerCase()) return json({ error: 'Not allowed' }, 403);
      const { keys } = await env.FEEDBACK.list({ prefix: 'fb:', limit: 200 });
      const items = (await Promise.all(keys.map((k) => env.FEEDBACK.get(k.name)))).filter(Boolean).map((v) => JSON.parse(v));
      return json({ items });
    }

    return json({ error: 'Method not allowed' }, 405);
  }
};
