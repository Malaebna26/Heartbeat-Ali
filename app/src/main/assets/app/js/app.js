// واجهة التطبيق: تربط المنطق (core.js) والقراءة (parser.js) والنصوص (i18n.js) بالصفحة.
// لا توجد أي مكتبة خارجية ولا اتصال بالإنترنت.

const $ = id => document.getElementById(id);
const STORE_KEY = 'pupilsCheckList_v2';
const LANG_KEY = 'nabadatLang';
const TIMER_TOTAL = 60000;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let pupils = [];
let currentClass = 'all';

// ===== النصوص والتعريب =====
function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  $('langBtn').textContent = t('lang.toggle');
}

function setLanguage(l) {
  setLang(l);
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'fr' ? 'ltr' : 'rtl';
  applyStaticI18n();
  renderAll();
  renderSolo();
  tRender();
}

function statusText(s) { return t('status.' + s); }
function flagText(f) { return t(f.k, f.p); }
function genderText(g) { return g === 'm' ? t('gender.m') : g === 'f' ? t('gender.f') : ''; }
function protocolText(p) { return p === 'abrupt' ? t('protocol.abrupt') : t('protocol.cooldown'); }

// ===== التخزين =====
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(pupils)); } catch (e) {}
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!Array.isArray(saved)) return;
    // سجل تالف لتلميذ واحد لا يُسقط بقية القائمة
    pupils = saved.flatMap(s => { try { return [sanitizePupil(s)]; } catch (e) { return []; } });
  } catch (e) {}
}

// ===== العرض =====
function visiblePupils() {
  return currentClass === 'all' ? pupils : pupils.filter(p => p.cls === currentClass);
}

function counts(list) {
  const c = { total: list.length, done: 0, ok: 0, follow: 0, refer: 0 };
  list.forEach(p => {
    const s = classify(p).status;
    if (s === 'ok' || s === 'follow' || s === 'refer') { c.done++; c[s]++; }
  });
  return c;
}

function resultHtml(r) {
  if (!r.status) return '<span class="badge none">—</span>';
  return `<span class="badge ${r.status}">${esc(statusText(r.status))}</span>` +
    (r.flags.length ? `<div class="flags">${r.flags.map(f => esc(flagText(f))).join('<br>')}</div>` : '');
}

function rowHtml(p, i) {
  const nameCell = p.extra
    ? `<input class="txt" data-f="name" value="${esc(p.name)}" placeholder="${esc(t('row.extraPh'))}">`
    : esc(p.name);
  return `<tr data-i="${i}" class="${p.extra ? 'extra' : ''}">
    <td class="g">${i + 1}</td>
    <td class="g">${esc(p.cls)}</td>
    <td class="name">${nameCell}</td>
    <td class="g">${esc(genderText(p.g))}</td>
    <td><input type="number" data-f="age" min="6" max="18" value="${p.age == null ? '' : p.age}"></td>
    <td><input type="number" data-f="pre" min="30" max="200" value="${p.pre}"></td>
    <td><input type="number" data-f="post" min="30" max="240" value="${p.post}"></td>
    <td><input type="number" data-f="rec" min="30" max="240" value="${p.rec}"></td>
    <td><select data-f="protocol">
      <option value="cooldown" ${p.protocol !== 'abrupt' ? 'selected' : ''}>${esc(t('protocol.cooldown'))}</option>
      <option value="abrupt" ${p.protocol === 'abrupt' ? 'selected' : ''}>${esc(t('protocol.abrupt'))}</option>
    </select></td>
    <td><input type="checkbox" data-f="symptoms" ${p.symptoms ? 'checked' : ''}></td>
    <td class="res"></td>
    <td class="acts">
      <button class="mini" type="button" data-act="save" title="${esc(t('row.save'))}">💾</button>
      <button class="mini" type="button" data-act="hist" title="${esc(t('row.hist'))}">${esc(t('row.histBtn', { n: p.history.length }))}</button>
    </td>
  </tr>`;
}

function refreshRow(i) {
  const tr = document.querySelector(`#rows tr[data-i="${i}"]`);
  if (!tr) return;
  tr.querySelector('.res').innerHTML = resultHtml(classify(pupils[i]));
}

