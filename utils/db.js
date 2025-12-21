const mongoose = require('mongoose');
const logger = require('../logger');

const connectDB = async () => {
  try {
    const Url = process.env.DB_URL;
    if (!Url) {
      throw new Error('DB_URL is not defined in environment');
    }

    // Mongoose 6+ sets sensible defaults; pass options only if needed.
    const conn = await mongoose.connect(Url);
    logger.info(
      `db connected at ${conn.connection.host} ${conn.connection.port} at ${process.env.NODE_ENV}`
    );
  } catch (error) {
    // Log the error and rethrow so callers can handle/exit appropriately.
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};

module.exports = connectDB;
