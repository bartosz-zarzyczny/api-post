const $ = (id) => document.getElementById(id);
const form = $('request-form');
const method = $('method');
const body = $('body');

function updateBodyState() {
  const disabled = method.value === 'GET' || method.value === 'HEAD';
  body.disabled = disabled;
  $('body-help').textContent = disabled
    ? `${method.value} requests do not send a body.`
    : 'The body will be sent exactly as entered.';
}

function parseHeaders(text) {
  const headers = {};
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    if (separator <= 0 || !line.slice(0, separator).trim()) {
      throw new Error(`Invalid header on line ${index + 1}. Use the format "Name: value".`);
    }
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Header "${name}" appears more than once.`);
    }
    Object.defineProperty(headers, name, { value, enumerable: true, configurable: true });
  }
  return headers;
}

function renderBody(text) {
  const output = $('response-body');
  output.replaceChildren();
  let formatted;
  try {
    formatted = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    $('format').textContent = 'TEXT';
    output.textContent = text || '(empty response)';
    return;
  }

  $('format').textContent = 'JSON';
  const tokens = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
  let position = 0;
  for (const match of formatted.matchAll(tokens)) {
    output.append(document.createTextNode(formatted.slice(position, match.index)));
    const span = document.createElement('span');
    span.className = match[1] ? (match[2] ? 'json-key' : 'json-string') : (match[3] ? 'json-number' : 'json-literal');
    span.textContent = match[1] || match[3] || match[4];
    output.append(span);
    if (match[2]) output.append(document.createTextNode(match[2]));
    position = match.index + match[0].length;
  }
  output.append(document.createTextNode(formatted.slice(position)));
}

function clearCurlExport() {
  $('curl-export-output').value = '';
  $('curl-copy').disabled = true;
  $('curl-export-message').hidden = true;
}

for (const id of ['url', 'method', 'headers', 'body']) {
  $(id).addEventListener('input', clearCurlExport);
  $(id).addEventListener('change', clearCurlExport);
}

method.addEventListener('change', updateBodyState);
updateBodyState();

$('curl-import').addEventListener('click', () => {
  const message = $('curl-message');
  try {
    const request = parseCurl($('curl-command').value);
    $('url').value = request.url;
    method.value = request.method;
    $('headers').value = request.headers;
    body.value = request.body;
    updateBodyState();
    clearCurlExport();
    message.textContent = 'Request imported. Review it before sending.';
    message.className = 'curl-message success';
  } catch (error) {
    message.textContent = `Could not import cURL: ${error instanceof Error ? error.message : String(error)}`;
    message.className = 'curl-message import-error';
  }
  message.hidden = false;
});

$('curl-export').addEventListener('click', () => {
  const message = $('curl-export-message');
  clearCurlExport();
  try {
    $('curl-export-output').value = exportCurl({
      url: $('url').value.trim(),
      method: method.value,
      headers: parseHeaders($('headers').value),
      body: body.value,
    });
    $('curl-copy').disabled = false;
    message.textContent = 'Command generated. Review it before sharing or running it.';
    message.className = 'curl-message success';
  } catch (error) {
    message.textContent = `Could not export cURL: ${error instanceof Error ? error.message : String(error)}`;
    message.className = 'curl-message import-error';
  }
  message.hidden = false;
});

$('curl-copy').addEventListener('click', async () => {
  const message = $('curl-export-message');
  try {
    await tiny.clipboard.write({ text: $('curl-export-output').value });
    message.textContent = 'Command copied to the clipboard.';
    message.className = 'curl-message success';
  } catch (error) {
    message.textContent = `Could not copy command: ${error instanceof Error ? error.message : String(error)}`;
    message.className = 'curl-message import-error';
  }
  message.hidden = false;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  $('error').hidden = true;
  $('result').hidden = true;
  $('response-meta').hidden = true;
  $('empty-state').hidden = true;
  $('response-label').textContent = 'SENDING';
  $('send').disabled = true;
  $('send').firstChild.textContent = 'Sending... ';

  try {
    const response = await tiny.api.call('sendRequest', {
      url: $('url').value.trim(),
      method: method.value,
      headers: parseHeaders($('headers').value),
      body: body.value,
    });
    $('status').textContent = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    $('status').className = `status ${response.status >= 400 ? 'status-error' : 'status-ok'}`;
    $('duration').textContent = `${response.duration} ms`;
    $('size').textContent = `${response.size.toLocaleString('en-US')} B`;
    $('response-headers-content').textContent = response.headers.map(([name, value]) => `${name}: ${value}`).join('\n') || '(no headers)';
    renderBody(response.body);
    $('response-meta').hidden = false;
    $('result').hidden = false;
    $('response-label').textContent = 'RECEIVED';
  } catch (error) {
    $('error').textContent = `Could not send request: ${error instanceof Error ? error.message : String(error)}`;
    $('error').hidden = false;
    $('response-label').textContent = 'ERROR';
  } finally {
    $('send').disabled = false;
    $('send').firstChild.textContent = 'Send request ';
  }
});