function updateStats() {
  const c = counts(visiblePupils());
  $('sTotal').textContent = c.total;
  $('sDone').textContent = c.done;
  $('sOk').textContent = c.ok;
  $('sFollow').textContent = c.follow;
  $('sRefer').textContent = c.refer;
}

function applySearch() {
  const q = $('search').value.trim();
  document.querySelectorAll('#rows tr').forEach(tr => {
    if (tr.dataset.i === undefined) return; // صف رسالة الفراغ لا يُخفى
    const p = pupils[Number(tr.dataset.i)];
    const inClass = currentClass === 'all' || p.cls === currentClass;
    const matches = q === '' || p.name.includes(q);
    tr.classList.toggle('hidden', !(inClass && matches));
  });
}

function renderClassFilter() {
  const counts2 = {};
  pupils.forEach(p => { counts2[p.cls] = (counts2[p.cls] || 0) + 1; });
  if (currentClass !== 'all' && !counts2[currentClass]) currentClass = 'all';
  $('classFilter').innerHTML = `<option value="all">${esc(t('filter.all', { n: pupils.length }))}</option>` +
    Object.keys(counts2).map(n => `<option value="${esc(n)}">${esc(n)} (${counts2[n]})</option>`).join('');
  $('classFilter').value = currentClass;
}

function renderAll() {
  renderClassFilter();
  if (pupils.length === 0) {
    $('rows').innerHTML = `<tr><td class="empty" colspan="12"><div class="empty-box">${esc(t('row.empty'))}</div></td></tr>`;
  } else {
    $('rows').innerHTML = pupils.map((p, i) => rowHtml(p, i)).join('');
    pupils.forEach((_, i) => refreshRow(i));
  }
  updateStats();
  applySearch();
  save();
}

function flash(text, kind) {
  const m = $('appMsg');
  m.textContent = text;
  m.className = 'msg show ' + kind;
}

// ===== تعديل الجدول =====
function onChange(e) {
  const el = e.target;
  const f = el.dataset.f;
  const tr = el.closest('tr');
  if (!f || !tr) return;
  const i = Number(tr.dataset.i);
  const p = pupils[i];
  if (!p) return;

  if (f === 'symptoms') p.symptoms = el.checked;
  else if (f === 'protocol') p.protocol = el.value;
  else if (f === 'age') p.age = el.value === '' ? null : Number(el.value);
  else if (f === 'name') p.name = el.value;
  else p[f] = el.value;

  if (f === 'age') p.ageEdited = true;
  refreshRow(i);
  updateStats();
  applySearch();
  save();
}

$('rows').addEventListener('input', onChange);
$('rows').addEventListener('change', onChange);

$('rows').addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const i = Number(btn.closest('tr').dataset.i);
  const p = pupils[i];
  if (!p) return;
  if (btn.dataset.act === 'save') {
    const res = saveSession(p);
    if (!res.ok) { flash(t('msg.incomplete'), 'err'); return; }
    renderAll();
    flash(t('msg.saved', { n: p.name || ('#' + (i + 1)) }), 'ok');
  } else if (btn.dataset.act === 'hist') {
    openHistory(i);
  }
});

$('rows').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.dataset.f) return;
  e.preventDefault();
  const f = e.target.dataset.f;
  let next = e.target.closest('tr').nextElementSibling;
  while (next && next.classList.contains('hidden')) next = next.nextElementSibling;
  const el = next && next.querySelector(`[data-f="${f}"]`);
  if (el) { el.focus(); if (el.select) el.select(); }
});

$('search').addEventListener('input', applySearch);

$('addExtra').addEventListener('click', () => {
  pupils.push(newPupil('', '', '', true, currentClass === 'all' ? '' : currentClass));
  renderAll();
  const last = document.querySelector('#rows tr:last-child [data-f="name"]');
  if (last) last.focus();
});

$('classFilter').addEventListener('change', e => {
  currentClass = e.target.value;
  updateStats();
  applySearch();
});

