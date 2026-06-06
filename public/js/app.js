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

// ===== ЗВУК =====
let soundEnabled = localStorage.getItem('sound') !== 'false';

// Мелодичные звуки на кнопки
function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const sounds = {
      success:  [{ f:523,d:0.08 },{ f:659,d:0.08 },{ f:784,d:0.15 }],
      coin:     [{ f:1047,d:0.06 },{ f:1319,d:0.12 }],
      ding:     [{ f:660,d:0.12 }],
      error:    [{ f:330,d:0.08 },{ f:220,d:0.25 }],
      levelup:  [{ f:523,d:0.08 },{ f:659,d:0.08 },{ f:784,d:0.08 },{ f:1047,d:0.25 }],
      click:    [{ f:800,d:0.05 }],
      open:     [{ f:600,d:0.06 },{ f:900,d:0.1 }],
      close:    [{ f:500,d:0.06 },{ f:350,d:0.1 }],
      buy:      [{ f:784,d:0.08 },{ f:1047,d:0.08 },{ f:1319,d:0.2 }]
    };
    const notes = sounds[type] || sounds.click;
    let t = ctx.currentTime;
    notes.forEach(n => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(n.f, t);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + n.d);
      o.start(t); o.stop(t + n.d);
      t += n.d;
    });
  } catch(e) {}
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('sound', soundEnabled);
  const btn = document.getElementById('soundBtn');
  if (btn) btn.textContent = soundEnabled ? '🔊' : '🔇';
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

let catClickIndex = 0;
let catAutoIndex = 0;

function initCatAssistant() {
  const cat = document.getElementById('cat-assistant');
  if (!cat) return;

  const bubble = cat.querySelector('.cat-bubble');
  const img = cat.querySelector('img');

  // Клик по коту — игривые фразы
  cat.addEventListener('click', () => {
    if (!bubble) return;
    const msg = catClickMessages[catClickIndex % catClickMessages.length];
    catClickIndex++;
    showCatBubble(cat, bubble, msg);
    playSound('ding');
    // Маленький эффект при клике
    if (img) {
      img.style.animation = 'none';
      img.style.transform = 'scale(1.2) rotate(10deg)';
      setTimeout(() => {
        img.style.transform = '';
        img.style.animation = '';
      }, 300);
    }
  });

  // Автофразы каждые 25 секунд
  setInterval(() => {
    if (!bubble) return;
    const msg = catMessages[catAutoIndex % catMessages.length];
    catAutoIndex++;
    showCatBubble(cat, bubble, msg);
  }, 25000);

  // Первое сообщение через 3 секунды
  setTimeout(() => {
    if (bubble) showCatBubble(cat, bubble, 'Привет! Нажми на меня 😺');
  }, 3000);
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
