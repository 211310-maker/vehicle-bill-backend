// server
const app = require('./app');
const { PORT } = require('./utils/constants');
const connectDB = require('./utils/db');
const logger = require('./logger');

const server = app.listen(PORT, () => {
  connectDB();
  logger.info(`app listening at port ${PORT} in ${process.env.NODE_ENV} mode`);
});

module.exports = server;
