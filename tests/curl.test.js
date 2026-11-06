import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/frontend/curl.js';

const parseCurl = globalThis.parseCurl;
const exportCurl = globalThis.exportCurl;

test('imports a quoted multiline POST with headers and JSON', () => {
  const command = `curl 'https://example.com/api?x=1&y=2' \\
  -X POST -H 'Content-Type: application/json' \\
  -H "Authorization: Bearer token" --data-raw '{"name":"A B","literal":"$value"}'`;
  assert.deepEqual(parseCurl(command), {
    url: 'https://example.com/api?x=1&y=2',
    method: 'POST',
    headers: 'Content-Type: application/json\nAuthorization: Bearer token',
    body: '{"name":"A B","literal":"$value"}',
  });
});

test('imports URL and option variants, data defaults and HEAD', () => {
  assert.deepEqual(parseCurl('curl --url=https://example.com -HAccept:application/json -d first -d second'), {
    url: 'https://example.com',
    method: 'POST',
    headers: 'Accept: application/json\nContent-Type: application/x-www-form-urlencoded',
    body: 'first&second',
  });
  assert.equal(parseCurl('curl --head https://example.com').method, 'HEAD');
  assert.equal(parseCurl('curl -XPATCH --url "https://example.com" --data-raw "@literal"').body, '@literal');
  assert.equal(parseCurl('curl https://example.com').method, 'GET');
  assert.equal(parseCurl('curl "https://example.com" -d "{\\"text\\": \\"hello\\"}"').body, '{"text": "hello"}');
});

test('rejects unsupported, ambiguous and unsafe commands', () => {
  const cases = [
    ['', /start with curl/],
    ['wget https://example.com', /start with curl/],
    ['curl', /URL is required/],
    ['curl file:///tmp/a', /HTTP and HTTPS/],
    ['curl https://example.com --compressed', /Unsupported cURL option/],
    ['curl https://example.com -d @secret', /from files/],
    ['curl https://example.com -H @headers', /from files/],
    ['curl https://example.com -H "A: 1" -H "a: 2"', /more than once/],
    ['curl https://example.com -H "A:"', /non-empty/],
    ['curl https://example.com -X GET -d test', /combination/],
    ['curl https://example.com -I -X POST', /combination/],
    ['curl https://example.com -X OPTIONS', /Unsupported request method/],
    ['curl https://example.com -X ""', /Unsupported request method/],
    ['curl https://one.example https://two.example', /Only one URL/],
    ['curl https://example.com -H', /Missing value/],
    ['curl "https://example.com', /Unterminated/],
    ['curl https://example.com; echo hello', /Shell operators/],
    ['curl https://example.com -H "Authorization: $TOKEN"', /Shell expansion/],
    ['curl https://example.com\ncurl https://example.org', /multiple commands/],
  ];
  for (const [command, error] of cases) assert.throws(() => parseCurl(command), error, command);
});

test('exports and reimports literal values, headers and body', () => {
  const request = {
    url: 'https://example.com/a?name=one&text=%27quoted%27',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Value': "it's $safe; `literal`", 'X-Empty': '' },
    body: `{"text":"it's $HOME",\n"arg":"@file","slash":"\\\\"}`,
  };
  const command = exportCurl(request);
  assert.match(command, /--globoff --location/);
  assert.deepEqual(parseCurl(command), {
    url: request.url,
    method: request.method,
    headers: "Content-Type: application/json\nX-Value: it's $safe; `literal`\nX-Empty: ",
    body: request.body,
  });
});

test('exports all supported methods and matches body defaults', () => {
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
    const command = exportCurl({ url: 'https://example.com', method, headers: {}, body: 'hello' });
    const request = parseCurl(command);
    assert.equal(request.method, method);
    if (method === 'GET' || method === 'HEAD') {
      assert.equal(request.body, '');
    } else {
      assert.equal(request.body, 'hello');
      assert.equal(request.headers, 'Content-Type: text/plain;charset=UTF-8');
    }
  }
  assert.equal(parseCurl(exportCurl({ url: 'https://example.com', method: 'POST', headers: {}, body: '' })).headers, '');
});

test('rejects request values that cannot be exported faithfully', () => {
  const request = { url: 'https://example.com', method: 'POST', headers: {}, body: '' };
  assert.throws(() => exportCurl({ ...request, url: 'file:///test' }), /HTTP and HTTPS/);
  assert.throws(() => exportCurl({ ...request, url: 'https://user:pass@example.com' }), /credentials/);
  assert.throws(() => exportCurl({ ...request, method: 'OPTIONS' }), /Unsupported request method/);
  assert.throws(() => exportCurl({ ...request, headers: { 'bad name': 'x' } }), /Invalid header/);
  assert.throws(() => exportCurl({ ...request, body: 'x\0y' }), /NUL/);
});
