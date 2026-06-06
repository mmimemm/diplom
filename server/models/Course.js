const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  icon: String,
  color: String,
  ageMin: { type: Number, default: 7 },
  ageMax: { type: Number, default: 17 },
  modules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Course', courseSchema);
