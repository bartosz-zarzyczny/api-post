import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/frontend/tabs.js';

test('tabs retain independent requests and responses', () => {
  const state = globalThis.createRequestTabs();
  const first = state.active;
  Object.assign(first, { url: 'https://one.example', method: 'POST', headers: 'X-Test: one', body: 'first', curl: 'curl one' });
  first.response = { state: 'sending' };
  const second = state.add();
  assert.equal(state.active, second);
  assert.equal(second.url, '');
  assert.equal(second.method, 'GET');
  second.url = 'https://two.example';
  first.response = { state: 'received', response: { body: 'first response' } };
  assert.equal(state.active, second);
  assert.equal(second.response.state, 'empty');
  state.select(first);
  assert.equal(state.active.url, 'https://one.example');
  assert.equal(state.active.response.response.body, 'first response');
  assert.equal(state.active.curl, 'curl one');
});

test('closing active or inactive tabs keeps a usable active tab', () => {
  const state = globalThis.createRequestTabs();
  const first = state.active;
  const second = state.add();
  const third = state.add();
  state.remove(second);
  assert.equal(state.active, third);
  state.remove(third);
  assert.equal(state.active, first);
  state.remove(first);
  assert.equal(state.tabs.length, 1);
  assert.equal(state.active.name, 'Request 4');
  assert.throws(() => state.select(first), /not found/);
});
