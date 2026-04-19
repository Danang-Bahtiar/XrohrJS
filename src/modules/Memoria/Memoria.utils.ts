import path from "path";
import { MemoriesConfig } from "./Memoria.type.js";
import { glob } from "glob";

class MemoriaUtils {
  private memoriesConfig: Map<string, MemoriesConfig>;

  constructor() {
    this.memoriesConfig = new Map();
  }

  public loadMemoriesConfig = async () => {
    const memoriesPath = path.resolve(process.cwd(), "src/memories");
    const memoriesDir = path
      .join(memoriesPath, "/**/*.{ts,js}")
      .replace(/\\/g, "/");
    const files = await glob(memoriesDir);

    for (const file of files) {
      const fileName = path.basename(file);
      const filePath = `file://${file.replace(/\\/g, "/")}`;

      try {
        const module = await import(`${filePath}?t=${Date.now()}`);
        const config: MemoriesConfig = module.default;
        if (!config.memoriesName) {
          console.warn(
            `[WARN] Memories config in file ${fileName} is missing 'memoriesName' property. Skipping...`,
          );
          continue;
        }
        this.memoriesConfig.set(config.memoriesName, config);
        console.log(
          `[MEMORIA UTILS] Loaded memories config: ${config.memoriesName} (from ${fileName})`,
        );
      } catch (error) {
        console.error(
          `[ERROR] Failed to load memories config from file ${fileName}:`,
          error,
        );
      }
    }
  };

  public getMemoriesConfigMap = (): Map<string, MemoriesConfig> => {
    return this.memoriesConfig;
  };
}

export default MemoriaUtils;
