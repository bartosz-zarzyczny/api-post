export function createAuthStore(fs) {
  const file = 'auth-keys.json';
  let pending = Promise.resolve();

  async function readKeys() {
    let data;
    try {
      data = await fs.readFile(file);
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw new Error(`Cannot read ${file} in the application's working directory: ${error.message}. Create it from auth-keys-example.json.`);
    }

    if (data.length === 0) return {};

    let keys;
    try {
      keys = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
    } catch (error) {
      throw new Error(`${file} must contain a valid JSON object; it was not changed. ${error.message}`);
    }
    if (!keys || typeof keys !== 'object' || Array.isArray(keys) ||
        Object.entries(keys).some(([name, value]) => !name.trim() || typeof value !== 'string' || !value)) {
      throw new Error(`${file} must contain an object mapping non-empty names to non-empty token strings; it was not changed.`);
    }
    return keys;
  }

  function validateName(name) {
    if (typeof name !== 'string' || !name.trim() || name !== name.trim()) {
      throw new Error('Enter a non-empty name without leading or trailing spaces.');
    }
  }

  return {
    async list() {
      return Object.keys(await readKeys()).sort();
    },
    async load(name) {
      validateName(name);
      const keys = await readKeys();
      if (!Object.hasOwn(keys, name)) throw new Error(`No token exists under the name "${name}".`);
      return keys[name];
    },
    async save(name, token) {
      validateName(name);
      if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) {
        throw new Error('Enter a non-empty token without line breaks.');
      }

      const write = pending.then(async () => {
        const keys = await readKeys();
        Object.defineProperty(keys, name, { value: token, enumerable: true, configurable: true, writable: true });
        const temp = await fs.makeTempFile(`${file}.XXXXXX`);
        const tempPath = temp.path;
        try {
          const bytes = new TextEncoder().encode(`${JSON.stringify(keys, null, 2)}\n`);
          let offset = 0;
          while (offset < bytes.length) {
            const written = await temp.write(bytes.subarray(offset));
            if (!written) throw new Error('Could not write the token file.');
            offset += written;
          }
          await temp.close();
          await fs.rename(tempPath, file);
        } catch (error) {
          try {
            await temp.close();
            await fs.remove(tempPath);
          } catch (cleanupError) {
            throw new Error(`Could not save token: ${error.message}. Could not remove temporary file: ${cleanupError.message}`);
          }
          throw error;
        }
      });
      pending = write.catch(() => {});
      await write;
    },
  };
}
