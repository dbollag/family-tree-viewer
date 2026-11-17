import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Local stand-in for the feedback Worker (messages are kept in memory until the dev server stops)
const devFeedback = (): Plugin => ({
  name: 'dev-feedback',
  configureServer(server) {
    const items: unknown[] = [];
    server.middlewares.use('/api/feedback', (req: any, res: any) => {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET') { res.end(JSON.stringify({ items: [...items].reverse() })); return; }
      let body = ''; req.on('data', (c: any) => (body += c));
      req.on('end', () => {
        try { const b = JSON.parse(body); if (!String(b.text || '').trim()) throw new Error('empty'); items.push({ at: new Date().toISOString(), from: 'local', text: String(b.text).slice(0, 2000), about: b.about ?? null, view: b.view ?? '' }); res.statusCode = 201; res.end('{"ok":true}'); }
        catch { res.statusCode = 400; res.end('{"error":"Bad request"}'); }
      });
    });
  }
});

export default defineConfig({ base: process.env.VITE_BASE || '/', plugins: [react(), devFeedback()], server: { host: '127.0.0.1', port: 5173 }, build: { sourcemap: false } });
