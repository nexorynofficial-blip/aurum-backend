const app = require('../dist/app').app;

// Vercel serverless handler — export the Express app directly
module.exports = app;

// Health check: this will be called first to verify the function is running
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AURUM API' });
});