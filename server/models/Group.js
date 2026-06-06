const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  schedule: [{
    day: String,       // Понедельник, Вторник...
    time: String,      // 14:00
    room: String
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
