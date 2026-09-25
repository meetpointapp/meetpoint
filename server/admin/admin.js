// MeetPoint yönetim paneli. Kullanıcı içeriği her zaman esc() ile kaçışlanır (XSS'e karşı).
'use strict';

const $ = (sel) => document.querySelector(sel);
// Oturum sekme kapanınca biter (sessionStorage). Erişim jetonu kısa ömürlü; süresi dolunca yenileme jetonuyla yenilenir.
const TOKEN_KEY = 'mp_admin_token';
const REFRESH_KEY = 'mp_admin_refresh';
let token = sessionStorage.getItem(TOKEN_KEY);
let refreshToken = sessionStorage.getItem(REFRESH_KEY);
let role = '';
let reportStatus = 'QUEUE';

// Cihaz kimliği: aynı tarayıcıdan her girişte "yeni cihaz" e-postası gitmesin
const DEVICE_KEY = 'mp_admin_device';
let deviceId = '';
try {
  deviceId = localStorage.getItem(DEVICE_KEY) || '';
  if (!deviceId) localStorage.setItem(DEVICE_KEY, (deviceId = crypto.randomUUID()));
} catch {
  deviceId = '';
}
const deviceHeaders = { 'x-device-id': deviceId, 'x-device-name': 'Yönetim paneli', 'x-platform': 'web' };

const ERRORS = {
  invalid_credentials: 'E-posta veya şifre hatalı.',
  account_locked: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.',
  rate_limited: 'Çok fazla deneme. Biraz bekle.',
  mfa_invalid: 'Kod hatalı. Telefonunun saatinin doğru olduğundan emin ol.',
  mfa_code_used: 'Bu kod az önce kullanıldı. Yeni kodu bekle.',
  forbidden: 'Bu işlem için yetkin yok.',
  not_found: 'Kayıt bulunamadı.',
  cannot_change_own_role: 'Kendi rolünü değiştiremezsin.',
  cannot_ban_self: 'Kendini yasaklayamazsın.',
  cannot_reset_own_mfa: 'Kendi doğrulamanı sıfırlayamazsın.',
  cannot_sanction_staff: 'Ekip üyesine yaptırım verilemez.',
  already_resolved: 'Bu kayıt zaten kapatılmış.',
  already_answered: 'Bu kayıt zaten yanıtlanmış.',
  validation: 'Eksik veya hatalı bilgi.',
  rate_required: 'USD/TL kurunu gir (veya Finans → Ekonomi\'de varsayılan kur tanımla).',
  tc_in_use: 'Bu TC ile başka bir hesap doğrulanmış.',
  banned: 'Bu hesap yasaklı.',
};
const errText = (err) => ERRORS[err.message] || `Hata: ${err.message}`;

const REASONS = {
  fake_profile: 'Sahte profil',
  inappropriate_content: 'Uygunsuz içerik',
  harassment: 'Taciz',
  scam: 'Dolandırıcılık',
  underage: '18 yaş altı',
  other: 'Diğer',
};
const POSES = {
  peace_sign: '✌️ Barış işareti yapıyor',
  thumbs_up: '👍 Başparmağını kaldırıyor',
  hand_on_head: '🙋 Elini başına koyuyor',
  point_up: '☝️ Yukarıyı gösteriyor',
  wave: '👋 El sallıyor',
};
const VERIFY_STATUS = { none: '', pending: 'Tik bekliyor', approved: 'Mavi tik', rejected: 'Tik reddedildi' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 2200);
}

const fmtDate = (d) => new Date(d).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

function saveTokens(r) {
  token = r.token;
  refreshToken = r.refreshToken;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(REFRESH_KEY, refreshToken);
}

// Aynı anda süresi dolan birden fazla istek tek yenileme yapar
let refreshing = null;
function refresh() {
  refreshing ??= (async () => {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error('refresh_failed');
    saveTokens(await res.json());
  })().finally(() => (refreshing = null));
  return refreshing;
}

async function send(method, path, body, retried = false) {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...deviceHeaders, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !retried && refreshToken && !path.startsWith('/auth/')) {
    const data = await res.clone().json().catch(() => ({}));
    if (data.error === 'token_expired') {
      try {
        await refresh();
        return send(method, path, body, true);
      } catch {
        /* aşağıda oturum kapanır */
      }
    }
  }
  return res;
}

async function api(method, path, body) {
  const res = await send(method, path, body);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) logout(false);
    else if (res.status === 403 && data.error === 'mfa_required') showMfaVerify();
    else if (res.status === 403 && data.error === 'mfa_setup_required') showMfaSetup();
    throw Object.assign(new Error(data.error || `http_${res.status}`), { status: res.status });
  }
  return data;
}

// Selfie yetkili istekle alınıp blob URL'ye çevrilir (img etiketi header gönderemez)
async function loadSelfie(img, id) {
  const res = await send('GET', `/admin/api/verifications/${encodeURIComponent(id)}/selfie`);
  if (res.ok) img.src = URL.createObjectURL(await res.blob());
}

// ---------- Oturum ----------
const LOGIN_CARDS = ['#login-form', '#mfa-setup', '#mfa-backup', '#mfa-verify'];
function showCard(id) {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  LOGIN_CARDS.forEach((c) => $(c).classList.toggle('hidden', c !== id));
  $(id).querySelector('input')?.focus();
}
const showLogin = () => showCard('#login-form');

async function showMfaSetup() {
  showCard('#mfa-setup');
  $('#mfa-setup-error').textContent = '';
  const r = await api('POST', '/admin/api/mfa/setup');
  // QR bir resim olarak gösterilir (SVG sayfaya işlenmez)
  $('#mfa-qr').src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(r.qrSvg)}`;
  $('#mfa-secret').textContent = r.secret.replace(/(.{4})/g, '$1 ').trim();
}

function showMfaVerify() {
  $('#mfa-error').textContent = '';
  $('#mfa-code').value = '';
  showCard('#mfa-verify');
}

// Oturum kapatma: sunucuda da kapatılır (jeton çalınmışsa işe yaramaz hâle gelir)
function logout(notifyServer = true) {
  if (notifyServer && token) fetch('/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  token = refreshToken = null;
  role = '';
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  showLogin();
}

// Giriş sonrası: yönetici mi, 2FA kurulu mu, bu oturumda doğrulandı mı?
async function afterLogin() {
  let s;
  try {
    s = await api('GET', '/admin/api/mfa/status');
  } catch (err) {
    if (err.status === 403) {
      logout();
      $('#login-error').textContent = 'Bu hesabın yönetim yetkisi yok.';
    }
    return;
  }
  if (!s.enabled) return showMfaSetup();
  if (!s.verified) return showMfaVerify();
  role = s.role;
  $('#whoami').textContent = `${s.email} · ${{ super: 'Süper yönetici', moderator: 'Moderatör', finance: 'Finans' }[s.role] || s.role}`;
  if (s.backupCodesLeft <= 2) toast(`Sadece ${s.backupCodesLeft} yedek kodun kaldı`);
  start();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    saveTokens(
      await api('POST', '/auth/login', {
        email: $('#login-email').value,
        password: $('#login-password').value,
      }),
    );
    $('#login-password').value = '';
    await afterLogin();
  } catch (err) {
    $('#login-error').textContent = errText(err);
  }
});

$('#mfa-setup').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#mfa-setup-error').textContent = '';
  try {
    const r = await api('POST', '/admin/api/mfa/enable', { code: $('#mfa-setup-code').value.trim() });
    $('#mfa-backup-codes').innerHTML = r.backupCodes.map((c) => `<code>${esc(c)}</code>`).join('');
    $('#mfa-backup-copy').onclick = () => navigator.clipboard.writeText(r.backupCodes.join('\n')).then(() => toast('Kopyalandı'));
    showCard('#mfa-backup');
  } catch (err) {
    $('#mfa-setup-error').textContent = errText(err);
  }
});

$('#mfa-backup-done').addEventListener('click', () => {
  $('#mfa-backup-codes').innerHTML = '';
  afterLogin();
});

$('#mfa-verify').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#mfa-error').textContent = '';
  try {
    await api('POST', '/admin/api/mfa/verify', { code: $('#mfa-code').value.trim() });
    await afterLogin();
  } catch (err) {
    $('#mfa-error').textContent = errText(err);
  }
});

$('#mfa-cancel').addEventListener('click', () => logout());
$('#logout').addEventListener('click', () => logout());

// ---------- Sekmeler ----------
const loaders = {
  overview: loadStats,
  reports: () => loadReports(),
  legal: loadLegal,
  finance: () => loadFinance(),
  verifications: loadVerifications,
  users: loadUsers,
  purchases: loadPurchases,
  payouts: loadPayouts,
  errors: loadErrors,
  staff: loadStaff,
  kvkk: () => loadKvkk(),
  support: () => loadSupport(),
  audit: () => loadAudit(),
};
let errorsResolved = '0';
let payoutStatus = 'PENDING';

document.querySelectorAll('.tab').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
    $(`#tab-${btn.dataset.tab}`).classList.remove('hidden');
    loaders[btn.dataset.tab]();
  }),
);

document.querySelectorAll('#tab-reports .seg-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-reports .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
    reportStatus = btn.dataset.status;
    loadReports();
  }),
);

document.querySelectorAll('#tab-errors .seg-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-errors .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
    errorsResolved = btn.dataset.estatus;
    loadErrors();
  }),
);

document.querySelectorAll('#tab-payouts .seg-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-payouts .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
    payoutStatus = btn.dataset.pstatus;
    loadPayouts();
  }),
);

