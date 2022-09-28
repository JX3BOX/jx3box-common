enum LOG_LEVEL {
  OFF = Number.MAX_VALUE,
  ERROR = 40000,
  WARN = 30000,
  INFO = 20000,
  DEBUG = 10000,
  LOG = 4000,
  ALL = Number.MIN_VALUE,
}
enum LOG_TAGS {
  DEBUG = "[DEBUG]",
  MAIN = "[MAIN]",
}

export { LOG_LEVEL, LOG_TAGS };
