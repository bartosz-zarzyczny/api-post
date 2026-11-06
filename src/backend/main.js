import { createAuthStore } from './auth-store.js';

const authStore = createAuthStore(globalThis.tjs);

export const api = {
  async listAuthKeys() {
    return authStore.list();
  },
  async loadAuthKey({ name }) {
    return authStore.load(name);
  },
  async saveAuthKey({ name, token }) {
    await authStore.save(name, token);
  },
  async sendRequest({ url, method, headers, body }) {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS URLs are allowed.');
    }

    const started = Date.now();
    const options = { method, headers };
    if (method !== 'GET' && method !== 'HEAD' && body !== '') {
      options.body = body;
    }

    const response = await fetch(parsedUrl.href, options);
    const text = await response.text();
    const responseHeaders = [];
    response.headers.forEach((value, name) => responseHeaders.push([name, value]));

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: text,
      duration: Date.now() - started,
      size: new TextEncoder().encode(text).length,
    };
  },
};
