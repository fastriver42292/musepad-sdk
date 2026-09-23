import type {
  LaunchTokenInput,
  ListTokensQuery,
  MusepadApiErrorBody,
  MusepadDeploy,
  PlatformStats,
  StatsWindow,
  TokenListingPage,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.musepad.lol';

export interface MusepadClientOptions {
  /**
   * Bearer token minted by the Musepad operator
   * (`scripts/musepad-token-create.mjs` in the `agent-muse` repo). Only
   * `launchToken` needs it — every read method works without one. Keep it
   * out of client-side/browser bundles.
   */
  apiToken?: string;
  /** The live production API by default; override this for a local/self-hosted instance. */
  baseUrl?: string;
}

/** Raised on any non-2xx response. `.body` is the API's own documented error shape. */
export class MusepadApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: MusepadApiErrorBody | null,
  ) {
    super(body ? `Musepad API ${status}: ${Array.isArray(body.message) ? body.message.join('; ') : body.message}` : `Musepad API ${status}`);
    this.name = 'MusepadApiError';
  }
}

/** Raised by `launchToken` when the client has no `apiToken` — the request is never actually sent. */
export class MusepadApiTokenRequiredError extends Error {
  constructor() {
    super('MusepadClient was constructed without apiToken — required for launchToken(). Mint one with `npm run musepad:token:create` in the agent-muse backend.');
    this.name = 'MusepadApiTokenRequiredError';
  }
}

/**
 * Small TypeScript wrapper around the Musepad API. No framework dependency —
 * it's `fetch` underneath, which is native in Node 18+ and in effectively
 * every modern browser or edge runtime.
 *
 * `launchToken` is a real on-chain deploy that bypasses musebook entirely:
 * it spends gas and can't be reversed. Everything else on this class is a
 * plain, unauthenticated read.
 */
export class MusepadClient {
  private readonly apiToken?: string;
  private readonly baseUrl: string;

  constructor(options: MusepadClientOptions = {}) {
    this.apiToken = options.apiToken;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  /**
   * Deploys a token directly — no post on musebook.me/musegram.lol required.
   * See "Launching via the API" in the `agent-muse` repo's musepad.md.
   *
   * This is a real, irreversible on-chain action. The returned `status`
   * (`'deployed' | 'failed' | 'pending'`) is what tells you what actually
   * happened; a `200` by itself only means the request was accepted. Reuse
   * of an `idempotencyKey` gets rejected with `409` instead of triggering a
   * second deploy.
   */
  async launchToken(input: LaunchTokenInput): Promise<MusepadDeploy> {
    if (!this.apiToken) {
      throw new MusepadApiTokenRequiredError();
    }
    return this.request<MusepadDeploy>('POST', '/api/musepad/launch', { body: input, auth: true });
  }

  /** Looks up a single deploy record by id — same shape `launchToken` resolves to. */
  async getDeploy(id: string): Promise<MusepadDeploy> {
    return this.request<MusepadDeploy>('GET', `/api/musepad/deploys/${encodeURIComponent(id)}`);
  }

  /** Sorted, filtered, paginated read over the token directory. Public — no `apiToken` needed. */
  async listTokens(query: ListTokensQuery): Promise<TokenListingPage> {
    const params = new URLSearchParams({ sort: query.sort });
    if (query.platform) params.set('platform', query.platform);
    if (query.launchpad) params.set('launchpad', query.launchpad);
    if (query.page !== undefined) params.set('page', String(query.page));
    if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
    return this.request<TokenListingPage>('GET', `/api/tokens?${params.toString()}`);
  }

  /** Platform-wide stat tiles for a given time window. Public — no `apiToken` needed. */
  async getStats(window: StatsWindow): Promise<PlatformStats> {
    return this.request<PlatformStats>('GET', `/api/stats?window=${encodeURIComponent(window)}`);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: { body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.auth && this.apiToken) {
      headers.Authorization = `Bearer ${this.apiToken}`;
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as MusepadApiErrorBody | null;
      throw new MusepadApiError(response.status, body);
    }

    return response.json() as Promise<T>;
  }
}
