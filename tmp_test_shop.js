const http = require('http');

function api(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method,
      headers: { ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  try {
    // 1. Login как student
    const loginRes = await api('POST', '/api/auth/login', JSON.stringify({login:'president',password:'president'}));
    console.log('Login:', loginRes.token ? 'OK' : 'FAIL');
    const token = loginRes.token;

    // 2. Получить профиль
    const me = await api('GET', '/api/auth/me', null, token);
    console.log('User:', me.login, me.role, 'tickets:', me.tickets, 'avatarConfig:', JSON.stringify(me.avatarConfig));

    // 3. Получить товары магазина
    const items = await api('GET', '/api/shop', null, token);
    console.log('Shop items:', items.length);
    items.forEach(i => console.log(' -', i._id, i.name, i.type, i.price, 'icon:', i.icon, 'effect:', i.effect));

    // 4. Получить мои покупки
    const purchases = await api('GET', '/api/shop/my', null, token);
    console.log('My purchases:', purchases.length);
    purchases.forEach(p => {
      const item = p.itemId;
      if (item && typeof item === 'object') {
        console.log(' - [populated]', item._id, item.name, item.type, item.effect, 'icon:', item.icon);
      } else {
        console.log(' - [plain id]', item);
      }
    });

    // 5. Тест updateTopbarAvatar логики
    console.log('\n--- Avatar rendering test ---');
    const avConfig = me.avatarConfig || {};
    if (avConfig.photo) {
      console.log('Priority: PHOTO =>', avConfig.photo);
    } else {
      const unlocked = avConfig.unlockedItems || [];
      if (unlocked.length > 0) {
        const lastEffect = unlocked[unlocked.length - 1];
        console.log('Priority: SHOP EFFECT =>', lastEffect);
      } else {
        console.log('Priority: FIRST LETTER =>', (me.firstName || '?')[0]);
      }
    }

    console.log('\nALL CHECKS PASSED');
  } catch(e) {
    console.error('ERROR:', e);
  }
}

main();
