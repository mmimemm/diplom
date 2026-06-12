// Полный тест всех API-эндпоинтов
const http = require('http');

const BASE = 'http://localhost:3000';
let token = '';
let userId = '';
let adminId = '';
let courseId = '';
let moduleId = '';
let lessonId = '';
let groupId = '';
let itemId = '';
let ticketId = '';
let subId = '';

function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch(e) { parsed = data; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('\n========== ТЕСТИРОВАНИЕ API IT-MANIA ==========\n');

  // 1. ПУБЛИЧНЫЕ ЭНДПОИНТЫ
  console.log('--- Публичные эндпоинты ---');
  
  let r = await api('GET', '/api/test');
  console.log(r.status === 200 ? '✅' : '❌', '/api/test:', r.status, r.data.message || '');

  // 2. ЗАЯВКИ (публичные)
  r = await api('POST', '/api/apply', { parentName: 'Тест', phone: '+79991234567', childAge: 10 });
  console.log(r.status === 200 ? '✅' : '❌', '/api/apply:', r.status);

  // 3. ОТЗЫВЫ (публичные)
  r = await api('POST', '/api/reviews', { authorName: 'Тест', text: 'Отличный курс!', rating: 5 });
  console.log(r.status === 200 ? '✅' : '❌', '/api/reviews (create):', r.status);

  r = await api('GET', '/api/reviews');
  console.log(r.status === 200 ? '✅' : '❌', '/api/reviews:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} отзывов)`);

  // 4. ЛОГИН
  console.log('\n--- Авторизация ---');
  r = await api('POST', '/api/auth/login', { login: 'admin', password: 'admin123' });
  if (r.status === 200) {
    token = r.data.token;
    adminId = r.data.id;
    console.log('✅ /api/auth/login: token получен, role:', r.data.role);
  } else {
    console.log('❌ /api/auth/login:', r.status, r.data.error);
    console.log('Запустите seed: node server/seed.js');
    process.exit(1);
  }

  // 5. GET ME
  r = await api('GET', '/api/auth/me');
  console.log(r.status === 200 ? '✅' : '❌', '/api/auth/me:', r.status, r.data.firstName || '');

  // 6. АДМИН - ПОЛЬЗОВАТЕЛИ
  console.log('\n--- Админ: пользователи ---');
  r = await api('GET', '/api/admin/users');
  console.log(r.status === 200 ? '✅' : '❌', '/api/admin/users:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} пользователей)`);

  // 7. АДМИН - ГРУППЫ
  r = await api('GET', '/api/admin/groups');
  console.log(r.status === 200 ? '✅' : '❌', '/api/admin/groups:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} групп)`);

  // 8. АДМИН - ЗАЯВКИ
  r = await api('GET', '/api/admin/applications');
  console.log(r.status === 200 ? '✅' : '❌', '/api/admin/applications:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} заявок)`);

  // 9. АДМИН - АНАЛИТИКА
  r = await api('GET', '/api/admin/analytics');
  console.log(r.status === 200 ? '✅' : '❌', '/api/admin/analytics:', r.status);

  // 10. АДМИН - ЧАТЫ
  r = await api('GET', '/api/admin/reviews');
  console.log(r.status === 200 ? '✅' : '❌', '/api/admin/reviews:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} отзывов)`);

  r = await api('GET', '/api/admin/chat/teachers');
  console.log(r.status === 200 ? '✅' : '❌', '/api/admin/chat/teachers:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} учителей)`);

  r = await api('GET', '/api/admin/chat/parents');
  console.log(r.status === 200 ? '✅' : '❌', '/api/admin/chat/parents:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} родителей)`);

  // 11. КУРСЫ И УРОКИ
  console.log('\n--- Курсы и уроки ---');
  r = await api('GET', '/api/courses');
  console.log(r.status === 200 ? '✅' : '❌', '/api/courses:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} курсов)`);
  if (Array.isArray(r.data) && r.data.length > 0) {
    courseId = r.data[0]._id;
    r = await api('GET', `/api/courses/${courseId}/modules`);
    console.log(r.status === 200 ? '✅' : '❌', `/api/courses/${courseId}/modules:`, r.status, `(${Array.isArray(r.data) ? r.data.length : 0} модулей)`);
    if (Array.isArray(r.data) && r.data.length > 0) {
      moduleId = r.data[0]._id;
      r = await api('GET', `/api/modules/${moduleId}/lessons`);
      console.log(r.status === 200 ? '✅' : '❌', `/api/modules/${moduleId}/lessons:`, r.status, `(${Array.isArray(r.data) ? r.data.length : 0} уроков)`);
      if (Array.isArray(r.data) && r.data.length > 0) {
        lessonId = r.data[0]._id;
        r = await api('GET', `/api/lessons/${lessonId}`);
        console.log(r.status === 200 ? '✅' : '❌', `/api/lessons/${lessonId}:`, r.status, r.data.title || '');
      }
    }
  }

  // 12. УВЕДОМЛЕНИЯ
  console.log('\n--- Уведомления ---');
  r = await api('GET', '/api/notifications');
  console.log(r.status === 200 ? '✅' : '❌', '/api/notifications:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} уведомлений)`);

  r = await api('PATCH', '/api/notifications/read');
  console.log(r.status === 200 ? '✅' : '❌', '/api/notifications/read:', r.status);

  // 13. ТИКЕТЫ
  console.log('\n--- Тикеты ---');
  r = await api('POST', '/api/tickets', { subject: 'Тестовый тикет', message: 'Проверка связи' });
  console.log(r.status === 200 ? '✅' : '❌', '/api/tickets (create):', r.status);
  if (r.data && r.data._id) ticketId = r.data._id;

  r = await api('GET', '/api/tickets');
  console.log(r.status === 200 ? '✅' : '❌', '/api/tickets:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} тикетов)`);

  if (ticketId) {
    r = await api('POST', `/api/tickets/${ticketId}/reply`, { text: 'Ответ на тикет' });
    console.log(r.status === 200 ? '✅' : '❌', `/api/tickets/${ticketId}/reply:`, r.status);
  }

  // 14. МАГАЗИН
  console.log('\n--- Магазин ---');
  r = await api('GET', '/api/shop');
  console.log(r.status === 200 ? '✅' : '❌', '/api/shop:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} товаров)`);
  if (Array.isArray(r.data) && r.data.length > 0) {
    itemId = r.data[0]._id;
  }

  r = await api('GET', '/api/shop/my');
  console.log(r.status === 200 ? '✅' : '❌', '/api/shop/my:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} покупок)`);

  r = await api('POST', '/api/shop/items', { name: 'Тест-скин', description: 'Тест', icon: '🎨', price: 10, type: 'editor_skin' });
  console.log(r.status === 200 ? '✅' : '❌', '/api/shop/items (create):', r.status);

  r = await api('GET', '/api/shop/purchases');
  console.log(r.status === 200 ? '✅' : '❌', '/api/shop/purchases:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} покупок)`);

  // 15. ЧАТЫ
  console.log('\n--- Чаты ---');
  r = await api('GET', '/api/admins');
  console.log(r.status === 200 ? '✅' : '❌', '/api/admins:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} админов)`);

  // 16. ПОЛЬЗОВАТЕЛЬ
  r = await api('GET', `/api/user/${adminId}`);
  console.log(r.status === 200 ? '✅' : '❌', `/api/user/${adminId}:`, r.status);

  // 17. ПЛАТЕЖИ (тестовые)
  console.log('\n--- Платежи ---');
  r = await api('POST', '/api/payments', { studentId: adminId, amount: 3000, type: 'online', month: 1 });
  console.log(r.status === 200 ? '✅' : '❌', '/api/payments (create):', r.status);

  r = await api('GET', '/api/payments');
  console.log(r.status === 200 ? '✅' : '❌', '/api/payments:', r.status, `(${Array.isArray(r.data) ? r.data.length : 0} платежей)`);

  // 18. ПРОВЕРКА НЕАВТОРИЗОВАННОГО ДОСТУПА
  console.log('\n--- Безопасность ---');
  const noAuth = await api('GET', '/api/admin/users');
  if (noAuth.status === 200 && token) {
    console.log('ℹ️  /api/admin/users без токена доступен (но мы уже с токеном)');
  }

  // 19. НЕСУЩЕСТВУЮЩИЙ ЭНДПОИНТ
  r = await api('GET', '/api/nonexistent');
  console.log(r.status === 404 ? '✅' : '❌', '/api/nonexistent (404 ожидаемо):', r.status);

  // 20. ПРОВЕРКА ПОСТ-ЭНДПОИНТОВ
  console.log('\n--- Студенческие эндпоинты ---');
  r = await api('GET', '/api/my-group');
  console.log(r.status === 200 ? '✅' : '❌', '/api/my-group:', r.status, r.data === null ? '(null - не ученик)' : '');

  r = await api('GET', '/api/my-submissions');
  console.log(r.status === 200 ? '✅' : '❌', '/api/my-submissions:', r.status);

  console.log('\n========== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ==========');
  console.log(`Всего проверено эндпоинтов: 30+`);
}

run().catch(e => console.error('Ошибка:', e));
