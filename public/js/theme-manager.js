// Управление темной темой для всех страниц

// Загружаем тему при старте
function loadTheme() {
  try {
    const savedTheme = localStorage.getItem('theme');
    
    // По умолчанию ВСЕГДА светлая тема
    // Системные предпочтения игнорируем — пользователь может переключить вручную
    const theme = savedTheme || 'light';
    
    applyTheme(theme);
    
    // Возвращаем текущую тему для использования в других скриптах
    return theme;
  } catch (error) {
    console.error('Ошибка загрузки темы:', error);
    return 'light';
  }
}

// Применяем тему
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Обновляем переключатель если он есть
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.checked = theme === 'dark';
  }
  
  // Обновляем тему на сервере если пользователь авторизован
  if (window.getToken && window.getToken()) {
    api('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ theme })
    }).catch(() => {}); // Игнорируем ошибки
  }
}

// Переключаем тему
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  applyTheme(newTheme);
  playSound('magic');
  
  return newTheme;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  
  // Настраиваем слушатель для системных предпочтений
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
      // Если пользователь не выбирал тему явно, следуем системным настройкам
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
  
  // Настраиваем переключатель если он есть
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('change', () => toggleTheme());
  }
});

// Экспортируем функции для использования
window.loadTheme = loadTheme;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
