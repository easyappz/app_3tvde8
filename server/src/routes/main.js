const express = require('express');
const authController = require('@src/controllers/authController');
const adController = require('@src/controllers/adController');
const commentController = require('@src/controllers/commentController');
const { verifyAuth } = require('@src/middleware/authMiddleware');

const router = express.Router();

// Auth routes
router.post('/auth/register', async (req, res) => {
  try {
    await authController.register(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    await authController.login(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/auth/verify-email', async (req, res) => {
  try {
    await authController.verifyEmail(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ads routes (public)
router.post('/ads/resolve', (req, res) => adController.resolveOrCreate(req, res));
router.get('/ads', (req, res) => adController.listTop(req, res));
router.get('/ads/:id', (req, res) => adController.getById(req, res));

// Comments routes
router.get('/ads/:id/comments', (req, res) => commentController.listComments(req, res));
router.post('/ads/:id/comments', verifyAuth, (req, res) => commentController.addComment(req, res));

// GET /api/hello
router.get('/hello', async (req, res) => {
  try {
    res.json({ message: 'Hello from API!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/status
router.get('/status', async (req, res) => {
  try {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