// ===== السجل وتطوّر النبض =====
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(LANG === 'fr' ? 'fr-FR' : 'ar-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const CH = { W: 560, H: 220, P: 34, MIN: 40, MAX: 200 };

function chartX(k, n) { return CH.P + (n <= 1 ? (CH.W - 2 * CH.P) / 2 : k * (CH.W - 2 * CH.P) / (n - 1)); }
function chartY(v) { return CH.P + (CH.MAX - v) / (CH.MAX - CH.MIN) * (CH.H - 2 * CH.P); }

function chartBpm(h) {
  const n = h.length;
  let grid = '';
  [60, 100, 140, 180].forEach(v => {
    grid += `<line x1="${CH.P}" x2="${CH.W - CH.P}" y1="${chartY(v)}" y2="${chartY(v)}" stroke="#eee"/>` +
      `<text x="${CH.P - 6}" y="${chartY(v) + 4}" font-size="11" text-anchor="end" fill="#636e72">${v}</text>`;
  });
  const series = [['pre', '#636e72'], ['post', '#e84393'], ['rec', '#0984e3']];
  let lines = '';
  series.forEach(([key, color]) => {
    const pts = h.map((s, k) => (s[key] === '' ? null : [chartX(k, n), chartY(Number(s[key]))])).filter(Boolean);
    if (pts.length > 1) lines += `<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
    pts.forEach(p => { lines += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}"/>`; });
  });
  const labels = h.map((s, k) => `<text x="${chartX(k, n)}" y="${CH.H - 8}" font-size="11" text-anchor="middle" fill="#636e72">${k + 1}</text>`).join('');
  return `<svg viewBox="0 0 ${CH.W} ${CH.H}" width="100%" role="img">${grid}${lines}${labels}</svg>`;
}

function chartDrop(h) {
  const n = h.length;
  const drops = h.map(s => (s.post === '' || s.rec === '' ? null : Number(s.post) - Number(s.rec)));
  const maxDrop = Math.max(30, ...drops.filter(d => d !== null));
  const base = CH.H - CH.P;
  const scale = (CH.H - 2 * CH.P) / maxDrop;
  const barW = Math.max(12, Math.min(40, (CH.W - 2 * CH.P) / Math.max(n, 1) * 0.6));
  let bars = '';
  drops.forEach((d, k) => {
    if (d === null) return;
    const th = h[k].protocol === 'abrupt' ? 18 : 12;
    const color = d > th ? '#00b894' : '#f0932b';
    const x = chartX(k, n) - barW / 2;
    const hgt = Math.max(0, d * scale);
    bars += `<rect x="${x}" y="${base - hgt}" width="${barW}" height="${hgt}" rx="4" fill="${color}"/>` +
      `<text x="${chartX(k, n)}" y="${base - hgt - 4}" font-size="11" text-anchor="middle" fill="#2d3436">${d}</text>`;
  });
  const th12 = base - 12 * scale;
  const thLine = `<line x1="${CH.P}" x2="${CH.W - CH.P}" y1="${th12}" y2="${th12}" stroke="#d63031" stroke-dasharray="5 4"/>` +
    `<text x="${CH.W - CH.P}" y="${th12 - 4}" font-size="11" text-anchor="end" fill="#d63031">${esc(t('hist.threshold'))}</text>`;
  const labels = h.map((s, k) => `<text x="${chartX(k, n)}" y="${CH.H - 8}" font-size="11" text-anchor="middle" fill="#636e72">${k + 1}</text>`).join('');
  return `<svg viewBox="0 0 ${CH.W} ${CH.H}" width="100%" role="img">${thLine}${bars}${labels}</svg>`;
}

