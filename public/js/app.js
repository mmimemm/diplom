// ===== ГЛОБАЛЬНЫЙ РЕЕСТР ЭФФЕКТОВ АВАТАРА (доступен на ВСЕХ страницах) =====
window.AVATAR_EFFECTS = {
  'clownnose': { icon: '🤡', name: 'Клоунский нос' },
  'headphones': { icon: '🎧', name: 'Наушники' },
  'helmet':     { icon: '⛑️', name: 'Каска' },
  'unicorn':    { icon: '🦄', name: 'Единорог' },
  'sunglasses': { icon: '🕶️', name: 'Очки' },
  'superbadge': { icon: '⭐', name: 'Супер-значок' }
};

// ===== ОБЩИЕ УТИЛИТЫ ПРИЛОЖЕНИЯ =====

const API = '';  // Относительные пути

// Получить токен
function getToken() { return localStorage.getItem('token'); }
function getRole() { return localStorage.getItem('role'); }
function getUserId() { return localStorage.getItem('userId'); }

// Запрос с авторизацией
async function api(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken(),
        ...(options.headers || {})
      }
    });
    
    if (res.status === 401) { 
      logout(); 
      return null; 
    }
    
    if (!res.ok) {
      console.error(`API error ${res.status}: ${path}`);
      return null;
    }
    
    return await res.json();
  } catch (error) {
    console.error(`API fetch error: ${path}`, error);
    return null;
  }
}

// Тестовая функция для проверки API
async function testApi() {
  const test = await api('/api/test');
  if (test) {
    console.log('API тест:', test);
    return true;
  }
  return false;
}

// Выход
function logout() {
  localStorage.clear();
  window.location.href = '/app/login.html';
}

// Проверка авторизации
function requireAuth(allowedRoles) {
  const token = getToken();
  const role = getRole();
  if (!token) { window.location.href = '/app/login.html'; return false; }
  if (allowedRoles && !allowedRoles.includes(role)) {
    window.location.href = '/app/login.html';
    return false;
  }
  return true;
}

// ===== АВАТАР В ТОПБАРЕ — глобальная функция =====
// Дожидается загрузки shopEffects, чтобы корректно отображать купленные аватары
async function updateTopbarAvatar(userData) {
  const avatarEl = document.getElementById('userAvatar');
  if (!avatarEl) return;
  
  let user = userData;
  if (!user) {
    user = await api('/api/auth/me');
  }
  if (!user) {
    const fallback = avatarEl.getAttribute('data-fallback') || '?';
    avatarEl.innerHTML = '';
    avatarEl.textContent = fallback;
    avatarEl.style.background = '';
    return;
  }
  
  // Сбрасываем содержимое
  if (avatarEl.querySelector('img')) avatarEl.innerHTML = '';
  avatarEl.innerHTML = '';
  
  // 1) Фото аватара — наивысший приоритет
  if (user.avatarConfig?.photo) {
    avatarEl.innerHTML = `<img src="${user.avatarConfig.photo}" alt="avatar" onerror="this.style.display='none'">`;
    avatarEl.style.background = 'transparent';
    return;
  }
  
  // 2) Shop-эффекты аватара — сначала дожидаемся загрузки shopEffects
  var unlocked = user.avatarConfig?.unlockedItems || [];
  if (unlocked.length > 0) {
    // Дожидаемся загрузки shopEffects, если ещё не загружены
    if (typeof loadShopEffects === 'function' && (!window.shopEffects || !window.shopEffects.avatarItems)) {
      try { await loadShopEffects(); } catch(e) {}
    }
    
    var lastEffect = unlocked[unlocked.length - 1];
    var effectDef = window.AVATAR_EFFECTS || {};
    var foundIcon = effectDef[lastEffect] ? effectDef[lastEffect].icon : null;
    
    // Fallback: ищем в shopEffects.avatarItems (на случай динамических эффектов)
    if (!foundIcon && window.shopEffects && window.shopEffects.avatarItems) {
      var matched = window.shopEffects.avatarItems.find(function(it) { return it.effect === lastEffect; });
      if (matched && matched.icon) foundIcon = matched.icon;
    }
    
    // Fallback: используем иконку, сохранённую сервером при покупке
    if (!foundIcon && user.avatarConfig?.lastPurchasedAvatarIcon) {
      foundIcon = user.avatarConfig.lastPurchasedAvatarIcon;
    }
    
    // Fallback: ищем во всех купленных предметах
    if (!foundIcon && window.shopEffects && window.shopEffects.avatarItems) {
      for (var i = unlocked.length - 1; i >= 0; i--) {
        var match = window.shopEffects.avatarItems.find(function(it) { return it.effect === unlocked[i]; });
        if (match && match.icon) { foundIcon = match.icon; break; }
      }
    }
    
    if (foundIcon) {
      avatarEl.textContent = foundIcon;
      avatarEl.style.background = '';
      return;
    }
  }
  
  // 3) Эмодзи аватара (очки или первая буква имени)
  var glassesEmoji = user.avatarConfig?.glasses === 'cool' ? '😎'
    : user.avatarConfig?.glasses === 'round' ? '🤓' : null;
  avatarEl.textContent = glassesEmoji || user.firstName?.charAt(0).toUpperCase() || '?';
  avatarEl.style.background = '';
}

