export function createTabStore(fs) {
  const directory = 'tabs';
  const decoder = new TextDecoder('utf-8', { fatal: true });

  function filePath(name) {
    if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,79}$/.test(name) ||
        name !== name.trim() || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) {
      throw new Error('Use a name of up to 80 letters, numbers, spaces, underscores or hyphens.');
    }
    return `${directory}/${name}.json`;
  }

  function validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== 1 ||
        !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(data.method) ||
        ['url', 'headers', 'body', 'curl'].some((key) => typeof data[key] !== 'string') ||
        !data.response || typeof data.response !== 'object') {
      throw new Error('Invalid request tab file.');
    }
    const r = data.response;
    if (r.state === 'empty') return;
    if (r.state === 'error' && typeof r.error === 'string') return;
    const value = r.response;
    if (r.state === 'received' && value && Number.isInteger(value.status) &&
        typeof value.statusText === 'string' && typeof value.body === 'string' &&
        Number.isFinite(value.duration) && Number.isFinite(value.size) &&
        Array.isArray(value.headers) && value.headers.every((item) =>
          Array.isArray(item) && item.length === 2 && item.every((part) => typeof part === 'string'))) return;
    throw new Error('Invalid response in request tab file.');
  }

  async function ensureDirectory() {
    try {
      await fs.makeDir(directory);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async function writeHandle(handle, data) {
    const bytes = new TextEncoder().encode(`${JSON.stringify(data, null, 2)}\n`);
    let offset = 0;
    while (offset < bytes.length) {
      const written = await handle.write(bytes.subarray(offset));
      if (!written) throw new Error('Could not write request tab.');
      offset += written;
    }
    await handle.close();
  }

  return {
    async list() {
      let dir;
      try {
        dir = await fs.readDir(directory);
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
      const names = [];
      for await (const entry of dir) {
        if (!entry.isFile || !entry.name.endsWith('.json')) continue;
        const name = entry.name.slice(0, -5);
        try { filePath(name); } catch { continue; }
        names.push(name);
      }
      return names.sort();
    },
    async load(name) {
      const raw = await fs.readFile(filePath(name));
      let data;
      try {
        data = JSON.parse(decoder.decode(raw));
      } catch (error) {
        throw new Error(`Could not parse request tab: ${error.message}`);
      }
      validate(data);
      return data;
    },
    async save(name, data, overwrite) {
      const path = filePath(name);
      validate(data);
      await ensureDirectory();
      if (!overwrite) {
        const handle = await fs.open(path, 'wx', 0o600);
        try {
          await writeHandle(handle, data);
        } catch (error) {
          try { await handle.close(); await fs.remove(path); }
          catch (cleanupError) { throw new Error(`Could not save request: ${error.message}. Cleanup failed: ${cleanupError.message}`); }
          throw error;
        }
        return;
      }
      const handle = await fs.makeTempFile(`${path}.XXXXXX`);
      const tempPath = handle.path;
      try {
        await writeHandle(handle, data);
        await fs.rename(tempPath, path);
      } catch (error) {
        try { await handle.close(); await fs.remove(tempPath); }
        catch (cleanupError) { throw new Error(`Could not save request: ${error.message}. Cleanup failed: ${cleanupError.message}`); }
        throw error;
      }
    },
  };
}
