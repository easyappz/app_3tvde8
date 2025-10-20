"use strict";

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('@src/models/User');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('@src/config/auth');

const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const createToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: String(email).toLowerCase().trim(),
      passwordHash,
      createdAt: new Date(),
    });

    const token = createToken(user._id.toString());

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    // Handle duplicate key error defensively
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }
    return res.status(500).json({ success: false, error: err.message || 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = createToken(user._id.toString());

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Login failed' });
  }
};
