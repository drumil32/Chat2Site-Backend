import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const customTimestamp = () => {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
};

const logFormat = printf(({ level, message, stack, ...meta }) => {
  const ts = customTimestamp();
  let log = `${ts} [${level.toUpperCase()}]: ${message}`;
  
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta, null, 2)}`;
  }
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  return log;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        errors({ stack: true }),
        logFormat
      )
    })
  ]
});