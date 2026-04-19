import { CorsOptions } from "cors";
import { ServerConfig, XrohrConfig } from "../../config/Xrohr.config.js";
import Memoria from "../../modules/Memoria/Memoria.js";
import MiddlewareManager from "../../modules/Middleware/MiddlewareManager.js";
import Rheos from "../../modules/Rheos/Rheos.js";
import { AxiosCall } from "../../modules/Rheos/Rheos.types.js";
import SparkLite from "../../modules/SparkLite/SparkLite.js";
import Server from "../Server.js";
import SimplexRouterManager from "../../modules/Router/SimplexRouterManager.js";
import { MemoriesConfig } from "../../modules/Memoria/Memoria.type.js";
import os from "os";
import crypto from "crypto";
import { NodeManifest } from "../Xrohr.types.js";

class XRohrUtils {
  static topologyCheck = (
    isEdge: boolean,
    config: XrohrConfig,
  ): "edge" | "main" => {
    if (isEdge) {
      if (!config.defaults.edgeNode) {
        console.error(
          "[FATAL] Node is set as EDGE but 'defaults.edgeNode' is missing.",
        );
        process.exit(1);
      }
      return "edge";
    } else {
      if (!config.defaults.mainNode) {
        console.error(
          "[FATAL] Node is set as MAIN but 'defaults.mainNode' is missing.",
        );
        process.exit(1);
      }
      return "main";
    }
  };

  static getBaseUrl = (port: number, prefix: string): string => {
    const networkInterfaces = os.networkInterfaces();
    let localIp = "localhost";

    // Look for the actual network IP (e.g., 192.168.x.x)
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        for (const iface of interfaces) {
          if (iface.family === "IPv4" && !iface.internal) {
            localIp = iface.address;
            break;
          }
        }
      }
    }

    return `http://${localIp}:${port}/${prefix.replace(/^\/|\/$/g, "")}`;
  };

  static generateNodeId = () => crypto.randomBytes(4).toString("hex");

  static finalizeLog = (isEdge: boolean, self: NodeManifest) => {
    const roleLabel = isEdge ? `EDGE NODE - ${self.id}` : `MAIN SERVER - ${self.id}`;
    const color = isEdge ? "\x1b[36m" : "\x1b[35m"; // Cyan for Edge, Magenta for Main
    const reset = "\x1b[0m";
    const boxWidth = 64; // Total inner space width

    // Helper to format a line
    const formatLine = (label: string, value: string) => {
      const boxWidth = 64; // Total inner width
      const labelWidth = 10; // Width reserved for the "Label" part

      // 1. Pad the label text so the colon always sits at the same index
      const alignedLabel = label.padEnd(labelWidth);

      // 2. Combine with value
      const content = `  ${alignedLabel}: ${value}`;

      // 3. Wrap in box borders
      return `${color}│${reset}${content.padEnd(boxWidth)}${color}│${reset}`;
    };

    const title = "SERVER STATUS";
    const totalWidth = boxWidth; // 56
    const titleLength = title.length + 2; // +2 for the spaces around the text
    const sideWidth = (totalWidth - titleLength) / 2;
    const topBar = `${color}┌${"─".repeat(Math.floor(sideWidth))} ${reset}${title}${color} ${"─".repeat(Math.ceil(sideWidth))}┐${reset}`;

    console.log("\n\n");
    console.log(topBar);
    console.log(formatLine("XRohrJS", `v${self.version} initialized`));
    console.log(formatLine("Role", roleLabel));
    console.log(formatLine("URL", self.baseUrl));
    console.log(`${color}└${"─".repeat(boxWidth)}┘${reset}\n`);
    console.log("\n\n");
  };

  static logSection = (name: string) => {
    const magenta = "\x1b[35m";
    const gray = "\x1b[90m"; // Dimmer color for the lines
    const reset = "\x1b[0m";

    // Format: ───[ 🚀 STARTING: MODULE_NAME ]────────────────
    const label = ` STARTING: ${name.toUpperCase()} `;
    const totalWidth = 60;
    const lineAfter = "─".repeat(Math.max(0, totalWidth - label.length - 3));

    console.log(
      `\n${magenta}───${reset}[${label}]${magenta}${lineAfter}${reset}`,
    );
  };

  /**
   * Creates a CORS configuration object based on the provided server configuration.
   * @param config - The server configuration containing CORS settings.
   * @returns
   */
  static createCorsConfig = (config: ServerConfig): CorsOptions => {
    return {
      origin: (origin, callback) => {
        if (!origin || config.allowedOrigins?.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("This origin is not allowed by CORS"));
        }
      },
      methods: config.allowedMethods || ["GET", "POST", "PUT", "DELETE"],
    };
  };
}

export default XRohrUtils;
