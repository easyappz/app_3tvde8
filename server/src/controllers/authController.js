"use strict";

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('@src/models/User');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('@src/config/auth');
const { sendEmailVerification } = require('@src/utils/mailer');

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

    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      emailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: verifyExpires,
      createdAt: new Date(),
    });

    const host = req.get('host');
    const protocol = (req.protocol || 'http');
    const verifyUrl = `${protocol}://${host}/api/auth/verify-email?token=${verifyToken}`;

    await sendEmailVerification({ to: user.email, verifyUrl });

    return res.status(201).json({
      success: true,
      verifyEmailSent: true,
      message: 'Письмо с подтверждением отправлено',
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }
    return res.status(500).json({ success: false, error: err.message || 'Registration failed' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const token = String(req.query && req.query.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const now = new Date();
    const user = await User.findOne({
      emailVerifyToken: token,
      emailVerifyExpires: { $gt: now },
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }

    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    const jwtToken = createToken(user._id.toString());

    return res.status(200).json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Verification failed' });
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

    if (user.emailVerified !== true) {
      return res.status(403).json({ success: false, error: 'Email not verified' });
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
