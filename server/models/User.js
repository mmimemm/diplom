const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Роли: student, teacher, parent, admin
const userSchema = new mongoose.Schema({
  login: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'parent', 'admin'], required: true },
  firstName: String,
  lastName: String,
  middleName: String,
  email: String,
  phone: String,
  // Всё про аватар в одном объекте — нет конфликта типов
  avatarConfig: {
    photo:         { type: String, default: null },   // путь к загруженному фото
    hair:          { type: String, default: 'default' },
    glasses:       { type: String, default: 'none' },
    shirt:         { type: String, default: 'default' },
    helmet:        { type: String, default: 'none' },
    headphones:    { type: String, default: 'none' },
    unlockedItems: { type: [String], default: [] }
  },
  // Геймификация
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  tickets: { type: Number, default: 0 },
  badges: [{ name: String, icon: String, earnedAt: Date }],
  reputation: { type: Number, default: 0 },
  // Связи
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // для ученика
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // для родителя
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Настройки
  soundEnabled: { type: Boolean, default: true },
  theme: { type: String, default: 'default' },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

// Хэшируем пароль перед сохранением
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(pass) {
  return bcrypt.compare(pass, this.password);
};

// Генерация логина по роли
userSchema.statics.generateLogin = function(role, lastName, firstName) {
  const prefix = { student: 's', teacher: 'p', parent: 'r', admin: 'a' };
  const base = (prefix[role] || 's') + lastName + firstName.charAt(0);
  return base.toLowerCase().replace(/\s/g, '');
};

module.exports = mongoose.model('User', userSchema);
