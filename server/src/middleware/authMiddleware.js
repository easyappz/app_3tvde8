"use strict";

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('@src/config/auth');

// Verifies Authorization: Bearer <token> and attaches { userId } to req.user
exports.verifyAuth = async (req, res, next) => {
  try {
    const header = req.headers && req.headers.authorization;
    if (!header || typeof header !== 'string') {
      return res.status(401).json({ success: false, error: 'Authorization header missing' });
    }

    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ success: false, error: 'Invalid Authorization header format' });
    }

    const token = parts[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token not provided' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || !payload.userId) {
      return res.status(401).json({ success: false, error: 'Invalid token payload' });
    }

    req.user = { userId: String(payload.userId) };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message || 'Unauthorized' });
  }
};
