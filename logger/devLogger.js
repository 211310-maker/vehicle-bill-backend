const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;

function devLogger() {
  const myFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  });

  return createLogger({
    level: 'info',
    format: combine(
      format.colorize(),
      timestamp({ format: 'YYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      myFormat
    ),

    transports: [new transports.Console()],
  });
}

module.exports = devLogger;
