import { LOG_LEVEL } from "./constants";
import { LogConfig } from "./types";

const coreLogConfig: LogConfig = {
  level: LOG_LEVEL.ALL,
  enabled: true,
  browser: {
    enabled: true,
  },
};

export { coreLogConfig };
