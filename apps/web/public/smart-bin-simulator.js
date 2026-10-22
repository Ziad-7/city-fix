(() => {
  const KEY = 'citycycle-smart-bin-demo-v1';
  const seed = () => ({
    selected: 'BIN-CAI-001',
    bins: [
      { id: 'BIN-CAI-001', name: 'Nile Corniche', area: 'Zamalek · Cairo', fill: 32, temp: 27, battery: 3.9, online: true, sensorFault: false, receiverFault: false, seq: 4, queued: [], readings: [{ seq: 1, fill: 18, temp: 25, battery: 4.0, state: 'confirmed' }, { seq: 2, fill: 23, temp: 26, battery: 3.98, state: 'confirmed' }, { seq: 3, fill: 28, temp: 26, battery: 3.94, state: 'confirmed' }, { seq: 4, fill: 32, temp: 27, battery: 3.9, state: 'confirmed' }] },
      { id: 'BIN-CAI-002', name: 'Tahrir Square', area: 'Downtown · Cairo', fill: 76, temp: 31, battery: 3.6, online: true, sensorFault: false, receiverFault: false, seq: 3, queued: [], readings: [{ seq: 1, fill: 61, temp: 29, battery: 3.7, state: 'confirmed' }, { seq: 2, fill: 69, temp: 30, battery: 3.65, state: 'confirmed' }, { seq: 3, fill: 76, temp: 31, battery: 3.6, state: 'confirmed' }] },
      { id: 'BIN-CAI-003', name: 'Azhar Park Gate', area: 'El-Darb El-Ahmar · Cairo', fill: 88, temp: 34, battery: 3.45, online: true, sensorFault: false, receiverFault: false, seq: 5, queued: [], readings: [{ seq: 1, fill: 56, temp: 29, battery: 3.8, state: 'confirmed' }, { seq: 2, fill: 63, temp: 30, battery: 3.7, state: 'confirmed' }, { seq: 3, fill: 72, temp: 31, battery: 3.6, state: 'confirmed' }, { seq: 4, fill: 81, temp: 33, battery: 3.5, state: 'confirmed' }, { seq: 5, fill: 88, temp: 34, battery: 3.45, state: 'confirmed' }] },
      { id: 'BIN-CAI-004', name: 'Maadi Station', area: 'Maadi · Cairo', fill: 44, temp: 28, battery: 2.9, online: false, sensorFault: false, receiverFault: false, seq: 2, queued: [{ seq: 2, fill: 44, temp: 28, battery: 2.9, state: 'queued' }], readings: [{ seq: 1, fill: 36, temp: 27, battery: 3.1, state: 'confirmed' }, { seq: 2, fill: 44, temp: 28, battery: 2.9, state: 'queued' }] },
    ], events: [{ at: 'Demo', text: '4 sample bins loaded for this browser.' }],
  });
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
  if (!state || !Array.isArray(state.bins)) state = seed();
  const $ = (id) => document.getElementById(id);
  const selected = () => state.bins.find((bin) => bin.id === state.selected) || state.bins[0];
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { $('notice').textContent = 'Browser storage is unavailable; changes will last only until this page closes.'; } };
  const activeAlert = (bin) => bin.fill >= 80 ? ['Full', '#b42335'] : bin.temp >= 60 ? ['Hot', '#b45309'] : bin.battery < 3.3 ? ['Low battery', '#8c6a00'] : bin.online ? ['Online', '#26744b'] : ['Offline', '#77736c'];
  const number = (value, digits = 0) => Number(value).toFixed(digits);
  const log = (text) => { state.events.unshift({ at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text }); state.events = state.events.slice(0, 30); };

  function renderBins() {
    $('fleetCount').textContent = `${state.bins.length} demo bins`;
    $('bins').replaceChildren(...state.bins.map((bin) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'bin-card'; button.setAttribute('aria-pressed', String(bin.id === state.selected));
      const [label, color] = activeAlert(bin);
      button.innerHTML = `<div class="bin-top"><div><div class="bin-name">${escapeHtml(bin.name)}</div><div class="bin-area">${escapeHtml(bin.area)} · ${escapeHtml(bin.id)}</div></div><span class="bin-status" style="color:${color}">${label}</span></div><div class="bin-stats"><span>Fill <b>${number(bin.fill)}%</b></span><span>Temp <b>${number(bin.temp, 1)}°C</b></span><span>Battery <b>${number(bin.battery, 2)}V</b></span><span>Queue <b>${bin.queued.length}</b></span></div><div class="tiny-meter"><i style="width:${Math.max(0, Math.min(100, bin.fill))}%;background:${bin.fill >= 80 ? '#c8102e' : '#d4a20b'}"></i></div>`;
      button.addEventListener('click', () => { state.selected = bin.id; save(); render(); });
      return button;
    }));
  }

  function renderChart(bin) {
    const svg = $('chart'); const width = 720; const height = 220; const points = bin.readings.slice(-30);
    if (points.length < 2) { svg.innerHTML = '<text x="360" y="110" text-anchor="middle" fill="#777" font-size="12">Record readings to build a history chart</text>'; return; }
    const path = points.map((item, index) => `${index ? 'L' : 'M'} ${(index / (points.length - 1)) * width} ${height - 16 - (Math.max(0, Math.min(100, item.fill)) / 100) * (height - 32)}`).join(' ');
    svg.innerHTML = `<line x1="0" x2="${width}" y1="${height * .2}" y2="${height * .2}" stroke="#d4a20b" stroke-dasharray="5 5"/><line x1="0" x2="${width}" y1="${height * .5}" y2="${height * .5}" stroke="#eee"/><line x1="0" x2="${width}" y1="${height * .8}" y2="${height * .8}" stroke="#eee"/><text x="5" y="${height * .2 - 4}" fill="#8a6b10" font-size="10">80% full alert</text><path d="${path}" fill="none" stroke="#c8102e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  function render() {
    const bin = selected(); const [statusText] = activeAlert(bin);
    $('selectedName').textContent = bin.name; $('location').textContent = `${bin.area} · ${bin.id}`;
    $('status').textContent = statusText; $('status').classList.toggle('alert', ['Full', 'Hot', 'Low battery', 'Offline'].includes(statusText));
    $('fillValue').textContent = `${number(bin.fill)}%`; $('tempValue').textContent = `${number(bin.temp, 1)} °C`; $('batteryValue').textContent = `${number(bin.battery, 2)} V`;
    $('fillMeter').style.width = `${Math.max(0, Math.min(100, bin.fill))}%`; $('fillMeter').style.background = bin.fill >= 80 ? '#c8102e' : '#d4a20b';
    for (const [input, range, value] of [['fill', 'fillRange', bin.fill], ['temp', 'tempRange', bin.temp], ['battery', 'batteryRange', bin.battery]]) { $(input).value = value; $(range).value = value; }
    $('offline').checked = !bin.online; $('sensorFault').checked = bin.sensorFault; $('receiverFault').checked = bin.receiverFault;
    $('readingCount').textContent = `${bin.readings.length} readings · ${bin.queued.length} queued`;
    renderBins(); renderChart(bin);
    $('readingRows').replaceChildren(...bin.readings.slice(-8).reverse().map((reading) => {
      const row = document.createElement('div'); row.className = 'reading-row';
      row.innerHTML = `<b>#${escapeHtml(reading.seq)}</b><span>${number(reading.fill)}% fill · ${number(reading.temp, 1)}°C · ${number(reading.battery, 2)}V</span><span class="pill ${reading.state === 'confirmed' ? 'confirmed' : 'queued'}">${escapeHtml(reading.state)}</span>`;
      return row;
    }));
    $('deliveryRows').replaceChildren(...state.events.slice(0, 8).map((event) => {
      const row = document.createElement('div'); row.className = 'delivery-row'; row.innerHTML = `<small>${escapeHtml(event.at)}</small><span>${escapeHtml(event.text)}</span><span class="pill">demo</span>`; return row;
    }));
  }

  for (const [input, range, key] of [['fill', 'fillRange', 'fill'], ['temp', 'tempRange', 'temp'], ['battery', 'batteryRange', 'battery']]) {
    $(input).addEventListener('input', () => { selected()[key] = Number($(input).value); $(range).value = $(input).value; render(); });
    $(range).addEventListener('input', () => { selected()[key] = Number($(range).value); $(input).value = $(range).value; render(); });
  }
  $('offline').addEventListener('change', (event) => { selected().online = !event.target.checked; log(`${selected().name}: network ${selected().online ? 'restored' : 'disconnected'}.`); save(); render(); });
  $('sensorFault').addEventListener('change', (event) => { selected().sensorFault = event.target.checked; save(); });
  $('receiverFault').addEventListener('change', (event) => { selected().receiverFault = event.target.checked; save(); });
  $('record').addEventListener('click', () => {
    const bin = selected();
    if (bin.sensorFault) { bin.sensorFault = false; $('sensorFault').checked = false; log(`${bin.name}: sensor fault skipped the reading.`); $('notice').textContent = 'Sensor fault: no reading was recorded. Fault cleared.'; save(); render(); return; }
    const reading = { seq: ++bin.seq, fill: bin.fill, temp: bin.temp, battery: bin.battery, state: 'queued' };
    bin.readings.push(reading); bin.queued.push(reading); log(`${bin.name}: reading #${reading.seq} queued.`); $('notice').textContent = `Reading #${reading.seq} saved in this browser.`; save(); render();
  });
  $('send').addEventListener('click', () => {
    const bin = selected();
    if (!bin.online) { $('notice').textContent = 'Device is offline. Queued readings stay on the device.'; return; }
    if (bin.receiverFault && bin.queued.length) { bin.receiverFault = false; $('receiverFault').checked = false; log(`${bin.name}: receiver rejected delivery; queue retained.`); $('notice').textContent = 'Mock receiver rejected this attempt. Try sending again.'; save(); render(); return; }
    if (!bin.queued.length) { $('notice').textContent = 'No queued readings.'; return; }
    const sent = bin.queued.splice(0); const sentIds = new Set(sent.map((reading) => reading.seq));
    bin.readings.forEach((reading) => { if (sentIds.has(reading.seq)) reading.state = 'confirmed'; });
    log(`${bin.name}: receiver confirmed ${sent.length} reading${sent.length === 1 ? '' : 's'}.`); $('notice').textContent = `${sent.length} reading${sent.length === 1 ? '' : 's'} confirmed by the mock receiver.`; save(); render();
  });
  $('scenario').addEventListener('change', (event) => {
    const kind = event.target.value; if (!kind) return;
    const bin = selected();
    if (kind === 'daily') { bin.fill = 55; bin.temp = 29; bin.battery = 3.8; bin.online = true; bin.sensorFault = false; bin.receiverFault = false; }
    if (kind === 'full') { bin.fill = 84; bin.temp = 31; bin.online = true; bin.sensorFault = false; bin.receiverFault = false; }
    if (kind === 'heat') { bin.fill = 42; bin.temp = 64; bin.online = true; bin.sensorFault = false; bin.receiverFault = false; }
    if (kind === 'offline') { bin.fill = 92; bin.temp = 35; bin.online = false; bin.sensorFault = false; bin.receiverFault = false; }
    const reading = { seq: ++bin.seq, fill: bin.fill, temp: bin.temp, battery: bin.battery, state: 'queued' };
    bin.readings.push(reading); bin.queued.push(reading); log(`Scenario loaded: ${event.target.selectedOptions[0].text}.`);
    $('notice').textContent = 'Scenario values loaded and a reading recorded.'; event.target.value = ''; save(); render();
  });
  $('reset').addEventListener('click', () => { if (!window.confirm('Clear this browser’s demo and restore the sample fleet?')) return; state = seed(); save(); $('notice').textContent = 'Demo reset.'; render(); });
  save(); render();
})();
