import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTabStore } from '../src/backend/tab-store.js';

function fakeFs() {
  const files = new Map();
  let exists = false;
  let sequence = 0;
  const fail = (code) => Object.assign(new Error(code), { code });
  const handle = (path) => ({
    path,
    async write(bytes) { files.set(path, files.get(path) + new TextDecoder().decode(bytes)); return bytes.length; },
    async close() { this.path = ''; },
  });
  return {
    files,
    async makeDir() { if (exists) throw fail('EEXIST'); exists = true; },
    async readDir() {
      if (!exists) throw fail('ENOENT');
      return [...files.keys()].filter((path) => path.startsWith('tabs/'))
        .map((path) => ({ name: path.slice(5), isFile: true }));
    },
    async readFile(path) { if (!files.has(path)) throw fail('ENOENT'); return new TextEncoder().encode(files.get(path)); },
    async open(path) { if (files.has(path)) throw fail('EEXIST'); files.set(path, ''); return handle(path); },
    async makeTempFile(path) { const name = path.replace('XXXXXX', String(++sequence)); files.set(name, ''); return handle(name); },
    async rename(from, to) { files.set(to, files.get(from)); files.delete(from); },
    async remove(path) { files.delete(path); },
  };
}

const request = {
  version: 1, url: 'https://example.com', method: 'POST', headers: 'X-Test: value',
  body: 'hello', curl: 'curl example',
  response: { state: 'received', response: { status: 201, statusText: '', headers: [['x-test', 'ok']], body: '{}', size: 2, duration: 1 } },
};

test('saves, lists, loads and explicitly overwrites tab state', async () => {
  const fs = fakeFs();
  const store = createTabStore(fs);
  assert.deepEqual(await store.list(), []);
  await store.save('First request', request, false);
  assert.deepEqual(await store.list(), ['First request']);
  assert.deepEqual(await store.load('First request'), request);
  await assert.rejects(store.save('First request', request, false), /EEXIST/);
  const updated = { ...request, body: 'updated' };
  await store.save('First request', updated, true);
  assert.deepEqual(await store.load('First request'), updated);
  assert.equal(fs.files.size, 1);
});

test('rejects invalid names and invalid saved state without modifying files', async () => {
  const fs = fakeFs();
  const store = createTabStore(fs);
  for (const name of ['../other', 'folder/name', 'CON', '', ' spaced ', 'x.json']) {
    await assert.rejects(store.save(name, request, false));
  }
  await assert.rejects(store.save('name', { ...request, response: { state: 'sending' } }, false));
  assert.equal(fs.files.size, 0);
  await store.save('good', request, false);
  fs.files.set('tabs/good.json', '{"version":1}');
  await assert.rejects(store.load('good'), /Invalid request tab/);
});

test('cleans up failed writes and keeps the previous file', async () => {
  const fs = fakeFs();
  const store = createTabStore(fs);
  await store.save('good', request, false);
  const original = fs.files.get('tabs/good.json');
  fs.rename = async () => { throw new Error('rename failed'); };
  await assert.rejects(store.save('good', { ...request, body: 'new' }, true), /rename failed/);
  assert.equal(fs.files.get('tabs/good.json'), original);
  assert.equal(fs.files.size, 1);
});