function openHistory(i) {
  const p = pupils[i];
  if (!p) return;
  $('histTitle').textContent = t('hist.title', { n: p.name || ('#' + (i + 1)) });
  const h = p.history;
  let html;
  if (!h.length) {
    html = `<p class="hist-none">${esc(t('hist.none'))}</p>`;
  } else {
    html = `<div class="chart-box"><h3>${esc(t('hist.chart1'))}</h3>${chartBpm(h)}<div class="legend">${esc(t('hist.legend'))}</div></div>` +
      `<div class="chart-box"><h3>${esc(t('hist.chart2'))}</h3>${chartDrop(h)}</div>` +
      `<div class="hist-scroll"><table class="hist-table"><thead><tr><th>#</th><th>${esc(t('hist.date'))}</th>` +
      `<th>${esc(t('th.pre'))}</th><th>${esc(t('th.post'))}</th><th>${esc(t('th.rec'))}</th><th>${esc(t('hist.status'))}</th></tr></thead><tbody>` +
      h.map((s, k) => `<tr><td>${k + 1}</td><td>${esc(fmtDate(s.d))}</td><td>${s.pre}</td><td>${s.post}</td><td>${s.rec}</td><td>${esc(s.status ? statusText(s.status) : '')}</td></tr>`).join('') +
      '</tbody></table></div>';
  }
  $('histBody').innerHTML = html;
  const dlg = $('histDialog');
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}

$('histClose').addEventListener('click', () => {
  const dlg = $('histDialog');
  if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
});

// ===== التصدير والتقرير والنسخ الاحتياطي =====
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

