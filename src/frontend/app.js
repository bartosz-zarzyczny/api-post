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

method.addEventListener('change', updateBodyState);
updateBodyState();

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
