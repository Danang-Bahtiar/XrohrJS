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
import DEBUG from "../../utils/Debug.js";

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
    const roleLabel = isEdge
      ? `EDGE NODE - ${self.id}`
      : `MAIN SERVER - ${self.id}`;
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

  static apiCallEvent = (
    prefix: string,
    sparklite: boolean,
    expressApp: Server,
    sparkliteApp: SparkLite,
    routerManager: SimplexRouterManager,
    middlewareManager?: MiddlewareManager,
  ) => {
    if (!sparklite) {
      DEBUG.warn(
        "[API CALL EVENT]: Default API CALL EVENT requires Sparklite to be enabled, unless you have implemented your own event handling.",
      );
      return;
    }

    XRohrUtils.callerEvent(
      sparkliteApp,
      routerManager,
      middlewareManager ? middlewareManager : undefined,
    );
    XRohrUtils.globalRouteHandler(prefix, expressApp, sparkliteApp);

    DEBUG.success(
      "[API CALL EVENT]: Global API call event registered successfully.",
    );
  };

  static callerEvent = (
    sparkliteApp: SparkLite,
    routerManager: SimplexRouterManager,
    middlewareManager?: MiddlewareManager,
  ) => {
    sparkliteApp.Subscribe("API_CALL", async (data, resolver) => {
      try {
        // 1. Try to run the engine
        const result = await routerManager.callSimplexAPI(
          data.id,
          data.req,
          data.method,
          data.headers,
          data.ip,
          middlewareManager ? middlewareManager : undefined,
        );

        // 2. Success! Send the user's data back.
        resolver?.(result);
      } catch (err: any) {
        // 3. ABORT! A middleware called next(err) or a handler threw an exception.
        // We just pass the raw error straight back to the client.
        console.error(`[Simplex Error] Route '${data.id}':`, err.message);

        resolver?.({
          error: true,
          message: err.message || "Internal Server Error",
          // Pass the raw error object if the user attached custom properties to it
          raw: err,
        });
      }
    });
  };

  static globalRouteHandler = (
    prefix: string,
    expressApp: Server,
    sparkliteApp: SparkLite,
  ) => {
    const app = expressApp.getApp();
    // GLOBAL API ENDPOINT
    // This endpoint will act as a bridge, forwarding requests to SparkLite which then routes them to the correct handler
    // Note: We use app.all() to catch all HTTP methods, but we will enforce method checks inside the handler
    // the API will forbid physical GET request, and only allow POST/PUT/DELETE with a body containing { id, method, data }
    app.all(new RegExp(`^/${prefix}/(.*)`), async (req, res) => {
      // 1. Immediate Method Check
      if (req.method === "GET") {
        return res.status(400).json({
          error: true,
          message:
            "Physical GET requests are not supported in Simplex mode. Use POST.",
        });
      }

      // 2. Body Existence Check
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          error: true,
          message:
            "Empty request body. Simplex routes require 'id' and 'method' in JSON.",
        });
      }

      // 3. Continue to Bridge
      const result = await sparkliteApp.Publish("API_CALL", {
        id: req.body.id,
        method: req.body.method,
        req: req.body.data,
        headers: req.headers,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json(result);
    });
  };
}

export default XRohrUtils;
