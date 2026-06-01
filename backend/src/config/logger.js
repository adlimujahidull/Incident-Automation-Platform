function write(level, message, meta) {
  const timestamp = new Date().toISOString();
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${payload}`);
}

export const logger = {
  info(message, meta) {
    write("INFO", message, meta);
  },
  warn(message, meta) {
    write("WARN", message, meta);
  },
  error(message, meta) {
    write("ERROR", message, meta);
  }
};

