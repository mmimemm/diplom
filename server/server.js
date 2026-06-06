require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Отдаём статику
app.use(express.static(path.join(__dirname, '../public')));

// Явный маршрут для GIF — гарантируем правильный MIME
app.get('/images/:file', (req, res) => {
  const file = req.params.file;
  const filePath = path.join(__dirname, '../public/images', file);
  if (file.endsWith('.gif')) {
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache');
  }
  res.sendFile(filePath, err => {
    if (err) res.status(404).send('Not found');
  });
});

// Маршруты API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/lessons'));
app.use('/api', require('./routes/misc'));

// Тестовый маршрут для проверки
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'API работает', timestamp: new Date() });
});

// Маршрут для проверки submissions
app.get('/api/submissions/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Submissions API доступен',
    testData: [
      { _id: 'test1', studentId: { firstName: 'Иван', lastName: 'Иванов' }, lessonId: { title: 'Тестовый урок' }, attempt: 1, submittedAt: new Date(), code: 'console.log("Hello World");' },
      { _id: 'test2', studentId: { firstName: 'Мария', lastName: 'Петрова' }, lessonId: { title: 'Основы HTML' }, attempt: 2, submittedAt: new Date(), code: '<h1>Привет!</h1>' }
    ]
  });
});

// Проверка кода на сервере (простой eval для JS)
app.post('/api/run-code', require('./middleware/auth').auth, (req, res) => {
  const { code, language } = req.body;
  if (language !== 'javascript') return res.json({ output: 'Поддерживается только JavaScript' });
  try {
    // Перехватываем console.log
    const logs = [];
    const fakeConsole = { log: (...args) => logs.push(args.join(' ')) };
    const fn = new Function('console', code);
    fn(fakeConsole);
    res.json({ output: logs.join('\n') || '(нет вывода)' });
  } catch (e) {
    res.json({ output: `Ошибка: ${e.message}`, error: true });
  }
});

// WebSocket — живые уведомления
const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.join(userId);
  });

  socket.on('disconnect', () => {
    for (const [uid, sid] of onlineUsers) {
      if (sid === socket.id) { onlineUsers.delete(uid); break; }
    }
  });
});

// Экспортируем io для использования в маршрутах
app.set('io', io);

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  const ext = path.extname(req.path).toLowerCase();
  const staticExts = ['.gif','.png','.jpg','.jpeg','.svg','.ico','.css','.js','.woff','.woff2','.ttf','.json','.webp','.mp3','.wav','.html'];
  if (staticExts.includes(ext)) {
    // Для HTML файлов возвращаем их напрямую
    if (ext === '.html') {
      return res.sendFile(path.join(__dirname, '../public', req.path));
    }
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Подключение к MongoDB и запуск
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB подключена');
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
  })
  .catch(err => console.error('Ошибка MongoDB:', err));
