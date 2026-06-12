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

    // Урок 2
    const lesson2 = new Lesson({
      moduleId: mod1._id,
      title: 'Условные операторы if-else',
      order: 2,
      theory: {
        content: `
          <h3>Если...иначе</h3>
          <p>Оператор if позволяет выполнить код только при выполнении условия:</p>
          <pre style="background:#f0e8ff;padding:12px;border-radius:12px;">let погода = "дождь";
if (погода === "дождь") {
  console.log("Возьми зонтик!");
} else {
  console.log("Можно идти без зонтика");
}</pre>
        `,
        interactiveBlocks: [{
          code: 'let age = 15;\nif (age >= 16) {\n  console.log("Можно получить права");\n} else {\n  console.log("Ещё рано");\n}',
          language: 'javascript',
          description: 'Проверь возраст!'
        }]
      },
      practice: {
        description: 'Напиши код, который проверяет, больше ли число 10',
        starterCode: 'let number = 7;\n// Напиши условие if-else\nif (/* условие */) {\n  console.log("Число больше 10");\n} else {\n  console.log("Число меньше или равно 10");\n}',
        language: 'javascript',
        hints: ['Используй оператор сравнения >', 'Условие должно быть: number > 10']
      },
      xpReward: 75
    });
    await lesson2.save();

    // Урок 3
    const lesson3 = new Lesson({
      moduleId: mod1._id,
      title: 'Циклы for и while',
      order: 3,
      theory: {
        content: `
          <h3>Повторение действий</h3>
          <p>Циклы позволяют повторять код несколько раз:</p>
          <pre style="background:#f0e8ff;padding:12px;border-radius:12px;">// Цикл for
for (let i = 1; i <= 5; i++) {
  console.log("Шаг " + i);
}

// Цикл while
let count = 0;
while (count < 3) {
  console.log("Считаем: " + count);
  count++;
}</pre>
        `,
        interactiveBlocks: [{
          code: 'for (let i = 0; i < 3; i++) {\n  console.log("Привет!");\n}',
          language: 'javascript',
          description: 'Запусти цикл!'
        }]
      },
      practice: {
        description: 'Напиши цикл, который выводит числа от 1 до 10',
        starterCode: '// Напиши цикл for\nfor (let i = /* начало */; i <= /* конец */; i++) {\n  console.log(i);\n}',
        language: 'javascript',
        hints: ['Начни с i = 1', 'Продолжай пока i <= 10']
      },
      xpReward: 100
    });
    await lesson3.save();

    // Добавляем все уроки в модуль
    await Module.findByIdAndUpdate(mod1._id, { 
      $push: { 
        lessons: { $each: [lesson1._id, lesson2._id, lesson3._id] }
      }
    });

    console.log('✅ Тестовый курс создан');
  }

  // Товары магазина — 10 штук с реальными рабочими эффектами
  const shopCount = await ShopItem.countDocuments();
  if (!shopCount) {
    await ShopItem.insertMany([
      { 
        name: 'Клоунский нос', 
        description: 'Красный клоунский нос для аватара 🎪', 
        icon: '🤡', price: 50, type: 'avatar', effect: 'clownnose' 
      },
      { 
        name: 'Радужные отступы', 
        description: 'Разноцветные отступы в коде', 
        icon: '🌈', price: 30, type: 'editor_skin',
        css: '.monaco-editor .margin-view-overlays .line-numbers { background: linear-gradient(135deg, #ff69b4, #9900ff, #00ccff) !important; color: white !important; border-radius: 0 4px 4px 0 !important; }'
      },
      { 
        name: 'Неоновые выделения', 
        description: 'Светящиеся выделения кода', 
        icon: '💡', price: 40, type: 'editor_skin',
        css: '.monaco-editor .selected-text { background: rgba(153,0,255,0.25) !important; box-shadow: 0 0 12px rgba(153,0,255,0.5) !important; } .monaco-editor .selectionHighlight { background: rgba(255,105,180,0.15) !important; }'
      },
      { 
        name: 'Космические звёзды', 
        description: 'Анимированные звёзды на фоне панели кода', 
        icon: '🌌', price: 60, type: 'editor_skin',
        css: '.monaco-editor .monaco-editor-background::after { content: "✨"; position: absolute; right: 10px; top: 10px; font-size: 24px; opacity: 0.4; animation: starSpin 3s linear infinite; } @keyframes starSpin { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.3); } 100% { transform: rotate(360deg) scale(1); } }'
      },
      { 
        name: 'Крутые наушники', 
        description: 'Элемент аватара — наушники', 
        icon: '🎧', price: 100, type: 'avatar', effect: 'headphones' 
      },
      { 
        name: 'Светящийся шлем', 
        description: 'Элемент аватара — шлем хакера', 
        icon: '⛑️', price: 200, type: 'avatar', effect: 'helmet' 
      },
      { 
        name: 'Смайлик-единорог', 
        description: 'Элемент аватара — волшебный единорог 🦄', 
        icon: '🦄', price: 150, type: 'avatar', effect: 'unicorn' 
      },
      { 
        name: 'Солнцезащитные очки 🕶️', 
        description: 'Крутой элемент аватара — солнечные очки', 
        icon: '🕶️', price: 120, type: 'avatar', effect: 'sunglasses' 
      },
      { 
        name: 'Бейдж Суперзвезда', 
        description: 'Элемент аватара — звёздный бейдж', 
        icon: '⭐', price: 180, type: 'avatar', effect: 'superbadge' 
      }
    ]);
    console.log('✅ 10 товаров магазина созданы');
  }

  console.log('\n🚀 Готово! Запусти сервер: npm start');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
