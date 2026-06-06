// ===== УТИЛИТЫ =====

function smoothScroll(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
}
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ===== ЗВУКИ ЛЕНДИНГА =====
function playLandingSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const sounds = {
      click:   { freq: 660,  dur: 0.12, type: 'sine' },
      open:    { freq: 880,  dur: 0.25, type: 'sine' },
      close:   { freq: 440,  dur: 0.2,  type: 'sine' },
      success: { freq: 1046, dur: 0.35, type: 'sine' },
      scroll:  { freq: 520,  dur: 0.1,  type: 'triangle' }
    };
    const s = sounds[type] || sounds.click;
    osc.type = s.type;
    osc.frequency.setValueAtTime(s.freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + s.dur);
  } catch(e) {}
}

// ===== МОДАЛКИ =====
function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
  playLandingSound('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
  playLandingSound('close');
}
// Закрыть по клику на фон
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});

// ===== ЧЕКБОКС → КНОПКА =====
function toggleFormBtn(checkId, btnId) {
  const btn = document.getElementById(btnId);
  btn.classList.toggle('ready', document.getElementById(checkId).checked);
}

// ===== СКРОЛЛ: ПЕРСОНАЖИ + АНИМАЦИИ =====
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const hero = document.getElementById('hero');
  const heroHeight = hero ? hero.offsetHeight : window.innerHeight;

  // Персонажи работают только пока hero виден
  const heroVisible = scrolled < heroHeight;

  // Динозавр выезжает слева при скролле, только в пределах hero
  const dino = document.getElementById('dino');
  if (heroVisible && scrolled > 100) {
    dino.style.left = Math.min(scrolled / 4 - 50, window.innerWidth / 2 - 220) + 'px';
    dino.style.opacity = '1';
  } else {
    dino.style.left = '-300px';
    dino.style.opacity = '0';
  }

  // Кот вылетает снизу справа, только в пределах hero
  const cat = document.getElementById('cat-hero');
  if (heroVisible && scrolled > 100) {
    const rise = Math.min((scrolled - 100) / 3, heroHeight * 0.6);
    cat.style.bottom = rise + 'px';
    cat.style.opacity = '1';
  } else {
    cat.style.bottom = '-200px';
    cat.style.opacity = '0';
  }

  // Анимации при появлении в viewport
  document.querySelectorAll('[data-anim]').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 80) el.classList.add('visible');
  });
});

// ===== ОТЗЫВЫ =====
let allReviews = [];

async function loadReviews() {
  try {
    const res = await fetch('/api/reviews');
    allReviews = await res.json();
  } catch {
    // Заглушка если сервер не запущен
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
  const grid = document.getElementById('reviewsGrid');
  grid.innerHTML = allReviews.map(r => `
    <div class="review-card" onclick="openFullReview('${r._id}')">
      <div class="review-header">
        <div class="review-name">${r.name}</div>
        <div class="review-role">${r.role || ''}</div>
      </div>
      <div class="review-text">${r.text}</div>
    </div>
  `).join('');
}

function openFullReview(id) {
  const r = allReviews.find(x => x._id === id);
  if (!r) return;
  document.getElementById('reviewFullName').textContent = r.name;
  document.getElementById('reviewFullRole').textContent = r.role || '';
  document.getElementById('reviewFullText').textContent = r.text;
  openModal('reviewFullModal');
}

async function submitReview(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('reviewName').value,
    role: document.getElementById('reviewRole').value,
    text: document.getElementById('reviewText').value
  };
  try {
    await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } catch {}
  // Добавляем локально сразу (без ожидания модерации)
  allReviews.unshift({ _id: Date.now().toString(), ...data });
  renderReviews();
  closeModal('reviewModal');
  spawnStars();
  playLandingSound('success');
}

// ===== ЗАЯВКА =====
async function submitApply(e) {
  e.preventDefault();
  const data = {
    parentName: document.getElementById('applyParent').value,
    childName: document.getElementById('applyChild').value,
    phone: document.getElementById('applyPhone').value
  };
  try {
    await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } catch {}
  closeModal('applyModal');
  spawnStars();
  playLandingSound('success');
  showToast('Заявка отправлена! Мы свяжемся с вами 🎉');
}

// ===== ЗВЁЗДОЧКИ =====
function spawnStars(count = 20) {
  const emojis = ['⭐', '✨', '🌟', '💫', '🎉', '🎊'];
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const star = document.createElement('div');
      star.className = 'star-particle';
      star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      star.style.left = Math.random() * window.innerWidth + 'px';
      star.style.top = Math.random() * window.innerHeight + 'px';
      document.body.appendChild(star);
      setTimeout(() => star.remove(), 1500);
    }, i * 80);
  }
}

// ===== ТОСТ =====
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:white;padding:14px 28px;border-radius:30px;z-index:9999;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ===== УВЕДОМЛЕНИЕ О МАГАЗИНЕ =====
function checkShopNotification() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  // Периоды работы магазина: 25 дек - 1 янв, 25 мая - 1 июля
  const isOpen = (month === 12 && day >= 25) || (month === 1 && day <= 1) ||
                 (month === 5 && day >= 25) || (month === 6) || (month === 7 && day <= 1);

  // За 5 дней до открытия
  const soonDec = month === 12 && day >= 20 && day < 25;
  const soonMay = month === 5 && day >= 20 && day < 25;

  const notif = document.getElementById('shopNotif');
  const text = document.getElementById('shopNotifText');

  if (isOpen) {
    text.innerHTML = '🎪 <b>Ярмарка открыта!</b><br>Магазин IT-MANIA работает — тратьте билетики!';
    notif.style.display = 'block';
  } else if (soonDec || soonMay) {
    // Считаем таймер до открытия
    const openDate = soonDec ? new Date(now.getFullYear(), 11, 25) : new Date(now.getFullYear(), 4, 25);
    const diff = openDate - now;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    text.innerHTML = `🎪 <b>Ярмарка скоро!</b><br>До открытия: ${days}д ${hours}ч<br>Копите билетики!`;
    notif.style.display = 'block';
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
  loadReviews();
  checkShopNotification();

  // Сбрасываем кэш GIF
  const navLogo = document.getElementById('navLogo');
  if (navLogo) navLogo.src = 'images/star.gif?t=' + Date.now();

  // Звук на кнопки навбара и hero
  document.querySelectorAll('.btn-accent, .btn-white, .btn-scroll-down').forEach(btn => {
    btn.addEventListener('click', () => playLandingSound('click'));
  });

  setTimeout(() => {
    document.querySelectorAll('[data-anim]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 80) el.classList.add('visible');
    });
  }, 100);
});
