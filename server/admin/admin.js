// MeetPoint yönetim paneli. Kullanıcı içeriği her zaman esc() ile kaçışlanır (XSS'e karşı).
'use strict';

const $ = (sel) => document.querySelector(sel);
const TOKEN_KEY = 'mp_admin_token';
let token = sessionStorage.getItem(TOKEN_KEY);
let reportStatus = 'OPEN';

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

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 || res.status === 403) {
    if (path !== '/auth/login') logout();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `http_${res.status}`), { status: res.status });
  return data;
}

// Selfie yetkili istekle alınıp blob URL'ye çevrilir (img etiketi header gönderemez)
async function loadSelfie(img, id) {
  const res = await fetch(`/admin/api/verifications/${encodeURIComponent(id)}/selfie`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.ok) img.src = URL.createObjectURL(await res.blob());
}

// ---------- Oturum ----------
function showLogin() {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
}

function logout() {
  token = null;
  sessionStorage.removeItem(TOKEN_KEY);
  showLogin();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    const r = await api('POST', '/auth/login', {
      email: $('#login-email').value,
      password: $('#login-password').value,
    });
    token = r.token;
    await api('GET', '/admin/api/me');
    sessionStorage.setItem(TOKEN_KEY, token);
    start();
  } catch (err) {
    token = null;
    $('#login-error').textContent = err.status === 403 ? 'Bu hesabın yönetim yetkisi yok.' : 'E-posta veya şifre hatalı.';
    showLogin();
  }
});

$('#logout').addEventListener('click', logout);

// ---------- Sekmeler ----------
const loaders = {
  overview: loadStats,
  reports: loadReports,
  verifications: loadVerifications,
  users: loadUsers,
  purchases: loadPurchases,
  payouts: loadPayouts,
  errors: loadErrors,
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
  $('#count-reports').textContent = s.openReports || '';
  $('#count-verifications').textContent = s.pendingVerifications || '';
  $('#count-payouts').textContent = s.payoutsPending || '';
  $('#count-errors').textContent = s.openErrors || '';
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
  ];
  $('#stats').innerHTML = cards
    .map(([label, value, alert]) => `<div class="card stat ${alert ? 'alert' : ''}"><div class="value">${esc(value)}</div><div class="label">${esc(label)}</div></div>`)
    .join('');
}

// ---------- Şikayetler ----------
async function loadReports() {
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
        ${r.status === 'RESOLVED' ? `<span class="pill green">${esc({ banned: 'Yasaklandı', dismissed: 'Yoksayıldı', photo_removed: 'Fotoğraf kaldırıldı' }[r.resolution] || r.resolution)}</span>` : ''}
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
    toast(`Hata: ${err.message}`);
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
        <div><div class="muted" style="margin-bottom:8px">Profil fotoğrafları</div>${photoStrip(v.user)}</div>
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
    toast(`Hata: ${err.message}`);
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
    toast(`Hata: ${err.message}`);
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
          ${p.accountName ? `<br><b>Hesap sahibi:</b> ${esc(p.accountName)}` : ''}</div>
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
    toast(`Hata: ${err.message}`);
  }
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
    toast(`Hata: ${err.message}`);
  }
});

// ---------- Başlat ----------
async function start() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await loadStats();
}

if (token) {
  api('GET', '/admin/api/me').then(start, showLogin);
} else {
  showLogin();
}
