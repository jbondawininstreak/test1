// DataSearch API client — zero dependencies, uses native fetch

const BASE_URL = 'https://api.global-search.at/v1';

export class ApiError extends Error {
  constructor(status, body) {
    const code = body?.error?.code || `HTTP_${status}`;
    const msg = body?.error?.message || `Request failed with status ${status}`;
    super(msg);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = body?.meta?.request_id || body?.request_id || null;
  }
}

export class DataSearchClient {
  #apiKey;

  constructor(apiKey) {
    if (!apiKey) {
      throw new Error(
        'API key required. Set DATASEARCH_API_KEY or pass --key.\n' +
        'Get your key at https://cabinet.global-search.at'
      );
    }
    this.#apiKey = apiKey;
  }

  async #request(path, params = {}) {
    const url = new URL(BASE_URL + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.#apiKey}`,
        'Accept': 'application/json',
      },
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      throw new ApiError(res.status, body);
    }

    return body;
  }

  // ── System ──────────────────────────────────────────────────────────────

  health() {
    return this.#request('/health');
  }

  me() {
    return this.#request('/me');
  }

  // ── Search (raw records) ────────────────────────────────────────────────

  searchName(q, { limit } = {}) {
    return this.#request('/search/name', { q, limit });
  }

  searchPhone(q, { limit } = {}) {
    return this.#request('/search/phone', { q, limit });
  }

  searchEmail(q, { limit } = {}) {
    return this.#request('/search/email', { q, limit });
  }

  searchId(q, { limit, country } = {}) {
    return this.#request('/search/id', { q, limit, country });
  }

  searchUsername(q, { limit } = {}) {
    return this.#request('/search/username', { q, limit });
  }

  searchDob(q, { limit } = {}) {
    return this.#request('/search/dob', { q, limit });
  }

  searchAddress(q, { limit } = {}) {
    return this.#request('/search/address', { q, limit });
  }

  searchGlobal(q, { limit } = {}) {
    return this.#request('/search/global', { q, limit });
  }

  // ── Messages ────────────────────────────────────────────────────────────

  searchMessages({ q, source, from, to, type, date_from, date_to, page, limit } = {}) {
    return this.#request('/search/messages', { q, source, from, to, type, date_from, date_to, page, limit });
  }

  getThread(source, threadId, { type, limit } = {}) {
    return this.#request('/search/messages/thread', { source, thread_id: threadId, type, limit });
  }

  // ── Dossier (person-grouped) ────────────────────────────────────────────

  dossierPhone(q, { limit } = {}) {
    return this.#request('/dossier/phone', { q, limit });
  }

  dossierEmail(q, { limit } = {}) {
    return this.#request('/dossier/email', { q, limit });
  }

  dossierName(q, { limit } = {}) {
    return this.#request('/dossier/name', { q, limit });
  }

  dossierUsername(q, { limit } = {}) {
    return this.#request('/dossier/username', { q, limit });
  }

  dossierDob(q, { limit } = {}) {
    return this.#request('/dossier/dob', { q, limit });
  }

  dossierAddress(q, { limit } = {}) {
    return this.#request('/dossier/address', { q, limit });
  }

  dossierId(q, { limit, country } = {}) {
    return this.#request('/dossier/id', { q, limit, country });
  }

  dossierGlobal(q, { limit } = {}) {
    return this.#request('/dossier/global', { q, limit });
  }

  // ── Report (full pipeline) ──────────────────────────────────────────────

  reportName(q, { limit } = {}) {
    return this.#request('/report/name', { q, limit });
  }

  reportPhone(q, { limit } = {}) {
    return this.#request('/report/phone', { q, limit });
  }

  reportEmail(q, { limit } = {}) {
    return this.#request('/report/email', { q, limit });
  }

  reportId(q, { limit } = {}) {
    return this.#request('/report/id', { q, limit });
  }

  reportUsername(q, { limit } = {}) {
    return this.#request('/report/username', { q, limit });
  }

  reportDob(q, { limit } = {}) {
    return this.#request('/report/dob', { q, limit });
  }

  reportAddress(q, { limit } = {}) {
    return this.#request('/report/address', { q, limit });
  }

  reportGlobal(q, { limit } = {}) {
    return this.#request('/report/global', { q, limit });
  }
}