// ---------- Ortak parçalar ----------
function userLine(u) {
  const pills = [
    u.banned ? '<span class="pill red">Yasaklı</span>' : '',
    u.verificationStatus === 'approved' ? '<span class="pill blue">Mavi tik</span>' : '',
    !u.emailVerified ? '<span class="pill">E-posta doğrulanmadı</span>' : '',
    u.reportCount ? `<span class="pill red">${u.reportCount} şikayet</span>` : '',
    u.deleteAfter ? `<span class="pill red">Silinecek: ${new Date(u.deleteAfter).toLocaleDateString('tr-TR')}</span>` : '',
  ].join(' ');
  return `<div class="user-line">
    <img class="avatar" src="${esc(u.photos[0]?.url || '')}" alt="">
    <div><div class="item-title">${esc(u.displayName || '(profil yok)')} ${pills}</div>
    <div class="muted">${esc(u.email)} · kayıt ${fmtDate(u.createdAt)}</div></div>
  </div>`;
}

function photoStrip(u, { removable = false, reportId = '' } = {}) {
  if (!u.photos.length) return '<p class="muted">Fotoğraf yok</p>';
  return `<div class="photos">${u.photos
    .map(
      (p) => `<div class="photo"><img src="${esc(p.url)}" alt="">${
        removable ? `<button data-remove-photo="${esc(p.id)}" data-report="${esc(reportId)}">Kaldır</button>` : ''
      }</div>`,
    )
    .join('')}</div>`;
}

// ---------- Özet ----------
async function loadStats() {
  const s = await api('GET', '/admin/api/stats');
  $('#count-reports').textContent = s.openModeration || '';
  $('#count-legal').textContent = s.openLegal || '';
  $('#count-verifications').textContent = s.pendingVerifications || '';
  $('#count-payouts').textContent = s.payoutsPending || '';
  $('#count-errors').textContent = s.openErrors || '';
  $('#count-dsr').textContent = s.openDsr || '';
  $('#count-support').textContent = s.openSupport || '';
  const cards = [
    ['Kullanıcı', s.users],
    ['E-postası doğrulanmış', s.verifiedEmail],
    ['Mavi tikli', s.verified],
    ['Yasaklı', s.banned],
    ['Açık şikayet', s.openReports, s.openReports > 0],
    ['Bekleyen mavi tik', s.pendingVerifications, s.pendingVerifications > 0],
    ['Satış', s.sales],
    ['Gelir (USD, brüt)', '$' + s.revenueUsd.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
    ['İade', s.refunds, s.refunds > 0],
    ['Özelliklere harcanan jeton', s.coinsSpentOnFeatures.toLocaleString('tr-TR')],
    ['Satın alınan jeton', s.coinsPurchased.toLocaleString('tr-TR')],
    ['Kullanıcılara geçen jeton', s.coinsEarned.toLocaleString('tr-TR')],
    ['Tamamlanan arama', s.calls.toLocaleString('tr-TR')],
    ['Şu an aktif arama', s.liveCalls],
    ['Arama dakikası', s.callMinutes.toLocaleString('tr-TR')],
    ['Arama + hediye jetonu', (s.callCoins + s.giftCoins).toLocaleString('tr-TR')],
    ['Bekleyen ödeme', `${s.payoutsPending} · $${s.payoutsPendingUsd.toFixed(2)}`, s.payoutsPending > 0],
    ['Ödenen (USD)', '$' + s.payoutsPaidUsd.toLocaleString('tr-TR', { minimumFractionDigits: 2 })],
    ['Açık KVKK başvurusu', s.overdueDsr ? `${s.openDsr} · ${s.overdueDsr} gecikmiş` : s.openDsr, s.overdueDsr > 0],
    ['Yanıt bekleyen destek', s.overdueSupport ? `${s.openSupport} · ${s.overdueSupport} gecikmiş` : s.openSupport, s.overdueSupport > 0],
  ];
  $('#stats').innerHTML = cards
    .map(([label, value, alert]) => `<div class="card stat ${alert ? 'alert' : ''}"><div class="value">${esc(value)}</div><div class="label">${esc(label)}</div></div>`)
    .join('');
}

// ---------- Moderasyon kuyruğu ----------
const LEVELS = { warning: 'Uyarı', restrict_24h: '24 saat kısıt', restrict_7d: '7 gün kısıt', ban: 'Kalıcı yasak' };
const FLAG_KINDS = {
  photo_suspicious: 'Şüpheli fotoğraf',
  contact_repeat: 'Tekrarlayan iletişim bilgisi paylaşımı',
  spam: 'Toplu mesaj',
  report_burst: 'Kısa sürede çok şikayet (otomatik 24 saat kısıt verildi)',
};
const PRIO = { 1: '🔴 Acil', 2: '🟠 Yüksek', 3: '⚪ Normal' };
const age = (h) => (h < 1 ? `${Math.round(h * 60)} dk` : h < 48 ? `${Math.round(h)} sa` : `${Math.round(h / 24)} gün`);

function briefLine(u, extra = '') {
  if (!u) return '<span class="muted">(hesap silinmiş)</span>';
  const pills = [
    u.banned ? '<span class="pill red">Yasaklı</span>' : '',
    u.restrictedUntil ? `<span class="pill red">Kısıtlı: ${fmtDate(u.restrictedUntil)}</span>` : '',
  ].join(' ');
  return `<div><span class="item-title">${esc(u.displayName || '(profil yok)')}</span> ${pills}<div class="muted small">${esc(u.email)}${extra}</div></div>`;
}

function thumbs(u, reportId) {
  if (!u?.photos?.length) return '';
  return `<div class="thumbs">${u.photos
    .map((p) => `<div class="photo"><img class="${p.hidden ? 'hidden-photo' : ''}" src="${esc(p.url)}" alt=""><button data-remove-photo="${esc(p.id)}" data-report="${esc(reportId || '')}">Kaldır</button></div>`)
    .join('')}</div>`;
}

const sanctionButtons = (userId, attrs) => `
  <button class="btn soft" data-sanction="${esc(userId)}" ${attrs}>Yaptırım (sıradaki)</button>
  <button class="btn red" data-sanction="${esc(userId)}" data-level="ban" ${attrs}>Kalıcı yasak</button>
  <button class="btn ghost" data-history="${esc(userId)}">Geçmiş</button>`;

function queueItem(i) {
  const head = `<div class="item-head"><div>${PRIO[i.priority] || ''} <span class="muted">· ${age(i.ageHours)} önce</span></div></div>`;
  if (i.type === 'report') {
    return `<div class="card item" data-item="${esc(i.id)}">${head}
      <div><span class="pill red">Şikayet: ${esc(REASONS[i.reason] || i.reason)}</span> <span class="muted small">şikayet eden: ${esc(i.reporter?.displayName || i.reporter?.email || '?')}</span></div>
      ${briefLine(i.user)}
      ${i.details ? `<div class="detail">${esc(i.details)}</div>` : ''}
      ${thumbs(i.user, i.id)}
      <div class="actions"><button class="btn soft" data-dismiss="${esc(i.id)}">Yoksay</button>${sanctionButtons(i.user?.id, `data-report-id="${esc(i.id)}"`)}</div>
      <div class="history hidden" data-history-for="${esc(i.user?.id)}"></div></div>`;
  }
  if (i.type === 'flag') {
    const evidence = i.photo
      ? `<img class="evidence" src="${esc(i.photo.url)}" alt="">`
      : i.message
        ? `<div class="detail">“${esc(i.message.body)}”</div>`
        : '';
    const actions = i.photo
      ? `<button class="btn green" data-flag="${esc(i.id)}" data-action="approve_photo">Fotoğrafı onayla</button>
         <button class="btn soft" data-flag="${esc(i.id)}" data-action="remove_photo">Fotoğrafı kaldır</button>
         <button class="btn red" data-flag="${esc(i.id)}" data-action="sanction">Kaldır + yaptırım</button>`
      : `<button class="btn soft" data-flag="${esc(i.id)}" data-action="dismiss">Yoksay</button>
         <button class="btn red" data-flag="${esc(i.id)}" data-action="sanction">Yaptırım (sıradaki)</button>`;
    return `<div class="card item" data-item="${esc(i.id)}">${head}
      <div><span class="pill blue">Otomatik: ${esc(FLAG_KINDS[i.kind] || i.kind)}</span></div>
      ${briefLine(i.user)}${evidence}
      <div class="actions">${actions}<button class="btn ghost" data-history="${esc(i.user?.id)}">Geçmiş</button></div>
      <div class="history hidden" data-history-for="${esc(i.user?.id)}"></div></div>`;
  }
  return `<div class="card item" data-item="${esc(i.id)}">${head}
    <div><span class="pill green">İtiraz</span> <span class="muted small">${esc(LEVELS[i.sanction.level] || i.sanction.level)} · ${esc(REASONS[i.sanction.reason] || i.sanction.reason)} · ${fmtDate(i.sanction.createdAt)}</span></div>
    ${briefLine(i.user)}
    ${i.sanction.note ? `<div class="muted small">Yaptırım notu: ${esc(i.sanction.note)}</div>` : ''}
    <div class="detail answer">${esc(i.message)}</div>
    <div class="actions"><button class="btn green" data-appeal="${esc(i.id)}" data-accept="1">Kabul et (yaptırımı kaldır)</button>
      <button class="btn soft" data-appeal="${esc(i.id)}" data-accept="0">Reddet</button>
      <button class="btn ghost" data-history="${esc(i.user?.id)}">Geçmiş</button></div>
    <div class="history hidden" data-history-for="${esc(i.user?.id)}"></div></div>`;
}

async function loadQueue() {
  const { items, stats } = await api('GET', '/admin/api/moderation/queue');
  $('#queue-stats').innerHTML = [
    ['Açık', stats.open],
    ['Acil', stats.urgent, stats.urgent > 0],
    ['En eski', stats.open ? age(stats.oldestHours) : '—', stats.oldestHours > 24],
    ['Ort. çözüm (7 gün)', stats.resolved7d ? age(stats.avgResolutionHours7d) : '—'],
  ]
    .map(([l, v, a]) => `<div class="card stat ${a ? 'alert' : ''}"><div class="value">${esc(v)}</div><div class="label">${esc(l)}</div></div>`)
    .join('');
  $('#queue').innerHTML = items.length ? items.map(queueItem).join('') : '<div class="card empty">Kuyruk boş 🎉</div>';
}

async function showHistory(userId) {
  const box = document.querySelector(`.history[data-history-for="${CSS.escape(userId)}"]`);
  if (!box) return;
  if (!box.classList.contains('hidden')) return box.classList.add('hidden');
  const h = await api('GET', `/admin/api/moderation/users/${encodeURIComponent(userId)}/history`);
  box.innerHTML = `<div class="muted small">Sıradaki basamak: <b>${esc(LEVELS[h.nextLevel])}</b> · aldığı şikayet: ${h.reportsAgainst.length} · yaptığı şikayet: ${h.reportsFiled}</div>
    ${h.sanctions
      .map(
        (s) => `<div class="small">${fmtDate(s.createdAt)} · <b>${esc(LEVELS[s.level] || s.level)}</b> · ${esc(REASONS[s.reason] || s.reason)}
        ${s.revoked ? '<span class="pill green">kaldırıldı</span>' : `<button class="btn ghost" data-revoke="${esc(s.id)}">Kaldır</button>`}
        ${s.appeal ? `<span class="pill">itiraz: ${esc(s.appeal.status)}</span>` : ''}</div>`,
      )
      .join('') || '<div class="muted small">Yaptırım yok</div>'}
    ${h.reportsAgainst.slice(0, 10).map((r) => `<div class="small muted">${fmtDate(r.createdAt)} · şikayet: ${esc(REASONS[r.reason] || r.reason)} · ${esc(r.status)}</div>`).join('')}`;
  box.classList.remove('hidden');
}

$('#queue').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.history) return showHistory(t.dataset.history);
    if (t.dataset.revoke) {
      if (!confirm('Bu yaptırım kaldırılsın mı?')) return;
      await api('POST', `/admin/api/moderation/sanctions/${t.dataset.revoke}/revoke`);
      toast('Yaptırım kaldırıldı');
    } else if (t.dataset.dismiss) {
      await api('POST', `/admin/api/reports/${t.dataset.dismiss}/resolve`, { action: 'dismiss' });
      toast('Şikayet yoksayıldı');
    } else if (t.dataset.sanction) {
      const ban = t.dataset.level === 'ban';
      const note = prompt(ban ? 'Kalıcı yasak gerekçesi (kullanıcıya gösterilir):' : 'Kullanıcıya gösterilecek açıklama:', '');
      if (note === null) return;
      if (t.dataset.reportId) {
        await api('POST', `/admin/api/reports/${t.dataset.reportId}/resolve`, { action: ban ? 'ban' : 'sanction', note });
      } else {
        const reason = prompt('Kural (fake_profile, inappropriate_content, harassment, scam, underage, spam, other):', 'harassment');
        if (!reason) return;
        await api('POST', `/admin/api/moderation/users/${t.dataset.sanction}/sanction`, { reason, note, ...(ban ? { level: 'ban' } : {}) });
      }
      toast('Yaptırım uygulandı');
    } else if (t.dataset.flag) {
      let body = { action: t.dataset.action };
      if (t.dataset.action === 'sanction') {
        const note = prompt('Kullanıcıya gösterilecek açıklama:', '');
        if (note === null) return;
        const reason = prompt('Kural (inappropriate_content, scam, spam, harassment, other):', 'other');
        if (!reason) return;
        body = { ...body, note, reason };
      }
      await api('POST', `/admin/api/moderation/flags/${t.dataset.flag}/resolve`, body);
      toast('Kapatıldı');
    } else if (t.dataset.appeal) {
      const accept = t.dataset.accept === '1';
      const answer = prompt(accept ? 'Kullanıcıya yanıt (yaptırım kaldırılacak):' : 'Ret gerekçesi (kullanıcıya gider):', '');
      if (!answer) return;
      await api('POST', `/admin/api/moderation/appeals/${t.dataset.appeal}/decide`, { accept, answer });
      toast(accept ? 'İtiraz kabul edildi' : 'İtiraz reddedildi');
    } else if (t.dataset.removePhoto) {
      if (!confirm('Bu fotoğraf kalıcı olarak silinsin mi?')) return;
      await api('DELETE', `/admin/api/photos/${t.dataset.removePhoto}`);
      toast('Fotoğraf kaldırıldı');
    } else return;
    loadQueue();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- Çözülmüş şikayetler ----------
