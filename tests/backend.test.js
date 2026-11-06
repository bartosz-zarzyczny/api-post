import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { api } from '../src/backend/main.js';

test('backend sends requests and returns HTTP error responses', async (t) => {
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.url === '/missing') {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(201, { 'content-type': 'application/json', 'x-test': 'ok' });
    res.end(JSON.stringify({ method: req.method, header: req.headers['x-custom'], body }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;

  const response = await api.sendRequest({ url: base, method: 'POST', headers: { 'x-custom': 'example' }, body: '{"hello":true}' });
  assert.equal(response.status, 201);
  assert.deepEqual(JSON.parse(response.body), { method: 'POST', header: 'example', body: '{"hello":true}' });
  assert.ok(response.headers.some(([name, value]) => name === 'x-test' && value === 'ok'));
  assert.equal(response.size, new TextEncoder().encode(response.body).length);
  assert.ok(response.duration >= 0);

  const missing = await api.sendRequest({ url: `${base}/missing`, method: 'GET', headers: {}, body: 'ignored' });
  assert.equal(missing.status, 404);
  assert.equal(missing.body, 'Not found');
  await assert.rejects(api.sendRequest({ url: 'file:///test', method: 'GET', headers: {}, body: '' }), /Only HTTP and HTTPS URLs are allowed/);
  await assert.rejects(api.sendRequest({ url: 'not a URL', method: 'GET', headers: {}, body: '' }));
});
