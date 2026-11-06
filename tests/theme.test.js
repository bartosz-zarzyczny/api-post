import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/frontend/theme.js';

function elements() {
  const root = { dataset: {} };
  const message = { textContent: '', hidden: true };
  const selector = {
    value: 'classic',
    disabled: true,
    addEventListener(type, handler) { this.handler = handler; },
  };
  return { root, message, selector };
}

test('loads and persists the selected theme', async () => {
  const ui = elements();
  let saved = 'orange';
  const store = {
    async get(key) { assert.equal(key, 'theme'); return saved; },
    async set(key, value) { assert.equal(key, 'theme'); saved = value; return true; },
  };
  await globalThis.setupTheme({ ...ui, store });
  assert.equal(ui.root.dataset.theme, 'orange');
  assert.equal(ui.selector.disabled, false);
  ui.selector.value = 'classic';
  await ui.selector.handler();
  assert.equal(saved, 'classic');
  assert.equal(ui.root.dataset.theme, 'classic');
  const restarted = elements();
  await globalThis.setupTheme({ ...restarted, store });
  assert.equal(restarted.selector.value, 'classic');
});

test('reports invalid settings and save failures', async () => {
  const ui = elements();
  await globalThis.setupTheme({ ...ui, store: {
    async get() { return 'unknown'; },
    async set() { return false; },
  } });
  assert.match(ui.message.textContent, /invalid/);
  ui.selector.value = 'orange';
  await ui.selector.handler();
  assert.equal(ui.root.dataset.theme, 'orange');
  assert.equal(ui.message.hidden, false);
  assert.match(ui.message.textContent, /could not be saved/);
  assert.equal(ui.selector.disabled, false);
});

test('reports store errors and leaves selector usable', async () => {
  const ui = elements();
  await globalThis.setupTheme({ ...ui, store: {
    async get() { throw new Error('read failed'); },
    async set() { throw new Error('write failed'); },
  } });
  assert.match(ui.message.textContent, /read failed/);
  ui.selector.value = 'orange';
  await ui.selector.handler();
  assert.match(ui.message.textContent, /write failed/);
  assert.equal(ui.selector.disabled, false);
});

test('loads the previously saved theme name as Orange', async () => {
  const ui = elements();
  await globalThis.setupTheme({ ...ui, store: {
    async get() { return 'solarwinds'; },
  } });
  assert.equal(ui.root.dataset.theme, 'orange');
  assert.equal(ui.selector.value, 'orange');
  assert.equal(ui.message.hidden, true);
});