async function loadReports() {
  const queueView = reportStatus === 'QUEUE';
  ['#queue', '#queue-stats'].forEach((s) => $(s).classList.toggle('hidden', !queueView));
  $('#reports').classList.toggle('hidden', queueView);
  if (queueView) return loadQueue();
  const list = await api('GET', `/admin/api/reports?status=${reportStatus}`);
  const el = $('#reports');
  if (!list.length) {
    el.innerHTML = `<div class="card empty">${reportStatus === 'OPEN' ? 'Açık şikayet yok 🎉' : 'Henüz çözülmüş şikayet yok'}</div>`;
    return;
  }
  el.innerHTML = list
    .map(
      (r) => `<div class="card item">
      <div class="item-head">
        <div><span class="pill red">${esc(REASONS[r.reason] || r.reason)}</span>
          <span class="muted">· ${fmtDate(r.createdAt)} · şikayet eden: ${esc(r.from.displayName || r.from.email)}</span></div>
        ${r.status === 'RESOLVED' ? `<span class="pill green">${esc({ banned: 'Yasaklandı', dismissed: 'Yoksayıldı', photo_removed: 'Fotoğraf kaldırıldı', sanctioned: 'Yaptırım' }[r.resolution] || r.resolution)}</span>` : ''}
      </div>
      ${userLine(r.to)}
      ${r.details ? `<div class="detail">${esc(r.details)}</div>` : ''}
      ${r.to.bio ? `<div class="muted">Biyografi: ${esc(r.to.bio)}</div>` : ''}
      ${photoStrip(r.to, { removable: r.status === 'OPEN', reportId: r.id })}
      ${
        r.status === 'OPEN'
          ? `<div class="actions">
          <button class="btn soft" data-dismiss="${esc(r.id)}">Yoksay</button>
          ${r.to.banned ? '' : `<button class="btn red" data-ban-report="${esc(r.id)}">Kullanıcıyı yasakla</button>`}
        </div>`
          : ''
      }
    </div>`,
    )
    .join('');
}

$('#reports').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.dismiss) {
      await api('POST', `/admin/api/reports/${t.dataset.dismiss}/resolve`, { action: 'dismiss' });
      toast('Şikayet yoksayıldı');
    } else if (t.dataset.banReport) {
      if (!confirm('Bu kullanıcı yasaklansın mı? Oturumları kapanır ve bekleyen istekleri iade edilir.')) return;
      await api('POST', `/admin/api/reports/${t.dataset.banReport}/resolve`, { action: 'ban' });
      toast('Kullanıcı yasaklandı');
    } else if (t.dataset.removePhoto) {
      if (!confirm('Bu fotoğraf kalıcı olarak silinsin mi?')) return;
      const q = t.dataset.report ? `?reportId=${encodeURIComponent(t.dataset.report)}` : '';
      await api('DELETE', `/admin/api/photos/${t.dataset.removePhoto}${q}`);
      toast('Fotoğraf kaldırıldı');
    } else return;
    loadReports();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- Mavi tik ----------
async function loadVerifications() {
  const list = await api('GET', '/admin/api/verifications');
  const el = $('#verifications');
  if (!list.length) {
    el.innerHTML = '<div class="card empty">Bekleyen başvuru yok 🎉</div>';
    return;
  }
  el.innerHTML = list
    .map(
      (v) => `<div class="card item">
      ${userLine(v.user)}
      <div class="verify-grid">
        <div class="selfie"><img data-selfie="${esc(v.id)}" alt="Selfie">
          <div class="pose">İstenen poz: ${esc(POSES[v.pose] || v.pose)}</div>
          <div class="muted">${fmtDate(v.createdAt)}</div></div>
        <div><div class="muted mb-8">Profil fotoğrafları</div>${photoStrip(v.user)}</div>
      </div>
      <div class="actions">
        <button class="btn green" data-approve="${esc(v.id)}">Onayla</button>
        <button class="btn soft" data-reject="${esc(v.id)}">Reddet</button>
      </div>
    </div>`,
    )
    .join('');
  el.querySelectorAll('img[data-selfie]').forEach((img) => loadSelfie(img, img.dataset.selfie));
}

$('#verifications').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.approve) {
      await api('POST', `/admin/api/verifications/${t.dataset.approve}/approve`, {});
      toast('Mavi tik verildi');
    } else if (t.dataset.reject) {
      const note = prompt('Reddetme sebebi (isteğe bağlı):', 'Selfie profil fotoğraflarıyla eşleşmiyor');
      if (note === null) return;
      await api('POST', `/admin/api/verifications/${t.dataset.reject}/reject`, { note });
      toast('Başvuru reddedildi');
    } else return;
    loadVerifications();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- Kullanıcılar ----------
let searchTimer;
$('#user-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadUsers, 300);
});

async function loadUsers() {
  const q = $('#user-search').value.trim();
  const list = await api('GET', `/admin/api/users?q=${encodeURIComponent(q)}`);
  const el = $('#users');
  if (!list.length) {
    el.innerHTML = '<div class="card empty">Kullanıcı bulunamadı</div>';
    return;
  }
  el.innerHTML = list
    .map(
      (u) => `<div class="card item">
      <div class="item-head">${userLine(u)}
        <div class="actions">${
          u.banned
            ? `<button class="btn soft" data-unban="${esc(u.id)}">Yasağı kaldır</button>`
            : `<button class="btn red" data-ban="${esc(u.id)}">Yasakla</button>`
        }</div>
      </div>
      ${u.banned && u.banReason ? `<div class="muted">Yasak sebebi: ${esc(u.banReason)}</div>` : ''}
      ${VERIFY_STATUS[u.verificationStatus] && u.verificationStatus !== 'approved' ? `<div class="muted">${esc(VERIFY_STATUS[u.verificationStatus])}</div>` : ''}
    </div>`,
    )
    .join('');
}

