/**
 * These types mirror the backend's DTOs by hand
 * (`backend/src/modules/musepad/dto/*.ts` in the `agent-muse` repo). Nothing
 * here is generated — this package can't reach the backend's OpenAPI
 * document at publish time — so if a response shape changes on the backend,
 * update it here too. `docs/api-integration.md` in that repo is the actual
 * source of truth.
 */

export type TokenSort = 'hot' | 'new' | 'mcap' | 'volume' | 'sourcePlatform';
export type Launchpad = 'pons' | 'bankr' | 'muse-launchpad';
export type StatsWindow = 'all-time' | '24h';
export type MusepadDeployStatus = 'matched' | 'deployed' | 'failed' | 'pending';

export interface LaunchedBy {
  handle: string;
}

/** A single row in the public token directory — `GET /tokens`. */
export interface TokenListingItem {
  id: string;
  sourcePlatform: string;
  sourceThreadUrl: string;
  symbol: string;
  name: string;
  /** The on-chain EVM address `creatorFeeRecipient`/`feeRecipient` was actually set to. */
  wallet: string;
  /** PayPal email or handle, present only when the requester used `paypal:` instead of `wallet:`. */
  paypal: string | null;
  changePct: number;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  graduated: boolean;
  launchpad: Launchpad;
  /** Origin of the deploy request: a musebook.me channel as `'#<name>'`, or `'#<consumer-name>'` for a `POST /launch` call. */
  platform: string;
  imageUrl: string | null;
  contractAddress: string;
  /** The token's Uniswap v4 `PoolId` (bytes32) once it's known. Stays `null` for a `pons` token until graduation, when the pool gets discovered. */
  poolId: string | null;
  launchedBy: LaunchedBy;
  launchedAt: string;
  description: string;
}

export interface TokenListingPage {
  items: TokenListingItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ListTokensQuery {
  sort: TokenSort;
  /** Exact-match on platform, e.g. `'#memecoins'`. Leave unset to match every platform. */
  platform?: string;
  launchpad?: Launchpad;
  page?: number;
  pageSize?: number;
}

export interface PlatformStats {
  totalMarketCap: number;
  feesEarnedByMuses: number;
  tokensLaunched: number;
  totalVolume: number;
  tokenGraduate: number;
  /** A decimal string, since the value can exceed `Number.MAX_SAFE_INTEGER`. */
  totalMusepadBurned: string;
}

/** Token fields parsed out of a single launch attempt. */
export interface MusepadToken {
  name: string;
  symbol: string;
  wallet: string;
  paypal: string | null;
  description: string;
  imageUrl: string | null;
}

/** A single deploy attempt, whether crawl-triggered or API-triggered — `GET /musepad/deploys[/:id]`, also what `POST /musepad/launch` returns. */
export interface MusepadDeploy {
  id: string;
  sourcePlatform: string;
  sourceThreadId: string;
  sourceChannel: string;
  sourceThreadTitle: string;
  sourceThreadUrl: string;
  sourceAuthor: string;
  token: MusepadToken;
  status: MusepadDeployStatus;
  deployTxHash: string | null;
  deployedTokenAddress: string | null;
  deployError: string | null;
  replyPostId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body for `POST /musepad/launch`. Exactly one of `wallet`/`paypal` must be set. */
export interface LaunchTokenInput {
  name: string;
  symbol: string;
  wallet?: string;
  paypal?: string;
  description?: string;
  imageUrl?: string;
  platform?: 'robinhood' | 'bankr';
  quote?: 'meta' | 'musebook';
  /** Must be unique per attempt. A repeat call with the same key gets rejected (409) instead of deploying again. */
  idempotencyKey: string;
}

/** The shape of any non-2xx response the API returns. */
export interface MusepadApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}
