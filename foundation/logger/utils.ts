enum TYPES {
  String = "[object String]",
  Boolean = "[object Boolean]",
  Number = "[object Number]",
  Object = "[object Object]",
  Array = "[object Array]",
  Function = "[object Function]",
  Undefined = "[object Undefined]",
  Null = "[object Null]",
  Error = "[object Error]",
}

const PARSER_MAP: { [key in TYPES]: (item: any) => string } = {
  "[object Object]": (item: object) => {
    try {
      return JSON.stringify(item);
    } catch {
      return "[object Object]";
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  "[object Array]": (item: any[]) => {
    try {
      return JSON.stringify(item);
    } catch {
      return "[object Array]";
    }
  },
  "[object String]": (item: string) => item,
  "[object Function]": () => "[object Function]",
  "[object Undefined]": () => "undefined",
  "[object Null]": () => "null",
  "[object Boolean]": (item: boolean) => String(item),
  "[object Number]": (item: number) => String(item),
  "[object Error]": (error: Error) => {
    return `${error.name}: ${error.message}\n${error.stack}`;
  },
};

function stringifyParams(...params: any): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return params.map((item: any) => {
    const type = Object.prototype.toString.call(item);
    if (PARSER_MAP[type]) {
      return PARSER_MAP[type](item);
    }
    return item ? item.toString() : type;
  });
}

export { stringifyParams };
