// ===== УТИЛИТЫ =====

function smoothScroll(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
  playLandingSound('click');
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  playLandingSound('click');
}

// ===== ЕДИНАЯ СИСТЕМА ЗВУКОВ =====
let _landingSoundEnabled = true;
let _landingCtx = null;
let _landingLastPlay = 0;
const _landingMinInterval = 50;

function _ensureLandingAudio() {
  if (!_landingCtx) {
    _landingCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_landingCtx.state === 'suspended') {
    _landingCtx.resume();
  }
  return _landingCtx;
}

function playLandingSound(type) {
  if (typeof playSound === 'function') {
    playSound(type);
    return;
  }
  if (!_landingSoundEnabled) return;
  const now = Date.now();
  if (now - _landingLastPlay < _landingMinInterval) return;
  _landingLastPlay = now;

  try {
    const ctx = _ensureLandingAudio();
    const defs = {
      click:   { wave:'sine', vol:0.04, notes:[[800,0.04]] },
      hover:   { wave:'sine', vol:0.03, notes:[[1000,0.03]] },
      open:    { wave:'triangle', vol:0.07, notes:[[600,0.06],[900,0.1]] },
      close:   { wave:'sine', vol:0.06, notes:[[500,0.06],[350,0.1]] },
      success: { wave:'sine', vol:0.08, notes:[[523,0.08],[659,0.08],[784,0.15]] },
      scroll:  { wave:'triangle', vol:0.04, notes:[[520,0.04],[650,0.04]] },
      pop:     { wave:'sine', vol:0.07, notes:[[800,0.03],[1200,0.06]] },
      sparkle: { wave:'sine', vol:0.05, notes:[[1200,0.03],[1500,0.03],[1800,0.05]] },
      swipe:   { wave:'triangle', vol:0.04, notes:[[600,0.04],[800,0.06]] }
    };
    const s = defs[type] || defs.click;
    let t = ctx.currentTime;
    s.notes.forEach(([freq, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = s.wave;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(s.vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });
  } catch(e) {}
}

// ===== МОДАЛКИ =====
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  document.body.style.overflow = 'hidden';
  playLandingSound('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  document.body.style.overflow = '';
  playLandingSound('close');
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) {
      closeModal(m.id);
      playLandingSound('close');
    }
  });
});

// ===== ЧЕКБОКС → КНОПКА =====
function toggleFormBtn(checkId, btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const checked = document.getElementById(checkId)?.checked;
  btn.classList.toggle('ready', checked);
  if (checked) playLandingSound('click');
}

// ===== НАВБАР ПРИ СКРОЛЛЕ (только компактный режим, без скрытия) =====
function handleNavbarScroll() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const scrollY = window.scrollY;
  const hero = document.getElementById('hero');
  const heroBottom = hero ? hero.offsetHeight : window.innerHeight;
  const isPastHero = scrollY > heroBottom - 200;

  nav.classList.toggle('nav-compact', isPastHero);
  checkSectionSounds();
}

const sectionSoundTriggers = {};

function checkSectionSounds() {
  document.querySelectorAll('section[id]').forEach(sec => {
    const id = sec.id;
    if (sectionSoundTriggers[id]) return;
    const rect = sec.getBoundingClientRect();
    if (rect.top < window.innerHeight - 100 && rect.bottom > 100) {
      sectionSoundTriggers[id] = true;
      if (id !== 'hero') {
        playLandingSound('pop');
      }
    }
  });
}

// ===== ПАРАЛЛАКС =====
function handleParallax() {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const scrollY = window.scrollY;
  const heroHeight = hero.offsetHeight;
  if (scrollY < heroHeight) {
    hero.style.backgroundPositionY = 'calc(50% - ' + (scrollY * 0.35) + 'px)';
  }
}

// ===== ПЕРСОНАЖИ =====
function animateCharacters() {
  var dino = document.getElementById('dino');
  var cat = document.getElementById('cat-hero');
  
  if (dino) {
    setTimeout(function() {
      dino.style.left = Math.min(window.innerWidth / 4, 200) + 'px';
      dino.style.opacity = '1';
    }, 300);
  }
  
  if (cat) {
    setTimeout(function() {
      cat.style.bottom = '40px';
      cat.style.opacity = '1';
    }, 800);
  }
}

