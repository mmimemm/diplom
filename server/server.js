const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

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

// Загрузка файлов (аватар)
const multer = require('multer');
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/avatars');
    if (!require('fs').existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  }
});
const uploadAvatar = multer({ 
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Только изображения: png, jpg, gif, webp'));
  }
});

// Загрузка аватара
app.post('/api/upload-avatar', require('./middleware/auth').auth, (req, res) => {
  uploadAvatar.single('avatar')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    try {
      const User = require('./models/User');
      const avatarPath = '/uploads/avatars/' + req.file.filename;
      await User.findByIdAndUpdate(req.user.id, {
        $set: { 'avatarConfig.photo': avatarPath }
      });
      res.json({ photo: avatarPath });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// Раздача загруженных файлов
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Тестовый маршрут для проверки
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'API работает', timestamp: new Date() });
});


const { execSync } = require('child_process');
const { writeFileSync, unlinkSync, existsSync } = require('fs');
const tmpDir = require('os').tmpdir();

// Выполнение кода на сервере (JS, Python, TypeScript, SQL, HTML, CSS)
app.post('/api/run-code', require('./middleware/auth').auth, (req, res) => {
  const { code, language } = req.body;

  if (!code && typeof code !== 'string') {
    return res.status(400).json({ output: 'Отсутствует код для выполнения', error: true });
  }

  const result = (output, error = false) => res.json({ output, error });

  // JavaScript — eval с перехватом console.log
  if (language === 'javascript') {
    try {
      const logs = [];
      const fakeConsole = {
        log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args) => logs.push('[error] ' + args.map(String).join(' ')),
        warn: (...args) => logs.push('[warn] ' + args.map(String).join(' ')),
        info: (...args) => logs.push('[info] ' + args.map(String).join(' '))
      };
      const fn = new Function('console', code);
      fn(fakeConsole);
      return result(logs.join('\n') || '(нет вывода)');
    } catch (e) {
      return result(`Ошибка: ${e.message}`, true);
    }
  }

  // Python — выполнение через python3/python/py
  if (language === 'python') {
    const tmpFile = path.join(tmpDir, `sandbox_${Date.now()}.py`);
    try {
      writeFileSync(tmpFile, code, 'utf8');
      let pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const output = execSync(`"${pythonCmd}" "${tmpFile}"`, {
        timeout: 10000,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: true
      });
      unlinkSync(tmpFile);
      return result(output || '(нет вывода)');
    } catch (e) {
      try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch (_) {}
      const stderr = e.stderr || e.stdout || e.message || '';
      return result(stderr || `Ошибка выполнения: ${e.message}`, true);
    }
  }

  // TypeScript — упрощённая транспиляция + eval
  if (language === 'typescript') {
    try {
      let jsCode = code
        // Убираем interface/type объявления
        .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
        .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
        // Убираем аннотации типов в параметрах: (name: string) => (name)
        .replace(/:\s*\w+(\[\])?(\s*\|\s*\w+(\[\])?)*(\s*&\s*\w+(\[\])?)*\s*(?=[,=)\s])/g, '')
        // Убираем : type после let/const/var  (let x: number = 5)
        .replace(/(\w+)\s*:\s*\w+(\[\])?(\s*\|\s*\w+(\[\])?)*(\s*&\s*\w+(\[\])?)*\s*=/g, '$1 =')
        // Убираем : return type в функциях
        .replace(/\)\s*:\s*\w+(\[\])?(\s*\|\s*\w+(\[\])?)*(\s*&\s*\w+(\[\])?)*\s*\{/g, '){')
        // Убираем as-приведения
        .replace(/\s+as\s+\w+/g, '');

      const logs = [];
      const fakeConsole = {
        log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args) => logs.push('[error] ' + args.map(String).join(' ')),
        warn: (...args) => logs.push('[warn] ' + args.map(String).join(' ')),
        info: (...args) => logs.push('[info] ' + args.map(String).join(' '))
      };
      const fn = new Function('console', jsCode);
      fn(fakeConsole);
      return result(logs.join('\n') || '(нет вывода)');
    } catch (e) {
      return result(`Ошибка TypeScript: ${e.message}`, true);
    }
  }

  // HTML / CSS — клиент должен обрабатывать сам, но сервер поддерживает
  if (language === 'html') {
    return result('[HTML] Код готов для превью в браузере.');
  }

  if (language === 'css') {
    return result('[CSS] Стили готовы для превью в браузере.');
  }

  return result(`Язык "${language}" не поддерживается на сервере.`);
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

    server.listen(PORT, () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });

    server.on('error', (err) => {
      console.error('Ошибка сервера:', err);
      process.exit(1);
    });
  })
  .catch(err => console.error('Ошибка MongoDB:', err));
