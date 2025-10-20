"use strict";
require('module-alias/register');

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const apiRoutes = require('@src/routes/main');

const app = express();

// Ensure Mongoose does not buffer commands when DB is down
mongoose.set('bufferCommands', false);

// Middlewares
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler (returns concrete error message)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('MongoDB connected');
    } else {
      console.warn('MONGO_URI is not set. Skipping MongoDB connection.');
    }
  } catch (err) {
    console.error('MongoDB connection error:', err);
  } finally {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  }
};

start();
