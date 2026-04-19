import { glob } from "glob";
import path from "path";
import axios from "axios";
import { AxiosCall, AxiosResult } from "./Rheos.types.js";

// 🎨 Visual Styling Helpers
const style = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
};

class Rheos {
  private Urls: string[];
  private universalMemoria: Map<string, any>;

  constructor(Urls: string[]) {
    this.Urls = Urls;
    this.universalMemoria = new Map();
  }

  /**
   * INITIALIZATION
   * Loads all AxiosCall definition files from the source folder.
   */
  public init = async () => {
    const callPath = path.resolve(process.cwd(), "./src/axiosCalls");
    // Normalize path for Windows compatibility
    const callDir = path
      .join(callPath, "/**/*.{axios.ts,axios.js}")
      .replace(/\\/g, "/");

    const files = await glob(callDir);

    if (files.length === 0) {
      console.log(
        `${style.yellow}[RHEOS] [WARN] No AxiosCall files found.${style.reset}`,
      );
      return;
    }

    for (const file of files) {
      const filePath = `file://${file.replace(/\\/g, "/")}`;

      try {
        const module = await import(`${filePath}?update=${Date.now()}`);
        const callConfig: AxiosCall = module.default;

        if (!this.validateConfig(callConfig, file)) continue;

        this.universalMemoria.set(callConfig.name, callConfig);

        // Logging
        const methodTag = `[${callConfig.method.toUpperCase()}]`.padEnd(8);
        console.log(
          `${style.blue}[RHEOS] Loaded: ${style.reset}${methodTag} ${callConfig.name} from ${path.basename(file)}`,
        );
      } catch (error) {
        console.error(
          `${style.red}[RHEOS] [ERR] Failed to load ${path.basename(
            file,
          )}: ${error}${style.reset}`,
        );
      }
    }
  };

  /**
   * 🔍 GET CONFIG
   * Retrieves the static configuration template by name.
   */
  public getCallConfig = (name: string): AxiosCall | undefined => {
    return this.universalMemoria.get(name);
  };

  public getAllConfig() {
    return this.universalMemoria;
  }

  public executeCall = async (name: string) => {
    const callConfig = this.universalMemoria.get(name);
    if (!callConfig) {
      throw new Error(
        `Rheos call with name '${name}' not found in the memoria.`,
      );
    }
    return await this.performConfigCall(callConfig);
  };

  public performConfigCall = async (config: AxiosCall) => {
    // 1. Handle Absolute URIs
    if (config.absoluteUri) {
      return await this.executeAxios(config.endpoint, config);
    }

    const strategyType = config.strategy?.type || "primary";
    const onFail = config.strategy?.onFail || "retry";
    const maxRetries = config.strategy?.maxRetries ?? 3;
    const targets = this.getTargetUrls(strategyType);

    // 2. Parallel Broadcast
    if (strategyType === "all") {
      console.log(`[RHEOS] Broadcasting ${config.name} to all nodes...`);
      return await Promise.all(
        targets.map((url) =>
          this.executeAxios(`${url}${config.endpoint}`, config),
        ),
      );
    }

    // 3. Fallback Logic (Horizontal)
    if (onFail === "fallback") {
      const allUrls = this.Urls;
      const startIndex = Math.max(0, allUrls.indexOf(targets[0]));

      for (let i = 0; i <= maxRetries; i++) {
        const currentIndex = (startIndex + i) % allUrls.length;
        const res = await this.executeAxios(
          `${allUrls[currentIndex]}${config.endpoint}`,
          config,
        );
        if (res.success) return res;
        if (i + 1 >= allUrls.length) break;
      }
    }
    // 4. Retry Logic (Vertical)
    else {
      const targetUrl = targets[0];
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await this.executeAxios(
          `${targetUrl}${config.endpoint}`,
          config,
        );
        if (res.success || onFail === "ignore") return res;

        if (attempt < maxRetries && config.strategy?.retryDelay) {
          await this.sleep(config.strategy.retryDelay);
        }
      }
    }
  };

  // =========================== PRIVATE UTILITIES =========================== //

  private validateConfig(config: AxiosCall, file: string): boolean {
    if (!config.name || !config.method || !config.endpoint) {
      console.warn(
        `${style.yellow}[RHEOS] [SKIP] Invalid config in ${path.basename(
          file,
        )}${style.reset}`,
      );
      return false;
    }
    return true;
  }

  private executeAxios = async (url: string, config: AxiosCall) => {
    // 1. Resolve body
    let requestData =
      typeof config.body === "function" ? await config.body() : config.body;

    // 2. Pure Axios Call
    try {
      const response = await axios({
        method: config.method,
        url: url,
        data: requestData,
        headers: config.headers || {},
        timeout: config.strategy?.timeout || 5000,
      });
      const result = { success: true, data: response.data };
      if (config.onResponse) await config.onResponse(result);
      return result;
    } catch (error: any) {
      const result = { success: false, error: error.response || error.message };
      if (config.onResponse) await config.onResponse(result);
      return result;
    }
  };

  private sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  private getTargetUrls(strategy: string): string[] {
    // This is a placeholder. You would implement logic here to return URLs based on the strategy and your topology configuration.
    // For example, you might return this.Urls for "primary", a random URL for "random", or all URLs for "all".
    if (strategy === "random") {
      const randomIndex = Math.floor(Math.random() * this.Urls.length);
      return [this.Urls[randomIndex]];
    } else if (strategy === "all") {
      return this.Urls;
    } else {
      return [this.Urls[0]]; // Primary by default
    }
  }
}

export default Rheos;
