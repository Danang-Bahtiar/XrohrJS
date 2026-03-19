import { CorsOptions } from "cors";
import { ServerConfig } from "../config/Xrohr.config.js";
import Memoria from "../modules/Memoria/Memoria.js";
import MiddlewareManager from "../modules/Middleware/MiddlewareManager.js";
import Rheos from "../modules/Rheos/Rheos.js";
import { AxiosCall } from "../modules/Rheos/Rheos.types.js";
import RouterManager from "../modules/Router/RouterManager.js";
import SparkLite from "../modules/SparkLite/SparkLite.js";
import Server from "./Server.js";
import SimplexRouterManager from "../modules/Router/SimplexRouterManager.js";

class XRohrUtils {
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
        ip: req.ip || req.socket.remoteAddress
      });

      res.json(result);
    });
  };

  static apiCallEvent = (
    sparkliteApp: SparkLite,
    routerManager: SimplexRouterManager,
    middlewareManager: MiddlewareManager,
  ) => {
    sparkliteApp.Subscribe("API_CALL", async (data, resolver) => {
      try {
        // 1. Try to run the engine
        const result = await routerManager.callSimplexAPI(
          data.id,
          data.req,
          data.method,
          middlewareManager,
          data.headers,
          data.ip
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

  static apiRegisterEvent = (
    sparkLiteApp: SparkLite,
    expressApp: Server,
    memoriaApp: Memoria,
    routerManager: RouterManager | SimplexRouterManager,
    rheosApp: Rheos,
  ) => {
    sparkLiteApp.Subscribe("API_REGISTER", async (data) => {
      if (routerManager instanceof RouterManager) {
        routerManager.registerRoute(
          data.configuration, // 1. routeConfig
          expressApp, // 2. expressApp
          memoriaApp,
          rheosApp,
          data.source,
        );
      } else if (routerManager instanceof SimplexRouterManager) {
        routerManager.registerRoute(
          data.configuration,
          memoriaApp,
          rheosApp,
          data.source,
        );
      }
    });
  };

  static autoHydrateRouteHandler = (
    expressApp: Server,
    sparkLiteApp: SparkLite,
    edgeSyncSecret: string,
    memoriaApp: Memoria,
  ) => {
    const app = expressApp.getApp();
    app.post("/__xrohr__/auto-hydrate", async (req, res) => {
      const { mainSyncSecret, configurationMap } = req.body;
      const mainServerMode =
        req.headers["x-internal-simp"] === "true" ? "Simplex" : "Standard";

      if (mainSyncSecret !== edgeSyncSecret) {
        return res
          .status(403)
          .json({ error: "Forbidden: Invalid sync secret" });
      }

      if (!configurationMap || typeof configurationMap !== "object") {
        return res
          .status(400)
          .json({ error: "Bad Request: Missing or invalid configuration map" });
      }

      let successCount = 0;
      let failureCount = 0;
      for (const [id, config] of Object.entries(configurationMap)) {
        try {
          sparkLiteApp.Publish("API_REGISTER", {
            configuration: config,
            source: "auto-hydrate",
          });
          successCount++;
        } catch (err) {
          console.error(
            `[Auto-Hydrate Error] Failed to register route '${id}':`,
            err,
          );
          failureCount++;
        }
      }

      res.json({ successCount, failureCount });
    });
  };

  static apiDeliverEvent = (
    sparkLiteApp: SparkLite,
    rheosApp: Rheos,
    endpoint: string,
  ) => {
    sparkLiteApp.Subscribe("API_DELIVER", async (data, resolver) => {
      try {
        const rheosConfig: AxiosCall = {
          name: "API_DELIVERY",
          method: "POST",
          endpoint: endpoint,
          data: data,
          tryWithSubURL: false,
          absoluteUri: true,
        };
        const result = await rheosApp["performRequest"](rheosConfig, "");

        resolver?.(result);
      } catch (error) {
        console.error("[API_DELIVER Error] Failed to deliver API call:", error);
        resolver?.({
          error: true,
          message:
            typeof error === "object" && error !== null && "message" in error
              ? (error as { message?: string }).message ||
                "Failed to deliver API call"
              : "Failed to deliver API call",
          raw: error,
        });
      }
    });
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
      methods: config.allowedMethods,
    };
  };

  /**
   * Logs a section header to the console for better readability.
   * @param name - The name of the section to log.
   */
  static logSection = (name: string) => {
    console.log(`\n========================================`);
    console.log(`   🚀 STARTING MODULE: ${name}`);
    console.log(`========================================`);
  };
}

export default XRohrUtils;
