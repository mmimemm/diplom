// Скрипт для добавления магазина во все страницы админа
const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'public', 'app', 'admin');

// Массив HTML файлов админ-панели
const adminPages = [
  'applications.html',
  'courses.html',
  'dashboard.html',
  'groups.html',
  'payments.html',
  'reviews.html',
  'tickets.html',
  'users.html'
];

// Шаблон меню магазина
const shopMenuItem = '\n  <a href="shop-admin.html"><span class="icon">🎪</span> Магазин</a>';

adminPages.forEach(page => {
  const filePath = path.join(adminDir, page);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Ищем место в меню перед разделителем или logout
    const menuPattern = /(<a href=".*"><span class="icon">.*<\/span>.*<\/a>)(\s*<div class="sidebar-bottom">|\s*<a href="#" id="logoutBtn">)/;
    
    if (content.includes('<a href="shop-admin.html">')) {
      console.log(`✓ Магазин уже есть в ${page}`);
    } else if (content.match(menuPattern)) {
      // Добавляем магазин перед разделителем
      const updatedContent = content.replace(
        menuPattern,
        `$1${shopMenuItem}$2`
      );
      
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✓ Добавлен магазин в ${page}`);
    } else {
      console.log(`✗ Не удалось найти меню в ${page}`);
    }
  } catch (error) {
    console.log(`✗ Ошибка обработки ${page}:`, error.message);
  }
});

console.log('\n✅ Обновление меню завершено!');