const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const User = require('../models/User');
const Group = require('../models/Group');
const { Application, Notification, Review, ChatMessage } = require('../models/Other');

async function normalizeStudentIds(studentIds = []) {
  const uniqueIds = [...new Set(studentIds.filter(Boolean).map(id => String(id)))];

  if (!uniqueIds.length) return [];

  const students = await User.find({
    _id: { $in: uniqueIds },
    role: 'student'
  }).select('_id groupId');

  return students;
}

async function syncGroupStudents(groupId, studentIds = []) {
  const group = await Group.findById(groupId);
  if (!group) return null;

  const students = await normalizeStudentIds(studentIds);
  const nextStudentIds = students.map(student => student._id.toString());
  const currentStudentIds = group.students.map(id => id.toString());
  const groupIdString = group._id.toString();

  const removedStudentIds = currentStudentIds.filter(id => !nextStudentIds.includes(id));

  if (removedStudentIds.length) {
    // Отвязываем учеников — убираем groupId и teacherId (если совпадает)
    await User.updateMany(
      { _id: { $in: removedStudentIds }, groupId: group._id },
      { $unset: { groupId: '', teacherId: '' } }
    );
  }

  for (const student of students) {
    const previousGroupId = student.groupId ? student.groupId.toString() : null;
    if (previousGroupId && previousGroupId !== groupIdString) {
      await Group.findByIdAndUpdate(previousGroupId, { $pull: { students: student._id } });
    }
  }

  group.students = students.map(student => student._id);
  await group.save();

  if (nextStudentIds.length) {
    // Привязываем учеников — проставляем groupId И teacherId
    await User.updateMany(
      { _id: { $in: nextStudentIds } },
      { $set: { groupId: group._id, teacherId: group.teacherId } }
    );
  }

  return group;
}

async function getPopulatedGroup(groupId) {
  return Group.findById(groupId)
    .populate('teacherId', 'firstName lastName')
    .populate('students', 'firstName lastName xp level tickets')
    .populate('courseId', 'title');
}

