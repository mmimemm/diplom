require('dotenv').config();
const mongoose = require('mongoose');
const { Purchase } = require('./server/models/Other');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Удалить покупки с битым itemId
  const r1 = await Purchase.deleteMany({ itemId: null });
  console.log('Удалено покупок с null itemId:', r1.deletedCount);
  
  // Удалить покупки, где itemId ссылается на несуществующий документ
  const all = await Purchase.find().populate('itemId');
  let deleted = 0;
  for (const p of all) {
    if (!p.itemId) {
      await Purchase.findByIdAndDelete(p._id);
      deleted++;
    }
  }
  console.log('Удалено покупок с несуществующим itemId:', deleted);
  
  // Сколько осталось
  const remaining = await Purchase.countDocuments();
  console.log('Осталось покупок:', remaining);
  
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