// ===== АНИМАЦИИ ПРИ СКРОЛЛЕ =====
function checkVisibility() {
  document.querySelectorAll('[data-anim]').forEach(function(el) {
    var rect = el.getBoundingClientRect();
    var offset = el.hasAttribute('data-anim-delay') ? 120 : 80;
    if (rect.top < window.innerHeight - offset) {
      el.classList.add('visible');
    }
  });
}

// ===== TOUCH-СВАЙП =====
function initCarouselTouch() {
  var carousel = document.getElementById('galleryCarousel');
  if (!carousel) return;

  var startX = 0;
  var isDragging = false;

  carousel.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  carousel.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    var diff = e.touches[0].clientX - startX;
    if (Math.abs(diff) > 50) {
      isDragging = false;
      var bsCarousel = bootstrap.Carousel.getInstance(carousel);
      if (bsCarousel) {
        if (diff < 0) bsCarousel.next();
        else bsCarousel.prev();
        playLandingSound('swipe');
      }
    }
  }, { passive: true });

  carousel.addEventListener('touchend', function() { isDragging = false; }, { passive: true });
}

// ===== ОТЗЫВЫ =====
var allReviews = [];

async function loadReviews() {
  try {
    var res = await fetch('/api/reviews');
    if (res.ok) allReviews = await res.json();
  } catch(e) {
    allReviews = [
      { _id: '1', name: 'Анна К.', role: 'Мама ученика', text: 'Отличная школа! Сын в восторге от занятий, каждый раз приходит домой с горящими глазами. Преподаватели очень внимательные.' },
      { _id: '2', name: 'Дмитрий', role: 'Ученик, 14 лет', text: 'Научился делать игры на Unity! Это было моей мечтой. Теперь уже сделал свою первую игру.' },
      { _id: '3', name: 'Елена М.', role: 'Родитель', text: 'Ребёнок занимается уже полгода. Заметен явный прогресс в логическом мышлении и усидчивости.' },
      { _id: '4', name: 'Максим Т.', role: 'Ученик, 12 лет', text: 'Круто! Мы делаем настоящие проекты, а не просто смотрим видео. Мой сайт уже в интернете!' }
    ];
  }
  renderReviews();
}

function renderReviews() {
  var grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  grid.innerHTML = allReviews.map(function(r) {
    return '<div class="review-card" onclick="openFullReview(\'' + r._id + '\')">' +
      '<div class="review-header">' +
      '<div class="review-name">' + escHtml(r.name) + '</div>' +
      '<div class="review-role">' + escHtml(r.role || '') + '</div>' +
      '</div>' +
      '<div class="review-text">' + escHtml(r.text) + '</div>' +
      '</div>';
  }).join('');
}

