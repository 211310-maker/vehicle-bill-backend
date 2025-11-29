const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json } = format;
const path = require('path');
function prodLogger() {
  return createLogger({
    level: 'info',
    format: combine(timestamp(), errors({ stack: true }), json()),
    defaultMeta: {
      service: 'user-service',
    },
    transports: [
      new transports.Console(),
      new transports.File({
        filename: path.join(__dirname, '../', 'logs', 'error.log'),
        level: 'error',
      }),
      new transports.File({
        filename: path.join(__dirname, '../', 'logs', 'combined.log'),
      }),
    ],
  });
}

module.exports = prodLogger;
