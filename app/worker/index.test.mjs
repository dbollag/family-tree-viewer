// Run with: npm run test:worker
import assert from 'node:assert/strict';
import worker from './index.js';

const store = new Map();
const env = {
  OWNER_EMAIL: 'owner@example.com',
  ASSETS: { fetch: async () => new Response('static') },
  FEEDBACK: {
    put: async (k, v) => { store.set(k, v); },
    get: async (k) => store.get(k) ?? null,
    list: async ({ prefix, limit }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit).map((name) => ({ name })) })
  }
};
const call = (method, body, email) => worker.fetch(new Request('https://x.test/api/feedback', { method, body: body === undefined ? undefined : JSON.stringify(body), headers: email ? { 'Cf-Access-Authenticated-User-Email': email } : {} }), env);

assert.equal((await worker.fetch(new Request('https://x.test/'), env)).status, 200);                        // other paths go to the site
assert.equal((await call('POST', { text: '   ' }, 'a@b.c')).status, 400);                                   // empty message
assert.equal((await call('POST', { text: 'Birth year looks wrong', about: { id: 'P02', name: 'Jane Sample' }, view: 'tree' }, 'Grandma@Example.com')).status, 201);
await new Promise((r) => setTimeout(r, 5));
assert.equal((await call('POST', { text: 'x'.repeat(5000) }, 'a@b.c')).status, 201);                         // long messages are cut, not refused
assert.equal((await call('GET', undefined, 'grandma@example.com')).status, 403);                            // only the owner reads
assert.equal((await call('GET', undefined, undefined)).status, 403);
const { items } = await (await call('GET', undefined, 'owner@example.com')).json();
assert.equal(items.length, 2);
assert.equal(items[0].text.length, 2000);                                                                   // newest first
assert.equal(items[1].from, 'grandma@example.com');
assert.deepEqual(items[1].about, { id: 'P02', name: 'Jane Sample' });
assert.equal((await call('DELETE')).status, 405);
console.log('worker ok');
