import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, '..', 'logs', 'error.log'), level: 'error', maxsize: 5 * 1024 * 1024, maxFiles: 5 }),
    new winston.transports.File({ filename: path.join(__dirname, '..', 'logs', 'combined.log'), maxsize: 5 * 1024 * 1024, maxFiles: 5 }),
  ],
});

// Console in development (readable), silent-ish JSON files in production
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }));
}

export default logger;
