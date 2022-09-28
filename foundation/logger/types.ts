import { LOG_LEVEL } from "./constants";

interface IConsoleLogPrettier {
  prettier(logEntity: LogEntity): any[];
}
interface ILogger {
  tags(...tags: string[]): ILogger;
  log(...params: any): void;
  debug(...params: any): void;
  info(...params: any): void;
  warn(...params: any): void;
  error(...params: any): void;
}
interface ICoreLogger {}
type LogConfig = {
  level: LOG_LEVEL;
  enabled: boolean;
  browser: {
    enabled: boolean;
  };
};
class LogEntity {
  id: string;
  level: LOG_LEVEL;
  userId: string;
  tags: string[];
  timestamp: number;
  params?: any[];
  message: string;
}

export { LogEntity };
export type { ICoreLogger, IConsoleLogPrettier, ILogger, LogConfig };