// ===== ЗВУК — единая система без задваивания =====
let soundEnabled = localStorage.getItem('sound') !== 'false';
let _soundCtx = null;
let _soundLastPlay = 0;
const _soundMinInterval = 40; // ms — защита от задваивания

function _getSoundCtx() {
  if (!_soundCtx) {
    _soundCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_soundCtx.state === 'suspended') {
    _soundCtx.resume();
  }
  return _soundCtx;
}

// Детские мелодии и звуки
const _soundDefs = {
  // Короткие клики — тихие, быстрые
  click:       { wave:'sine', vol:0.04, notes:[[800,0.04]] },
  hover:       { wave:'sine', vol:0.03, notes:[[1000,0.03]] },
  tap:         { wave:'triangle', vol:0.05, notes:[[700,0.03]] },
  
  // Игровые звуки
  success:     { wave:'sine', vol:0.08, notes:[[523,0.08],[659,0.08],[784,0.15]] },
  coin:        { wave:'sine', vol:0.08, notes:[[1047,0.06],[1319,0.12]] },
  ding:        { wave:'sine', vol:0.06, notes:[[660,0.1]] },
  error:       { wave:'sawtooth', vol:0.06, notes:[[330,0.08],[220,0.25]] },
  
  // Длинные мелодии
  levelup:     { wave:'sine', vol:0.08, notes:[[523,0.08],[659,0.08],[784,0.08],[1047,0.25]] },
  magic:       { wave:'sine', vol:0.07, notes:[[1047,0.06],[1319,0.06],[1568,0.15]] },
  achievement: { wave:'sine', vol:0.08, notes:[[784,0.1],[1047,0.1],[1175,0.2]] },
  notification:{ wave:'sine', vol:0.06, notes:[[880,0.06],[698,0.06],[784,0.1]] },
  buy:         { wave:'triangle', vol:0.08, notes:[[784,0.08],[1047,0.08],[1319,0.18]] },
  
  // Для магазина и действий
  open:        { wave:'triangle', vol:0.07, notes:[[600,0.06],[900,0.1]] },
  close:       { wave:'sine', vol:0.06, notes:[[500,0.06],[350,0.1]] },
  swipe:       { wave:'triangle', vol:0.05, notes:[[600,0.04],[800,0.06]] },
  
  // Веселые детские звуки
  fun:         { wave:'triangle', vol:0.07, notes:[[440,0.06],[554,0.06],[659,0.06],[880,0.12]] },
  victory:     { wave:'square', vol:0.06, notes:[[784,0.1],[988,0.1],[1175,0.1],[1319,0.2]] },
  tickle:      { wave:'sine', vol:0.05, notes:[[1200,0.03],[1400,0.03],[1600,0.03]] },
  bounce:      { wave:'sine', vol:0.06, notes:[[600,0.04],[900,0.04],[1200,0.06]] },
  boop:        { wave:'sine', vol:0.07, notes:[[500,0.04],[700,0.06]] },
  drop:        { wave:'triangle', vol:0.06, notes:[[700,0.06],[500,0.06],[400,0.1]] },
  sparkle:     { wave:'sine', vol:0.05, notes:[[1200,0.04],[1500,0.04],[1800,0.06]] },
  meow:        { wave:'sine', vol:0.06, notes:[[700,0.06],[900,0.08],[800,0.06]] },
  star:        { wave:'triangle', vol:0.06, notes:[[880,0.04],[1100,0.04],[1320,0.06],[1760,0.1]] },
  chime:       { wave:'sine', vol:0.07, notes:[[1047,0.1],[1319,0.1],[1568,0.18]] },
  
  // Новые детские звуки — более разнообразные и весёлые
  jump:        { wave:'sine', vol:0.07, notes:[[500,0.05],[700,0.05],[900,0.08]] },
  slide:       { wave:'triangle', vol:0.05, notes:[[600,0.06],[400,0.06],[300,0.1]] },
  pop:         { wave:'sine', vol:0.08, notes:[[800,0.03],[1200,0.06]] },
  whizz:       { wave:'sine', vol:0.04, notes:[[400,0.05],[800,0.05],[1200,0.1]] },
  zap:         { wave:'square', vol:0.05, notes:[[600,0.04],[800,0.04],[1000,0.06]] },
  twinkle:     { wave:'sine', vol:0.06, notes:[[1300,0.04],[1600,0.04],[2000,0.08]] },
  honk:        { wave:'square', vol:0.06, notes:[[400,0.06],[500,0.08]] },
  purr:        { wave:'sine', vol:0.04, notes:[[200,0.08],[250,0.08],[220,0.12]] },
  plop:        { wave:'triangle', vol:0.07, notes:[[400,0.04],[300,0.06],[200,0.08]] },
  squeak:      { wave:'sine', vol:0.06, notes:[[1000,0.03],[1200,0.04]] },
  laugh:       { wave:'triangle', vol:0.05, notes:[[600,0.04],[800,0.04],[700,0.04],[900,0.06]] },
  blink:       { wave:'sine', vol:0.04, notes:[[1400,0.02],[1600,0.02]] },
  flip:        { wave:'sine', vol:0.06, notes:[[500,0.04],[700,0.04],[900,0.06]] },
  swoosh:      { wave:'triangle', vol:0.04, notes:[[300,0.04],[600,0.04],[900,0.06]] },
  dingdong:    { wave:'sine', vol:0.07, notes:[[660,0.08],[880,0.08],[660,0.12]] },
  wagga:       { wave:'square', vol:0.05, notes:[[300,0.04],[350,0.04],[400,0.04],[350,0.04]] },
};

