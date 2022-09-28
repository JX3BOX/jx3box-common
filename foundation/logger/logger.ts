import { coreLogConfig } from "./config";
import { LOG_LEVEL } from "./constants";
import { ConsoleLogPrettier } from "./log-prettier";
import { IConsoleLogPrettier, ICoreLogger, ILogger, LogEntity } from "./types";

const buildLogEntity = (
  level: LOG_LEVEL,
  tags: string[],
  params: any[]
): LogEntity => {
  const logEntity = new LogEntity();
  logEntity.level = level;
  logEntity.tags = tags;
  logEntity.params = params;
  return logEntity;
};

class CoreLogger implements ICoreLogger {
  constructor(private _consoleLogPrettier: IConsoleLogPrettier) {}
  doLog(logEntity: LogEntity): void {
    if (typeof window === "undefined") {
      return;
    }

    this._browserLog(
      logEntity.level,
      this._consoleLogPrettier.prettier(logEntity)
    );
  }

  private _browserLog(level: LOG_LEVEL, params: any[]) {
    switch (level) {
      case LOG_LEVEL.ERROR:
        window.console.error(...params);
        break;
      case LOG_LEVEL.WARN:
        window.console.warn(...params);
        break;
      case LOG_LEVEL.INFO:
        window.console.info(...params);
        break;
      case LOG_LEVEL.DEBUG:
        window.console.debug(...params);
        break;
      case LOG_LEVEL.LOG:
        window.console.log(...params);
        break;
      default:
        window.console.log(...params);
        break;
    }
  }
}

export class Logger implements ILogger, ICoreLogger {
  private static _instance: Logger;
  private _consoleCoreLogger: CoreLogger;
  private _tags: string[];

  private constructor() {
    this._consoleCoreLogger = new CoreLogger(new ConsoleLogPrettier());
    this._tags = [];
  }

  static getInstance() {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }
    return Logger._instance;
  }

  log(...params: any) {
    return this.doLog(buildLogEntity(LOG_LEVEL.LOG, this._tags, params));
  }

  debug(...params: any) {
    return this.doLog(buildLogEntity(LOG_LEVEL.DEBUG, this._tags, params));
  }

  info(...params: any) {
    return this.doLog(buildLogEntity(LOG_LEVEL.INFO, this._tags, params));
  }

  warn(...params: any) {
    return this.doLog(buildLogEntity(LOG_LEVEL.WARN, this._tags, params));
  }

  error(...params: any) {
    return this.doLog(buildLogEntity(LOG_LEVEL.ERROR, this._tags, params));
  }

  tags = (...tags: string[]): ILogger => {
    this._tags.concat(tags);
    return this;
  };

  doLog(logEntity: LogEntity = new LogEntity()) {
    if (!this._isLogEnabled(logEntity)) return;
    this._isBrowserEnabled() && this._consoleCoreLogger.doLog(logEntity);
  }

  private _isLogEnabled(logEntity: LogEntity) {
    const { level, enabled } = coreLogConfig;
    if (logEntity.level < level) return false;
    return enabled;
  }

  private _isBrowserEnabled() {
    const {
      browser: { enabled },
    } = coreLogConfig;
    return enabled;
  }
}
