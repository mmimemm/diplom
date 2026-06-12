// Скрипт для обновления CSS товара "Космические звёзды" в БД
// Запуск: node update_star_skin.js (из папки it-mania)
require('dotenv').config();
const mongoose = require('mongoose');
const { ShopItem } = require('./server/models/Other');

const NEW_CSS = `/* Космические звёзды — только внутри .sandbox-layout за панелями */
.skin-cosmic-stars-container {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
  border-radius: 16px;
}
.skin-cosmic-stars-container::before,
.skin-cosmic-stars-container::after {
  position: absolute;
  pointer-events: none;
  animation: starDrift 8s ease-in-out infinite;
}
.skin-cosmic-stars-container::before {
  content: "✨";
  top: 5%;
  left: 5%;
  font-size: 26px;
  animation-delay: 0s;
}
.skin-cosmic-stars-container::after {
  content: "🌟";
  bottom: 8%;
  right: 3%;
  font-size: 30px;
  animation-delay: 2s;
}
.skin-cosmic-stars-container .star-extra-1 {
  position: absolute;
  top: 50%;
  left: 80%;
  font-size: 22px;
  animation: starDrift 8s ease-in-out infinite;
  animation-delay: 4s;
  content: "⭐";
}
.skin-cosmic-stars-container .star-extra-2 {
  position: absolute;
  bottom: 20%;
  left: 10%;
  font-size: 18px;
  animation: starDrift 8s ease-in-out infinite;
  animation-delay: 6s;
  content: "✨";
}
@keyframes starDrift {
  0%, 100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.3; }
  25% { transform: translateY(-20px) rotate(90deg) scale(1.2); opacity: 0.8; }
  50% { transform: translateY(0) rotate(180deg) scale(1); opacity: 0.4; }
  75% { transform: translateY(15px) rotate(270deg) scale(0.9); opacity: 0.6; }
}`;

async function updateStarSkin() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Подключено к MongoDB');

  const result = await ShopItem.updateOne(
    { name: 'Космические звёзды' },
    { $set: { css: NEW_CSS } }
  );

  if (result.matchedCount > 0) {
    console.log('✅ CSS товара "Космические звёзды" обновлён');
  } else {
    console.log('⚠️ Товар "Космические звёзды" не найден в БД');
  }

  await mongoose.disconnect();
  process.exit(0);
}

updateStarSkin().catch(err => { console.error(err); process.exit(1); });
