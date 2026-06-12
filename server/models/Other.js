const mongoose = require('mongoose');

// Заявка с лендинга
const applicationSchema = new mongoose.Schema({
  parentName: { type: String, required: true },
  childName: { type: String, required: true },
  phone: { type: String, required: true },
  status: { type: String, enum: ['new', 'contacted', 'enrolled', 'rejected'], default: 'new' },
  createdAt: { type: Date, default: Date.now }
});

// Оплата
const paymentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['weekday', 'weekend', 'online'], required: true },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  // Тестовый биллинг — просто фиксируем
  transactionId: String,
  paidAt: Date,
  createdAt: { type: Date, default: Date.now }
});

// Отзыв с лендинга
const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: String,
  text: { type: String, required: true },
  isApproved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Тикет (обращение)
const ticketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: String,
  message: String,
  status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
  replies: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Уведомление
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: String,
  type: { type: String, default: 'info' }, // info, success, warning
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Магазин — товары
const shopItemSchema = new mongoose.Schema({
  name: String,
  description: String,
  icon: String,
  price: Number,  // в билетиках
  type: { type: String, enum: ['avatar', 'editor_skin', 'pin_project', 'boost'] },
  css: String,
  effect: String,
  duration: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
});

// Чат ученик-преподаватель
const chatMessageSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  from: { type: String, enum: ['student', 'teacher', 'parent', 'admin'], required: true },
  userName: { type: String, default: '' },
  text: String,
  createdAt: { type: Date, default: Date.now }
});

// Групповой чат (сообщения внутри группы)
const groupMessageSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userRole: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});

// Покупка в магазине
const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopItem' },
  purchasedAt: { type: Date, default: Date.now }
});

// Подписка на курс (оплата)
const subscriptionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  paidUntil: { type: Date, required: true }, // дата окончания оплаты
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Application: mongoose.model('Application', applicationSchema),
  Payment: mongoose.model('Payment', paymentSchema),
  Review: mongoose.model('Review', reviewSchema),
  Ticket: mongoose.model('Ticket', ticketSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  ShopItem: mongoose.model('ShopItem', shopItemSchema),
  Purchase: mongoose.model('Purchase', purchaseSchema),
  ChatMessage: mongoose.model('ChatMessage', chatMessageSchema),
  GroupMessage: mongoose.model('GroupMessage', groupMessageSchema),
  Subscription: mongoose.model('Subscription', subscriptionSchema)
};