$('#users').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.ban) {
      const reason = prompt('Yasaklama sebebi:', '');
      if (reason === null) return;
      await api('POST', `/admin/api/users/${t.dataset.ban}/ban`, { reason });
      toast('Kullanıcı yasaklandı');
    } else if (t.dataset.unban) {
      await api('POST', `/admin/api/users/${t.dataset.unban}/unban`, {});
      toast('Yasak kaldırıldı');
    } else return;
    loadUsers();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- Satışlar ----------
const STORES = { app_store: 'App Store', play_store: 'Google Play', dev: 'Test' };

async function loadPurchases() {
  const list = await api('GET', '/admin/api/purchases');
  const el = $('#purchases');
  if (!list.length) {
    el.innerHTML = '<div class="card empty">Henüz satış yok</div>';
    return;
  }
  el.innerHTML = list
    .map(
      (p) => `<div class="card item"><div class="item-head">
        <div><span class="item-title">${esc(p.coins.toLocaleString('tr-TR'))} jeton</span>
          ${p.bonusCoins ? `<span class="pill green">+${esc(p.bonusCoins)} bonus</span>` : ''}
          <span class="pill">${esc(STORES[p.store] || p.store)}</span>
          ${p.sandbox ? '<span class="pill blue">Sandbox</span>' : ''}
          ${p.status === 'REFUNDED' ? '<span class="pill red">İade edildi</span>' : ''}</div>
        <div class="muted">${p.priceUsd != null ? '$' + esc(p.priceUsd.toFixed(2)) : '—'} · ${fmtDate(p.createdAt)}</div>
      </div><div class="muted">${esc(p.user.displayName || '(profil yok)')} · ${esc(p.user.email)}</div></div>`,
    )
    .join('');
}

// ---------- Ödemeler ----------
const PAYOUT_STATUS = { PAID: ['Ödendi', 'green'], REJECTED: ['Reddedildi', 'red'], CANCELLED: ['İptal edildi', ''] };

async function loadPayouts() {
  const list = await api('GET', `/admin/api/payouts?status=${payoutStatus}`);
  const el = $('#payouts');
  if (!list.length) {
    el.innerHTML = `<div class="card empty">${payoutStatus === 'PENDING' ? 'Bekleyen ödeme yok 🎉' : 'Kayıt yok'}</div>`;
    return;
  }
  el.innerHTML = list
    .map((p) => {
      const u = p.user;
      const [label, color] = PAYOUT_STATUS[p.status] || [];
      const newAccount = u && Date.now() - new Date(u.memberSince).getTime() < 7 * 24 * 3600_000;
      const pills = u
        ? [
            u.verified ? '<span class="pill blue">Mavi tik</span>' : '<span class="pill red">Doğrulanmamış</span>',
            u.banned ? '<span class="pill red">Yasaklı</span>' : '',
            u.reportCount ? `<span class="pill red">${u.reportCount} şikayet</span>` : '',
            newAccount ? '<span class="pill red">Yeni hesap</span>' : '',
          ].join(' ')
        : '<span class="pill">Hesap silinmiş</span>';
      return `<div class="card item">
        <div class="item-head">
          <div><span class="item-title">$${esc(p.usd.toFixed(2))}</span>
            <span class="muted">· ${esc(p.coins.toLocaleString('tr-TR'))} jeton · ${fmtDate(p.createdAt)}</span></div>
          ${label ? `<span class="pill ${color}">${label}</span>` : ''}
        </div>
        <div><div class="item-title">${esc(u?.displayName || '')} ${pills}</div><div class="muted">${esc(p.email)}</div></div>
        <div class="detail"><b>${p.method === 'iban' ? 'IBAN' : 'PayPal'}:</b> <code>${esc(p.accountValue)}</code>
          ${p.accountName ? `<br><b>Hesap sahibi:</b> ${esc(p.accountName)}` : ''}
          ${p.withholdingUsd ? `<br><b>Stopaj:</b> $${esc(p.withholdingUsd.toFixed(2))} · <b>Net ödenecek:</b> $${esc(p.netUsd.toFixed(2))}` : ''}
          ${p.exportedAt ? `<br><span class="pill blue">EFT dosyasında · ${fmtDate(p.exportedAt)}</span>` : ''}</div>
        ${(p.riskFlags || []).length ? `<div>${p.riskFlags.map((f) => `<span class="pill red">${esc(RISK[f] || f)}</span>`).join(' ')}</div>` : ''}
        ${p.status === 'PAID' ? `<div class="actions"><button class="btn ghost" data-receipt="${esc(p.id)}">Ödeme belgesi</button></div>` : ''}
        ${p.reference ? `<div class="muted">İşlem no: ${esc(p.reference)} · ${fmtDate(p.processedAt)}</div>` : ''}
        ${p.adminNote ? `<div class="muted">Red sebebi: ${esc(p.adminNote)}</div>` : ''}
        ${
          p.status === 'PENDING'
            ? `<div class="actions">
            <button class="btn green" data-pay="${esc(p.id)}">Ödendi olarak işaretle</button>
            <button class="btn red" data-reject-payout="${esc(p.id)}">Reddet</button>
          </div>`
            : ''
        }
      </div>`;
    })
    .join('');
}

$('#payouts').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.pay) {
      const reference = prompt('Havale / PayPal işlem numarası:');
      if (!reference) return;
      await api('POST', `/admin/api/payouts/${t.dataset.pay}/pay`, { reference });
      toast('Ödendi olarak işaretlendi');
    } else if (t.dataset.rejectPayout) {
      const note = prompt('Red sebebi (kullanıcıya gösterilir):');
      if (!note) return;
      await api('POST', `/admin/api/payouts/${t.dataset.rejectPayout}/reject`, { note });
      toast('Talep reddedildi, jetonlar iade edildi');
    } else return;
    loadPayouts();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- EFT ve ödeme belgesi ----------
const RISK = {
  monthly_cap: 'Aylık tavan aşıldı',
  new_account: 'Yeni hesap (<30 gün)',
  same_device: 'Ödeyenle aynı cihaz',
  same_ip: 'Ödeyenle aynı IP',
  single_payer: 'Kazancın tamamı tek kişiden',
};
let lastEftIds = [];

$('#eft-export').addEventListener('click', async () => {
  const rate = $('#eft-rate').value;
  const res = await send('GET', `/admin/api/finance/eft${rate ? `?rate=${encodeURIComponent(rate)}` : ''}`);
  if (!res.ok) return toast(errText(new Error((await res.json().catch(() => ({}))).error || `http_${res.status}`)));
  const text = await res.text();
  lastEftIds = text.split(/\r?\n/).slice(1).map((l) => l.split(';').at(-1)).filter(Boolean);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = `eft-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${lastEftIds.length} ödeme dosyaya eklendi`);
  loadPayouts();
});

$('#eft-paid').addEventListener('click', async () => {
  if (!lastEftIds.length) return toast('Önce EFT dosyasını indir');
  const reference = prompt(`${lastEftIds.length} ödeme için banka dekont / toplu işlem numarası:`);
  if (!reference) return;
  try {
    const r = await api('POST', '/admin/api/finance/payouts/bulk-paid', { ids: lastEftIds, reference });
    toast(`${r.done} ödeme işaretlendi${r.failed.length ? `, ${r.failed.length} başarısız` : ''}`);
    lastEftIds = [];
    loadPayouts();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

$('#payouts').addEventListener('click', async (e) => {
  const t = e.target.closest('button[data-receipt]');
  if (!t) return;
  const res = await send('GET', `/admin/api/finance/payouts/${t.dataset.receipt}/receipt`);
  if (!res.ok) return toast('Belge açılamadı');
  const w = window.open(URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' })), '_blank');
  if (!w) toast('Açılır pencere engellendi');
});

// ---------- Finans ----------
let finView = 'kyc';
document.querySelectorAll('#tab-finance .seg-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-finance .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
    finView = btn.dataset.fin;
    loadFinance();
  }),
);

function loadFinance() {
  ['kyc', 'economy', 'report'].forEach((v) => $(`#fin-${v}`).classList.toggle('hidden', v !== finView));
  return { kyc: loadKyc, economy: loadEconomy, report: loadReport }[finView]();
}

async function loadKyc() {
  const list = await api('GET', '/admin/api/finance/kyc');
  $('#count-kyc').textContent = list.length || '';
  $('#kyc').innerHTML = list.length
    ? list
        .map(
          (k) => `<div class="card item"><div class="item-head">
        <div><span class="item-title">${esc(k.fullName)}</span> <span class="muted">· TC ${esc(k.tcMasked)} · ${esc(k.email)}</span>
          ${k.blueCheck ? '<span class="pill blue">Mavi tik</span>' : '<span class="pill red">Mavi tik yok</span>'}</div>
        <div class="muted">${fmtDate(k.createdAt)}</div></div>
        ${k.hasDocument ? `<div><button class="btn soft" data-doc="${esc(k.id)}">Belgeyi göster</button><div data-doc-box="${esc(k.id)}"></div></div>` : ''}
        <div class="actions"><button class="btn green" data-kyc="${esc(k.id)}" data-approve="1">Onayla</button>
          <button class="btn red" data-kyc="${esc(k.id)}" data-approve="0">Reddet</button></div></div>`,
        )
        .join('')
    : '<div class="card empty">Bekleyen kimlik doğrulama yok 🎉</div>';
}

$('#kyc').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.doc) {
    const res = await send('GET', `/admin/api/finance/kyc/${t.dataset.doc}/document`);
    if (!res.ok) return toast('Belge açılamadı');
    document.querySelector(`[data-doc-box="${t.dataset.doc}"]`).innerHTML = `<img class="doc" src="${URL.createObjectURL(await res.blob())}" alt="Kimlik belgesi">`;
    return;
  }
  if (!t.dataset.kyc) return;
  const approve = t.dataset.approve === '1';
  const note = approve ? '' : prompt('Red sebebi (kullanıcıya gider):', 'Belge okunmuyor / bilgiler eşleşmiyor');
  if (!approve && !note) return;
  try {
    await api('POST', `/admin/api/finance/kyc/${t.dataset.kyc}/decide`, { approve, note });
    toast(approve ? 'Kimlik onaylandı' : 'Başvuru reddedildi');
    loadKyc();
  } catch (err) {
    toast(errText(err));
  }
});

