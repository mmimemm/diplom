const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }],
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  schedule: [{
    day: String,
    time: String,
    room: String
  }],
  maxStudents: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now }
});

// Валидация количества учеников — pre-save вместо сломанного validate
groupSchema.pre('save', function(next) {
  if (this.students && this.students.length > this.maxStudents) {
    return next(new Error(`В группе не может быть более ${this.maxStudents} учеников`));
  }
  next();
});

module.exports = mongoose.model('Group', groupSchema);