$('csv').addEventListener('click', () => {
  const lines = visiblePupils().map(p => {
    const r = classify(p);
    return [
      p.cls, p.name, genderText(p.g), (p.age == null ? '' : p.age), p.pre, p.post, p.rec,
      p.protocol === 'abrupt' ? t('csv.abrupt') : t('csv.cooldown'),
      p.symptoms ? t('csv.yes') : t('csv.no'),
      r.status ? statusText(r.status) : '',
      r.flags.map(flagText).join(' | '),
      p.history.length
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const header = t('csv.h').map(h => `"${h}"`).join(',');
  const name = currentClass === 'all' ? t('csv.name.all') : t('csv.name.class', { s: currentClass });
  download(name + '.csv', '﻿' + [header, ...lines].join('\n'), 'text/csv;charset=utf-8');
});

$('report').addEventListener('click', () => {
  const list = visiblePupils();
  const c = counts(list);
  const className = currentClass === 'all' ? t('scope.all') : currentClass;
  const rows = list.map((p, i) => {
    const r = classify(p);
    return `<tr><td>${i + 1}</td><td>${esc(p.cls)}</td><td>${esc(p.name)}</td><td>${esc(genderText(p.g))}</td>` +
      `<td>${p.age == null ? '' : p.age}</td><td>${p.pre}</td><td>${p.post}</td><td>${p.rec}</td>` +
      `<td>${esc(r.status ? statusText(r.status) : '')}</td><td>${esc(r.flags.map(flagText).join(' | '))}</td></tr>`;
  }).join('');
  $('printReport').innerHTML =
    `<h1>${esc(t('report.title'))}</h1>` +
    `<p>${esc(t('report.class', { s: className }))} — ${esc(t('report.date', { d: new Date().toLocaleDateString(LANG === 'fr' ? 'fr-FR' : 'ar-u-nu-latn') }))}</p>` +
    `<p>${esc(t('report.counts', { t: c.total, done: c.done, ok: c.ok, follow: c.follow, refer: c.refer }))}</p>` +
    `<table><thead><tr><th>#</th><th>${esc(t('th.class'))}</th><th>${esc(t('th.name'))}</th><th>${esc(t('th.gender'))}</th>` +
    `<th>${esc(t('th.age'))}</th><th>${esc(t('th.pre'))}</th><th>${esc(t('th.post'))}</th><th>${esc(t('th.rec'))}</th>` +
    `<th>${esc(t('th.result'))}</th><th>${esc(t('th.symptoms'))}</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<p class="report-foot">${esc(t('report.footer'))}</p>`;
  window.print();
});

$('backup').addEventListener('click', () => {
  download('nabadat-backup-' + new Date().toISOString().slice(0, 10) + '.json', buildBackup(pupils), 'application/json;charset=utf-8');
  flash(t('msg.exported'), 'ok');
});

$('restoreFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const list = parseBackup(await file.text());
    if (!confirm(t('confirm.restore', { n: list.length }))) return;
    pupils = list;
    currentClass = 'all';
    renderAll();
    flash(t('msg.restored', { n: list.length }), 'ok');
  } catch (err) {
    flash(err.message === 'too-many' ? t('msg.badBackupBig') : t('msg.badBackup'), 'err');
  }
});

// ===== المسح =====
function scopeName() { return currentClass === 'all' ? t('scope.all') : currentClass; }

$('clear').addEventListener('click', () => {
  if (!confirm(t('confirm.clear', { s: scopeName() }))) return;
  visiblePupils().forEach(p => { p.pre = ''; p.post = ''; p.rec = ''; p.symptoms = false; p.protocol = 'cooldown'; });
  renderAll();
});

$('removeList').addEventListener('click', () => {
  if (!confirm(t('confirm.removeList', { s: scopeName() }))) return;
  pupils = currentClass === 'all' ? [] : pupils.filter(p => p.cls !== currentClass);
  currentClass = 'all';
  renderAll();
  flash(t('msg.deleted'), 'info');
});

$('wipe').addEventListener('click', () => {
  if (!confirm(t('confirm.wipe'))) return;
  pupils = [];
  currentClass = 'all';
  renderAll();
  flash(t('msg.wiped'), 'info');
});

// ===== استيراد القوائم =====
function showMsg(text, kind) {
  const m = $('importMsg');
  m.textContent = text;
  m.className = 'msg show ' + kind;
}

function hasMeasurement(p) {
  return p.pre !== '' || p.post !== '' || p.rec !== '' || p.symptoms || p.history.length > 0;
}

// كل قسم مستقل: لا يُستبدل إلا القسم الذي يُستورد بالاسم نفسه
function applyRoster(res, sourceName) {
  const incoming = [...new Set(res.list.map(x => x[3]))];
  const clash = incoming.filter(c => pupils.some(p => p.cls === c && hasMeasurement(p)));
  if (clash.length && !confirm(t('msg.clash', { c: clash.join('، ') }))) {
    showMsg(t('msg.noImport'), 'info');
    return;
  }
  pupils = pupils.filter(p => !incoming.includes(p.cls));
  pupils.push(...res.list.map(([name, g, dob, cls]) => newPupil(name, g, dob, false, cls)));
  currentClass = incoming.length === 1 ? incoming[0] : 'all';
  showMsg(t('msg.imported', { n: res.list.length, k: incoming.length, s: sourceName, c: incoming.join('، ') }), 'ok');
  renderAll();
}

function importSheets(sheets, sourceName) {
  const res = parseRoster(sheets, $('fallbackClass').value.trim());
  if (!res.list.length) {
    const found = res.seenHeaders.length ? '<br>' + esc(t('msg.foundHeaders', { h: res.seenHeaders.slice(0, 15).join('، ') })) : '';
    $('importMsg').innerHTML = esc(t('msg.noTable')) + found;
    $('importMsg').className = 'msg show err';
    return;
  }
  applyRoster(res, sourceName);
}

$('file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  showMsg(t('msg.reading'), 'info');
  try {
    const name = file.name.toLowerCase();
    let sheets;
    if (name.endsWith('.csv')) sheets = readCsv(await file.text());
    else if (name.endsWith('.xlsx')) sheets = await readXlsx(await file.arrayBuffer());
    else { showMsg(t('msg.badType'), 'err'); return; }
    importSheets(sheets, file.name);
  } catch (err) {
    showMsg(t('msg.readFail', { e: err.message }), 'err');
  }
  e.target.value = '';
});

$('parsePaste').addEventListener('click', () => {
  const text = $('pasteBox').value;
  if (!text.trim()) { flash(t('msg.pasteEmpty'), 'err'); return; }
  try {
    const sheets = text.includes('\t')
      ? [text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '').map(l => l.split('\t'))]
      : readCsv(text);
    importSheets(sheets, 'الجدول الملصوق');
  } catch (err) {
    flash(t('msg.pasteFail', { e: err.message }), 'err');
  }
});

// ===== عداد الدقيقة =====
let tRemaining = TIMER_TOTAL;
let tEnd = 0;
let tTick = null;

function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function tSetMsg(text, kind) {
  const m = $('tMsg');
  m.textContent = text || '';
  m.className = 'msg' + (text ? ' show ' + (kind || 'info') : '');
}

