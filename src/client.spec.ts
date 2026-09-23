import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MusepadApiError, MusepadApiTokenRequiredError, MusepadClient } from './client.js';
import type { MusepadDeploy } from './types.js';

const DEPLOY: MusepadDeploy = {
  id: '66d1f2b8c1a4e5f6a7b8c9d0',
  sourcePlatform: 'api',
  sourceThreadId: 'my-key-1',
  sourceChannel: 'some-agent',
  sourceThreadTitle: 'Launched via Musepad API',
  sourceThreadUrl: 'https://api.musepad.lol/api/musepad/deploys/66d1f2b8c1a4e5f6a7b8c9d0',
  sourceAuthor: 'some-agent',
  token: { name: 'Test', symbol: 'TEST', wallet: '0xabc', paypal: null, description: '', imageUrl: null },
  status: 'deployed',
  deployTxHash: '0xtx',
  deployedTokenAddress: '0xtoken',
  deployError: null,
  replyPostId: null,
  createdAt: '2026-09-23T00:00:00.000Z',
  updatedAt: '2026-09-23T00:00:00.000Z',
};

describe('MusepadClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('launchToken', () => {
    it('throws MusepadApiTokenRequiredError and never calls fetch when no apiToken was configured', async () => {
      const client = new MusepadClient();

      await expect(client.launchToken({ name: 'Test', symbol: 'TEST', wallet: '0xabc', idempotencyKey: 'k' })).rejects.toThrow(
        MusepadApiTokenRequiredError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the Authorization header and JSON body, and returns the parsed deploy', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(DEPLOY), { status: 200 }));
      const client = new MusepadClient({ apiToken: 'musepad_live_abc' });

      const result = await client.launchToken({ name: 'Test', symbol: 'TEST', wallet: '0xabc', idempotencyKey: 'k' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.musepad.lol/api/musepad/launch',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer musepad_live_abc', 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name: 'Test', symbol: 'TEST', wallet: '0xabc', idempotencyKey: 'k' }),
        }),
      );
      expect(result).toEqual(DEPLOY);
    });

    it('throws MusepadApiError with the response status and body on a non-2xx response', async () => {
      const errorBody = { statusCode: 409, error: 'CONFLICT', message: 'already used', path: '/api/musepad/launch', timestamp: 'now' };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 409 }));
      const client = new MusepadClient({ apiToken: 'musepad_live_abc' });

      let caught: unknown;
      await client.launchToken({ name: 'Test', symbol: 'TEST', wallet: '0xabc', idempotencyKey: 'k' }).catch((e: unknown) => {
        caught = e;
      });

      expect(caught).toBeInstanceOf(MusepadApiError);
      const error = caught as MusepadApiError;
      expect(error.status).toBe(409);
      expect(error.body).toEqual(errorBody);
    });
  });

  describe('getDeploy', () => {
    it('fetches by id, URL-encoded, with no Authorization header', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(DEPLOY), { status: 200 }));
      const client = new MusepadClient();

      await client.getDeploy('66d1f2b8c1a4e5f6a7b8c9d0');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.musepad.lol/api/musepad/deploys/66d1f2b8c1a4e5f6a7b8c9d0');
      expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    });
  });

  describe('listTokens', () => {
    it('builds the query string from every given filter', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1 }), { status: 200 }));
      const client = new MusepadClient();

      await client.listTokens({ sort: 'new', platform: '#memecoins', launchpad: 'pons', page: 2, pageSize: 5 });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe('https://api.musepad.lol/api/tokens?sort=new&platform=%23memecoins&launchpad=pons&page=2&pageSize=5');
    });

    it('omits unset optional filters', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1 }), { status: 200 }));
      const client = new MusepadClient();

      await client.listTokens({ sort: 'hot' });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe('https://api.musepad.lol/api/tokens?sort=hot');
    });
  });

  describe('getStats', () => {
    it('requests the given window', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ totalMarketCap: 0, feesEarnedByMuses: 0, tokensLaunched: 0, totalVolume: 0, tokenGraduate: 0, totalMusepadBurned: '0' }), { status: 200 }));
      const client = new MusepadClient();

      await client.getStats('24h');

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe('https://api.musepad.lol/api/stats?window=24h');
    });
  });

  describe('baseUrl override', () => {
    it('strips a trailing slash and uses the override for every call', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(DEPLOY), { status: 200 }));
      const client = new MusepadClient({ baseUrl: 'http://localhost:3000/' });

      await client.getDeploy('abc');

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe('http://localhost:3000/api/musepad/deploys/abc');
    });
  });
});
