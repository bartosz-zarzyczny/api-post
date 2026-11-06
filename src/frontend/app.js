const $ = (id) => document.getElementById(id);
const form = $('request-form');
const method = $('method');
const body = $('body');
const requestTabs = createRequestTabs();

setupTheme({
  root: document.documentElement,
  selector: $('theme-select'),
  message: $('theme-message'),
  store: tiny.store,
});

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

function saveActiveTab() {
  Object.assign(requestTabs.active, {
    url: $('url').value,
    method: method.value,
    headers: $('headers').value,
    body: body.value,
    curl: $('curl-command').value,
  });
}

function renderTabs() {
  const container = $('request-tabs');
  container.replaceChildren();
  for (const tab of requestTabs.tabs) {
    const item = document.createElement('div');
    item.className = `request-tab${tab === requestTabs.active ? ' active' : ''}`;
    const select = document.createElement('button');
    select.type = 'button';
    select.textContent = tab.name;
    if (tab === requestTabs.active) select.setAttribute('aria-current', 'page');
    select.addEventListener('click', () => {
      if (tab === requestTabs.active) return;
      saveActiveTab();
      requestTabs.select(tab);
      showActiveTab();
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'close-tab';
    close.textContent = '×';
    close.setAttribute('aria-label', `Close ${tab.name}`);
    close.addEventListener('click', async () => {
      saveActiveTab();
      $('tabs-message').hidden = true;
      close.disabled = true;
      try {
        if ((tab.url || tab.headers || tab.body || tab.curl || tab.method !== 'GET' || tab.response.state !== 'empty') &&
            !(await tiny.dialog.confirm(`Close ${tab.name}?`, { detail: 'The request and response will be discarded.', ok: 'Close', cancel: 'Keep' }))) return;
        if (requestTabs.active !== tab) saveActiveTab();
        requestTabs.remove(tab);
        showActiveTab();
      } catch (error) {
        $('tabs-message').textContent = `Could not close request: ${error instanceof Error ? error.message : String(error)}`;
        $('tabs-message').hidden = false;
      } finally {
        close.disabled = false;
      }
    });
    item.append(select, close);
    container.append(item);
  }
}

function renderResponse(tab) {
  const { state, response, error } = tab.response;
  $('empty-state').hidden = state !== 'empty';
  $('response-meta').hidden = state !== 'received';
  $('result').hidden = state !== 'received';
  $('error').hidden = state !== 'error';
  $('response-label').textContent = { empty: 'WAITING', sending: 'SENDING', received: 'RECEIVED', error: 'ERROR' }[state];
  $('send').disabled = state === 'sending';
  $('send').firstChild.textContent = state === 'sending' ? 'Sending... ' : 'Send request ';
  if (state === 'received') {
    $('status').textContent = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    $('status').className = `status ${response.status >= 400 ? 'status-error' : 'status-ok'}`;
    $('duration').textContent = `${response.duration} ms`;
    $('size').textContent = `${response.size.toLocaleString('en-US')} B`;
    $('response-headers-content').textContent = response.headers.map(([name, value]) => `${name}: ${value}`).join('\n') || '(no headers)';
    renderBody(response.body);
  } else if (state === 'error') {
    $('error').textContent = `Could not send request: ${error}`;
  }
}

function showActiveTab() {
  const tab = requestTabs.active;
  $('url').value = tab.url;
  method.value = tab.method;
  $('headers').value = tab.headers;
  body.value = tab.body;
  $('curl-command').value = tab.curl;
  $('curl-message').hidden = true;
  clearCurlExport();
  updateBodyState();
  renderResponse(tab);
  renderTabs();
}

$('add-request-tab').addEventListener('click', () => {
  saveActiveTab();
  requestTabs.add();
  showActiveTab();
});

function tabNotice(text, error = false) {
  $('tabs-message').hidden = !error;
  $('tabs-status').hidden = error;
  $(error ? 'tabs-message' : 'tabs-status').textContent = text;
}

async function refreshSavedTabs(selected = $('saved-tabs').value) {
  const names = await tiny.api.call('listSavedTabs');
  const select = $('saved-tabs');
  select.replaceChildren(new Option('Select a saved request', ''));
  for (const name of names) select.add(new Option(name, name));
  if (names.includes(selected)) select.value = selected;
  return names;
}

async function withTabFiles(action) {
  const buttons = ['tab-save', 'tab-save-as', 'tab-open', 'tab-refresh'].map($);
  buttons.forEach((button) => { button.disabled = true; });
  $('tabs-message').hidden = true;
  $('tabs-status').hidden = true;
  try {
    await action();
  } catch (error) {
    tabNotice(`Request file operation failed: ${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function saveTab(asNew) {
  saveActiveTab();
  const tab = requestTabs.active;
  if (tab.response.state === 'sending') throw new Error('Wait for the request to finish before saving.');
  const data = JSON.parse(JSON.stringify({
    version: 1, url: tab.url, method: tab.method, headers: tab.headers,
    body: tab.body, curl: tab.curl, response: tab.response,
  }));
  let name = tab.filename;
  let overwrite = Boolean(name);
  if (asNew || !name) {
    name = await tiny.dialog.prompt('Save request as', {
      detail: 'The file can contain tokens and response data.',
      default: name || tab.name,
      ok: 'Save',
    });
    if (name === null) return;
    const names = await tiny.api.call('listSavedTabs');
    const existing = names.find((item) => item.toLowerCase() === name.toLowerCase());
    overwrite = Boolean(existing);
    if (existing) {
      name = existing;
      if (!(await tiny.dialog.confirm(`Replace ${name}.json?`, {
        detail: 'The existing saved request will be overwritten.', ok: 'Replace', cancel: 'Cancel',
      }))) return;
    }
  }
  await tiny.api.call('saveRequestTab', { name, data, overwrite });
  tab.filename = name;
  tab.name = name;
  renderTabs();
  try {
    await refreshSavedTabs(name);
    tabNotice(`Saved ${name}.json.`);
  } catch (error) {
    tabNotice(`Saved ${name}.json, but could not refresh the list: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

$('tab-save').addEventListener('click', () => withTabFiles(() => saveTab(false)));
$('tab-save-as').addEventListener('click', () => withTabFiles(() => saveTab(true)));
$('tab-refresh').addEventListener('click', () => withTabFiles(async () => {
  await refreshSavedTabs();
  tabNotice('Saved request list refreshed.');
}));
$('tab-open').addEventListener('click', () => withTabFiles(async () => {
  const name = $('saved-tabs').value;
  if (!name) throw new Error('Select a saved request.');
  const data = await tiny.api.call('loadSavedTab', { name });
  saveActiveTab();
  const tab = requestTabs.add();
  Object.assign(tab, {
    name, filename: name, url: data.url, method: data.method, headers: data.headers,
    body: data.body, curl: data.curl, response: data.response,
  });
  showActiveTab();
  tabNotice(`Opened ${name}.json in a new tab.`);
}));
withTabFiles(refreshSavedTabs);

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
renderTabs();

function authMessage(text, isError = false) {
  const message = $('auth-message');
  message.textContent = text;
  message.className = `curl-message ${isError ? 'import-error' : 'success'}`;
  message.hidden = false;
}

async function refreshAuthKeys(selected = $('auth-saved').value) {
  const names = await tiny.api.call('listAuthKeys');
  const select = $('auth-saved');
  select.replaceChildren(new Option('Select a token', ''));
  for (const name of names) select.add(new Option(name, name));
  if (names.includes(selected)) select.value = selected;
}

async function withAuthAction(action) {
  const buttons = ['auth-refresh', 'auth-load', 'auth-save', 'auth-use'].map($);
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await action();
  } catch (error) {
    authMessage(`Token operation failed: ${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

$('auth-panel').addEventListener('toggle', () => {
  if ($('auth-panel').open) {
    withAuthAction(async () => {
      await refreshAuthKeys();
      authMessage('Token list loaded.');
    });
  }
});

$('auth-saved').addEventListener('change', () => {
  $('auth-name').value = $('auth-saved').value;
  $('auth-token').value = '';
});

$('auth-refresh').addEventListener('click', () => withAuthAction(async () => {
  await refreshAuthKeys();
  authMessage('Token list loaded.');
}));

$('auth-load').addEventListener('click', () => withAuthAction(async () => {
  const name = $('auth-saved').value;
  if (!name) throw new Error('Select a saved token.');
  const token = await tiny.api.call('loadAuthKey', { name });
  $('auth-name').value = name;
  $('auth-token').value = token;
  authMessage('Token loaded.');
}));

$('auth-save').addEventListener('click', () => withAuthAction(async () => {
  const name = $('auth-name').value;
  await tiny.api.call('saveAuthKey', { name, token: $('auth-token').value });
  try {
    await refreshAuthKeys(name);
    authMessage('Token saved.');
  } catch (error) {
    authMessage(`Token saved, but the list could not be refreshed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}));

$('auth-use').addEventListener('click', () => withAuthAction(async () => {
  const token = $('auth-token').value;
  if (!token || /[\r\n]/.test(token)) throw new Error('Enter or load a token without line breaks.');
  const headers = parseHeaders($('headers').value);
  const existing = Object.keys(headers).find((name) => name.toLowerCase() === 'authorization');
  if (existing) delete headers[existing];
  $('headers').value = [...Object.entries(headers).map(([name, value]) => `${name}: ${value}`), `Authorization: Bearer ${token}`].join('\n');
  clearCurlExport();
  authMessage('Authorization header updated. No request was sent.');
}));

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
  const tab = requestTabs.active;
  saveActiveTab();
  tab.response = { state: 'sending' };
  renderResponse(tab);

  try {
    const response = await tiny.api.call('sendRequest', {
      url: tab.url.trim(),
      method: tab.method,
      headers: parseHeaders(tab.headers),
      body: tab.body,
    });
    tab.response = { state: 'received', response };
  } catch (error) {
    tab.response = { state: 'error', error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (requestTabs.active === tab) renderResponse(tab);
  }
});