function tRender(state) {
  const d = $('tDisplay');
  d.textContent = fmtTime(tRemaining);
  d.className = 'timer-display' + (state ? ' ' + state : '');
  $('tStart').textContent = tTick ? t('timer.pause')
    : (tRemaining < TIMER_TOTAL && tRemaining > 0 ? t('timer.resume') : t('timer.start'));
}

function tBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.45, 0.9].forEach(offset => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime + offset);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.35);
      o.start(ctx.currentTime + offset);
      o.stop(ctx.currentTime + offset + 0.4);
    });
  } catch (e) { /* الصوت غير متاح: نكتفي بالاهتزاز والرسالة */ }
  try { if (navigator.vibrate) navigator.vibrate([400, 200, 400]); } catch (e) {}
}

function tStop() { clearInterval(tTick); tTick = null; }

function tFinish() {
  tStop();
  tRemaining = 0;
  tRender('done');
  tSetMsg(t('timer.done'), 'ok');
  tBeep();
}

function tLoop() {
  tRemaining = Math.max(0, tEnd - Date.now());
  if (tRemaining <= 0) { tFinish(); return; }
  tRender('running');
}

$('tStart').addEventListener('click', () => {
  if (tTick) {
    tStop();
    tRender('');
    tSetMsg(t('timer.paused'), 'info');
    return;
  }
  if (tRemaining <= 0) tRemaining = TIMER_TOTAL;
  tEnd = Date.now() + tRemaining;
  tSetMsg('');
  tLoop();
  tTick = setInterval(tLoop, 250);
});

$('tReset').addEventListener('click', () => {
  tStop();
  tRemaining = TIMER_TOTAL;
  tSetMsg('');
  tRender('');
});

// عند عودة الصفحة بعد قفل الشاشة نحسب الوقت من جديد
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && tTick) tLoop();
});

// ===== التبويبات =====
function showView(v) {
  $('viewTeachers').hidden = v !== 'teachers';
  $('viewSolo').hidden = v !== 'solo';
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === v));
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

// ===== الفحص الفردي =====
function readSolo() {
  return {
    name: $('sName').value.trim(), g: $('sGender').value, cls: '',
    age: $('sAge').value === '' ? null : Number($('sAge').value), ageEdited: true,
    pre: $('sPre').value, post: $('sPost').value, rec: $('sRec').value,
    protocol: $('sProtocol').value, symptoms: $('sSymptoms').checked
  };
}

function renderSolo() {
  const r = classify(readSolo());
  $('soloResult').innerHTML = r.status ? resultHtml(r) : `<span class="badge none">—</span><div class="flags">${esc(t('solo.empty'))}</div>`;
}

['sName', 'sGender', 'sAge', 'sPre', 'sPost', 'sRec', 'sProtocol', 'sSymptoms'].forEach(id =>
  $(id).addEventListener('input', renderSolo));
$('sProtocol').addEventListener('change', renderSolo);
$('sSymptoms').addEventListener('change', renderSolo);
$('sClear').addEventListener('click', () => {
  ['sName', 'sAge', 'sPre', 'sPost', 'sRec'].forEach(id => { $(id).value = ''; });
  $('sGender').value = ''; $('sProtocol').value = 'cooldown'; $('sSymptoms').checked = false;
  renderSolo();
});

// ===== اللغة =====
$('langBtn').addEventListener('click', () => setLanguage(LANG === 'fr' ? 'ar' : 'fr'));

window.addEventListener('error', e => flash(t('msg.error', { e: e.message }), 'err'));

// ===== البدء =====
(function init() {
  let saved = 'ar';
  try { saved = localStorage.getItem(LANG_KEY) === 'fr' ? 'fr' : 'ar'; } catch (e) {}
  setLang(saved);
  document.documentElement.lang = saved;
  document.documentElement.dir = saved === 'fr' ? 'ltr' : 'rtl';
  $('jsWarn').style.display = 'none';
  applyStaticI18n();
  load();
  renderAll();
  renderSolo();
  tRender('');
})();