const SETTINGS = [
  ['storeFeeRate', 'Mağaza payı (0.15 = %15)'],
  ['vatRate', 'KDV (0.20 = %20)'],
  ['cashoutUsdPerCoin', 'Bozdurma kuru (USD / jeton)'],
  ['cashoutMinCoins', 'En az çekim (jeton)'],
  ['withholdingRate', 'Stopaj (0 = yok)'],
  ['maturityDays', 'Kazanç olgunlaşma (gün)'],
  ['monthlyPayoutCapUsd', 'Aylık çekim tavanı (USD)'],
  ['usdTryRate', 'Varsayılan USD/TL kuru (EFT)'],
];

function renderEconomy({ settings, packs }) {
  const readOnly = role !== 'super';
  $('#settings-fields').innerHTML = SETTINGS.map(
    ([k, label]) => `<label>${esc(label)}<input type="number" step="any" min="0" data-setting="${k}" value="${esc(settings[k])}" ${readOnly ? 'disabled' : ''}></label>`,
  ).join('');
  $('#settings-save').classList.toggle('hidden', readOnly);
  const pct = (x) => `%${x.marginPct}`;
  $('#packs').innerHTML = `<div class="card item"><table class="data"><thead><tr><th>Paket</th><th>Jeton</th><th>USD</th><th>TL (KDV dahil)</th><th>Net / jeton</th><th>Kâr (şimdi)</th><th>Kâr (%30 payda)</th><th></th></tr></thead><tbody>${packs
    .map(
      (p) => `<tr class="${p.now.profitable ? '' : 'loss'}"><td>${esc(p.id)} ${p.popular ? '⭐' : ''} ${p.active ? '' : '<span class="pill">pasif</span>'}</td>
      <td>${esc(p.coins)}</td><td>$${esc(p.usd)}</td><td>${p.tryPrice ? `₺${esc(p.tryPrice)}` : '—'}</td><td>$${esc(p.now.netPerCoin)}</td>
      <td>${p.now.profitable ? '' : '⚠️ '}${pct(p.now)}</td><td class="${p.at30.profitable ? '' : 'loss'}">${p.at30.profitable ? '' : '⚠️ '}${pct(p.at30)}</td>
      <td>${readOnly ? '' : `<button class="btn ghost" data-pack="${esc(p.id)}">Düzenle</button>`}</td></tr>`,
    )
    .join('')}</tbody></table>${readOnly ? '' : '<div class="actions"><button class="btn soft" data-pack="">Paket ekle</button></div>'}</div>`;
  $('#packs').dataset.packs = JSON.stringify(packs);
}

async function loadEconomy() {
  renderEconomy(await api('GET', '/admin/api/finance/settings'));
}

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries([...document.querySelectorAll('[data-setting]')].map((i) => [i.dataset.setting, Number(i.value)]));
  try {
    renderEconomy(await api('PUT', '/admin/api/finance/settings', body));
    toast('Ayarlar kaydedildi');
  } catch (err) {
    toast(errText(err));
  }
});

$('#packs').addEventListener('click', async (e) => {
  const t = e.target.closest('button[data-pack]');
  if (!t) return;
  const packs = JSON.parse($('#packs').dataset.packs || '[]');
  const cur = packs.find((p) => p.id === t.dataset.pack) || { coins: 0, usd: 0, tryPrice: 0, popular: false, active: true, sortOrder: packs.length + 1 };
  const id = t.dataset.pack || prompt('Mağazadaki ürün kimliği (ör. coins_12000):');
  if (!id) return;
  const coins = Number(prompt('Jeton:', cur.coins));
  const usd = Number(prompt('USD referans fiyat:', cur.usd));
  const tryPrice = Number(prompt('Mağazadaki TL fiyatı (KDV dahil, 0 = bilinmiyor):', cur.tryPrice));
  const active = confirm('Paket satışta olsun mu? (İptal = pasif)');
  const popular = confirm('"En popüler" rozeti bu pakette mi?');
  if (!coins || !usd) return;
  try {
    const r = await api('PUT', `/admin/api/finance/packs/${encodeURIComponent(id)}`, { coins, usd, tryPrice, active, popular, sortOrder: cur.sortOrder });
    renderEconomy({ settings: (await api('GET', '/admin/api/finance/settings')).settings, packs: r.packs });
    toast('Paket kaydedildi');
  } catch (err) {
    toast(errText(err));
  }
});

async function loadReport() {
  if (!$('#report-month').value) $('#report-month').value = new Date().toISOString().slice(0, 7);
  const r = await api('GET', `/admin/api/finance/report?month=${$('#report-month').value}`);
  const usd = (n) => `$${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  const cards = [
    ['Satış', r.sales.count],
    ['Brüt satış', usd(r.sales.grossUsd)],
    ['KDV (tahmini)', usd(r.sales.vatUsd)],
    ['Mağaza payı (tahmini)', usd(r.sales.storeFeeUsd)],
    ['Net gelir (tahmini)', usd(r.sales.netUsd)],
    ['İade', `${r.refunds.count} · ${usd(r.refunds.grossUsd)}`, r.refunds.count > 0],
    ['Ödenen (net)', usd(r.payouts.netUsd)],
    ['Stopaj', usd(r.payouts.withholdingUsd)],
    ['Bekleyen ödeme', `${r.payouts.pendingCount} · ${usd(r.payouts.pendingUsd)}`],
    ['Bozdurulabilir jeton yükümlülüğü', usd(r.liability.maxCashUsd)],
    ['Dolaşımdaki satın alınmış jeton', r.liability.paidCoins.toLocaleString('tr-TR')],
    ['Mutabakat', r.reconciliation.matches && !r.reconciliation.inconsistentWallets ? '✓ tutarlı' : '⚠️ FARK VAR', !r.reconciliation.matches || r.reconciliation.inconsistentWallets > 0],
  ];
  $('#report').innerHTML = `<div class="stats">${cards
    .map(([l, v, a]) => `<div class="card stat ${a ? 'alert' : ''}"><div class="value">${esc(v)}</div><div class="label">${esc(l)}</div></div>`)
    .join('')}</div><p class="muted small">Satış tutarları mağazanın bildirdiği USD karşılığıdır; KDV ve mağaza payı ayarlardaki oranlarla tahmin edilir, kesin tutar mağaza ödeme raporundan alınır.</p>`;
}

$('#report-load').addEventListener('click', () => loadReport().catch((e) => toast(errText(e))));
$('#report-csv').addEventListener('click', async () => {
  const month = $('#report-month').value || new Date().toISOString().slice(0, 7);
  const res = await send('GET', `/admin/api/finance/report?month=${month}&format=csv`);
  if (!res.ok) return toast('Rapor indirilemedi');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob());
  a.download = `finans-${month}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Hatalar ----------
async function loadErrors() {
  const list = await api('GET', `/admin/api/errors?resolved=${errorsResolved}`);
  const el = $('#errors');
  if (!list.length) {
    el.innerHTML = `<div class="card empty">${errorsResolved === '0' ? 'Açık hata yok 🎉' : 'Kayıt yok'}</div>`;
    return;
  }
  el.innerHTML = list
    .map(
      (x) => `<div class="card item">
      <div class="item-head">
        <div><span class="pill ${x.source === 'server' ? 'red' : 'blue'}">${x.source === 'server' ? 'Sunucu' : 'Uygulama'}</span>
          ${x.platform && x.platform !== 'server' ? `<span class="pill">${esc(x.platform)}</span>` : ''}
          ${x.appVersion ? `<span class="pill">v${esc(x.appVersion)}</span>` : ''}
          <span class="item-title">${esc(x.count)}×</span></div>
        <div class="muted">son: ${fmtDate(x.lastSeen)} · ilk: ${fmtDate(x.firstSeen)}</div>
      </div>
      <div class="item-title">${esc(x.message)}</div>
      ${x.context ? `<div class="muted">${esc(x.context)}</div>` : ''}
      ${x.stack ? `<details><summary class="muted">Yığın</summary><pre class="stack">${esc(x.stack)}</pre></details>` : ''}
      ${x.resolvedAt ? '' : `<div class="actions"><button class="btn soft" data-resolve-error="${esc(x.id)}">Çözüldü</button></div>`}
    </div>`,
    )
    .join('');
}

$('#errors').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t?.dataset.resolveError) return;
  try {
    await api('POST', `/admin/api/errors/${t.dataset.resolveError}/resolve`);
    toast('Çözüldü olarak işaretlendi');
    loadErrors();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- KVKK ----------
const DSR_KINDS = { info: 'Bilgi talebi', correction: 'Düzeltme', deletion: 'Silme', objection: 'İtiraz', other: 'Diğer' };
let kvkkView = 'dsr';

document.querySelectorAll('#tab-kvkk .seg-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-kvkk .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
    kvkkView = btn.dataset.kvkk;
    loadKvkk();
  }),
);

function loadKvkk() {
  ['dsr', 'breaches', 'destruction'].forEach((v) => $(`#kvkk-${v}`).classList.toggle('hidden', v !== kvkkView));
  return { dsr: loadDsr, breaches: loadBreaches, destruction: loadDestruction }[kvkkView]();
}

