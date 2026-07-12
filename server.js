import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Sphere, getCoinIdBySymbol } from '@unicitylabs/sphere-sdk';
import { createNodeProviders } from '@unicitylabs/sphere-sdk/impl/nodejs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const AGENT_NAMETAG = process.env.AGENT_NAMETAG || 'buildbot_demo';
const AUTO_ACCEPT_MAX_UCT = Number(process.env.AUTO_ACCEPT_MAX_UCT || 5);

// In-memory activity log the dashboard polls. Newest first.
const log = [];
function pushLog(type, message, extra = {}) {
  log.unshift({ type, message, extra, time: new Date().toISOString() });
  if (log.length > 200) log.pop();
  console.log(`[${type}] ${message}`);
}

let sphere; // the running Sphere instance for our agent

async function startAgent() {
  const NETWORK = 'testnet';
  const providers = createNodeProviders({
    network: NETWORK,
    dataDir: path.join(__dirname, 'wallet-data'),
    tokensDir: path.join(__dirname, 'tokens-data'),
    oracle: { apiKey: process.env.ORACLE_API_KEY },
  });

  // Sphere.init() requires `network` at the top level of its options too -
  // createNodeProviders() doesn't forward it automatically.
  const initOpts = { ...providers, network: NETWORK, autoGenerate: true, nametag: AGENT_NAMETAG };
  if (process.env.WALLET_MNEMONIC) initOpts.mnemonic = process.env.WALLET_MNEMONIC;

  const { sphere: s, created, generatedMnemonic } = await Sphere.init(initOpts);
  sphere = s;

  if (created && generatedMnemonic) {
    pushLog(
      'wallet',
      'New wallet created - SAVE THIS RECOVERY PHRASE (also printed in server console)'
    );
    console.log('\n=== RECOVERY PHRASE (back this up!) ===');
    console.log(generatedMnemonic);
    console.log('========================================\n');
  }

  pushLog('identity', `Agent online as @${sphere.identity?.nametag || AGENT_NAMETAG}`, {
    directAddress: sphere.identity?.directAddress,
  });

  // Make sure the agent has some test UCT to work with (self-mint on testnet).
  try {
    const coinId = getCoinIdBySymbol('UCT');
    const assets = await sphere.payments.getAssets();
    const uct = assets.find((a) => a.symbol === 'UCT');
    const balance = uct ? Number(uct.totalAmount) : 0;
    if (!balance) {
      const mint = await sphere.payments.mintFungibleToken(coinId, 100_000_000n); // 100 UCT @ 6 decimals
      if (mint.success) {
        pushLog('mint', 'Self-minted 100 UCT of testnet tokens to start with.');
      } else {
        pushLog('mint-failed', `Could not self-mint: ${mint.error}`);
      }
    }
  } catch (err) {
    pushLog('mint-failed', `Mint check failed: ${err.message}`);
  }

  // --- Autonomous behavior #1: auto-respond to incoming direct messages ---
  sphere.communications.onDirectMessage(async (msg) => {
    const from = msg.senderNametag ? `@${msg.senderNametag}` : msg.senderPubkey;
    pushLog('dm-in', `${from}: ${msg.content}`);
    try {
      const reply = decideReply(msg.content);
      await sphere.communications.sendDM(msg.senderNametag ? `@${msg.senderNametag}` : msg.senderPubkey, reply);
      pushLog('dm-out', `-> ${from}: ${reply}`);
    } catch (err) {
      pushLog('dm-failed', `Reply to ${from} failed: ${err.message}`);
    }
  });

  // --- Autonomous behavior #2: auto-accept/reject incoming payment requests ---
  sphere.payments.onPaymentRequest(async (request) => {
    const from = request.senderNametag ? `@${request.senderNametag}` : 'unknown sender';
    pushLog('payreq-in', `${from} requests ${request.amount} ${request.symbol}`, request);
    const amountUct = Number(request.amount) / 1_000_000;
    if (amountUct <= AUTO_ACCEPT_MAX_UCT) {
      await sphere.payments.payPaymentRequest(request.id);
      pushLog('payreq-accepted', `Auto-paid ${from} (${amountUct} UCT, under threshold)`);
    } else {
      await sphere.payments.rejectPaymentRequest(request.id);
      pushLog('payreq-rejected', `Auto-rejected ${from} (${amountUct} UCT exceeds ${AUTO_ACCEPT_MAX_UCT} UCT limit)`);
    }
  });

  pushLog('ready', 'Autonomous behaviors armed: DM auto-reply + payment auto-accept/reject.');
}

// Extremely simple negotiation/reply logic - replace with real logic / an LLM call.
function decideReply(incoming) {
  const text = incoming.toLowerCase();
  if (text.includes('price') || text.includes('quote')) {
    return `I can do this for 2 UCT. Send a payment request to @${AGENT_NAMETAG} and I'll settle instantly if it's within my auto-accept limit.`;
  }
  if (text.includes('hello') || text.includes('hi')) {
    return `Hey! I'm an autonomous agent on Unicity testnet. Ask me for a "price" or send me a payment request.`;
  }
  return `Got it: "${incoming}". I'm a simple demo agent - I auto-accept payment requests under ${AUTO_ACCEPT_MAX_UCT} UCT and reply to DMs automatically.`;
}

// --- Web dashboard / API ---
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', async (req, res) => {
  if (!sphere) return res.json({ ready: false });
  try {
    const assets = await sphere.payments.getAssets();
    res.json({
      ready: true,
      nametag: sphere.identity?.nametag,
      directAddress: sphere.identity?.directAddress,
      assets,
      autoAcceptMaxUct: AUTO_ACCEPT_MAX_UCT,
    });
  } catch (err) {
    res.status(500).json({ ready: true, error: err.message });
  }
});

app.get('/api/log', (req, res) => res.json(log));

// The Sphere Connect payment_request intent needs a real coinId (lowercase
// hex), not a ticker symbol - this resolves it using the same registry our
// own agent already uses, so the frontend never has to hardcode a coinId.
app.get('/api/coin-id/:symbol', (req, res) => {
  try {
    const coinId = getCoinIdBySymbol(req.params.symbol.toUpperCase());
    res.json({ symbol: req.params.symbol.toUpperCase(), coinId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send-dm', async (req, res) => {
  const { recipient, message } = req.body;
  if (!recipient || !message) return res.status(400).json({ error: 'recipient and message required' });
  try {
    await sphere.communications.sendDM(recipient, message);
    pushLog('dm-out-manual', `-> ${recipient}: ${message}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/request-payment', async (req, res) => {
  const { recipient, amountUct, message } = req.body;
  if (!recipient || !amountUct) return res.status(400).json({ error: 'recipient and amountUct required' });
  try {
    const amount = String(Math.round(Number(amountUct) * 1_000_000));
    const result = await sphere.payments.sendPaymentRequest(recipient, {
      amount,
      coinId: 'UCT',
      message: message || 'Payment request from demo agent',
    });
    pushLog('payreq-out', `Requested ${amountUct} UCT from ${recipient}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

startAgent()
  .then(() => {
    app.listen(PORT, () => console.log(`Dashboard running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start agent:', err);
    process.exit(1);
  });
