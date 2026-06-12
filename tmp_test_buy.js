const http = require('http');

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Логинимся
  const login = await api('POST', '/api/auth/login', JSON.stringify({ login: 'sМимиго', password: '123456' }));
  console.log('LOGIN:', login.status, JSON.stringify(login.data).slice(0,200));
  if (!login.data || !login.data.token) { console.log('NO TOKEN'); return; }
  const token = login.data.token;

  // Проверяем /api/shop
  const shop = await api('GET', '/api/shop', null);
  console.log('SHOP items:', shop.data?.length);
  
  // Проверяем /api/shop/my
  const my = await api('GET', '/api/shop/my', null);
  console.log('MY purchases:', my.data?.length);

  // Пробуем купить товар за 40 (Неоновые выделения) — уже куплен
  // Пробуем что-то не купленное: Крутые наушники (100) — у Виктории 10 tickets, не хватит
  // Найдём товар с ценой <= 10
  const items = shop.data || [];
  const cheapItem = items.find(i => i.price <= 10 && !my.data?.some(p => String(p.itemId?._id || p.itemId) === String(i._id)));
  console.log('CHEAP item:', cheapItem?.name, cheapItem?.price, cheapItem?._id);

  if (cheapItem) {
    const buy = await api('POST', `/api/shop/buy/${cheapItem._id}`, null);
    console.log('BUY result:', buy.status, JSON.stringify(buy.data));
  } else {
    console.log('No affordable unpurchased items');
    // Попробуем купить самый дешёвый доступный
    const sorted = items.filter(i => !my.data?.some(p => String(p.itemId?._id || p.itemId) === String(i._id)))
      .sort((a,b) => a.price - b.price);
    console.log('Cheapest available:', sorted[0]?.name, sorted[0]?.price, sorted[0]?._id);
  }
  
  // Проверяем профиль — avatarConfig
  const me = await api('GET', '/api/auth/me', null);
  console.log('ME avatarConfig:', JSON.stringify(me.data?.avatarConfig));
}

main().catch(console.error);
