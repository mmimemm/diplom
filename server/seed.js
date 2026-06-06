// Запускать один раз: node server/seed.js
// Создаёт первого администратора и тестовые данные
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Course = require('./models/Course');
const { Module, Lesson } = require('./models/Lesson');
const { ShopItem } = require('./models/Other');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Подключено к MongoDB');

  // Создаём администратора
  const existAdmin = await User.findOne({ login: 'admin' });
  if (!existAdmin) {
    const admin = new User({
      login: 'admin',
      password: 'admin123',
      role: 'admin',
      firstName: 'Администратор',
      lastName: 'IT-MANIA',
      isActive: true
    });
    await admin.save();
    console.log('✅ Администратор создан: login=admin, password=admin123');
  } else {
    console.log('Администратор уже существует');
  }

  // Создаём тестовый курс
  let course = await Course.findOne({ title: 'Программирование для начинающих' });
  if (!course) {
    course = new Course({
      title: 'Программирование для начинающих',
      description: 'Основы программирования на JavaScript',
      icon: '💻',
      color: '#9900FF'
    });
    await course.save();

    // Модуль 1
    const mod1 = new Module({ courseId: course._id, title: 'Основы JavaScript', order: 1 });
    await mod1.save();
    await Course.findByIdAndUpdate(course._id, { $push: { modules: mod1._id } });

    // Урок 1
    const lesson1 = new Lesson({
      moduleId: mod1._id,
      title: 'Переменные и типы данных',
      order: 1,
      theory: {
        content: `
          <h3>Что такое переменная?</h3>
          <p>Переменная — это как коробочка, в которую можно положить любое значение.</p>
          <p>В JavaScript переменные объявляются с помощью <code>let</code> или <code>const</code>:</p>
          <pre style="background:#f0e8ff;padding:12px;border-radius:12px;">let имя = "Вася";
let возраст = 12;
const школа = "IT-MANIA";</pre>
        `,
        interactiveBlocks: [{
          code: 'let name = "Привет, мир!";\nconsole.log(name);',
          language: 'javascript',
          description: 'Попробуй запустить!'
        }]
      },
      practice: {
        description: 'Создай переменную с твоим именем и выведи её в консоль',
        starterCode: '// Создай переменную name со своим именем\nlet name = "";\nconsole.log(name);',
        language: 'javascript',
        hints: ['Используй let для объявления переменной', 'Строки пишутся в кавычках: "Вася"']
      },
      xpReward: 50
    });
    await lesson1.save();
    await Module.findByIdAndUpdate(mod1._id, { $push: { lessons: lesson1._id } });

    console.log('✅ Тестовый курс создан');
  }

  // Товары магазина
  const shopCount = await ShopItem.countDocuments();
  if (!shopCount) {
    await ShopItem.insertMany([
      { name: 'Тёмная тема редактора', description: 'Стильная тёмная тема для Monaco Editor', icon: '🌙', price: 50, type: 'editor_skin' },
      { name: 'Радужные отступы', description: 'Разноцветные отступы в коде', icon: '🌈', price: 30, type: 'editor_skin' },
      { name: 'Крутые наушники', description: 'Элемент аватара — наушники', icon: '🎧', price: 100, type: 'avatar' },
      { name: 'Светящийся шлем', description: 'Элемент аватара — шлем хакера', icon: '⛑️', price: 200, type: 'avatar' },
      { name: 'Закрепить проект', description: 'Твой проект на главной странице на 1 день', icon: '📌', price: 150, type: 'pin_project' }
    ]);
    console.log('✅ Товары магазина созданы');
  }

  console.log('\n🚀 Готово! Запусти сервер: npm start');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
