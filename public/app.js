async function refreshStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const el = document.getElementById('status');
    if (!data.ready) {
      el.innerHTML = 'Agent starting up…';
      return;
    }
    const assetsHtml = (data.assets || [])
      .map((a) => `${a.symbol}: ${a.totalAmount}`)
      .join(', ') || 'no assets yet';
    el.innerHTML = `
      <div class="row"><span class="k">Unicity ID</span><span class="v">@${data.nametag || '(unclaimed)'}</span></div>
      <div class="row"><span class="k">Address</span><span class="v addr">${data.directAddress || '-'}</span></div>
      <div class="row"><span class="k">Balances</span><span class="v">${assetsHtml}</span></div>
      <div class="row"><span class="k">Auto-accept limit</span><span class="v">${data.autoAcceptMaxUct} UCT</span></div>
    `;
  } catch (err) {
    document.getElementById('status').innerHTML = 'Error loading status: ' + err.message;
  }
}

async function refreshLog() {
  try {
    const res = await fetch('/api/log');
    const rows = await res.json();
    const el = document.getElementById('log');
    el.innerHTML = rows
      .map(
        (r) => `
      <div class="log-row">
        <span class="log-time">${new Date(r.time).toLocaleTimeString()}</span>
        <span class="log-type">[${r.type}]</span>
        <span>${r.message}</span>
      </div>`
      )
      .join('');
  } catch (err) {
    console.error(err);
  }
}

async function sendDm() {
  const recipient = document.getElementById('dm-recipient').value.trim();
  const message = document.getElementById('dm-message').value.trim();
  const out = document.getElementById('dm-result');
  out.textContent = 'Sending…';
  try {
    const res = await fetch('/api/send-dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, message }),
    });
    const data = await res.json();
    out.textContent = res.ok ? 'Sent.' : 'Error: ' + data.error;
  } catch (err) {
    out.textContent = 'Error: ' + err.message;
  }
}

async function requestPayment() {
  const recipient = document.getElementById('pay-recipient').value.trim();
  const amountUct = document.getElementById('pay-amount').value.trim();
  const out = document.getElementById('pay-result');
  out.textContent = 'Sending request…';
  try {
    const res = await fetch('/api/request-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, amountUct }),
    });
    const data = await res.json();
    out.textContent = res.ok ? 'Payment request sent.' : 'Error: ' + data.error;
  } catch (err) {
    out.textContent = 'Error: ' + err.message;
  }
}

refreshStatus();
refreshLog();
setInterval(refreshStatus, 5000);
setInterval(refreshLog, 3000);
