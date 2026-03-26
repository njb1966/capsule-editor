const api = {
  async _fetch(method, path, body) {
    const opts = { method, credentials: 'include', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    if (res.status === 204) return null;
    const ct = res.headers.get('Content-Type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) throw { status: res.status, error: data?.error || data };
    return data;
  },

  register: (username, email, password) =>
    api._fetch('POST', '/api/register', { username, email, password }),

  verifyEmail: (token) =>
    api._fetch('POST', '/api/verify-email', { token }),

  login: (email, password) =>
    api._fetch('POST', '/api/login', { email, password }),

  logout: () =>
    api._fetch('POST', '/api/logout'),

  requestReset: (email) =>
    api._fetch('POST', '/api/password-reset-request', { email }),

  resetPassword: (token, password) =>
    api._fetch('POST', '/api/password-reset', { token, password }),

  listFiles: (path) =>
    api._fetch('GET', '/api/files?path=' + encodeURIComponent(path || '')),

  readFile: (path) =>
    api._fetch('GET', '/api/files/' + encodeURIComponent(path)),

  writeFile: async (path, content) => {
    const res = await fetch('/api/files/' + encodeURIComponent(path), {
      method: 'PUT',
      credentials: 'include',
      body: content,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw { status: res.status, error: data.error };
    }
    return res.json();
  },

  deleteFile: (path) =>
    api._fetch('DELETE', '/api/files/' + encodeURIComponent(path)),

  renameFile: (old_path, new_path) =>
    api._fetch('POST', '/api/files/rename', { old_path, new_path }),

  mkdir: (path) =>
    api._fetch('POST', '/api/files/mkdir', { path }),

  export: () => {
    window.location.href = '/api/export';
  },

  getAccount: () =>
    api._fetch('GET', '/api/account'),

  deleteAccount: (password) =>
    api._fetch('DELETE', '/api/account', { password }),
};
