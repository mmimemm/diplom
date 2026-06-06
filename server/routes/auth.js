const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Логин
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    const user = await User.findOne({ login, isActive: true });
    if (!user || !(await user.comparePassword(password)))
      return res.status(400).json({ error: 'Неверный логин или пароль' });

    user.lastActive = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, login: user.login },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, role: user.role, id: user._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Получить свой профиль
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('groupId', 'name')
      .populate('teacherId', 'firstName lastName');
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Обновить профиль (аватар, звук, тема)
router.patch('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const update = {};
    if (req.body.avatarConfig && typeof req.body.avatarConfig === 'object') {
      update.avatarConfig = req.body.avatarConfig;
    }
    if (req.body.soundEnabled !== undefined) update.soundEnabled = req.body.soundEnabled;
    if (req.body.theme)  update.theme  = req.body.theme;
    if (req.body.email)  update.email  = req.body.email;
    if (req.body.phone)  update.phone  = req.body.phone;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