function escHtml(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function openFullReview(id) {
  var r = allReviews.find(function(x) { return x._id === id; });
  if (!r) return;
  document.getElementById('reviewFullName').textContent = r.name;
  document.getElementById('reviewFullRole').textContent = r.role || '';
  document.getElementById('reviewFullText').textContent = r.text;
  openModal('reviewFullModal');
}

async function submitReview(e) {
  e.preventDefault();
  var data = {
    name: document.getElementById('reviewName').value,
    role: document.getElementById('reviewRole').value,
    text: document.getElementById('reviewText').value
  };
  try {
    await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } catch(e) {}
  allReviews.unshift({ _id: Date.now().toString(), name: data.name, role: data.role, text: data.text });
  renderReviews();
  closeModal('reviewModal');
  spawnStars();
  playLandingSound('success');
}

// ===== ЗАЯВКА =====
async function submitApply(e) {
  e.preventDefault();
  var data = {
    parentName: document.getElementById('applyParent').value,
    childName: document.getElementById('applyChild').value,
    phone: document.getElementById('applyPhone').value
  };
  try {
    await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } catch(e) {}
  closeModal('applyModal');
  spawnStars();
  playLandingSound('success');
  showToast('Заявка отправлена! Мы свяжемся с вами 🎉');
}

// ===== ЗВЁЗДОЧКИ =====
function spawnStars(count) {
  if (count === undefined) count = 20;
  var emojis = ['\u2B50', '\u2728', '\uD83C\uDF1F', '\uD83D\uDCAB', '\uD83C\uDF89', '\uD83C\uDF8A'];
  for (var i = 0; i < count; i++) {
    (function(idx) {
      setTimeout(function() {
        var star = document.createElement('div');
        star.className = 'star-particle';
        star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        star.style.left = Math.random() * window.innerWidth + 'px';
        star.style.top = Math.random() * window.innerHeight + 'px';
        document.body.appendChild(star);
        setTimeout(function() { star.remove(); }, 1500);
      }, idx * 80);
    })(i);
  }
}

// ===== ТОСТ =====
function showToast(msg) {
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:white;padding:14px 28px;border-radius:30px;z-index:9999;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:Nunito,sans-serif;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 3500);
}

// ===== УВЕДОМЛЕНИЕ О МАГАЗИНЕ =====
function checkShopNotification() {
  var now = new Date();
  var month = now.getMonth() + 1;
  var day = now.getDate();

  var isOpen = (month === 12 && day >= 25) || (month === 1 && day <= 1) ||
               (month === 5 && day >= 25) || (month === 6) || (month === 7 && day <= 1);

  var soonDec = month === 12 && day >= 20 && day < 25;
  var soonMay = month === 5 && day >= 20 && day < 25;

  var notif = document.getElementById('shopNotif');
  var text = document.getElementById('shopNotifText');
  if (!notif || !text) return;

  if (isOpen) {
    text.innerHTML = '\uD83C\uDFAA <b>Ярмарка открыта!</b><br>Магазин IT-MANIA работает \u2014 тратьте билетики!';
    notif.style.display = 'block';
  } else if (soonDec || soonMay) {
    var openDate = soonDec ? new Date(now.getFullYear(), 11, 25) : new Date(now.getFullYear(), 4, 25);
    var diff = openDate - now;
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    text.innerHTML = '\uD83C\uDFAA <b>Ярмарка скоро!</b><br>До открытия: ' + days + '\u0434 ' + hours + '\u0447<br>Копите билетики!';
    notif.style.display = 'block';
  }
}

// ===== БУРГЕР =====
function toggleNav() {
  var burger = document.getElementById('navBurger');
  var links = document.getElementById('navLinks');
  if (!burger || !links) return;
  burger.classList.toggle('active');
  links.classList.toggle('open');
  playLandingSound('click');

  if (links.classList.contains('open')) {
    links.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function() {
        burger.classList.remove('active');
        links.classList.remove('open');
      }, { once: true });
    });
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', function() {
  loadReviews();
  checkShopNotification();

  var navLogo = document.getElementById('navLogo');
  if (navLogo) navLogo.src = 'images/star.gif?t=' + Date.now();

  document.querySelectorAll('.btn-accent, .btn-white, .btn-scroll-down, .nav-links a, .social-links a').forEach(function(btn) {
    btn.addEventListener('click', function() { playLandingSound('click'); });
    btn.addEventListener('mouseenter', function() { playLandingSound('hover'); });
  });

  setTimeout(function() {
    spawnStars(20);
    playLandingSound('success');
  }, 100);

  setTimeout(function() {
    animateCharacters();
    playLandingSound('open');
  }, 300);

  setTimeout(checkVisibility, 100);

  handleNavbarScroll();
  window.addEventListener('scroll', function() {
    handleNavbarScroll();
    handleParallax();
    checkVisibility();
  }, { passive: true });

  initCarouselTouch();

  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      var dino = document.getElementById('dino');
      if (dino && dino.style.opacity === '1') {
        dino.style.left = Math.min(window.innerWidth / 4, 200) + 'px';
      }
    }, 200);
  }, { passive: true });
});
