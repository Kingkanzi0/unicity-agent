# Unicity Autonomous Agent Demo

A minimal but real submission for Unicity's **Sphere Quests / Call for Builders**
testnet campaign, targeting the **Autonomous Agents** category (also touches
**Payments + Markets** and **Social + Messaging**).

It runs one autonomous agent wallet on the Unicity testnet2 network that:

- claims a human-readable **Unicity ID** (e.g. `@buildbot_alex`)
- **self-mints** test UCT tokens on startup if it has none
- **auto-replies to direct messages** it receives (simple rule-based "negotiation")
- **auto-accepts or auto-rejects incoming payment requests** based on a configurable threshold
- exposes a plain HTML/JS **dashboard** so you (and judges) can see it work live, and manually trigger a DM or a payment request from the agent

Everything the agent does goes through
[`@unicitylabs/sphere-sdk`](https://github.com/unicity-sphere/sphere-sdk) — no
custom crypto, just the SDK's Node.js provider.

## 1. Prerequisites (fresh setup)

Install Node.js 20+ (includes npm). Check with:

```bash
node -v
npm -v
```

If you don't have Node installed:
- **Mac**: `brew install node`
- **Windows/Linux**: download from https://nodejs.org (LTS version)

## 2. Install

```bash
cd unicity-agent
npm install
```

## 3. Configure

```bash
cp .env.example .env
```

Then edit `.env`:

1. `AGENT_NAMETAG` — pick a unique Unicity ID for your agent, e.g. `buildbot_yourname`.
2. `ORACLE_API_KEY` — the testnet2 gateway key. It's **not secret**, it's published
   in the SDK's own repo — open
   https://github.com/unicity-sphere/sphere-sdk/blob/main/.env.example
   and copy the testnet key value shown there into your `.env`.
3. Leave `WALLET_MNEMONIC` blank on first run — the SDK generates one and saves
   it to `./wallet-data`. **Back up the recovery phrase printed in your terminal
   on first run** so you keep the same identity if you redeploy.

## 4. Run locally

```bash
npm start
```

Open http://localhost:3000 — you'll see the agent's identity, balances, and a
live activity log. Test it two ways:

- **From another Sphere wallet** (browser wallet, CLI, or a friend's instance),
  send a DM to your agent's nametag, or send it a payment request — watch the
  dashboard log react in real time.
- **From the dashboard itself**, use the two forms to have the agent send a
  DM or a payment request to someone else's nametag.

## 5. Deploy so it's reachable/verifiable for the testnet program

This app needs a long-running Node process (it holds an open wallet + relay
connection), so use a small always-on host rather than a serverless platform:

**Railway / Render (easiest):**
1. Push this folder to a GitHub repo.
2. Create a new Web Service, connect the repo.
3. Set the same environment variables from `.env` in the host's dashboard
   (`AGENT_NAMETAG`, `ORACLE_API_KEY`, `WALLET_MNEMONIC` once you have one,
   `AUTO_ACCEPT_MAX_UCT`).
4. Build command: `npm install`. Start command: `npm start`.
5. **Important**: add a persistent volume (or set `WALLET_MNEMONIC` explicitly)
   so the wallet survives redeploys — otherwise a fresh container generates a
   brand-new identity every deploy.

Once deployed, submit the live URL plus your agent's Unicity ID for the quest.

## Where to extend this for more XP

- Replace `decideReply()` in `server.js` with a real negotiation strategy or an
  LLM call — this is the "autonomous" part, currently it's rule-based on purpose
  so the demo has zero external dependencies.
- Add `sphere.market` (the intents bulletin board) so your agent posts and
  discovers trade intents automatically — closer to a real "market" agent.
- Add `sphere.groupChat` if you want it to participate in a public group instead
  of only DMs — extends into Social + Messaging more fully.
