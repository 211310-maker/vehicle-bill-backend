const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      minlength: [5, 'Username minlength should be 5'],
    },
    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member',
    },
    password: {
      type: String,
      minlength: [5, 'Username minlength should be 5'],
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    accessState: {
      type: [String],
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.model('TempUser', UserSchema);

module.exports = User;