// Троттлинг + предотвращение дублирования
function playSound(type) {
  if (!soundEnabled) return;
  const now = Date.now();
  if (now - _soundLastPlay < _soundMinInterval) return;
  _soundLastPlay = now;
  
  try {
    const ctx = _getSoundCtx();
    const def = _soundDefs[type] || _soundDefs.click;
    const { wave, vol, notes } = def;
    let t = ctx.currentTime;
    
    notes.forEach(([freq, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });
  } catch(e) {
    // Игнорируем ошибки AudioContext
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('sound', soundEnabled);
  const btn = document.getElementById('soundBtn');
  if (btn) btn.textContent = soundEnabled ? '🔊' : '🔇';
  if (soundEnabled) playSound('ding');
}

// ===== ЗВЁЗДОЧКИ =====
function spawnStars(count = 20) {
  const emojis = ['⭐', '✨', '🌟', '💫', '🎉', '🎊', '💜'];
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

// ===== КОНФЕТТИ =====
function launchConfetti() {
  if (typeof confetti !== 'undefined') {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#9900FF', '#BB44FF', '#FF69B4', '#FFD700'] });
  }
  spawnStars(15);
  playSound('success');
}

// ===== УВЕДОМЛЕНИЯ =====
let notifCount = 0;

async function loadNotifications() {
  const data = await api('/api/notifications');
  if (!data) return [];
  notifCount = data.filter(n => !n.isRead).length;
  const badge = document.getElementById('notifBadge');
  if (badge) badge.textContent = notifCount > 0 ? notifCount : '';
  return data;
}

function getNotificationsPanel() {
  return document.getElementById('notifPanel');
}

function renderNotificationsList(notes = []) {
  const list = document.getElementById('notifList');
  if (!list) return;
  list.innerHTML = notes.length
    ? notes.map(n => `
      <div style="padding:10px 0;border-bottom:1px solid #f0e8ff;">
        <div style="font-size:0.9rem;font-weight:600;color:${n.type === 'success' ? '#00aa44' : n.type === 'warning' ? '#cc8800' : '#1a1a2e'};">${n.text}</div>
        <div style="font-size:0.75rem;color:#aaa;margin-top:3px;">${new Date(n.createdAt).toLocaleString('ru')}</div>
      </div>`).join('')
    : '<p style="color:#888;text-align:center;padding:16px;">Нет уведомлений</p>';
}

async function toggleNotificationsPanel() {
  const panel = getNotificationsPanel();
  if (!panel) return;
  const isOpen = panel.style.display === 'block';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const notes = await loadNotifications();
    renderNotificationsList(notes || []);
    await api('/api/notifications/read', { method: 'PATCH' });
    const badge = document.getElementById('notifBadge');
    if (badge) badge.textContent = '';
  }
}

function ensureNotificationsUI() {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;

  if (!document.getElementById('notifPanel')) {
    const panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.style.cssText = 'position:fixed;top:80px;right:24px;width:300px;background:white;border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:500;padding:20px;max-height:400px;overflow-y:auto;display:none;';
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:12px;"><b>Уведомления</b><button type="button" id="notifCloseBtn" style="background:none;border:none;cursor:pointer;">✕</button></div><div id="notifList"><p style="color:#888;text-align:center;">Загрузка...</p></div>';
    document.body.appendChild(panel);
    panel.querySelector('#notifCloseBtn')?.addEventListener('click', toggleNotificationsPanel);
  }

  const existingButton = document.querySelector('.notif-btn');
  if (existingButton) {
    existingButton.onclick = toggleNotificationsPanel;
  }

  if (!document.getElementById('notifBadge')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'notif-btn';
    button.innerHTML = '🔔 <span class="notif-badge" id="notifBadge"></span>';
    button.onclick = toggleNotificationsPanel;

    const avatar = topbarRight.querySelector('.user-avatar');
    if (avatar) {
      topbarRight.insertBefore(button, avatar);
    } else {
      topbarRight.appendChild(button);
    }
  }
}

// ===== КОТ-АССИСТЕНТ =====
const catMessages = [
  'Не забыл сохранить проект? 💾',
  'Ты молодец! Продолжай в том же духе! 🌟',
  'Попробуй запустить код — вдруг уже работает? 🚀',
  'Сделай перерыв, попей воды 💧',
  'Ошибки — это часть обучения! 💪',
  'Проверь дедлайны по заданиям 📅',
  'Мурр! Я всегда рядом 😺',
  'Каждый код — это шаг к мечте! ✨',
  'Сегодня хороший день для новых знаний! 📚',
  'Ты умнее, чем думаешь! 🧠',
  'Не сдавайся, у тебя всё получится! 🌈',
  'Псст... у меня есть подсказка, нажми на меня! 😼',
  'Билетики накапливаются за выполненные задания! 🎟️',
  'Главное — не сдаваться! 💪🐈'
];

// Фразы при клике 
const catClickMessages = [
  'Мурр! Не щекочи! 😾',
  'Ой, привет! 👋',
  'Я кот-программист! 💻🐈',
  'Чесать меня не надо, лучше пиши код! 😼',
  'Пурр... ты мой любимый ученик! ❤️',
  'Буду рядом, если зависнешь! 😺',
  'Мяу! 🐱',
  'Ты знаешь, что кошки очень умные? 🧠',
  'Нажми ещё раз! 😻',
  'Сегодня ты особенно умный! 🌟'
];

// Храним оригинальную позицию кота для возврата после авто-отодвигания
let _catOrigPos = null;

let catClickIndex = 0;
let catAutoIndex = 0;

function initCatAssistant() {
  // Если страница сама управляет котом (песочница), не трогаем
  if (window._sandboxCatManaged) return;
  const cat = document.getElementById('cat-assistant');
  if (!cat) return;

  const bubble = cat.querySelector('.cat-bubble');
  const img = cat.querySelector('img');
  const isMobile = window.innerWidth < 768;

  // ===== DRAG-TO-MOVE =====
  // Восстанавливаем сохранённую позицию
  (function restoreCatPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem('catPos'));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        cat.style.left = saved.x + 'px';
        cat.style.top = saved.y + 'px';
        cat.style.bottom = 'auto';
        cat.style.right = 'auto';
      }
    } catch (e) { /* ignore */ }
  })();

  let dragStartX = 0, dragStartY = 0;
  let dragOrigLeft = 0, dragOrigTop = 0;
  let isDragging = false;
  let wasDragged = false;
  let dragArmed = false; // для touch: не начинаем перетаскивание сразу, ждём порога

  // Порог перетаскивания: на мобилке больше, чтобы случайные касания не триггерили
  const dragThreshold = isMobile ? 8 : 5;

  // Сохраняем привязки, чтобы потом отписаться при необходимости
  let _boundMouseMove, _boundMouseUp;
  let _boundTouchMove, _boundTouchEnd;

  function catDragStart(clientX, clientY) {
    const rect = cat.getBoundingClientRect();
    dragStartX = clientX;
    dragStartY = clientY;
    dragOrigLeft = rect.left;
    dragOrigTop = rect.top;
    isDragging = true;
    wasDragged = false;
    dragArmed = false;
    cat.classList.add('dragging');
    cat.style.left = rect.left + 'px';
    cat.style.top = rect.top + 'px';
    cat.style.bottom = 'auto';
    cat.style.right = 'auto';
  }

  function catDragMove(clientX, clientY) {
    if (!isDragging) return;
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;
    // Не считаем перетаскиванием, пока не превышен порог
    if (!dragArmed && !wasDragged && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
      dragArmed = true;
      wasDragged = true;
    }
    // Если не вооружены и не тащим — не двигаем кота
    if (!dragArmed && !wasDragged) return;
    let newLeft = dragOrigLeft + dx;
    let newTop = dragOrigTop + dy;
    const maxLeft = window.innerWidth - cat.offsetWidth;
    const maxTop = window.innerHeight - cat.offsetHeight;
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));
    cat.style.left = newLeft + 'px';
    cat.style.top = newTop + 'px';
  }

  function catDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    cat.classList.remove('dragging');
    // Сбрасываем wasDragged, если был только тач-старт без реального движения
    if (wasDragged && dragArmed) {
      try {
        localStorage.setItem('catPos', JSON.stringify({
          x: parseInt(cat.style.left) || 0,
          y: parseInt(cat.style.top) || 0
        }));
      } catch (e) { /* ignore */ }
    } else {
      // Если drag не состоялся — сбрасываем флаг, чтобы click сработал
      wasDragged = false;
    }
    dragArmed = false;
  }

  // Mouse
  cat.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    catDragStart(e.clientX, e.clientY);
    e.preventDefault();
  });
  _boundMouseMove = function(e) { catDragMove(e.clientX, e.clientY); };
  _boundMouseUp = function() { catDragEnd(); };
  document.addEventListener('mousemove', _boundMouseMove);
  document.addEventListener('mouseup', _boundMouseUp);

  // Touch — с порогом: не начинаем drag сразу, ждём пока палец сдвинется
  // touchstart НЕ вызывает preventDefault — страница скроллится при обычном касании
  // preventDefault вызывается только в touchmove, когда началось реальное перетаскивание
  cat.addEventListener('touchstart', function(e) {
    const t = e.touches[0];
    const rect = cat.getBoundingClientRect();
    dragStartX = t.clientX;
    dragStartY = t.clientY;
    dragOrigLeft = rect.left;
    dragOrigTop = rect.top;
    isDragging = true;
    wasDragged = false;
    dragArmed = false;
    cat.classList.add('dragging');
    cat.style.left = rect.left + 'px';
    cat.style.top = rect.top + 'px';
    cat.style.bottom = 'auto';
    cat.style.right = 'auto';
    // НЕ вызываем preventDefault — скролл должен работать
  }, { passive: true });

  _boundTouchMove = function(e) {
    if (!isDragging) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStartX;
    const dy = t.clientY - dragStartY;
    if (!dragArmed && !wasDragged && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
      dragArmed = true;
      wasDragged = true;
      // Началось перетаскивание — блокируем скролл
      cat.style.touchAction = 'none';
      e.preventDefault();
    }
    if (!dragArmed && !wasDragged) return;
    let newLeft = dragOrigLeft + dx;
    let newTop = dragOrigTop + dy;
    const maxLeft = window.innerWidth - cat.offsetWidth;
    const maxTop = window.innerHeight - cat.offsetHeight;
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));
    cat.style.left = newLeft + 'px';
    cat.style.top = newTop + 'px';
    if (dragArmed) e.preventDefault();
  };
  _boundTouchEnd = function() {
    // Восстанавливаем touch-action для скролла
    cat.style.touchAction = '';
    if (!isDragging) return;
    isDragging = false;
    cat.classList.remove('dragging');
    if (wasDragged && dragArmed) {
      try {
        localStorage.setItem('catPos', JSON.stringify({
          x: parseInt(cat.style.left) || 0,
          y: parseInt(cat.style.top) || 0
        }));
      } catch (e) { /* ignore */ }
    } else {
      wasDragged = false;
    }
    dragArmed = false;
  };
  document.addEventListener('touchmove', _boundTouchMove, { passive: true });
  document.addEventListener('touchend', _boundTouchEnd);

  // При resize подрезаем позицию, если кот уехал за экран
  window.addEventListener('resize', function() {
    const left = parseInt(cat.style.left);
    const top = parseInt(cat.style.top);
    if (isNaN(left) || isNaN(top)) return;
    const maxLeft = window.innerWidth - cat.offsetWidth;
    const maxTop = window.innerHeight - cat.offsetHeight;
    const newLeft = Math.max(0, Math.min(left, maxLeft));
    const newTop = Math.max(0, Math.min(top, maxTop));
    if (newLeft !== left || newTop !== top) {
      cat.style.left = newLeft + 'px';
      cat.style.top = newTop + 'px';
      try {
        localStorage.setItem('catPos', JSON.stringify({ x: newLeft, y: newTop }));
      } catch (e) { /* ignore */ }
    }
  });

  // ===== КЛИК ПО КОТУ (только если не было drag) =====
  cat.addEventListener('click', function(e) {
    if (wasDragged) {
      wasDragged = false;
      return;
    }
    if (!bubble) return;
    const msg = catClickMessages[catClickIndex % catClickMessages.length];
    catClickIndex++;
    bubble.textContent = msg;
    cat.classList.add('talking');
    clearTimeout(cat._bubbleTimer);
    cat._bubbleTimer = setTimeout(function() {
      cat.classList.remove('talking');
    }, 4000);
    playSound('ding');
    if (img) {
      img.style.animation = 'none';
      img.style.transform = 'scale(1.2) rotate(10deg)';
      setTimeout(function() {
        img.style.transform = '';
        img.style.animation = '';
      }, 300);
    }
  });

  // ===== АВТОФРАЗЫ КАЖДЫЕ 25 СЕКУНД =====
  setInterval(function() {
    if (!bubble) return;
    const msg = catMessages[catAutoIndex % catMessages.length];
    catAutoIndex++;
    bubble.textContent = msg;
    cat.classList.add('talking');
    clearTimeout(cat._bubbleTimer);
    cat._bubbleTimer = setTimeout(function() {
      cat.classList.remove('talking');
    }, 4000);
  }, 25000);

  // ===== ПЕРВОЕ ПРИВЕТСТВИЕ =====
  setTimeout(function() {
    if (bubble && !localStorage.getItem('catPos')) {
      bubble.textContent = 'Привет! Нажми на меня 😺';
      cat.classList.add('talking');
      clearTimeout(cat._bubbleTimer);
      cat._bubbleTimer = setTimeout(function() {
        cat.classList.remove('talking');
      }, 4000);
    }
  }, 3000);

  // ===== АВТОМАТИЧЕСКОЕ ОТОДВИГАНИЕ ПРИ ФОКУСЕ НА ПОЛЕ ВВОДА (мобильные) =====
  if (isMobile) {
    const inputs = document.querySelectorAll('input[type="text"], input[type="search"], input[type="email"], input[type="password"], textarea');
    let _catFocusMoved = false;

    function moveCatFromInput() {
      if (!cat || _catFocusMoved) return;
      _catFocusMoved = true;
      // Запоминаем позицию только если ещё не запомнили
      if (!_catOrigPos) {
        _catOrigPos = {
          left: cat.style.left,
          top: cat.style.top,
          bottom: cat.style.bottom,
          right: cat.style.right,
          display: cat.style.display
        };
      }
      // Перемещаем кота наверх (left top), подальше от клавиатуры
      cat.style.left = '16px';
      cat.style.top = '80px';
      cat.style.bottom = 'auto';
      cat.style.right = 'auto';
      // Уменьшаем размер на мобилке, чтобы меньше мешал
      var catImg = cat.querySelector('img');
      if (catImg) catImg.style.width = '50px';
    }

    function restoreCatPosition() {
      if (!cat || !_catFocusMoved) return;
      _catFocusMoved = false;
      if (_catOrigPos) {
        cat.style.left = _catOrigPos.left;
        cat.style.top = _catOrigPos.top;
        cat.style.bottom = _catOrigPos.bottom;
        cat.style.right = _catOrigPos.right;
      }
      // Восстанавливаем размер
      var catImg = cat.querySelector('img');
      if (catImg) catImg.style.width = '';
    }

    inputs.forEach(function(el) {
      el.addEventListener('focus', function() {
        // Небольшая задержка, чтобы клавиатура успела появиться и мы знали её размер
        setTimeout(moveCatFromInput, 300);
      });
      el.addEventListener('blur', function() {
        // Возвращаем с задержкой, чтобы клавиатура точно убралась
        setTimeout(restoreCatPosition, 400);
      });
    });
  }
}

