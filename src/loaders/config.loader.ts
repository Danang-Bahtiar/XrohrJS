import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import { XrohrConfig } from "../types/Xrohr.config.js";

export async function loadConfig(): Promise<XrohrConfig> {
  const fullPath = path.resolve(process.cwd(), "xrohr.config.js");

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Xrohr config not found at: ${fullPath}`);
  }

  const module = await import(pathToFileURL(fullPath).href);
  return (module.default || module) as XrohrConfig;
}

