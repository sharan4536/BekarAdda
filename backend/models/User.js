const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  avatarUrl: String,
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  totalPoints: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', UserSchema);
