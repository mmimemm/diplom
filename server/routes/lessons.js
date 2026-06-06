const express = require('express');
const router = express.Router();
const { auth, role } = require('../middleware/auth');
const { Module, Lesson } = require('../models/Lesson');
const Course = require('../models/Course');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { Notification } = require('../models/Other');

// Курсы
router.get('/courses', auth, async (req, res) => {
  try {
    const courses = await Course.find({ isActive: true }).populate('modules');
    res.json(courses);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/courses', auth, role('admin'), async (req, res) => {
  try {
    const course = new Course(req.body);
    await course.save();
    res.json(course);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Модули курса
router.get('/courses/:courseId/modules', auth, async (req, res) => {
  try {
    const modules = await Module.find({ courseId: req.params.courseId })
      .sort('order')
      .populate('lessons');
    res.json(modules);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/modules', auth, role('admin', 'teacher'), async (req, res) => {
  try {
    const mod = new Module(req.body);
    await mod.save();
    await Course.findByIdAndUpdate(req.body.courseId, { $push: { modules: mod._id } });
    res.json(mod);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Уроки
router.get('/modules/:moduleId/lessons', auth, async (req, res) => {
  try {
    const lessons = await Lesson.find({ moduleId: req.params.moduleId }).sort('order');
    res.json(lessons);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/lessons', auth, role('admin', 'teacher'), async (req, res) => {
  try {
    const lesson = new Lesson(req.body);
    await lesson.save();
    await Module.findByIdAndUpdate(req.body.moduleId, { $push: { lessons: lesson._id } });
    res.json(lesson);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/lessons/:id', auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    res.json(lesson);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/lessons/:id', auth, role('admin', 'teacher'), async (req, res) => {
  try {
    const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(lesson);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Отправить задание
router.post('/submit', auth, role('student'), async (req, res) => {
  try {
    const { lessonId, code } = req.body;

    // Считаем номер попытки
    const prevAttempts = await Submission.countDocuments({ studentId: req.user.id, lessonId });

    const sub = new Submission({
      studentId: req.user.id,
      lessonId,
      code,
      attempt: prevAttempts + 1
    });
    await sub.save();

    // Уведомляем учителя
    const student = await User.findById(req.user.id).populate('groupId');
    if (student.teacherId) {
      await new Notification({
        userId: student.teacherId,
        text: `${student.firstName} ${student.lastName} сдал задание на проверку`,
        type: 'info'
      }).save();
    }

    res.json(sub);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Проверить задание (учитель)
router.patch('/submissions/:id/check', auth, role('teacher', 'admin'), async (req, res) => {
  try {
    const { score, teacherComment } = req.body;
    const sub = await Submission.findById(req.params.id);
    sub.score = score;
    sub.teacherComment = teacherComment;
    sub.status = score >= 50 ? 'passed' : 'failed';
    sub.checkedAt = new Date();

    // Билетики только за первые 2 попытки
    if (sub.attempt <= 2) {
      sub.tickets = sub.calcTickets();
      // Начисляем ученику
      const xpGain = Math.round(score / 2);
      await User.findByIdAndUpdate(sub.studentId, {
        $inc: { tickets: sub.tickets, xp: xpGain }
      });
      // Проверяем уровень
      await updateLevel(sub.studentId);
    }
    await sub.save();

    // Уведомляем ученика
    await new Notification({
      userId: sub.studentId,
      text: `Задание проверено! Оценка: ${score}%, билетики: ${sub.tickets} 🎫`,
      type: sub.status === 'passed' ? 'success' : 'warning'
    }).save();

    res.json(sub);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Задания для проверки (учитель)
router.get('/submissions/pending', auth, role('teacher', 'admin'), async (req, res) => {
  try {
    const subs = await Submission.find({ status: 'pending' })
      .populate('studentId', 'firstName lastName')
      .populate('lessonId', 'title')
      .sort('-submittedAt');
    res.json(subs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Прогресс ученика
router.get('/progress/:studentId', auth, async (req, res) => {
  try {
    const subs = await Submission.find({ studentId: req.params.studentId, status: 'passed' })
      .populate('lessonId', 'title moduleId xpReward');
    res.json(subs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Добавить комментарий к заданию (чат по строке кода)
router.post('/submissions/:id/comment', auth, async (req, res) => {
  try {
    const { text, line } = req.body;
    const sub = await Submission.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { userId: req.user.id, text, line } } },
      { new: true }
    ).populate('comments.userId', 'firstName lastName role');
    res.json(sub.comments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Обновить уровень по XP
async function updateLevel(userId) {
  const user = await User.findById(userId);
  // Каждые 500 XP = новый уровень
  const newLevel = Math.floor(user.xp / 500) + 1;
  if (newLevel > user.level) {
    user.level = newLevel;
    // Выдаём бейдж за уровень
    const levelBadges = { 2: 'Юный хакер', 5: 'Магистр кода', 10: 'Мастер IT' };
    if (levelBadges[newLevel]) {
      user.badges.push({ name: levelBadges[newLevel], icon: '🏆', earnedAt: new Date() });
    }
    await user.save();
    await new Notification({
      userId,
      text: `🎉 Новый уровень ${newLevel}! Ты крутой!`,
      type: 'success'
    }).save();
  }
}

module.exports = router;
