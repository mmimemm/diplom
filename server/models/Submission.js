const mongoose = require('mongoose');

// Попытка выполнения задания
const submissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  code: String,
  attempt: { type: Number, default: 1 },  // номер попытки
  score: { type: Number, default: 0 },    // 0-100
  tickets: { type: Number, default: 0 },  // начисленные билетики
  status: { type: String, enum: ['pending', 'checked', 'passed', 'failed'], default: 'pending' },
  teacherComment: String,
  // Чат по заданию (вопросы к строкам кода)
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    line: Number,  // привязка к строке кода
    createdAt: { type: Date, default: Date.now }
  }],
  // Peer review
  peerReviews: [{
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sticker: String,  // 'cool', 'check_line_5' и т.д.
    createdAt: { type: Date, default: Date.now }
  }],
  submittedAt: { type: Date, default: Date.now },
  checkedAt: Date
});

// Считаем билетики по проценту
submissionSchema.methods.calcTickets = function() {
  const s = this.score;
  if (s >= 90) return 30;
  if (s >= 70) return 25;
  if (s >= 60) return 20;
  if (s >= 50) return 15;
  if (s >= 20) return 10;
  return 0;
};

module.exports = mongoose.model('Submission', submissionSchema);
