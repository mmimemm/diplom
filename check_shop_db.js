require('dotenv').config();
const mongoose = require('mongoose');
const { ShopItem, Purchase } = require('./server/models/Other');
const User = require('./server/models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Проверим товары
  const items = await ShopItem.find({ isActive: true });
  console.log('Товары в магазине:', items.length);
  items.forEach(i => console.log('  -', i.icon, i.name, i.type, i.price, '🎫', 'effect:', i.effect, 'css:', i.css ? 'да' : 'нет'));
  
  // Проверим покупки
  const purchases = await Purchase.find().populate('userId', 'firstName lastName').populate('itemId', 'name type effect css');
  console.log('\nПокупки:', purchases.length);
  purchases.forEach(p => {
    console.log('  -', p.userId?.firstName, p.userId?.lastName, 'купил', p.itemId?.name, 
      '(type:', p.itemId?.type, ', effect:', p.itemId?.effect, ', css:', p.itemId?.css ? 'да' : 'нет', ")");
  });
  
  // Проверим пользователей с билетиками
  const students = await User.find({ role: 'student' }).select('firstName lastName tickets avatarConfig.unlockedItems xp');
  console.log('\nСтуденты:');
  students.forEach(s => {
    console.log('  -', s.firstName, s.lastName, 'tickets:', s.tickets,
      'unlockedItems:', s.avatarConfig?.unlockedItems?.length || 0,
      'xp:', s.xp);
  });
  
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
