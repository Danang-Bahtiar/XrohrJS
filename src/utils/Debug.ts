class DEBUG {
  static log(modules: string, ...args: any[]) {
    console.log(`[DEBUG ${modules}]`, ...args);
  }

  private static reset = "\x1b[0m";
  private static colors = {
    info: "\x1b[36m", // Cyan
    success: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
  };

  static info(message: string) {
    console.log(`${this.colors.info}${message}${this.reset}`);
  }

  static success(message: string) {
    console.log(`${this.colors.success}${message}${this.reset}`);
  }

  static warn(message: string) {
    console.log(`${this.colors.warn}${message}${this.reset}`);
  }

  static error(message: string) {
    console.log(`${this.colors.error}${message}${this.reset}`);
  }
}

export default DEBUG;
