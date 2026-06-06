const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { Application, Review, Ticket, Notification, ShopItem, Purchase } = require('../models/Other');
const { Payment } = require('../models/Other');
const User = require('../models/User');

// === ЗАЯВКИ С ЛЕНДИНГА ===
router.post('/apply', async (req, res) => {
  try {
    const app = new Application(req.body);
    await app.save();
    // Уведомляем всех админов
    const admins = await User.find({ role: 'admin' });
    await Promise.all(admins.map(a =>
      new Notification({ userId: a._id, text: `Новая заявка от ${req.body.parentName}`, type: 'info' }).save()
    ));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === ОТЗЫВЫ ===
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ isApproved: true }).sort('-createdAt');
    res.json(reviews);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/reviews', async (req, res) => {
  try {
    const review = new Review(req.body);
    await review.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/reviews/:id/approve', auth, role('admin'), async (req, res) => {
  try {
    const r = await Review.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === ТИКЕТЫ ===
router.post('/tickets', auth, async (req, res) => {
  try {
    const ticket = new Ticket({ userId: req.user.id, ...req.body });
    await ticket.save();
    res.json(ticket);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/tickets', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const tickets = await Ticket.find(filter).populate('userId', 'firstName lastName role').sort('-createdAt');
    res.json(tickets);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tickets/:id/reply', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { $push: { replies: { userId: req.user.id, text: req.body.text } } },
      { new: true }
    );
    res.json(ticket);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === УВЕДОМЛЕНИЯ ===
router.get('/notifications', auth, async (req, res) => {
  try {
    const notes = await Notification.find({ userId: req.user.id }).sort('-createdAt').limit(20);
    res.json(notes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/notifications/read', auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === ОПЛАТА (тестовая) ===
router.post('/payments', auth, role('parent', 'admin'), async (req, res) => {
  try {
    const payment = new Payment({
      ...req.body,
      parentId: req.user.id,
      status: 'paid',  // тестовый режим — сразу оплачено
      transactionId: 'TEST_' + Date.now(),
      paidAt: new Date()
    });
    await payment.save();
    await new Notification({
      userId: req.body.studentId,
      text: `Оплата курса подтверждена ✅`,
      type: 'success'
    }).save();
    res.json(payment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/payments', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { parentId: req.user.id };
    const payments = await Payment.find(filter).populate('studentId', 'firstName lastName').sort('-createdAt');
    res.json(payments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === МАГАЗИН ===
router.get('/shop', auth, async (req, res) => {
  try {
    const items = await ShopItem.find({ isActive: true });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/shop/my', auth, async (req, res) => {
  try {
    const purchases = await Purchase.find({ userId: req.user.id })
      .populate('itemId', 'name description icon price type isActive')
      .sort('-purchasedAt');
    res.json(purchases);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/shop/purchases', auth, role('admin'), async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate('userId', 'firstName lastName role')
      .populate('itemId', 'name description icon price type isActive')
      .sort('-purchasedAt');
    res.json(purchases);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/shop/buy/:itemId', auth, role('student'), async (req, res) => {
  try {
    const item = await ShopItem.findById(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Товар не найден' });
    const user = await User.findById(req.user.id);
    if ((user.tickets || 0) < item.price) return res.status(400).json({ error: 'Недостаточно билетиков' });
    // Проверяем не куплено ли уже
    const already = await Purchase.findOne({ userId: user._id, itemId: item._id });
    if (already) return res.status(400).json({ error: 'Уже куплено' });
    user.tickets -= item.price;
    await user.save();
    await new Purchase({ userId: user._id, itemId: item._id }).save();
    await new Notification({ userId: user._id, text: `Куплено: ${item.name} 🎉`, type: 'success' }).save();
    res.json({ ok: true, tickets: user.tickets });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Добавить товар в магазин (админ)
router.post('/shop/items', auth, role('admin'), async (req, res) => {
  try {
    const item = new ShopItem(req.body);
    await item.save();
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === ДЛЯ РОДИТЕЛЯ ===
// Получить данные конкретного ребёнка
router.get('/parent/child/:id', auth, role('parent', 'admin'), async (req, res) => {
  try {
    const child = await User.findById(req.params.id).select('-password').populate('groupId', 'name');
    if (!child) return res.status(404).json({ error: 'Не найдено' });
    res.json(child);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Список детей родителя
router.get('/parent/children', auth, role('parent', 'admin'), async (req, res) => {
  try {
    const children = await User.find({ parentId: req.user.id }).select('-password').populate('groupId', 'name');
    res.json(children);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
