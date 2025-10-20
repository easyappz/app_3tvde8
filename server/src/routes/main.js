const express = require('express');
const authController = require('@src/controllers/authController');

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
