const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { Application, Review, Ticket, Notification, ShopItem, Purchase, ChatMessage, GroupMessage, Subscription } = require('../models/Other');
const { Payment } = require('../models/Other');
const User = require('../models/User');
const Group = require('../models/Group');

// === ЗАЯВКИ С ЛЕНДИНГА ===
router.post('/apply', async (req, res) => {
  try {
    const app = new Application({
      parentName: req.body.parentName || req.body.parent_name || 'Аноним',
      childName: req.body.childName || req.body.child_name || 'Ребёнок',
      phone: req.body.phone || '+70000000000'
    });
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
    const review = new Review({
      name: req.body.authorName || req.body.name || 'Аноним',
      role: req.body.role || '',
      text: req.body.text || '',
      rating: req.body.rating || 5,
      isApproved: false
    });
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
      .populate('itemId', 'name description icon price type isActive css effect duration')
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
    
    // Все товары — однократная покупка
    const already = await Purchase.findOne({ userId: user._id, itemId: item._id });
    if (already) return res.status(400).json({ error: 'Уже куплено' });
    
    user.tickets -= item.price;
    
    // Применяем avatar-товар — разблокируем предмет
    if (item.type === 'avatar') {
      if (!user.avatarConfig) user.avatarConfig = {};
      if (!user.avatarConfig.unlockedItems) user.avatarConfig.unlockedItems = [];
      if (item.effect && !user.avatarConfig.unlockedItems.includes(item.effect)) {
        user.avatarConfig.unlockedItems.push(item.effect);
      }
      // Сохраняем иконку последнего купленного аватара — для корректного отображения в топбаре
      user.avatarConfig.lastPurchasedAvatarIcon = item.icon || '🎁';
    }

    // Применяем editor_skin — загружаем CSS на странице (через shop-effects.js)
    // Ничего не делаем на сервере, все эффекты на клиенте
    
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

// === ЧАТ УЧЕНИК-ПРЕПОДАВАТЕЛЬ ===
// Получить сообщения чата
router.get('/chat/:teacherId', auth, role('student'), async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      studentId: req.user.id,
      teacherId: req.params.teacherId
    }).sort('createdAt').limit(100);
    res.json(messages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Отправить сообщение (ученик)
router.post('/chat/:teacherId', auth, role('student'), async (req, res) => {
  try {
    const msg = new ChatMessage({
      studentId: req.user.id,
      teacherId: req.params.teacherId,
      from: 'student',
      text: req.body.text
    });
    await msg.save();
    // Уведомление преподавателю
    await new Notification({
      userId: req.params.teacherId,
      text: `Новое сообщение от ученика`,
      type: 'info'
    }).save();
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Получить сообщения (для преподавателя)
router.get('/chat/student/:studentId', auth, role('teacher'), async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      studentId: req.params.studentId,
      teacherId: req.user.id
    }).sort('createdAt').limit(100);
    res.json(messages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Отправить сообщение (преподаватель)
router.post('/chat/student/:studentId', auth, role('teacher'), async (req, res) => {
  try {
    const msg = new ChatMessage({
      studentId: req.params.studentId,
      teacherId: req.user.id,
      from: 'teacher',
      text: req.body.text
    });
    await msg.save();
    // Уведомление ученику
    await new Notification({
      userId: req.params.studentId,
      text: `Новое сообщение от преподавателя`,
      type: 'info'
    }).save();
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === ГРУППОВОЙ ЧАТ ===
// Получить сообщения группы
router.get('/group-chat/:groupId', auth, async (req, res) => {
  try {
    const messages = await GroupMessage.find({ groupId: req.params.groupId })
      .sort('-createdAt').limit(100);
    res.json(messages.reverse());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Отправить сообщение в групповой чат
router.post('/group-chat/:groupId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('firstName lastName role');
    const msg = new GroupMessage({
      groupId: req.params.groupId,
      userId: req.user.id,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Ученик',
      userRole: user.role,
      text: req.body.text
    });
    await msg.save();

    // Уведомляем всех участников группы
    const Group = require('../models/Group');
    const group = await Group.findById(req.params.groupId).populate('students', '_id');
    if (group) {
      const allIds = [...group.students.map(s => s._id.toString()), group.teacherId.toString()];
      const uniqueIds = [...new Set(allIds)].filter(id => id !== req.user.id);
      await Promise.all(uniqueIds.map(uid =>
        new Notification({
          userId: uid,
          text: `Новое сообщение в чате группы`,
          type: 'info'
        }).save()
      ));
    }

    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === ВЫПОЛНЕННЫЕ ЗАДАНИЯ ===
// Получить все submission ученика (для student — свои, для админа — тест)
router.get('/my-submissions', auth, async (req, res) => {
  try {
    const Submission = require('../models/Submission');
    const filter = req.user.role === 'student' ? { studentId: req.user.id } : {};
    const submissions = await Submission.find(filter)
      .populate('lessonId', 'title moduleId xpReward')
      .populate('comments.userId', 'firstName lastName role')
      .sort('-submittedAt');
    res.json(submissions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Получить ответ преподавателя по конкретному заданию
router.get('/submission/:id/teacher-response', auth, role('student'), async (req, res) => {
  try {
    const Submission = require('../models/Submission');
    const sub = await Submission.findOne({ _id: req.params.id, studentId: req.user.id })
      .populate('comments.userId', 'firstName lastName role');
    if (!sub) return res.status(404).json({ error: 'Задание не найдено' });
    res.json({
      status: sub.status,
      score: sub.score,
      teacherComment: sub.teacherComment,
      checkedAt: sub.checkedAt,
      comments: sub.comments,
      tickets: sub.tickets
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Получить чат учителя для ученика — через группу
router.get('/my-teacher-chat', auth, role('student'), async (req, res) => {
  try {
    const Group = require('../models/Group');
    const student = await User.findById(req.user.id).select('groupId');
    if (!student?.groupId) return res.json([]);
    const group = await Group.findById(student.groupId).select('teacherId');
    if (!group?.teacherId) return res.json([]);
    const messages = await ChatMessage.find({
      studentId: req.user.id,
      teacherId: group.teacherId
    }).sort('createdAt').limit(100);
    res.json(messages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Отправить сообщение своему учителю — через группу
router.post('/my-teacher-chat', auth, role('student'), async (req, res) => {
  try {
    const Group = require('../models/Group');
    const student = await User.findById(req.user.id).select('groupId');
    if (!student?.groupId) return res.status(400).json({ error: 'У вас нет группы' });
    const group = await Group.findById(student.groupId).select('teacherId');
    if (!group?.teacherId) return res.status(400).json({ error: 'У вашей группы нет преподавателя' });
    const msg = new ChatMessage({
      studentId: req.user.id,
      teacherId: group.teacherId,
      from: 'student',
      text: req.body.text
    });
    await msg.save();
    await new Notification({
      userId: group.teacherId,
      text: `Новое сообщение от ученика`,
      type: 'info'
    }).save();
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЯ ПО ID ===
router.get('/user/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('firstName lastName role email');
    if (!user) return res.status(404).json({ error: 'Не найден' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === ЧАТ РОДИТЕЛЯ С ПРЕПОДАВАТЕЛЕМ РЕБЁНКА ===
// Получить сообщения (родитель — преподаватель ребёнка)
// Ищем учителя через группу ребёнка
router.get('/parent/teacher-chat/:childId', auth, role('parent', 'admin'), async (req, res) => {
  try {
    const Group = require('../models/Group');
    const child = await User.findById(req.params.childId).select('groupId');
    if (!child?.groupId) return res.json([]);
    const group = await Group.findById(child.groupId).select('teacherId');
    if (!group?.teacherId) return res.json([]);

    const messages = await ChatMessage.find({
      $or: [
        { studentId: req.user.id, teacherId: group.teacherId },
        { studentId: group.teacherId, teacherId: req.user.id }
      ]
    }).sort('createdAt').limit(100);

    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Отправить сообщение преподавателю ребёнка (родитель)
// Ищем учителя через группу ребёнка
router.post('/parent/teacher-chat/:childId', auth, role('parent', 'admin'), async (req, res) => {
  try {
    const Group = require('../models/Group');
    const child = await User.findById(req.params.childId).select('groupId');
    if (!child?.groupId) return res.status(400).json({ error: 'У ребёнка нет группы' });
    const group = await Group.findById(child.groupId).select('teacherId');
    if (!group?.teacherId) return res.status(400).json({ error: 'У группы ребёнка нет преподавателя' });

    const parent = await User.findById(req.user.id).select('firstName lastName');

    const msg = new ChatMessage({
      studentId: req.user.id,       // studentId = id родителя
      teacherId: group.teacherId,   // teacherId = id преподавателя
      from: 'parent',
      userName: `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'Родитель',
      text: req.body.text
    });
    await msg.save();

    // Уведомление преподавателю
    await new Notification({
      userId: group.teacherId,
      text: `Новое сообщение от родителя (${parent.firstName || ''})`,
      type: 'info'
    }).save();

    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === ЧАТ РОДИТЕЛЯ С АДМИНИСТРАТОРОМ ===
// Получить сообщения (родитель — администратор)
router.get('/parent/admin-chat/:adminId', auth, role('parent', 'admin'), async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      $or: [
        { studentId: req.user.id, teacherId: req.params.adminId },
        { studentId: req.params.adminId, teacherId: req.user.id }
      ]
    }).sort('createdAt').limit(100);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Отправить сообщение администратору (родитель)
router.post('/parent/admin-chat/:adminId', auth, role('parent', 'admin'), async (req, res) => {
  try {
    const parent = await User.findById(req.user.id).select('firstName lastName');

    const msg = new ChatMessage({
      studentId: req.user.id,
      teacherId: req.params.adminId,
      from: 'parent',
      userName: `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'Родитель',
      text: req.body.text
    });
    await msg.save();

    // Уведомление администратору
    await new Notification({
      userId: req.params.adminId,
      text: `Новое сообщение от родителя (${parent.firstName || ''})`,
      type: 'info'
    }).save();

    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === ОПЛАТА КУРСА РОДИТЕЛЕМ ===
router.post('/parent/pay-course/:studentId', auth, role('parent', 'admin'), async (req, res) => {
  try {
    const student = await User.findById(req.params.studentId).select('groupId firstName lastName');
    if (!student) return res.status(404).json({ error: 'Ученик не найден' });

    // Проверяем, что это ребёнок родителя (для роли parent)
    if (req.user.role === 'parent') {
      const parent = await User.findById(req.user.id).select('children');
      if (!parent.children.map(c => c.toString()).includes(req.params.studentId)) {
        return res.status(403).json({ error: 'Это не ваш ребёнок' });
      }
    }

    if (!student.groupId) return res.status(400).json({ error: 'У ученика нет группы' });

    const group = await require('../models/Group').findById(student.groupId).populate('courseId');
    if (!group || !group.courseId) return res.status(400).json({ error: 'Курс не назначен' });

    const course = group.courseId;
    if (course.price <= 0) return res.json({ isPaid: true, message: 'Курс бесплатный' });

    // Продлеваем на месяц от текущей даты
    const existingSub = await Subscription.findOne({
      studentId: student._id,
      courseId: course._id,
      isActive: true
    });

    const now = new Date();
    let paidUntil;
    if (existingSub && existingSub.paidUntil > now) {
      paidUntil = new Date(existingSub.paidUntil);
      paidUntil.setMonth(paidUntil.getMonth() + 1);
      existingSub.paidUntil = paidUntil;
      await existingSub.save();
    } else {
      paidUntil = new Date(now);
      paidUntil.setMonth(paidUntil.getMonth() + 1);
      await Subscription.findOneAndUpdate(
        { studentId: student._id, courseId: course._id },
        { $set: { paidUntil, isActive: true } },
        { upsert: true }
      );
    }

    // Фиксируем платеж
    await new Payment({
      studentId: student._id,
      parentId: req.user.id,
      amount: course.price,
      type: course.scheduleType || 'online',
      status: 'paid',
      transactionId: 'TEST_' + Date.now(),
      paidAt: new Date()
    }).save();

    // Уведомление ученику
    await new Notification({
      userId: student._id,
      text: `✅ Курс "${course.title}" оплачен вашими родителями до ${paidUntil.toLocaleDateString('ru')}`,
      type: 'success'
    }).save();

    res.json({ isPaid: true, paidUntil, message: 'Курс оплачен на месяц' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Информация о подписке ребёнка (для родителя)
router.get('/parent/child-subscription/:studentId', auth, role('parent', 'admin'), async (req, res) => {
  try {
    const student = await User.findById(req.params.studentId).select('groupId');
    if (!student) return res.status(404).json({ error: 'Ученик не найден' });
    
    if (!student.groupId) return res.json({ isPaid: true, message: 'Нет группы' });

    const group = await require('../models/Group').findById(student.groupId).populate('courseId');
    if (!group || !group.courseId) return res.json({ isPaid: true, message: 'Курс не назначен' });

    const course = group.courseId;
    if (course.price <= 0) return res.json({ isPaid: true, paidUntil: null, message: 'Курс бесплатный', price: 0, scheduleType: course.scheduleType, courseName: course.title });

    const sub = await Subscription.findOne({
      studentId: student._id,
      courseId: course._id,
      isActive: true,
      paidUntil: { $gte: new Date() }
    });

    return res.json({ 
      isPaid: !!sub, 
      paidUntil: sub?.paidUntil || null, 
      price: course.price,
      scheduleType: course.scheduleType,
      courseName: course.title,
      message: sub ? 'Оплачено' : 'Не оплачен'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === ВЫДАЧА ДОСТИЖЕНИЙ (учитель → ученик) ===
router.post('/teacher/achievement', auth, role('teacher', 'admin'), async (req, res) => {
  try {
    const { studentId, name, icon } = req.body;
    if (!studentId || !name) return res.status(400).json({ error: 'studentId и name обязательны' });

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Ученик не найден' });

    // Проверяем, что ученик в группе учителя
    const teacher = await User.findById(req.user.id).populate('groupId');
    const group = await Group.findById(teacher.groupId);
    if (!group || !group.students.map(s => s.toString()).includes(studentId)) {
      return res.status(403).json({ error: 'Этот ученик не в вашей группе' });
    }

    student.badges.push({ name, icon: icon || '🏆', earnedAt: new Date() });
    
    // Дополнительно начисляем XP за достижение
    student.xp = (student.xp || 0) + 100;
    
    await student.save();

    await new Notification({
      userId: studentId,
      text: `🏆 Достижение получено: ${name}! +100 XP`,
      type: 'success'
    }).save();

    // Уведомление родителю
    if (student.parentId) {
      await new Notification({
        userId: student.parentId,
        text: `Ваш ребёнок получил достижение: ${name} 🏆`,
        type: 'success'
      }).save();
    }

    res.json({ success: true, badges: student.badges, xp: student.xp });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Список достижений ученика (для учителя)
router.get('/teacher/student-achievements/:studentId', auth, role('teacher', 'admin'), async (req, res) => {
  try {
    const student = await User.findById(req.params.studentId).select('badges');
    if (!student) return res.status(404).json({ error: 'Ученик не найден' });
    res.json(student.badges || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === ЧАТ С РОДИТЕЛЯМИ (реальный, не мок) ===
// Получить сообщения с родителем
router.get('/teacher/parent-chat/:parentId', auth, role('teacher', 'admin'), async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      studentId: req.params.parentId, // используем поле studentId как chat partner ID
      teacherId: req.user.id
    }).sort('createdAt').limit(100);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Отправить сообщение родителю
router.post('/teacher/parent-chat/:parentId', auth, role('teacher', 'admin'), async (req, res) => {
  try {
    const msg = new ChatMessage({
      studentId: req.params.parentId,
      teacherId: req.user.id,
      from: 'teacher',
      text: req.body.text
    });
    await msg.save();
    await new Notification({
      userId: req.params.parentId,
      text: `Новое сообщение от преподавателя`,
      type: 'info'
    }).save();
    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === ЧАТ С АДМИНИСТРАТОРОМ ===
// Получить список администраторов
router.get('/admins', auth, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('firstName lastName email');
    res.json(admins);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Получить сообщения с администратором (работает для всех ролей: учитель↔админ и ученик↔админ)
router.get('/chat-admin/:adminId', auth, async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      $or: [
        { studentId: req.user.id, teacherId: req.params.adminId },
        { studentId: req.params.adminId, teacherId: req.user.id }
      ]
    }).sort('createdAt').limit(100);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Отправить сообщение администратору
router.post('/chat-admin/:adminId', auth, async (req, res) => {
  try {
    // Определяем корректный from
    let from = 'teacher';
    if (req.user.role === 'student') from = 'student';
    if (req.user.role === 'admin') from = 'teacher'; // админ тоже считается teacher в этом контексте

    const msg = new ChatMessage({
      studentId: req.user.id,
      teacherId: req.params.adminId,
      from: from,
      text: req.body.text
    });
    await msg.save();

    // Кому уведомление — противоположной стороне
    const notifyUserId = req.params.adminId;
    const roleLabel = req.user.role === 'teacher' ? 'преподавателя' : req.user.role === 'student' ? 'ученика' : 'пользователя';
    await new Notification({
      userId: notifyUserId,
      text: `Новое сообщение от ${roleLabel}`,
      type: 'info'
    }).save();
    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === СПИСОК РОДИТЕЛЕЙ ДЛЯ УЧИТЕЛЯ (реальный, не мок) ===
router.get('/teacher/parents', auth, role('teacher', 'admin'), async (req, res) => {
  try {
    // Находим группу, где учитель — преподаватель
    const Group = require('../models/Group');
    const group = await Group.findOne({ teacherId: req.user.id }).populate('students');
    
    if (!group || !group.students.length) return res.json([]);

    // Находим родителей учеников группы
    const studentIds = group.students.map(s => s._id);
    const parents = await User.find({ role: 'parent', children: { $in: studentIds } })
      .select('firstName lastName email phone children');

    // Собираем данные
    const result = await Promise.all(parents.map(async (parent) => {
      const children = await User.find({ _id: { $in: parent.children } })
        .select('firstName lastName xp level');
      return {
        _id: parent._id,
        firstName: parent.firstName,
        lastName: parent.lastName,
        email: parent.email,
        phone: parent.phone,
        children: children.map(c => ({
          _id: c._id,
          firstName: c.firstName,
          lastName: c.lastName,
          xp: c.xp || 0,
          level: c.level || 1
        }))
      };
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === МОЯ ГРУППА (для ученика) ===
router.get('/my-group', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('groupId');
    if (!user || !user.groupId) return res.json(null);
    const group = await Group.findById(user.groupId).populate('teacherId', 'firstName lastName').populate('students', 'firstName lastName');
    res.json(group);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