async function loadDsr() {
  const list = await api('GET', '/admin/api/privacy/dsr');
  $('#dsr').innerHTML = list.length
    ? list
        .map(
          (r) => `<div class="card item">
        <div class="item-head"><div><span class="pill blue">${esc(DSR_KINDS[r.kind] || r.kind)}</span>
          <span class="muted">· ${esc(r.email)} · ${fmtDate(r.createdAt)}</span></div>
          <span class="pill ${r.overdue ? 'red' : ''}">Son gün: ${new Date(r.dueAt).toLocaleDateString('tr-TR')}${r.overdue ? ' (gecikti)' : ''}</span></div>
        <div class="detail answer">${esc(r.message)}</div>
        <textarea rows="3" data-answer-for="${esc(r.id)}" placeholder="Yanıt (kullanıcıya e-postayla gider)"></textarea>
        <div class="actions"><button class="btn green" data-dsr="${esc(r.id)}" data-status="ANSWERED">Yanıtla</button>
          <button class="btn soft" data-dsr="${esc(r.id)}" data-status="REJECTED">Gerekçeyle reddet</button></div>
      </div>`,
        )
        .join('')
    : '<div class="card empty">Açık başvuru yok 🎉</div>';
}

$('#dsr').addEventListener('click', async (e) => {
  const t = e.target.closest('button[data-dsr]');
  if (!t) return;
  const answer = document.querySelector(`textarea[data-answer-for="${t.dataset.dsr}"]`).value.trim();
  if (answer.length < 10) return toast('Yanıt en az 10 karakter olmalı');
  try {
    await api('POST', `/admin/api/privacy/dsr/${t.dataset.dsr}/answer`, { status: t.dataset.status, answer });
    toast('Yanıt gönderildi');
    loadDsr();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

async function loadBreaches() {
  const list = await api('GET', '/admin/api/privacy/breaches');
  $('#breaches').innerHTML = list
    .map(
      (b) => `<div class="card item">
      <div class="item-head"><div class="item-title">${esc(b.title)}</div><div class="muted">Tespit: ${fmtDate(b.detectedAt)}</div></div>
      <div class="detail answer">${esc(b.description)}</div>
      <div class="muted small">Etkilenen: ${esc(b.affectedCount)} · Kayıt: ${esc(b.createdBy)}</div>
      <div class="actions">
        ${b.authorityNotifiedAt ? `<span class="pill green">Kurul'a bildirildi ${fmtDate(b.authorityNotifiedAt)}</span>` : `<button class="btn soft" data-authority="${esc(b.id)}">Kurul'a bildirildi olarak işaretle</button>`}
        ${b.usersNotifiedAt ? `<span class="pill green">${esc(b.usersNotifiedCount)} kullanıcıya e-posta</span>` : ''}
        <button class="btn soft" data-notify="${esc(b.id)}">Tüm kullanıcılara e-posta</button>
      </div></div>`,
    )
    .join('');
}

$('#breach-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('POST', '/admin/api/privacy/breaches', {
      title: $('#breach-title').value,
      description: $('#breach-desc').value,
      detectedAt: new Date($('#breach-detected').value).toISOString(),
      affectedCount: Number($('#breach-count').value || 0),
    });
    e.target.reset();
    toast('İhlal kaydedildi');
    loadBreaches();
  } catch (err) {
    toast(errText(err));
  }
});

$('#breaches').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.authority) {
      await api('PATCH', `/admin/api/privacy/breaches/${t.dataset.authority}`, { authorityNotified: true });
    } else if (t.dataset.notify) {
      const subject = prompt('E-posta konusu:', 'MeetPoint: güvenlik bildirimi');
      if (!subject) return;
      const message = prompt('E-posta metni (ne oldu, hangi veriler, ne yapmalı):');
      if (!message) return;
      const body = { scope: 'all', subject, message };
      const dry = await api('POST', `/admin/api/privacy/breaches/${t.dataset.notify}/notify`, { ...body, dryRun: true });
      if (!confirm(`${dry.recipients} kullanıcıya e-posta gidecek. Gönderilsin mi?`)) return;
      const r = await api('POST', `/admin/api/privacy/breaches/${t.dataset.notify}/notify`, { ...body, dryRun: false });
      toast(`${r.sent} e-posta gönderildi`);
    } else return;
    loadBreaches();
  } catch (err) {
    toast(errText(err));
  }
});

const DESTRUCTION = {
  account_deleted: 'Hesap silindi',
  inactive_warning_sent: 'Hareketsizlik uyarısı',
  email_codes: 'E-posta kodları',
  sessions: 'Kapanmış oturumlar',
  data_exports: 'Süresi dolan veri dosyaları',
  view_once_photos: 'Açılmamış tek seferlik fotoğraflar',
  error_logs: 'Çözülmüş hata kayıtları',
  traffic_logs: '5651 trafik kayıtları',
  support_tickets: 'Kapanmış destek talepleri',
};

async function loadDestruction() {
  const list = await api('GET', '/admin/api/privacy/destruction-log');
  $('#destruction').innerHTML = list.length
    ? list
        .map(
          (d) => `<div class="card audit-row"><div class="item-head">
        <div><span class="item-title">${esc(DESTRUCTION[d.kind] || d.kind)}</span> <span class="pill">${esc(d.count)}</span>
          ${d.details?.reason ? `<span class="muted">· ${esc(d.details.reason === 'inactive' ? 'hareketsizlik' : 'kullanıcı talebi')}</span>` : ''}</div>
        <div class="muted">${fmtDate(d.createdAt)}</div></div></div>`,
        )
        .join('')
    : '<div class="card empty">Henüz imha kaydı yok</div>';
}

