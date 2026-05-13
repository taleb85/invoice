const IS_PROD = process.env.NODE_ENV === 'production'

type LogFn = (msg: string, ...args: unknown[]) => void

function createLogger(level: string, prodFn: LogFn): LogFn {
  return (msg: string, ...args: unknown[]) => {
    if (IS_PROD) {
      prodFn(`[${level.toUpperCase()}] ${msg}`, ...args)
    } else {
      console.log(`[${level.toUpperCase()}] ${msg}`, ...args)
    }
  }
}

export const logger = {
  info: createLogger('info', () => {}),
  warn: createLogger('warn', console.warn),
  error: createLogger('error', console.error),
  debug: createLogger('debug', () => {}),
}
