// ============================================================
// BAZARE — App intro (splash)
// Shown once per browser session (and on every PWA launch, which is a new
// session). Tap anywhere to skip. Add ?nosplash to the URL to disable.
// Load synchronously right after <body> so the home page never flashes first.
// ============================================================
(function () {
  if (/[?&]nosplash\b/.test(location.search)) return;
  try {
    if (sessionStorage.getItem('bz_splash_seen')) return;
    sessionStorage.setItem('bz_splash_seen', '1');
  } catch (e) { /* storage blocked: still show it */ }

  var script = document.currentScript;
  var BASE = script && script.src ? script.src.replace(/[^\/]*$/, '') : 'splash/';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // artwork coordinates (941×1672 canvas): logo "e" centre and the shop sign's "e" centre
  var W = 941, H = 1672, LOGO_E = [584.5, 355.5], SHOP_E = [782, 1246];

  var root = document.createElement('div');
  root.id = 'bz-splash';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Bazare — বাংলার উদ্যোক্তাদের মার্কেটপ্লেস');
  var stage = document.createElement('div');
  stage.className = 'bz-stage';
  stage.style.setProperty('--bz-mask', 'url("' + BASE + 'box.png")');
  root.appendChild(stage);

  function img(cls, file) {
    var i = new Image();
    i.className = cls; i.alt = ''; i.draggable = false; i.decoding = 'async';
    i.src = BASE + file;
    stage.appendChild(i);
    return i;
  }
  function fx(cls) {
    var d = document.createElement('div');
    d.className = 'bz-fx ' + cls;
    stage.appendChild(d);
  }

  var bg = img('bz-bg', 'bg.webp');
  bg.onerror = function () { bg.onerror = null; bg.src = BASE + 'bg.jpg'; };
  fx('bz-sun');
  fx('bz-shopglow');
  img('bz-box', 'box.png');
  fx('bz-shine');
  img('bz-bazar', 'bazar.png');
  img('bz-ghost2', 'e.png');
  img('bz-ghost1', 'e.png');
  img('bz-e', 'e.png');
  fx('bz-ring');
  img('bz-swoosh', 'swoosh.png');
  img('bz-tag', 'tag.png');

  (document.body || document.documentElement).appendChild(root);
  var html = document.documentElement, prevOverflow = html.style.overflow;
  html.style.overflow = 'hidden';

  var done = false, exitTimer;
  function exit() {
    if (done) return;
    done = true;
    clearTimeout(exitTimer);
    root.classList.add('bz-out');
    html.style.overflow = prevOverflow;
    setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 550);
  }
  root.addEventListener('pointerdown', exit);
  root.addEventListener('keydown', exit);

  var started = false;
  function play() {
    if (started || done) return;
    started = true;
    // flight offset of the "e": from the shop signboard up to the logo, in px of the rendered stage
    var r = stage.getBoundingClientRect();
    stage.style.setProperty('--fx', ((SHOP_E[0] - LOGO_E[0]) / W * r.width).toFixed(1) + 'px');
    stage.style.setProperty('--fy', ((SHOP_E[1] - LOGO_E[1]) / H * r.height).toFixed(1) + 'px');
    root.classList.add('bz-play');
    exitTimer = setTimeout(exit, reduce ? 1400 : 3800);
  }

  // start once the background is ready (or after 1.5s on a slow connection)
  var ready = bg.decode ? bg.decode() : new Promise(function (res) { bg.onload = res; });
  Promise.race([ready, new Promise(function (res) { setTimeout(res, 1500); })]).then(play, play);
  // safety net: never trap the user behind the splash
  setTimeout(exit, 7000);
})();