$('#retention-run').addEventListener('click', async () => {
  try {
    const r = await api('POST', '/admin/api/privacy/retention/run');
    toast(`Çalıştı: ${Object.values(r).reduce((a, b) => a + Math.max(0, b), 0)} kayıt`);
    loadDestruction();
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- Resmi talepler ----------
const LEGAL_KINDS = { takedown: 'İçerik kaldırma', information: 'Bilgi talebi', court_order: 'Mahkeme kararı', other: 'Diğer' };

async function loadLegal() {
  const list = await api('GET', '/admin/api/moderation/legal-requests');
  $('#legal').innerHTML = list.length
    ? list
        .map(
          (r) => `<div class="card item"><div class="item-head">
        <div><span class="pill blue">${esc(LEGAL_KINDS[r.kind] || r.kind)}</span> <span class="item-title">${esc(r.authority)}</span> <span class="muted small">${esc(r.referenceNo)}</span></div>
        <span class="pill ${r.overdue ? 'red' : ''}">Son: ${fmtDate(r.dueAt)}${r.overdue ? ' (gecikti)' : ''}</span></div>
        <div class="detail answer">${esc(r.description)}</div>
        ${r.subjectUsers?.length ? `<div class="muted small">İlgili kullanıcılar: ${r.subjectUsers.map(esc).join(', ')}</div>` : ''}
        <textarea rows="2" data-actions-for="${esc(r.id)}" placeholder="Yapılan işlemler (ör. içerik kaldırıldı, trafik kaydı gönderildi)"></textarea>
        <div class="actions"><button class="btn green" data-close="${esc(r.id)}" data-status="DONE">Tamamlandı</button>
          <button class="btn soft" data-close="${esc(r.id)}" data-status="REJECTED">Gerekçeyle reddet</button></div></div>`,
        )
        .join('')
    : '<div class="card empty">Açık resmi talep yok</div>';
}

$('#legal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('POST', '/admin/api/moderation/legal-requests', {
      kind: $('#legal-kind').value,
      authority: $('#legal-authority').value,
      referenceNo: $('#legal-ref').value,
      description: $('#legal-desc').value,
      subjectUsers: $('#legal-users').value.split(',').map((s) => s.trim()).filter(Boolean),
    });
    e.target.reset();
    toast('Talep kaydedildi');
    loadLegal();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

$('#legal').addEventListener('click', async (e) => {
  const t = e.target.closest('button[data-close]');
  if (!t) return;
  const actions = document.querySelector(`textarea[data-actions-for="${t.dataset.close}"]`).value.trim();
  if (actions.length < 5) return toast('Yapılan işlemleri yaz');
  try {
    await api('POST', `/admin/api/moderation/legal-requests/${t.dataset.close}/close`, { status: t.dataset.status, actions });
    toast('Talep kapatıldı');
    loadLegal();
    loadStats();
  } catch (err) {
    toast(errText(err));
  }
});

$('#traffic-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const params = new URLSearchParams({
    from: new Date($('#traffic-from').value).toISOString(),
    to: new Date($('#traffic-to').value).toISOString(),
  });
  if ($('#traffic-user').value.trim()) params.set('userId', $('#traffic-user').value.trim());
  if ($('#traffic-ip').value.trim()) params.set('ip', $('#traffic-ip').value.trim());
  const res = await send('GET', `/admin/api/moderation/traffic?${params}`);
  if (!res.ok) return toast(errText(new Error((await res.json().catch(() => ({}))).error || `http_${res.status}`)));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob());
  a.download = `trafik-${params.get('from').slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#traffic-verify').addEventListener('click', async () => {
  try {
    const r = await api('GET', '/admin/api/moderation/traffic/verify');
    toast(r.ok ? `Zincir sağlam: ${r.batches} parti, ${r.rows} kayıt` : `ZİNCİR BOZUK: parti ${r.brokenAt}`);
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- Ekip ----------
const ROLES = { super: 'Süper yönetici', moderator: 'Moderatör', finance: 'Finans' };

async function loadStaff() {
  const list = await api('GET', '/admin/api/staff');
  $('#staff').innerHTML = list
    .map(
      (s) => `<div class="card item"><div class="item-head">
        <div><span class="item-title">${esc(s.email)}</span> <span class="pill">${esc(ROLES[s.role] || s.role)}</span>
          ${s.mfaEnabled ? '<span class="pill green">2FA açık</span>' : '<span class="pill red">2FA kurulmadı</span>'}</div>
        ${s.mfaEnabled ? `<button class="btn soft" data-reset-mfa="${esc(s.id)}" data-email="${esc(s.email)}">2FA sıfırla</button>` : ''}
      </div></div>`,
    )
    .join('');
}

$('#staff-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#staff-email').value.trim();
  const newRole = $('#staff-role').value;
  if (newRole === 'none' && !confirm(`${email} yönetim ekibinden çıkarılsın mı? Oturumları kapanır.`)) return;
  try {
    await api('POST', '/admin/api/staff', { email, role: newRole });
    $('#staff-email').value = '';
    toast('Kaydedildi');
    loadStaff();
  } catch (err) {
    toast(err.message === 'not_found' ? 'Bu e-postayla bir hesap yok' : errText(err));
  }
});

$('#staff').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t?.dataset.resetMfa) return;
  if (!confirm(`${t.dataset.email} için 2FA sıfırlansın mı? Bir sonraki girişte yeniden kurması gerekir.`)) return;
  try {
    await api('POST', `/admin/api/staff/${t.dataset.resetMfa}/reset-mfa`);
    toast('2FA sıfırlandı');
    loadStaff();
  } catch (err) {
    toast(errText(err));
  }
});

// ---------- İşlem kaydı ----------
const ACTIONS = {
  'user.ban': 'Kullanıcı yasakladı',
  'user.unban': 'Yasağı kaldırdı',
  'report.ban': 'Şikayetle yasakladı',
  'report.dismiss': 'Şikayeti yoksaydı',
  'photo.remove': 'Fotoğraf kaldırdı',
  'verification.approve': 'Mavi tik verdi',
  'verification.reject': 'Mavi tik reddetti',
  'verification.view_selfie': 'Selfie görüntüledi',
  'payout.view_list': 'Ödeme listesini görüntüledi',
  'payout.pay': 'Ödeme yaptı',
  'payout.reject': 'Ödeme reddetti',
  'error.resolve': 'Hatayı çözdü',
  'staff.role': 'Rol değiştirdi',
  'staff.reset_mfa': '2FA sıfırladı',
  'mfa.enable': '2FA kurdu',
  'mfa.backup_code_used': 'Yedek kodla girdi',
  'dsr.answered': 'KVKK başvurusunu yanıtladı',
  'dsr.rejected': 'KVKK başvurusunu reddetti',
  'breach.create': 'İhlal kaydetti',
  'breach.update': 'İhlal kaydını güncelledi',
  'breach.notify_users': 'İhlal e-postası gönderdi',
  'retention.run': 'İmha işini çalıştırdı',
  'report.sanction': 'Şikayetle yaptırım verdi',
  'sanction.warning': 'Uyarı verdi',
  'sanction.restrict_24h': '24 saat kısıtladı',
  'sanction.restrict_7d': '7 gün kısıtladı',
  'sanction.ban': 'Yasakladı',
  'sanction.revoke': 'Yaptırımı kaldırdı',
  'flag.dismissed': 'Otomatik işareti yoksaydı',
  'flag.photo_approved': 'Şüpheli fotoğrafı onayladı',
  'flag.photo_removed': 'Şüpheli fotoğrafı kaldırdı',
  'flag.sanctioned': 'İşaretle yaptırım verdi',
  'appeal.accept': 'İtirazı kabul etti',
  'appeal.reject': 'İtirazı reddetti',
  'legal_request.create': 'Resmi talep kaydetti',
  'legal_request.done': 'Resmi talebi tamamladı',
  'legal_request.rejected': 'Resmi talebi reddetti',
  'traffic.export': 'Trafik kaydı dışa aktardı',
  'traffic.verify': 'Trafik zincirini doğruladı',
  'finance.settings': 'Ekonomi ayarlarını değiştirdi',
  'finance.pack': 'Paketi değiştirdi',
  'finance.report_export': 'Finans raporu indirdi',
  'kyc.view_document': 'Kimlik belgesini görüntüledi',
  'kyc.approve': 'Kimliği onayladı',
  'kyc.reject': 'Kimliği reddetti',
  'payout.eft_export': 'EFT dosyası indirdi',
  'payout.bulk_paid': 'Toplu ödendi işaretledi',
  'payout.receipt': 'Ödeme belgesi açtı',
};
let auditCursor = null;
let auditTimer;
$('#audit-filter').addEventListener('input', () => {
  clearTimeout(auditTimer);
  auditTimer = setTimeout(() => loadAudit(), 300);
});
$('#audit-more').addEventListener('click', () => loadAudit(true));

async function loadAudit(more = false) {
  const params = new URLSearchParams({ action: $('#audit-filter').value.trim() });
  if (more && auditCursor) params.set('before', auditCursor);
  const list = await api('GET', `/admin/api/audit?${params}`);
  const html = list
    .map((a) => {
      const details = Object.keys(a.details || {}).length ? JSON.stringify(a.details) : '';
      return `<div class="card audit-row">
        <div class="item-head"><div><span class="item-title">${esc(ACTIONS[a.action] || a.action)}</span>
          <span class="muted">· ${esc(a.adminEmail)}</span></div>
          <div class="muted">${fmtDate(a.createdAt)}</div></div>
        ${a.targetId ? `<div class="muted small">${esc(a.targetType)}: ${esc(a.targetId)}</div>` : ''}
        ${details ? `<div class="details">${esc(details)}</div>` : ''}
      </div>`;
    })
    .join('');
  if (more) $('#audit').insertAdjacentHTML('beforeend', html);
  else $('#audit').innerHTML = html || '<div class="card empty">Kayıt yok</div>';
  auditCursor = list.length ? list[list.length - 1].createdAt : auditCursor;
  $('#audit-more').classList.toggle('hidden', list.length < 100);
}

// ---------- Destek ----------
const SUPPORT_CATS = { coins: 'Jeton', calls: 'Arama', cashout: 'Para çekme', safety: 'Güvenlik', account: 'Hesap', bug: 'Hata', other: 'Diğer' };
const TICKET_STATUS = { OPEN: ['Yanıt bekliyor', 'red'], ANSWERED: ['Kullanıcıda', 'blue'], CLOSED: ['Kapalı', ''] };
const RELATED = { purchase: 'Satın alma', payout: 'Para çekme', call: 'Arama', wallet: 'Cüzdan hareketi' };
let supView = 'tickets';
let ticketStatus = 'OPEN';
let helpLocale = 'tr';

document.querySelectorAll('#tab-support [data-sup]').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-support [data-sup]').forEach((b) => b.classList.toggle('active', b === btn));
    supView = btn.dataset.sup;
    loadSupport();
  }),
);
document.querySelectorAll('#tab-support [data-tstatus]').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-support [data-tstatus]').forEach((b) => b.classList.toggle('active', b === btn));
    ticketStatus = btn.dataset.tstatus;
    loadTickets();
  }),
);
document.querySelectorAll('#tab-support [data-hlocale]').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-support [data-hlocale]').forEach((b) => b.classList.toggle('active', b === btn));
    helpLocale = btn.dataset.hlocale;
    resetHelpForm();
    loadHelp();
  }),
);

function loadSupport() {
  ['tickets', 'help', 'company'].forEach((v) => $(`#sup-${v}`).classList.toggle('hidden', v !== supView));
  return { tickets: loadTickets, help: loadHelp, company: loadCompany }[supView]();
}

async function loadTickets() {
  const [m, list] = await Promise.all([api('GET', '/admin/api/support/tickets/metrics'), api('GET', `/admin/api/support/tickets?status=${ticketStatus}`)]);
  const cards = [
    ['Yanıt bekleyen', m.open, false],
    ['Geciken', m.overdue, m.overdue > 0],
    ['Son 30 gün', m.last30Days, false],
    ['Ort. ilk yanıt', m.avgFirstResponseHours === null ? '—' : `${m.avgFirstResponseHours} sa`, false],
    [`${m.targetHours} saatte yanıt`, m.withinTargetPct === null ? '—' : `%${m.withinTargetPct}`, m.withinTargetPct !== null && m.withinTargetPct < 90],
  ];
  $('#support-metrics').innerHTML = cards
    .map(([label, value, alert]) => `<div class="card stat ${alert ? 'alert' : ''}"><div class="value">${esc(value)}</div><div class="label">${esc(label)}</div></div>`)
    .join('');
  $('#tickets').innerHTML = list.length
    ? list
        .map(
          (t) => `<div class="card item" data-ticket-card="${esc(t.id)}">
        <div class="item-head"><div><span class="pill blue">${esc(SUPPORT_CATS[t.category] || t.category)}</span>
          <span class="item-title">${esc(t.subject)}</span>
          <span class="muted">· ${esc(t.email)} · ${fmtDate(t.createdAt)} · ${t.messageCount} mesaj${t.platform ? ` · ${esc(t.platform)}` : ''}</span></div>
          ${t.status === 'OPEN' ? `<span class="pill ${t.overdue ? 'red' : ''}">Hedef: ${fmtDate(t.dueAt)}${t.overdue ? ' (gecikti)' : ''}</span>` : `<span class="pill ${TICKET_STATUS[t.status][1]}">${TICKET_STATUS[t.status][0]}</span>`}</div>
        <div class="actions"><button class="btn soft" data-ticket-open="${esc(t.id)}">Aç</button></div>
        <div class="ticket-body hidden"></div>
      </div>`,
        )
        .join('')
    : '<div class="card empty">Bu listede talep yok 🎉</div>';
}

