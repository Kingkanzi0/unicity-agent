// Sphere Connect integration.
// Lets a visitor connect their OWN Sphere wallet (not the agent's backend wallet)
// and interact with the agent directly from the browser - the agent's existing
// auto-reply / auto-accept-or-reject logic (server.js) handles what comes in.
//
// Docs used to build this: https://github.com/unicity-sphere/sphere-sdk-connect-example
import { autoConnect } from 'https://esm.sh/@unicitylabs/sphere-sdk@0.11.8/connect/browser';

// Update this if you redeploy the agent under a different Unicity ID.
const AGENT_NAMETAG = '@buildbot_reekystem';

// The Sphere web wallet, used as the popup fallback when this page isn't
// already embedded inside Sphere (iframe) and no browser extension is present.
const WALLET_URL = 'https://sphere.unicity.network';

// testnet2, per the sphere-sdk Connect docs.
const NETWORK = { id: 4, name: 'testnet2' };

// Least-privilege: only what this dashboard actually needs.
// - identity:read  -> know who connected, to display it
// - dm:request     -> let the visitor message the agent
// - payment:request -> let the visitor ask the agent to pay them
// Deliberately NOT requested: transfer:request, sign:request, mint:request -
// this dashboard can never move funds out of the visitor's wallet or sign for them.
const PERMISSIONS = ['identity:read', 'dm:request', 'payment:request'];

const DAPP_INFO = { name: 'Unicity Autonomous Agent Demo', url: location.origin };

let activeClient = null;

const els = {
  status: document.getElementById('connect-status'),
  connectBtn: document.getElementById('connect-btn'),
  actions: document.getElementById('connect-actions'),
  dmForm: document.getElementById('connect-dm-form'),
  dmMessage: document.getElementById('connect-dm-message'),
  dmResult: document.getElementById('connect-dm-result'),
  payForm: document.getElementById('connect-pay-form'),
  payAmount: document.getElementById('connect-pay-amount'),
  payResult: document.getElementById('connect-pay-result'),
};

function setStatus(text) {
  if (els.status) els.status.textContent = text;
}

function showConnected(identity) {
  const label = identity?.nametag ? `@${identity.nametag}` : identity?.directAddress || 'connected wallet';
  setStatus(`Connected as ${label}`);
  if (els.connectBtn) els.connectBtn.textContent = 'Disconnect';
  if (els.actions) els.actions.style.display = 'block';
}

function showDisconnected(message) {
  setStatus(message || 'Not connected.');
  if (els.connectBtn) els.connectBtn.textContent = 'Connect Sphere Wallet';
  if (els.actions) els.actions.style.display = 'none';
  activeClient = null;
}

function wireEvents(client) {
  client.on('wallet:locked', () => {
    showDisconnected('Wallet locked — reconnect to continue.');
  });
  client.on('identity:changed', (identity) => {
    showConnected(identity);
  });
}

async function tryAutoConnect() {
  try {
    const { client, connection } = await autoConnect({
      dapp: DAPP_INFO,
      walletUrl: WALLET_URL,
      permissions: PERMISSIONS,
      network: NETWORK,
      silent: true,
    });
    activeClient = client;
    wireEvents(client);
    showConnected(connection.identity);
  } catch {
    showDisconnected('Not connected.');
  }
}

async function connect() {
  if (activeClient) {
    try {
      await activeClient.disconnect();
    } catch {
      /* ignore */
    }
    showDisconnected();
    return;
  }
  setStatus('Connecting…');
  try {
    const { client, connection } = await autoConnect({
      dapp: DAPP_INFO,
      walletUrl: WALLET_URL,
      permissions: PERMISSIONS,
      network: NETWORK,
    });
    activeClient = client;
    wireEvents(client);
    showConnected(connection.identity);
  } catch (err) {
    showDisconnected(`Connection failed: ${err.message}`);
  }
}

els.connectBtn?.addEventListener('click', connect);

els.dmForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeClient) return;
  els.dmResult.textContent = 'Sending…';
  try {
    await activeClient.intent('dm', {
      to: AGENT_NAMETAG,
      message: els.dmMessage.value,
    });
    els.dmResult.textContent = 'Sent — the agent should auto-reply shortly.';
    els.dmMessage.value = '';
  } catch (err) {
    els.dmResult.textContent = `Error: ${err.message}`;
  }
});

els.payForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeClient) return;
  els.payResult.textContent = 'Requesting…';
  try {
    const amountUct = Number(els.payAmount.value || 0);
    await activeClient.intent('payment_request', {
      to: AGENT_NAMETAG,
      amount: String(Math.round(amountUct * 1_000_000)),
      coinId: 'UCT',
      message: 'Requested from the SphereQuests demo dashboard',
    });
    els.payResult.textContent = 'Request sent — the agent auto-accepts requests under its configured limit.';
  } catch (err) {
    els.payResult.textContent = `Error: ${err.message}`;
  }
});

tryAutoConnect();
