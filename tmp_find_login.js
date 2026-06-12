require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./server/models/User');
  const users = await User.find({ role: 'student' }).select('login firstName lastName tickets');
  console.log(JSON.stringify(users, null, 2));
  process.exit();
});
