// Faz 25 yük testi (HTTP): gerçekçi bir kullanıcı akışı. SADECE staging/test sunucusunda çalıştırın.
// Hazırlık:  cd server && npm run load:users -- 5000      (tools/loadtest/tokens.json üretir)
// Çalıştır:  k6 run -e BASE_URL=https://staging-api.vibeupme.com -e VUS=500 -e DURATION=5m tools/loadtest/k6-vibeupme.js
// Her sanal kullanıcı: keşfet destesini al → birkaç kart gezip kaydır → profil → bildirim sayısı gibi hafif uçlar.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const tokens = new SharedArray('tokens', () => JSON.parse(open('./tokens.json')));
const BASE = __ENV.BASE_URL || 'http://localhost:4000';
const VUS = Number(__ENV.VUS || 100);

export const options = {
  scenarios: {
    kullanicilar: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '1m', target: VUS },
        { duration: __ENV.DURATION || '3m', target: VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // %1'den az hata
    'http_req_duration{kind:discover}': ['p(95)<800'], // en ağır uç: p95 < 800 ms
    'http_req_duration{kind:swipe}': ['p(95)<400'],
    'http_req_duration{kind:light}': ['p(95)<250'],
  },
};

export default function () {
  const me = tokens[(__VU - 1) % tokens.length];
  const params = (kind) => ({ headers: { Authorization: `Bearer ${me.token}`, 'Content-Type': 'application/json' }, tags: { kind } });

  const deck = http.get(`${BASE}/discover`, params('discover'));
  check(deck, { 'keşfet 200': (r) => r.status === 200 });
  const cards = deck.status === 200 ? deck.json() : [];

  // Kullanıcı birkaç kart gezer (her biri 2-6 sn düşünür). Beğeni hakkı günlük sınırlı: çoğu "geç".
  for (const card of cards.slice(0, 5)) {
    sleep(2 + Math.random() * 4);
    const direction = Math.random() < 0.15 ? 'like' : 'pass';
    const r = http.post(`${BASE}/swipes`, JSON.stringify({ toId: card.id, direction }), params('swipe'));
    // 403 like_limit_reached ve 429 beklenen davranış (sınırlar çalışıyor), hata sayılmaz
    check(r, { 'kaydırma kabul/sınır': (x) => [200, 403, 429].includes(x.status) });
  }

  check(http.get(`${BASE}/me`, params('light')), { 'me 200': (r) => r.status === 200 });
  check(http.get(`${BASE}/discover/like-status`, params('light')), { 'like-status 200': (r) => r.status === 200 });
  sleep(3 + Math.random() * 5);
}
