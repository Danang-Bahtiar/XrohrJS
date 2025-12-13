import { glob } from "glob";
import path from "path";
import { AxiosCall, AxiosResult } from "../types/Rheos.types.js";
import axios from "axios";
import { AxiosConfig } from "../config/Xrohr.config.js";

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
  private config: AxiosConfig;
  // Storage: Priority -> Map<CallName, CallConfig>
  private RheosMemoria: Map<number, Map<string, AxiosCall>>;
  private universalMemoria: Map<string, any>;

  constructor(config: AxiosConfig) {
    this.config = config;
    this.RheosMemoria = new Map();
    this.universalMemoria = new Map();
  }

  /**
   * INITIALIZATION
   * Loads all AxiosCall definition files from the source folder.
   */
  public load = async () => {
    const callPath = path.resolve(process.cwd(), "./src/axiosCalls");
    // Normalize path for Windows compatibility
    const callDir = path
      .join(callPath, "/**/*.{axios.ts,axios.js}")
      .replace(/\\/g, "/");

    const files = await glob(callDir);

    if (files.length === 0) {
      console.log(
        `${style.yellow}[RHEOS] [WARN] No AxiosCall files found.${style.reset}`
      );
      return;
    }

    for (const file of files) {
      const filePath = `file://${file.replace(/\\/g, "/")}`;

      try {
        const module = await import(`${filePath}?update=${Date.now()}`);
        const callConfig: AxiosCall = module.default;

        if (!this.validateConfig(callConfig, file)) continue;

        this.registerCall(callConfig);
      } catch (error) {
        console.error(
          `${style.red}[RHEOS] [ERR] Failed to load ${path.basename(
            file
          )}: ${error}${style.reset}`
        );
      }
    }
  };

  public executeSingleCall = async (name: string) => {
    const callConfig = this.universalMemoria.get(name);
    if (!callConfig) {
      throw new Error(
        `Rheos call with name '${name}' not found in the memoria.`
      );
    }
    return await this.performRequest(callConfig, this.config.baseURL);
  };

  /**
   * 🔍 GET CONFIG
   * Retrieves the static configuration template by name.
   */
  public getCallConfig = (name: string): AxiosCall | undefined => {
    return this.universalMemoria.get(name);
  };

  /**
   * 🔍 GET PRIORITY GROUP
   * Returns all calls associated with a specific priority.
   */
  public getPriorityGroup = (
    priority: number
  ): Map<string, AxiosCall> | undefined => {
    return this.RheosMemoria.get(priority);
  };

  /**
   * 🛠️ EXECUTE BY CONFIG object
   * If you manually constructed a config object or heavily modified one.
   */
  public executeConfig = async (config: AxiosCall): Promise<AxiosResult> => {
    return await this.performRequest(config, this.config.baseURL);
  };

  /**
   * EXECUTION ENGINE
   * Runs all calls registered under a specific priority level.
   */
  public executeBulkCalls = async (priority: number) => {
    const priorityMap = this.RheosMemoria.get(priority);

    if (!priorityMap) {
      // Not necessarily an error, just no tasks for this priority
      return null;
    }

    console.log(
      `${style.cyan}[RHEOS] 🔄 Batch Execution: Priority ${priority}${style.reset}`
    );

    const resultMap = new Map<string, any>();

    for (const [name, axiosConfig] of priorityMap.entries()) {
      // 1. Primary Attempt
      let result = await this.performRequest(axiosConfig, this.config.baseURL);

      // 2. Fallback Attempt (if configured)
      if (!result.success && axiosConfig.tryWithSubURL && this.config.subURL) {
        console.warn(
          `${style.yellow}[RHEOS] ⚠️  ${name} failed. Retrying via SubURL...${style.reset}`
        );
        result = await this.performRequest(axiosConfig, this.config.subURL);
      }

      resultMap.set(name, result);
    }

    return resultMap;
  };

  public getAllConfig () {
    return this.universalMemoria;
  }

  // =========================== PRIVATE UTILITIES =========================== //

  private registerCall(config: AxiosCall) {
    // Default to Lowest Priority if not set
    const priority = config.priority ?? Number.MAX_SAFE_INTEGER;

    if (!this.RheosMemoria.has(priority)) {
      this.RheosMemoria.set(priority, new Map());
    }

    this.RheosMemoria.get(priority)!.set(config.name, config);
    this.universalMemoria.set(config.name, config);

    // Logging
    const methodTag = `[${config.method.toUpperCase()}]`.padEnd(8);
    console.log(
      `${style.blue}[RHEOS] Loaded: ${style.reset}${methodTag} ${config.name} ${style.dim}(Prio: ${priority})${style.reset}`
    );
  }

  private validateConfig(config: AxiosCall, file: string): boolean {
    if (!config.name || !config.method || !config.endpoint) {
      console.warn(
        `${style.yellow}[RHEOS] [SKIP] Invalid config in ${path.basename(
          file
        )}${style.reset}`
      );
      return false;
    }
    return true;
  }

  private performRequest = async (config: AxiosCall, baseURL: string) => {
    const url = config.absoluteUri
      ? config.endpoint
      : baseURL + config.endpoint;

    // Dynamic Data Generation
    let requestData = config.data;
    if (typeof config.data === "function") {
      try {
        requestData = await config.data();
      } catch (e) {
        console.error(
          `${style.red}[RHEOS] [ERR] Data generation failed for '${config.name}': ${e}${style.reset}`
        );
        return { success: false, error: e };
      }
    }

    const axiosOptions = {
      method: config.method,
      url: url,
      data: requestData,
      headers: config.headers || {},
      timeout: config.timeout || this.config.defaultTimeout || 5000,
    };

    let result: { success: boolean; data?: any; error?: any };

    try {
      const response = await axios(axiosOptions);
      console.log(
        `${style.green}[RHEOS] ✔️  Success: ${config.name}${style.reset}`
      );

      result = { success: true, data: response.data };
    } catch (error: any) {
      const errMsg = error.response
        ? `Status ${error.response.status}`
        : error.message;
      console.error(
        `${style.red}[RHEOS] ❌ Failed:  ${config.name} -> ${errMsg}${style.reset}`
      );

      result = { success: false, error };
    }

    if (config.onResponse) {
      try {
        console.log(
          `${style.dim}   -> Triggering reactive function for ${config.name}...${style.reset}`
        );
        // We await it in case it's async (e.g., saving to database)
        await config.onResponse(result);
      } catch (callbackError) {
        console.error(
          `${style.red}   -> Reactive function failed: ${callbackError}${style.reset}`
        );
      }
    }

    return result;
  };
}

export default Rheos;
