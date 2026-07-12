// Sphere Connect integration.
// Lets a visitor connect their OWN Sphere wallet (not the agent's backend wallet)
// and interact with the agent directly from the browser - the agent's existing
// auto-reply / auto-accept-or-reject logic (server.js) handles what comes in.
//
// Docs used to build this: https://github.com/unicity-sphere/sphere-sdk-connect-example
import { autoConnect } from 'https://esm.sh/@unicitylabs/sphere-sdk@0.11.8/connect/browser';

const AGENT_NAMETAG = '@buildbot_reekystem';
const WALLET_URL = 'https://sphere.unicity.network';
const NETWORK = { id: 4, name: 'testnet2' };
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

let uctCoinId = null;
async function getUctCoinId() {
  if (uctCoinId) return uctCoinId;
  const res = await fetch('/api/coin-id/UCT');
  if (!res.ok) throw new Error('Could not resolve UCT coin ID from the agent backend');
  const data = await res.json();
  uctCoinId = data.coinId;
  return uctCoinId;
}

els.payForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeClient) return;
  els.payResult.textContent = 'Requesting…';
  try {
    const amountUct = Number(els.payAmount.value || 0);
    const coinId = await getUctCoinId();
    await activeClient.intent('payment_request', {
      to: AGENT_NAMETAG,
      amount: String(Math.round(amountUct * 1_000_000)),
      coinId,
      message: 'Requested from the SphereQuests demo dashboard',
    });
    els.payResult.textContent = 'Request sent — the agent auto-accepts requests under its configured limit.';
  } catch (err) {
    els.payResult.textContent = `Error: ${err.message}`;
  }
});

tryAutoConnect();
