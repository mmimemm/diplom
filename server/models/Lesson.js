const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: String,
  order: Number,
  lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }]
});

const lessonSchema = new mongoose.Schema({
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  title: { type: String, required: true },
  order: Number,
  // Теоретическая часть
  theory: {
    content: String,       // HTML-контент урока
    videoUrl: String,
    interactiveBlocks: [{ // Интерактивные примеры кода
      code: String,
      language: String,
      description: String
    }]
  },
  // Практическая часть
  practice: {
    description: String,
    starterCode: String,
    language: { type: String, default: 'javascript' },
    tests: [{ input: String, expected: String, description: String }],
    hints: [String]
  },
  xpReward: { type: Number, default: 50 },
  isBonus: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Module = mongoose.model('Module', moduleSchema);
const Lesson = mongoose.model('Lesson', lessonSchema);
module.exports = { Module, Lesson };
