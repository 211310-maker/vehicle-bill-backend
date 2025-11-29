const mongoose = require('mongoose');
const logger = require('../logger');
const connectDB = async () => {
  try {
    const Url = process.env.DB_URL;
    const conn = await mongoose.connect(Url);
    logger.info(
      `db connected at ${conn.connection.host} ${conn.connection.port} at ${process.env.NODE_ENV}`
    );
  } catch (error) {
    logger.error(error);
  }
};
module.exports = connectDB;
