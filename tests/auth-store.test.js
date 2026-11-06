import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthStore } from '../src/backend/auth-store.js';

function memoryFs(initial = '{}') {
  const files = new Map(initial === null ? [] : [['auth-keys.json', initial]]);
  let counter = 0;
  return {
    files,
    async readFile(path) {
      if (!files.has(path)) throw Object.assign(new Error('File not found'), { code: 'ENOENT' });
      return new TextEncoder().encode(files.get(path));
    },
    async makeTempFile() {
      const path = `auth-keys.json.${++counter}`;
      files.set(path, '');
      return {
        path,
        async write(bytes) {
          const part = bytes.subarray(0, Math.min(3, bytes.length));
          files.set(path, files.get(path) + new TextDecoder().decode(part));
          return part.length;
        },
        async close() { this.path = ''; },
      };
    },
    async rename(from, to) {
      files.set(to, files.get(from));
      files.delete(from);
    },
    async remove(path) { files.delete(path); },
  };
}

test('saves, lists, reads and replaces named tokens', async () => {
  const fs = memoryFs();
  const store = createAuthStore(fs);
  await Promise.all([store.save('first', 'token-one'), store.save('__proto__', 'token-two')]);
  assert.deepEqual(await store.list(), ['__proto__', 'first']);
  assert.equal(await store.load('first'), 'token-one');
  assert.equal(await store.load('__proto__'), 'token-two');
  await store.save('first', 'replacement');
  assert.deepEqual(JSON.parse(fs.files.get('auth-keys.json')), { first: 'replacement', ['__proto__']: 'token-two' });
  assert.deepEqual([...fs.files.keys()], ['auth-keys.json']);
  await assert.rejects(store.load('missing'), /No token exists/);
  await assert.rejects(store.save(' ', 'token'), /non-empty name/);
  await assert.rejects(store.save('name', 'bad\ntoken'), /without line breaks/);
});

test('initializes missing and empty files when saving a token', async () => {
  for (const content of [null, '']) {
    const fs = memoryFs(content);
    const store = createAuthStore(fs);
    assert.deepEqual(await store.list(), []);
    assert.equal(fs.files.get('auth-keys.json'), content === null ? undefined : content);
    await store.save('name', 'value');
    assert.deepEqual(JSON.parse(fs.files.get('auth-keys.json')), { name: 'value' });
    assert.equal(await store.load('name'), 'value');
  }
});

test('does not overwrite invalid or incorrectly shaped files', async () => {
  for (const content of [' ', '{', '[]', '{"name":1}', '{"name":""}']) {
    const fs = memoryFs(content);
    const store = createAuthStore(fs);
    await assert.rejects(store.save('name', 'value'));
    assert.equal(fs.files.get('auth-keys.json'), content);
    assert.equal(fs.files.size, 1);
  }
});

test('reports read errors other than missing files', async () => {
  const fs = memoryFs();
  fs.readFile = async () => { throw Object.assign(new Error('Permission denied'), { code: 'EACCES' }); };
  await assert.rejects(createAuthStore(fs).save('name', 'value'), /Permission denied/);
  assert.equal(fs.files.get('auth-keys.json'), '{}');
});

test('reports write failures and preserves the original file', async () => {
  const fs = memoryFs('{"existing":"token"}');
  fs.rename = async () => { throw new Error('rename failed'); };
  await assert.rejects(createAuthStore(fs).save('name', 'value'), /rename failed/);
  assert.equal(fs.files.get('auth-keys.json'), '{"existing":"token"}');
  assert.deepEqual([...fs.files.keys()], ['auth-keys.json']);
});