async function openTicket(card, id) {
  const body = card.querySelector('.ticket-body');
  const t = await api('GET', `/admin/api/support/tickets/${encodeURIComponent(id)}`);
  const u = t.user;
  const pills = [
    u.banned ? '<span class="pill red">Yasaklı</span>' : '',
    u.verificationStatus === 'approved' ? '<span class="pill blue">Mavi tik</span>' : '',
    u.kycStatus === 'approved' ? '<span class="pill green">Kimlik doğrulandı</span>' : '',
  ].join(' ');
  const related = t.related
    ? `<div class="small"><b>${esc(RELATED[t.related.type] || t.related.type)}:</b> ${esc(t.related.text)} · ${fmtDate(t.related.createdAt)}${t.related.transactionId ? ` · <code>${esc(t.related.transactionId)}</code>` : ''}</div>`
    : '';
  const thread = t.messages
    .map(
      (m) => `<div class="msg ${m.fromStaff ? 'staff' : ''}">${esc(m.body)}${m.hasAttachment ? `<div><button class="btn soft small" data-attach="${esc(m.id)}">Ekran görüntüsünü aç</button></div>` : ''}
        <div class="meta">${m.fromStaff ? `Destek${m.staff ? ` (${esc(m.staff)})` : ''}` : 'Kullanıcı'} · ${fmtDate(m.createdAt)}</div></div>`,
    )
    .join('');
  const reply =
    t.status === 'CLOSED'
      ? '<p class="muted">Talep kapalı.</p>'
      : `<textarea rows="3" data-reply-for="${esc(t.id)}" placeholder="Yanıt (uygulamada görünür, bildirim ve e-postayla gider)"></textarea>
    <div class="actions"><button class="btn green" data-reply="${esc(t.id)}">Yanıtla</button>
      <button class="btn soft" data-reply="${esc(t.id)}" data-close="1">Yanıtla ve kapat</button>
      <button class="btn ghost" data-tclose="${esc(t.id)}">Yanıtsız kapat</button></div>`;
  body.innerHTML = `
    <div class="detail">${esc(u.name || '—')} · ${esc(u.email)} · ${esc(u.locale.toUpperCase())} · üyelik ${new Date(u.createdAt).toLocaleDateString('tr-TR')} · bakiye ${u.balance.toLocaleString('tr-TR')} jeton ${pills}
      <div class="muted small">Kullanıcı kimliği: <code>${esc(u.id)}</code>${t.appVersion ? ` · Uygulama ${esc(t.appVersion)}` : ''}</div>
      ${related}
    </div>
    <div class="thread">${thread}</div>
    ${reply}`;
  body.classList.remove('hidden');
}

$('#tickets').addEventListener('click', async (e) => {
  const open = e.target.closest('button[data-ticket-open]');
  const attach = e.target.closest('button[data-attach]');
  const reply = e.target.closest('button[data-reply]');
  const close = e.target.closest('button[data-tclose]');
  try {
    if (open) {
      const card = open.closest('[data-ticket-card]');
      const body = card.querySelector('.ticket-body');
      if (!body.classList.contains('hidden')) return body.classList.add('hidden');
      await openTicket(card, open.dataset.ticketOpen);
    } else if (attach) {
      const res = await send('GET', `/admin/api/support/tickets/attachments/${encodeURIComponent(attach.dataset.attach)}`);
      if (!res.ok) return toast('Görüntü açılamadı');
      const img = document.createElement('img');
      img.src = URL.createObjectURL(await res.blob());
      img.alt = 'Ekran görüntüsü';
      attach.replaceWith(img);
    } else if (reply) {
      const text = document.querySelector(`textarea[data-reply-for="${reply.dataset.reply}"]`).value.trim();
      if (text.length < 2) return toast('Yanıt yaz');
      await api('POST', `/admin/api/support/tickets/${encodeURIComponent(reply.dataset.reply)}/reply`, { body: text, close: !!reply.dataset.close });
      toast(reply.dataset.close ? 'Yanıtlandı ve kapatıldı' : 'Yanıt gönderildi');
      loadTickets();
      loadStats();
    } else if (close) {
      if (!confirm('Talep yanıtsız kapatılsın mı?')) return;
      await api('POST', `/admin/api/support/tickets/${encodeURIComponent(close.dataset.tclose)}/close`);
      toast('Kapatıldı');
      loadTickets();
      loadStats();
    }
  } catch (err) {
    toast(errText(err));
  }
});

// Yardım merkezi (SSS)
const HELP_CATS = { coins: 'Jetonlar ve satın alma', calls: 'Aramalar ve hediyeler', cashout: 'Kazanç ve para çekme', safety: 'Güvenlik', account: 'Hesap ve gizlilik' };
let helpItems = [];

function resetHelpForm() {
  $('#help-form').reset();
  $('#help-id').value = '';
  $('#help-save').textContent = 'Ekle';
  $('#help-cancel').classList.add('hidden');
}

async function loadHelp() {
  // Uygulamadaki kategori sırasıyla
  const order = Object.keys(HELP_CATS);
  helpItems = (await api('GET', `/admin/api/support/help?locale=${helpLocale}`)).sort(
    (a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.position - b.position,
  );
  $('#help-list').innerHTML = helpItems.length
    ? helpItems
        .map(
          (a) => `<div class="card item">
        <div class="item-head"><div><span class="pill blue">${esc(HELP_CATS[a.category] || a.category)}</span> <span class="muted">#${a.position}</span>
          ${a.published ? '' : '<span class="pill red">Yayında değil</span>'}</div>
          <span class="muted small">${esc(a.updatedBy)} · ${fmtDate(a.updatedAt)}</span></div>
        <div class="faq-q">${esc(a.question)}</div><div class="faq-a">${esc(a.answer)}</div>
        <div class="actions"><button class="btn soft" data-help-edit="${esc(a.id)}">Düzenle</button>
          <button class="btn soft" data-help-toggle="${esc(a.id)}">${a.published ? 'Yayından kaldır' : 'Yayınla'}</button>
          <button class="btn ghost" data-help-delete="${esc(a.id)}">Sil</button></div>
      </div>`,
        )
        .join('')
    : '<div class="card empty">Bu dilde soru yok</div>';
}

$('#help-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#help-id').value;
  const body = {
    locale: helpLocale,
    category: $('#help-category').value,
    question: $('#help-question').value.trim(),
    answer: $('#help-answer').value.trim(),
    position: Number($('#help-position').value || 0),
    published: $('#help-published').checked,
  };
  try {
    await api(id ? 'PUT' : 'POST', id ? `/admin/api/support/help/${encodeURIComponent(id)}` : '/admin/api/support/help', body);
    toast(id ? 'Güncellendi' : 'Eklendi');
    resetHelpForm();
    loadHelp();
  } catch (err) {
    toast(errText(err));
  }
});
$('#help-cancel').addEventListener('click', resetHelpForm);

$('#help-list').addEventListener('click', async (e) => {
  const edit = e.target.closest('button[data-help-edit]');
  const toggle = e.target.closest('button[data-help-toggle]');
  const del = e.target.closest('button[data-help-delete]');
  try {
    if (edit) {
      const a = helpItems.find((x) => x.id === edit.dataset.helpEdit);
      $('#help-id').value = a.id;
      $('#help-category').value = a.category;
      $('#help-position').value = a.position;
      $('#help-published').checked = a.published;
      $('#help-question').value = a.question;
      $('#help-answer').value = a.answer;
      $('#help-save').textContent = 'Kaydet';
      $('#help-cancel').classList.remove('hidden');
      $('#help-form').scrollIntoView({ behavior: 'smooth' });
    } else if (toggle) {
      const a = helpItems.find((x) => x.id === toggle.dataset.helpToggle);
      await api('PUT', `/admin/api/support/help/${encodeURIComponent(a.id)}`, { published: !a.published });
      loadHelp();
    } else if (del) {
      if (!confirm('Soru kalıcı olarak silinsin mi? (Gizlemek için "Yayından kaldır" kullanabilirsin)')) return;
      await api('DELETE', `/admin/api/support/help/${encodeURIComponent(del.dataset.helpDelete)}`);
      loadHelp();
    }
  } catch (err) {
    toast(errText(err));
  }
});

// Künye
const COMPANY = [
  ['legalName', 'Ticaret unvanı'],
  ['mersisNo', 'MERSİS no'],
  ['taxOffice', 'Vergi dairesi'],
  ['taxNo', 'Vergi no'],
  ['address', 'Adres'],
  ['kepAddress', 'KEP adresi'],
  ['email', 'Destek e-postası'],
  ['kvkkEmail', 'KVKK başvuru e-postası'],
  ['phone', 'Telefon'],
  ['etbisNo', 'ETBİS kayıt no'],
  ['verbisNo', 'VERBİS kayıt no'],
];

async function loadCompany() {
  const c = await api('GET', '/admin/api/support/company');
  const editable = role === 'super';
  $('#company-fields').innerHTML = COMPANY.map(
    ([k, label]) =>
      `<label><span>${label}${c.missing.includes(k) ? ' <span class="pill red">zorunlu</span>' : ''}</span><input name="${k}" value="${esc(c[k] || '')}" maxlength="300" ${editable ? '' : 'disabled'}></label>`,
  ).join('');
  $('#company-save').classList.toggle('hidden', !editable);
  $('#company-missing').innerHTML = c.missing.length
    ? `<div class="card item mb-8"><div><b>Yayın öncesi eksik:</b> ${c.missing.map((k) => esc(COMPANY.find(([f]) => f === k)[1])).join(', ')}</div></div>`
    : '';
}

$('#company-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(COMPANY.map(([k]) => [k, $(`#company-fields input[name="${k}"]`).value.trim()]));
  try {
    await api('PUT', '/admin/api/support/company', body);
    toast('Künye kaydedildi');
    loadCompany();
  } catch (err) {
    toast(errText(err));
  }
});

// İYS dosyası (KVKK sekmesi)
$('#iys-export').addEventListener('click', async () => {
  const res = await send('GET', '/admin/api/privacy/iys.csv');
  if (!res.ok) return toast('İYS dosyası indirilemedi');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob());
  a.download = `iys-eposta-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Başlat ----------
// Sekmeler (ve alt bölümler) role göre: data-roles boşsa sadece süper yönetici görür
function applyRole() {
  document.querySelectorAll('[data-roles]').forEach((btn) => {
    const allowed = role === 'super' || btn.dataset.roles.split(' ').includes(role);
    btn.classList.toggle('hidden', !allowed);
  });
}

async function start() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  applyRole();
  document.querySelector('.tab[data-tab="overview"]').click();
}

if (token) {
  afterLogin().catch(showLogin);
} else {
  showLogin();
}
