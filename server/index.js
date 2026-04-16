const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db/migrate');

const app = express();
const PORT = process.env.PORT || 7070;

app.use(cors());
app.use(express.json());

// Initialize DB on startup
initDb();

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes (stubs — populated in later sessions)
app.use('/api/books', require('./routes/books'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/annotations', require('./routes/annotations'));
app.use('/api/concept_cards', require('./routes/concept_cards'));
app.use('/api/chapter_recalls', require('./routes/chapter_recalls'));
app.use('/api/reading_time', require('./routes/reading_time'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/highlights', require('./routes/highlights'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/vocab', require('./routes/vocab'));
app.use('/api/search', require('./routes/search'));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DeepReader running on http://localhost:${PORT}`);
  });
}

module.exports = app;
