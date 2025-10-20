const express = require('express');

const router = express.Router();

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

// Future routes will be mounted here:
// router.use('/auth', require('@src/routes/auth'));
// router.use('/ads', require('@src/routes/ads'));
// router.use('/comments', require('@src/routes/comments'));

module.exports = router;