// Создать пользователя (только админ)
router.post('/users', auth, role('admin'), async (req, res) => {
  try {
    const { firstName, lastName, middleName, roleType, email, phone, parentId, groupId } = req.body;
    const login = User.generateLogin(roleType, lastName, firstName);

    // Проверяем уникальность логина
    let finalLogin = login;
    let count = 1;
    while (await User.findOne({ login: finalLogin })) {
      finalLogin = login + count++;
    }

    // Создаём пользователя — только разрешённые поля, без avatar
    const user = new User({
      login: finalLogin,
      password: finalLogin,
      role: roleType,
      firstName, lastName, middleName, email, phone,
      parentId: parentId || undefined,
      groupId: groupId || undefined
    });
    await user.save();

    // Если ученик — добавляем в группу
    if (groupId && roleType === 'student') {
      await Group.findByIdAndUpdate(groupId, { $addToSet: { students: user._id } });
    }

    // Уведомление самому себе
    await new Notification({ userId: user._id, text: `Добро пожаловать в IT-MANIA! Ваш логин: ${finalLogin}`, type: 'success' }).save();

    res.json({ user: { ...user.toObject(), password: undefined }, login: finalLogin });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Список пользователей
router.get('/users', auth, role('admin'), async (req, res) => {
  try {
    const { role: r, groupId } = req.query;
    const filter = {};
    if (r) filter.role = r;
    if (groupId) filter.groupId = groupId;
    const users = await User.find(filter).select('-password').populate('groupId', 'name');
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Деактивировать пользователя
router.patch('/users/:id/toggle', auth, role('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.isActive = !user.isActive;
    await user.save();
    res.json({ isActive: user.isActive });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Выдать билетики пользователю
router.post('/users/:id/tickets', auth, role('admin'), async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    
    user.tickets = (user.tickets || 0) + parseInt(amount || 0);
    await user.save();

    // Уведомление пользователю
    await new Notification({ 
      userId: user._id, 
      text: `Администратор выдал вам ${amount} билетиков за: ${reason || 'активность'} 🎫`,
      type: 'success' 
    }).save();

    res.json({ tickets: user.tickets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Группы — доступно админу и учителю
router.get('/groups', auth, role('admin', 'teacher'), async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('teacherId', 'firstName lastName')
      .populate('students', 'firstName lastName xp level tickets')
      .populate('courseId', 'title');
    res.json(groups);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Своя группа для ученика (рейтинг)
router.get('/my-group', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.groupId) return res.json(null);
    const group = await Group.findById(user.groupId)
      .populate('students', 'firstName xp level tickets avatarConfig')
      .populate('teacherId', 'firstName lastName');
    res.json(group);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/groups', auth, role('admin'), async (req, res) => {
  try {
    const { name, teacherId, courseId, studentIds = [] } = req.body;

    if (!name || !teacherId) {
      return res.status(400).json({ error: 'Название группы и преподаватель обязательны' });
    }

    const group = new Group({
      name,
      teacherId,
      courseId: courseId || undefined,
      students: []
    });

    await group.save();

    if (studentIds.length) {
      await syncGroupStudents(group._id, studentIds);
    }

    const createdGroup = await getPopulatedGroup(group._id);

    res.json(createdGroup);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/groups/:id/students', auth, role('admin'), async (req, res) => {
  try {
    const { studentIds = [] } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    const nextIds = [...new Set([
      ...group.students.map(id => id.toString()),
      ...studentIds.filter(Boolean).map(id => String(id))
    ])];

    await syncGroupStudents(group._id, nextIds);

    const updatedGroup = await getPopulatedGroup(group._id);

    res.json(updatedGroup);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Удалить ученика из группы
router.delete('/groups/:id/students/:studentId', auth, role('admin'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    const studentId = req.params.studentId;
    const hadStudent = group.students.some(s => s.toString() === studentId);
    
    if (hadStudent) {
      // Убираем из группы
      group.students = group.students.filter(s => s.toString() !== studentId);
      await group.save();

      // Отвязываем ученика от группы и учителя
      await User.findByIdAndUpdate(studentId, {
        $unset: { groupId: '', teacherId: '' }
      });
    }

    const updatedGroup = await getPopulatedGroup(group._id);
    res.json(updatedGroup);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/groups/:id', auth, role('admin'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    if (group.students.length) {
      await User.updateMany(
        { _id: { $in: group.students }, groupId: group._id },
        { $unset: { groupId: '' } }
      );
    }

    await Group.deleteOne({ _id: group._id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/groups/:id', auth, role('admin'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    const { name, teacherId, courseId, studentIds } = req.body;
    if (name !== undefined) group.name = name;
    if (teacherId !== undefined) group.teacherId = teacherId;
    if (courseId !== undefined) group.courseId = courseId || undefined;

    await group.save();

    if (Array.isArray(studentIds)) {
      await syncGroupStudents(group._id, studentIds);
    }

    const updatedGroup = await getPopulatedGroup(group._id);
    res.json(updatedGroup);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reviews', auth, role('admin'), async (req, res) => {
  try {
    const reviews = await Review.find().sort('-createdAt').lean();
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Заявки с лендинга
router.get('/applications', auth, role('admin'), async (req, res) => {
  try {
    const apps = await Application.find().sort('-createdAt');
    res.json(apps);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/applications/:id', auth, role('admin'), async (req, res) => {
  try {
    const app = await Application.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json(app);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Аналитика для дашборда
router.get('/analytics', auth, role('admin'), async (req, res) => {
  try {
    const [students, teachers, parents, newApps, groups] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      User.countDocuments({ role: 'parent', isActive: true }),
      Application.countDocuments({ status: 'new' }),
      Group.countDocuments()
    ]);

    // Новые ученики за последние 7 дней
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newStudents = await User.countDocuments({ role: 'student', createdAt: { $gte: weekAgo } });

    // Количество заявок по дням за 7 дней
    const appCounts = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const count = await Application.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } });
      appCounts.push(count);
    }

    res.json({ students, teachers, parents, newApps, groups, newStudents, appCounts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === АДМИН ЧАТЫ ===

// Список преподавателей с их группами для админ-чата
router.get('/chat/teachers', auth, role('admin'), async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher', isActive: true })
      .select('firstName lastName login');

    // Для каждого преподавателя находим ВСЕ группы
    const result = await Promise.all(teachers.map(async (t) => {
      const groups = await Group.find({ teacherId: t._id }).select('name');
      return {
        _id: t._id,
        firstName: t.firstName,
        lastName: t.lastName,
        login: t.login,
        groups: groups.map(g => ({ _id: g._id, name: g.name })),
        groupNames: groups.map(g => g.name),
        groupName: groups.length > 0 ? groups[0].name : null
      };
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Список родителей отсортированных по группам детей для админ-чата
router.get('/chat/parents', auth, role('admin'), async (req, res) => {
  try {
    const parents = await User.find({ role: 'parent', isActive: true })
      .select('firstName lastName login children');

    // Загружаем всех детей родителей с их группами
    const result = await Promise.all(parents.map(async (p) => {
      const children = await User.find({ _id: { $in: p.children || [] } })
        .select('firstName lastName groupId')
        .populate('groupId', 'name');

      // Группируем детей (может быть несколько групп)
      const groups = [...new Set(children
        .filter(c => c.groupId)
        .map(c => c.groupId.name)
      )];

      return {
        _id: p._id,
        firstName: p.firstName,
        lastName: p.lastName,
        login: p.login,
        children: children.map(c => ({
          _id: c._id,
          firstName: c.firstName,
          lastName: c.lastName,
          groupName: c.groupId ? c.groupId.name : null
        })),
        groups: groups.length > 0 ? groups : ['—']
      };
    }));

    // Сортируем: сначала родители, чьи дети в группах, потом остальные
    // Внутри каждой группы по имени группы
    result.sort((a, b) => {
      const aGroup = a.groups[0] || '';
      const bGroup = b.groups[0] || '';
      if (aGroup === '—' && bGroup !== '—') return 1;
      if (aGroup !== '—' && bGroup === '—') return -1;
      return aGroup.localeCompare(bGroup);
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Получить сообщения между админом и пользователем
router.get('/chat/:userId', auth, role('admin'), async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      $or: [
        { studentId: req.user.id, teacherId: req.params.userId },
        { studentId: req.params.userId, teacherId: req.user.id }
      ]
    }).sort('createdAt').limit(200);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Отправить сообщение пользователю от админа
router.post('/chat/:userId', auth, role('admin'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст сообщения обязателен' });

    const admin = await User.findById(req.user.id).select('firstName lastName');

    const msg = new ChatMessage({
      studentId: req.user.id,
      teacherId: req.params.userId,
      from: 'teacher',
      userName: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Администратор',
      text
    });
    await msg.save();

    // Уведомление получателю
    await new Notification({
      userId: req.params.userId,
      text: `Новое сообщение от администратора`,
      type: 'info'
    }).save();

    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
