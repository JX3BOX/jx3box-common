import { LOG_TAGS } from "./constants";
import { Logger } from "./logger";
import { ILogger } from "./types";

export class LoggerManager {
  private static _instance: LoggerManager;
  private _loggers: Map<string, ILogger>;
  private _logger: Logger;

  private constructor() {
    this._loggers = new Map();
    this._logger = Logger.getInstance();
  }

  static getInstance() {
    this._instance || (this._instance = new this());
    return this._instance;
  }

  getLogger(categoryName: string): ILogger {
    let logger = this._loggers.get(categoryName);
    if (!logger) {
      logger = this._logger.tags(categoryName);
      this._loggers.set(categoryName, logger);
    }
    return logger;
  }

  getMainLogger() {
    return this.getLogger(LOG_TAGS.MAIN);
  }
}
