function tokenizeCurl(command) {
  const tokens = [];
  let token = '';
  let started = false;
  let quote = null;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote === "'") {
      if (char === "'") quote = null;
      else token += char;
      continue;
    }
    if (char === '\\') {
      const next = command[i + 1];
      if (next === undefined) throw new Error('Incomplete escape at the end of the command.');
      if (next === '\n' || (next === '\r' && command[i + 2] === '\n')) {
        i += next === '\r' ? 2 : 1;
      } else if (quote === '"' && !'"\\$`'.includes(next)) {
        token += '\\';
      } else {
        token += next;
        started = true;
        i++;
      }
      continue;
    }
    if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === '$' || char === '`') throw new Error('Shell expansion is not supported. Use literal values.');
      else token += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (char === '\n' || char === '\r') {
      throw new Error('Use a backslash for line continuations; multiple commands are not supported.');
    } else if (/\s/.test(char)) {
      if (started) tokens.push(token);
      token = '';
      started = false;
    } else if (';$`|&<>'.includes(char)) {
      throw new Error('Shell operators and expansions are not supported. Quote literal values.');
    } else {
      token += char;
      started = true;
    }
  }
  if (quote) throw new Error('Unterminated quoted value.');
  if (started) tokens.push(token);
  return tokens;
}

function parseCurl(command) {
  const tokens = tokenizeCurl(command);
  if (tokens.shift() !== 'curl') throw new Error('The command must start with curl.');

  let url;
  let requestMethod;
  let head = false;
  const headers = [];
  const data = [];
  const setUrl = (value) => {
    if (url !== undefined) throw new Error('Only one URL can be imported.');
    url = value;
  };
  const readValue = (option, inline, index) => {
    if (inline !== undefined) return [inline, index];
    if (index + 1 >= tokens.length || tokens[index + 1].startsWith('-')) {
      throw new Error(`Missing value for ${option}.`);
    }
    return [tokens[index + 1], index + 1];
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '-L' || token === '--location' || token === '-g' || token === '--globoff') {
      continue;
    }
    if (token === '-I' || token === '--head') {
      head = true;
      continue;
    }
    let option;
    let inline;
    if (token.startsWith('--')) {
      const equal = token.indexOf('=');
      option = equal === -1 ? token : token.slice(0, equal);
      if (equal !== -1) inline = token.slice(equal + 1);
    } else if (/^-[XHd].+/.test(token)) {
      option = token.slice(0, 2);
      inline = token.slice(2);
    } else {
      option = token;
    }

    if (['-X', '--request', '-H', '--header', '-d', '--data', '--data-raw', '--data-binary', '--url'].includes(option)) {
      let value;
      [value, i] = readValue(option, inline, i);
      if (option === '-X' || option === '--request') {
        if (requestMethod !== undefined) throw new Error('Only one request method can be imported.');
        requestMethod = value;
      } else if (option === '-H' || option === '--header') {
        if (value.startsWith('@')) throw new Error('Headers from files are not supported.');
        const separator = value.indexOf(':');
        const emptyHeader = separator === -1 && value.endsWith(';');
        const name = (emptyHeader ? value.slice(0, -1) : value.slice(0, separator)).trim();
        const headerValue = emptyHeader ? '' : value.slice(separator + 1).trim();
        if ((!emptyHeader && (separator <= 0 || !headerValue)) || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || /[\r\n]/.test(value)) {
          throw new Error('Headers must have a valid name and a non-empty value, or use Name; for an empty value.');
        }
        if (headers.some(([existing]) => existing.toLowerCase() === name.toLowerCase())) {
          throw new Error(`Header "${name}" appears more than once.`);
        }
        headers.push([name, headerValue]);
      } else if (option === '--url') {
        setUrl(value);
      } else {
        if (option !== '--data-raw' && value.startsWith('@')) throw new Error('Request bodies from files are not supported.');
        data.push(value);
      }
    } else if (token.startsWith('-')) {
      throw new Error(`Unsupported cURL option: ${token}`);
    } else {
      setUrl(token);
    }
  }

  if (!url) throw new Error('A URL is required.');
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.');
  const method = requestMethod === undefined ? (head ? 'HEAD' : data.length ? 'POST' : 'GET') : requestMethod;
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) {
    throw new Error(`Unsupported request method: ${method}`);
  }
  if ((head && method !== 'HEAD') || ((method === 'GET' || method === 'HEAD') && data.length)) {
    throw new Error('This combination of method and request body cannot be imported.');
  }
  if (data.length && !headers.some(([name]) => name.toLowerCase() === 'content-type')) {
    headers.push(['Content-Type', 'application/x-www-form-urlencoded']);
  }
  return { url, method, headers: headers.map(([name, value]) => `${name}: ${value}`).join('\n'), body: data.join('&') };
}

function exportCurl({ url, method, headers, body }) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.');
  if (parsedUrl.username || parsedUrl.password) throw new Error('URLs containing credentials cannot be exported.');
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) throw new Error(`Unsupported request method: ${method}`);

  const quote = (value) => {
    if (value.includes('\0')) throw new Error('NUL characters cannot be represented in a shell command.');
    return `'${value.replace(/'/g, "'\\''")}'`;
  };
  const command = ['curl', '--globoff', '--location', `--url=${quote(url)}`];
  if (method === 'HEAD') command.push('--head');
  else command.push(`--request=${quote(method)}`);
  for (const [name, value] of Object.entries(headers)) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || /[\r\n\0]/.test(value)) {
      throw new Error(`Invalid header: ${name}`);
    }
    command.push(`--header=${quote(value ? `${name}: ${value}` : `${name};`)}`);
  }
  if (method !== 'GET' && method !== 'HEAD' && body !== '') {
    if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')) {
      command.push(`--header=${quote('Content-Type: text/plain;charset=UTF-8')}`);
    }
    command.push(`--data-raw=${quote(body)}`);
  }
  return command.join(' ');
}

globalThis.parseCurl = parseCurl;
globalThis.exportCurl = exportCurl;
