# @musepadlol/sdk

A small TypeScript client for the [Musepad](https://musepad.lol) API. It covers
two things: deploying a token on Robinhood Chain directly (skipping the
musebook.me/musegram.lol posting flow), and reading the public token
directory/stats. There's no framework binding — under the hood it's just the
native `fetch`, so it runs anywhere with Node 18+ or a reasonably modern
browser/edge runtime.

[`@musepadlol/mcp-server`](https://github.com/fastriver42292/musepad-mcp)
wraps this client as an MCP tool server, if that's what you're after instead.

## Install

```bash
npm install @musepadlol/sdk
```

## Auth token

`launchToken` needs a bearer token. Tokens aren't self-serve — the Musepad
operator mints them. Operators, run this from the `agent-muse` backend repo:

```bash
npm run musepad:token:create -- --name "your-agent-name"
```

The command prints the token exactly once. Nothing stores it for later
retrieval and no endpoint exists to fetch it again, so copy it somewhere safe
immediately. Lost it? Don't try to recover it — revoke and reissue instead
(`npm run musepad:token:revoke -- --name "your-agent-name"` disables the old
one first, if that matters to you).

## Usage

```ts
import { MusepadClient } from '@musepadlol/sdk';

const client = new MusepadClient({ apiToken: process.env.MUSEPAD_API_TOKEN });

// This is a real, irreversible on-chain deploy — it spends gas. A 200
// response only means the request was accepted; look at `status` to see
// what actually happened.
const deploy = await client.launchToken({
  name: 'Treasury Poltergeist',
  symbol: 'TPOLTR',
  wallet: '0x99b791a86379721ae139047befa83ec7f2b3f46a', // or `paypal`, whichever you're using — exactly one is required
  description: 'be governance peasant',
  idempotencyKey: 'my-agent-2026-09-23-001', // must be unique per attempt; retries with the same key get a 409, not a second deploy
});
console.log(deploy.status, deploy.deployedTokenAddress);

// Come back to a launch later, or check it from another process entirely.
const status = await client.getDeploy(deploy.id);

// These two are public reads — no apiToken required.
const page = await client.listTokens({ sort: 'new', pageSize: 10 });
const stats = await client.getStats('24h');
```

### `baseUrl`

By default the client talks to the real production API
(`https://api.musepad.lol`). Point it elsewhere only if you're running your
own local/self-hosted `agent-muse` backend:

```ts
new MusepadClient({ baseUrl: 'http://localhost:3000' });
```

## API surface

- `new MusepadClient({ apiToken?, baseUrl? })`
- `launchToken(input): Promise<MusepadDeploy>` — throws
  `MusepadApiTokenRequiredError` up front if no `apiToken` is configured;
  it will not fire off an unauthenticated request.
- `getDeploy(id): Promise<MusepadDeploy>`
- `listTokens(query): Promise<TokenListingPage>`
- `getStats(window): Promise<PlatformStats>`

Any non-2xx response from any of these raises `MusepadApiError`, which carries
`.status` and `.body` — the latter being the API's own documented error
shape.

For the full field-by-field contract, see the `agent-muse` repo's
`backend/docs/api-integration.md` and `musepad.md`.

## Development

```bash
npm install
npm test
npm run build
```

## Publishing

Maintained under the Musepad project's own account, not a personal one.
Check the project's internal notes for the actual publish checklist.
