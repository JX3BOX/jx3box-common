import { LOG_LEVEL } from "./constants";
import { IConsoleLogPrettier, LogEntity } from "./types";
import { stringifyParams } from "./utils";

const COLORS = ["#ff8800", "#516bf0", "#008b8b"];

const ICON_MAP = {
  [LOG_LEVEL.WARN]: "⚠️",
  [LOG_LEVEL.INFO]: "ℹ️",
};

export class ConsoleLogPrettier implements IConsoleLogPrettier {
  prettier(logEntity: LogEntity): any[] {
    const { tags, params = [] } = logEntity;
    const iconPrefix = ICON_MAP[logEntity.level];
    let colorParams: string[] = [];
    if (tags && tags.length > 0) {
      colorParams = this.addColor(tags);
    }
    let _params = params;
    if (process.env.NODE_ENV !== "development") {
      _params = stringifyParams(...params);
    }
    if (iconPrefix && colorParams.length) {
      colorParams[0] = `${iconPrefix}${colorParams[0]}`;
    }
    return [...colorParams, ..._params];
  }

  addColor(tags: string[]): string[] {
    const tagString = `%c${tags.join("%c")}`;
    const colors = tags.map(
      (tag, index) => `color: ${COLORS[index % COLORS.length]}`
    );
    return [tagString, ...colors];
  }
}