function showCatBubble(cat, bubble, msg) {
  bubble.textContent = msg;
  cat.classList.add('talking');
  clearTimeout(cat._bubbleTimer);
  cat._bubbleTimer = setTimeout(() => cat.classList.remove('talking'), 4000);
}

// ===== САЙДБАР (мобилка) =====
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle('open');
  // Оверлей
  let overlay = document.querySelector('.sidebar-overlay');
  if (isOpen) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      overlay.onclick = toggleSidebar;
      document.body.appendChild(overlay);
    }
  } else {
    overlay?.remove();
  }
}

// ===== ТОСТ =====
function showToast(msg, type = 'success') {
  const colors = { success: '#1a1a2e', error: '#cc0000', info: '#0066cc' };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${colors[type]};color:white;padding:14px 28px;border-radius:30px;z-index:9999;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:Nunito,sans-serif;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

window.toggleNotificationsPanel = toggleNotificationsPanel;

// ===== FALLBACK для scroll-anim (гарантирует видимость на всех страницах) =====
function ensureAllVisible() {
  var hidden = document.querySelectorAll('.scroll-anim:not(.visible)');
  if (hidden.length > 0) {
    hidden.forEach(function(el) {
      el.classList.add('visible');
    });
  }
}

// Запускаем safety fallback с задержками (даже если app-enhancements.js не загружен)
// Используем 300ms для быстрого исправления, плюс повторные проверки
setTimeout(ensureAllVisible, 300);
setTimeout(ensureAllVisible, 800);
setTimeout(ensureAllVisible, 2000);
window.toggleNotif = toggleNotificationsPanel;

// ===== МИНИ-ИГРА (разминка) =====
const miniGames = [
  {
    question: 'Что из этого НЕ является языком программирования?',
    options: ['Python', 'JavaScript', 'HTML', 'Java'],
    correct: 2,
    explanation: 'HTML — это язык разметки, а не программирования!'
  },
  {
    question: 'Найди лишнее число в последовательности: 2, 4, 7, 8, 16',
    options: ['4', '7', '8', '16'],
    correct: 1,
    explanation: '7 — нечётное, остальные чётные!'
  },
  {
    question: 'Что делает цикл for?',
    options: ['Проверяет условие', 'Повторяет код несколько раз', 'Объявляет переменную', 'Выводит текст'],
    correct: 1,
    explanation: 'Цикл for повторяет блок кода заданное количество раз!'
  },
  {
    question: 'Какой тег делает текст жирным в HTML?',
    options: ['<i>', '<u>', '<b>', '<p>'],
    correct: 2,
    explanation: 'Тег <b> делает текст жирным!'
  },
  {
    question: 'Какое расширение у файла с кодом на Python?',
    options: ['.py', '.js', '.html', '.css'],
    correct: 0,
    explanation: 'Файлы на Python имеют расширение .py!'
  },
  {
    question: 'Какое ключевое слово используется для создания переменной в JavaScript?',
    options: ['var', 'make', 'create', 'new'],
    correct: 0,
    explanation: 'В JavaScript используется var, let или const для создания переменных!'
  },
  {
    question: 'Как называется процесс исправления ошибок в коде?',
    options: ['Компиляция', 'Документирование', 'Отладка', 'Тестирование'],
    correct: 2,
    explanation: 'Отладка — это процесс поиска и исправления ошибок в программе!'
  },
  {
    question: 'Что такое алгоритм?',
    options: ['Набор команд', 'Пошаговая инструкция', 'Программа', 'Данные'],
    correct: 1,
    explanation: 'Алгоритм — это пошаговая инструкция для решения задачи!'
  },
  {
    question: 'Какой язык программирования используется для создания веб-страниц?',
    options: ['HTML', 'C++', 'Python', 'Java'],
    correct: 0,
    explanation: 'HTML используется для структуры веб-страниц вместе с CSS и JavaScript!'
  },
  {
    question: 'Что делает оператор "==" в Python?',
    options: ['Присваивает значение', 'Сравнивает значения', 'Умножает значения', 'Создает список'],
    correct: 1,
    explanation: 'Оператор "==" сравнивает два значения на равенство!'
  },
  {
    question: 'Сколько бит в одном байте?',
    options: ['4', '8', '16', '32'],
    correct: 1,
    explanation: 'В одном байте 8 бит!'
  },
  {
    question: 'Какой браузер используется для просмотра веб-страниц?',
    options: ['Chrome', 'Excel', 'Photoshop', 'Word'],
    correct: 0,
    explanation: 'Chrome — это веб-браузер для просмотра сайтов!'
  }
];

function showMiniGame(onComplete) {
  const game = miniGames[Math.floor(Math.random() * miniGames.length)];
  const overlay = document.createElement('div');
  overlay.className = 'minigame-overlay';
  overlay.innerHTML = `
    <div class="minigame-box">
      <h2>🧠 Разминка!</h2>
      <p>Ответь правильно и получи бонус к XP</p>
      <div style="background:#f0e8ff;border-radius:16px;padding:16px;margin-bottom:20px;font-weight:700;">${game.question}</div>
      <div class="minigame-options">
        ${game.options.map((o, i) => `<button class="minigame-opt" onclick="checkMiniGame(this,${i},${game.correct},'${game.explanation}',${JSON.stringify(onComplete)})">${o}</button>`).join('')}
      </div>
      <div id="mgExplanation" style="display:none;margin-top:16px;color:#666;font-size:0.9rem;"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  window._mgOverlay = overlay;
  window._mgCallback = onComplete;
}

function checkMiniGame(btn, chosen, correct, explanation, callback) {
  const opts = document.querySelectorAll('.minigame-opt');
  opts.forEach(o => o.disabled = true);
  opts[correct].classList.add('correct');
  const isRight = chosen === correct;
  if (!isRight) btn.classList.add('wrong');

  document.getElementById('mgExplanation').style.display = 'block';
  document.getElementById('mgExplanation').textContent = explanation;

  if (isRight) { playSound('success'); spawnStars(10); }

  setTimeout(() => {
    window._mgOverlay?.remove();
    if (window._mgCallback) window._mgCallback(isRight);
  }, 2000);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
  // Принудительно перезагружаем GIF через JS чтобы сбросить кэш
  document.querySelectorAll('img[src*="star.gif"]').forEach(img => {
    const base = img.src.split('?')[0];
    img.src = base + '?t=' + Date.now();
  });
  
  // Проверяем API при загрузке
  setTimeout(() => testApi(), 1000);

  const soundBtn = document.getElementById('soundBtn');
  if (soundBtn) {
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    soundBtn.onclick = toggleSound;
  }

  // Звук на кнопки (без скролла!)
  document.addEventListener('click', e => {
    const btn = e.target.closest('button:not(#soundBtn), .btn-accent, .btn-white, .sidebar a, .stat-card, .skill-card');
    if (btn) playSound('click');
  });

  // Звук при наведении на интерактивные элементы
  document.addEventListener('mouseover', e => {
    const hoverable = e.target.closest('button:not(#soundBtn), .btn-accent, .btn-white, .sidebar a, .stat-card, .skill-card, .module-card, .lesson-item');
    if (hoverable && e.target === hoverable) {
      playSound('hover');
    }
  });

  // Клик по аватару в топбаре — переход в профиль для ВСЕХ ролей
  // Используем АБСОЛЮТНЫЙ путь, чтобы работало с любой страницы
  document.addEventListener('click', function(e) {
    var avatar = e.target.closest('.user-avatar');
    if (!avatar) return;
    // Не перенаправляем, если внутри аватара уже есть onclick (например, в dashboard студента)
    if (avatar.getAttribute('onclick')) return;
    // Ведём на профиль в зависимости от роли
    var role = getRole();
    var profilePaths = {
      student: '/app/student/profile.html',
      parent: '/app/parent/profile.html',
      teacher: '/app/teacher/profile.html',
      admin: '/app/admin/profile.html'
    };
    location.href = profilePaths[role] || '/app/student/profile.html';
  });

  // Автоматически подгружаем аватар в топбаре для всех страниц
  // Первая попытка — через 500ms (для страниц, где данные уже загружены)
  setTimeout(function autoLoadAvatar() {
    var avatarEl = document.getElementById('userAvatar');
    if (!avatarEl || typeof updateTopbarAvatar !== 'function') return;
    var currentText = (avatarEl.textContent || '').trim();
    // Обновляем, если аватар показывает fallback ("?" или пусто) или устаревшую заглушку
    // НЕ трогаем, если уже установлен эмодзи-аватар (смайлик, фото, shop-эффект)
    if (currentText === '?' || currentText === '' || currentText === 'A') {
      updateTopbarAvatar();
    }
  }, 500);

  // Кнопка выхода
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    playSound('close');
    setTimeout(logout, 150);
  });

  // Сайдбар на мобилке
  document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);

  ensureNotificationsUI();
  loadNotifications();
  initCatAssistant();
});

window.toggleNotificationsPanel = toggleNotificationsPanel;
