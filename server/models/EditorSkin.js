const mongoose = require('mongoose');

// Скины редактора кода
const editorSkinSchema = new mongoose.Schema({
  name: String,
  description: String,
  css: String,        // CSS для стилизации редактора
  icon: String,
  type: { type: String, enum: ['theme', 'rainbow', 'effects'], default: 'theme' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EditorSkin', editorSkinSchema);