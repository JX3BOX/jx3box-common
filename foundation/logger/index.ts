import { LoggerManager } from "./logger-manager";
import { ILogger } from "./types";

const loggerManager = LoggerManager.getInstance();
const mainLogger: ILogger = loggerManager.getMainLogger();

(window as any).logger = mainLogger;

export { LOG_LEVEL } from "./constants";
export { loggerManager, mainLogger };
export * from "./types";
export * from "./utils";
export * from "./config";
