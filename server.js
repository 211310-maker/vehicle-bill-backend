// server.js
const app = require('./app');
const connectDB = require('./utils/db');
const logger = require('./logger');

// Render gives PORT dynamically
const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});
