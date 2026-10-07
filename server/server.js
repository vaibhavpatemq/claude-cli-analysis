const express = require('express');
const path = require('path');
const analysisRoutes = require('./routes/analysis.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', analysisRoutes);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist.'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Claude Code Analyzer running on http://localhost:${PORT}`);
  });
}

module.exports = app;
