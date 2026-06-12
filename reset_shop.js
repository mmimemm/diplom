// Удалить все товары и пересоздать через seed
require('dotenv').config();
const mongoose = require('mongoose');
const { ShopItem } = require('./server/models/Other');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const deleted = await ShopItem.deleteMany({});
  console.log(`Deleted ${deleted.deletedCount} old shop items`);

  // Now insert the updated items
  const items = [
    { name: 'Клоунский нос', description: 'Красный клоунский нос для аватара 🎪', icon: '🤡', price: 50, type: 'avatar', effect: 'clownnose', duration: 0 },
    { name: 'Неоновые выделения', description: 'Светящиеся выделения кода', icon: '💡', price: 40, type: 'editor_skin',
      css: '.monaco-editor .selected-text { background: rgba(153,0,255,0.25) !important; box-shadow: 0 0 12px rgba(153,0,255,0.5) !important; } .monaco-editor .selectionHighlight { background: rgba(255,105,180,0.15) !important; }' },
    { name: 'Космические звёзды', description: 'Анимированные звёзды на фоне панели кода', icon: '🌌', price: 60, type: 'editor_skin',
      css: '.monaco-editor .monaco-editor-background::after { content: "✨"; position: absolute; right: 10px; top: 10px; font-size: 24px; opacity: 0.4; animation: starSpin 3s linear infinite; } @keyframes starSpin { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.3); } 100% { transform: rotate(360deg) scale(1); } }' },
    { name: 'Крутые наушники', description: 'Элемент аватара — наушники', icon: '🎧', price: 100, type: 'avatar', effect: 'headphones', duration: 0 },
    { name: 'Светящийся шлем', description: 'Элемент аватара — шлем хакера', icon: '⛑️', price: 200, type: 'avatar', effect: 'helmet', duration: 0 },
    { name: 'Смайлик-единорог', description: 'Элемент аватара — волшебный единорог 🦄', icon: '🦄', price: 150, type: 'avatar', effect: 'unicorn', duration: 0 },
    { name: 'Солнцезащитные очки 🕶️', description: 'Крутой элемент аватара — солнечные очки', icon: '🕶️', price: 120, type: 'avatar', effect: 'sunglasses', duration: 0 },
    { name: 'Бейдж Суперзвезда', description: 'Элемент аватара — звёздный бейдж', icon: '⭐', price: 180, type: 'avatar', effect: 'superbadge', duration: 0 }
  ];

  const created = await ShopItem.insertMany(items);
  console.log(`Created ${created.length} shop items:`);
  created.forEach(i => console.log(`  - ${i.icon} ${i.name} (${i.type}) — ${i.price}🎫`));

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
