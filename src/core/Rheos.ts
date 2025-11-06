import { glob } from "glob";
import path from "path";
import { AxiosCall } from "../types/Rheos.types.js";
import axios from "axios";

class Rheos {
  private defaultTimeout: number;
  private baseURL: string;
  private subURL: string = "";
  private RheosMemoria: Map<number, Map<string, AxiosCall>>;

  constructor(defaultTimeout: number = 5000, baseURL: string, subURL: string) {
    this.subURL = subURL;
    this.baseURL = baseURL;
    this.defaultTimeout = defaultTimeout;
    this.RheosMemoria = new Map();
  }

  private call = async (config: AxiosCall, baseURL: string) => {
    const url = baseURL + config.endpoint;
    const callConfig = {
      headers: config.headers || {},
      timeout: config.timeout || this.defaultTimeout,
    };

    try {
      const method = config.method.toLowerCase();
      let res;
      switch (method) {
        case "get":
          res = await axios.get(url, callConfig);
          break;
        case "post":
          res = await axios.post(url, config.data, callConfig);
          break;
        case "put":
          res = await axios.put(url, config.data, callConfig);
          break;
        case "delete":
          res = await axios.delete(url, callConfig);
          break;
        default:
          throw new Error(`Unsupported method: ${config.method}`);
      }
      return { success: true, data: res.data };
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[RHEOS] Error calling ${url}:`, error.message);
        return { success: false, error };
      } else {
        console.error(`[RHEOS] Unknown error calling ${url}:`, error);
        return { success: false, error: new Error(String(error)) };
      }
    }
  };

  public executeAutoCalls = async (priority: number) => {
    const priorityMap = this.RheosMemoria.get(priority);
    if (!priorityMap) {
      console.warn(`[RHEOS] No AxiosCalls found for priority: ${priority}`);
      return null;
    }

    const resultMap = new Map<string, any>();

    for (const [name, axiosConfig] of priorityMap.entries()) {
      console.log(`[RHEOS] Executing AxiosCall: ${name}`);

      // --- main call ---
      let result = await this.call(axiosConfig, this.baseURL);

      // --- fallback ---
      if (!result.success && axiosConfig.tryWithSubURL && this.subURL) {
        console.warn(`[RHEOS] Retrying ${name} via subURL...`);
        result = await this.call(axiosConfig, this.subURL);
      }

      resultMap.set(name, result);
    }

    return resultMap;
  };

  public load = async () => {
    console.log("[RHEOS] Rheos module loaded.");
    const callPath = path.resolve(process.cwd(), "./src/axiosCalls");
    console.log(`[RHEOS] Loading AxiosCall from: ${callPath}`);
    const callDir = path
      .join(callPath, "/**/*.{axios.ts,axios.js}")
      .replace(/\\/g, "/");
    const files = await glob(callDir);

    for (const file of files) {
      const filePath = `file://${file.replace(/\\/g, "/")}`;
      const axiosModule = await import(`${filePath}?update=${Date.now()}`);
      const axiosConfig: AxiosCall = axiosModule.default;

      if (!axiosConfig.name || !axiosConfig.method || !axiosConfig.endpoint) {
        console.warn(`[RHEOS] Skipping invalid AxiosCall file: ${file}`);
        continue;
      }

      if (!axiosConfig.timeout) {
        axiosConfig.timeout = this.defaultTimeout;
      }

      if (axiosConfig.priority) {
        let priorityMap = this.RheosMemoria.get(axiosConfig.priority);
        if (!priorityMap) {
          priorityMap = new Map<string, AxiosCall>();
          this.RheosMemoria.set(axiosConfig.priority, priorityMap);
        }
        console.log(
          `[RHEOS] Registered AxiosCall with Priority ${axiosConfig.priority}: ${axiosConfig.name} from ${file}`
        );
        priorityMap.set(axiosConfig.name, axiosConfig);
      } else {
        let priorityMap = this.RheosMemoria.get(Number.MAX_SAFE_INTEGER);
        if (!priorityMap) {
          priorityMap = new Map<string, AxiosCall>();
          this.RheosMemoria.set(Number.MAX_SAFE_INTEGER, priorityMap);
        }
        console.log(
          `[RHEOS] Registered AxiosCall: ${axiosConfig.name} from ${file}`
        );
        priorityMap.set(axiosConfig.name, axiosConfig);
      }
    }
  };
}

export default Rheos;
