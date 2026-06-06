import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LOG_LEVEL } from './config';

const uppercaseLevel = winston.format((info) => {
  info.level = info.level.toUpperCase();
  return info;
});

const createLogFormat = (colorize = false) =>
  winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    uppercaseLevel(),
    ...(colorize ? [winston.format.colorize()] : []),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      try {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaStr}`;
      } catch {
        return `[${timestamp}] [${level}] ${message}{meta is too complex to stringify}`;
      }
    }),
  );

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [
    new winston.transports.Console({
      format: createLogFormat(true),
    }),
    new DailyRotateFile({
      dirname: 'logs',
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: createLogFormat(),
    }),
  ],
});
