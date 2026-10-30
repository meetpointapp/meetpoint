// Telefon demosu: karta basılı tutma kademelerini (Merak → İlgi → Tutku) döngüyle gösterir.
(function () {
  var phone = document.getElementById('phone');
  if (!phone) return;
  var label = phone.querySelector('.cap-label');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function set(tier) {
    phone.setAttribute('data-tier', String(tier));
    if (tier > 0) label.textContent = label.getAttribute('data-l' + tier);
  }

  // Hareket azaltma tercihinde sabit bir kare göster
  if (reduce) { set(2); return; }

  // [kademe, süre ms]: bekleme → merak → ilgi → tutku → bırak
  var steps = [[0, 1800], [1, 1100], [2, 1100], [3, 1700]];
  var i = 0;
  (function next() {
    set(steps[i][0]);
    var wait = steps[i][1];
    i = (i + 1) % steps.length;
    setTimeout(next, wait);
  })();
})();
