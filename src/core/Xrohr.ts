import express from "express";
import { loadConfig } from "../loaders/config.loader.js";
import cors from "cors";
import Server from "./Server.js";
import Memoria from "../modules/Memoria/Memoria.js";
import MiddlewareManager from "../modules/Middleware/MiddlewareManager.js";
import SparkLite from "../modules/SparkLite/SparkLite.js";
import Rheos from "../modules/Rheos/Rheos.js";
import XRohrUtils from "./topology/shared.utils.js";
import SimplexRouterManager from "../modules/Router/SimplexRouterManager.js";
import MemoriaUtils from "../modules/Memoria/Memoria.utils.js";
import {
  EdgeNodeConfig,
  MainNodeConfig,
  ServerConfig,
  XrohrConfig,
} from "../config/Xrohr.config.js";
import AuthServices from "../services/AuthServices.js";
import JWTService from "../services/JWTServices.js";
import { NodeManifest } from "./Xrohr.types.js";
import DEBUG from "../utils/Debug.js";

class Xrohr {
  private self!: NodeManifest;
  private connectedNodes: Map<string, NodeManifest>;

  // Server
  private expressApp: Server;
  private port!: number;
  // Actua Module
  private routerManager!: SimplexRouterManager;

  // ===== Modules =====
  // Middleware
  private middlewareManager!: MiddlewareManager;
  // Memoria Module
  private memoriaApp!: Memoria;
  private memoriesUtility!: MemoriaUtils;
  // SparkLite Module
  private sparkLiteApp!: SparkLite;
  // Axios Module
  private rheosApp!: Rheos;

  // ===== Services =====
  private jwtService!: JWTService;

  constructor() {
    this.expressApp = new Server();
    this.connectedNodes = new Map<string, NodeManifest>();
  }

  /**
   * Initializes the Xrohr application by loading configuration, setting up middleware, and initializing modules.
   */
  private initialize = async () => {
    // 1. Load Config
    XRohrUtils.logSection("CONFIGURATION");
    const config = await loadConfig();

    // --- EARLY VALIDATION GATE ---
    const isEdge = config.topology.isEdgeNode;
    const nodeType = XRohrUtils.topologyCheck(isEdge, config);
    // -----------------------------
    this.port = config.server.port;
    console.log(`[CONFIG] Loaded configuration. Port set to: ${this.port}`);

    // 2. Express Core Setup
    XRohrUtils.logSection("EXPRESS SERVER SETUP");
    this.expressConfiguration(config.server);
    const shortId = XRohrUtils.generateNodeId();

    this.self = {
      id: isEdge ? `edge-${shortId}` : `main-${shortId}`,
      baseUrl: XRohrUtils.getBaseUrl(this.port, config.server.apiPrefix),
      type: nodeType,
      modules: [],
      services: [],
      version: "2.3.6",
    };

    XRohrUtils.logSection("ROUTER MANAGER");
    this.routerManager = new SimplexRouterManager();
    await this.routerManager.init();
    DEBUG.success(`[CONFIG] Router Manager initialized successfully.`);

    // 3. Check enabled modules and initiate each one enabled.
    await this.setupEnableModules(config, isEdge);
    await this.setupEnableServices(config);

    // 4. Default Event Register
    XRohrUtils.logSection("DEFAULT EVENT REGISTRATION");
    XRohrUtils.apiCallEvent(
      config.server.apiPrefix,
      this.self.modules.includes("SPARKLITE"),
      this.expressApp,
      this.sparkLiteApp,
      this.routerManager,
      this.self.modules.includes("MIDDLEWARE") ? this.middlewareManager : undefined,
    );

    // ============== FINALIZATION ==================
    XRohrUtils.finalizeLog(isEdge, this.self);
  };

  private expressConfiguration = (config: ServerConfig) => {
    if (config.useDefaultCors) {
      this.expressApp.getApp().use(cors());
      console.log("[SERVER] Using default CORS configuration.");
    } else {
      const corsConfig = XRohrUtils.createCorsConfig(config);
      this.expressApp.getApp().use(cors(corsConfig));
      console.log("[SERVER] Using custom CORS configuration.");
    }
    if (config.useJsonParser) {
      this.expressApp.getApp().use(express.json());
      console.log("[SERVER] JSON Parser enabled.");
    }
    if (config.useUrlEncoded) {
      this.expressApp.getApp().use(express.urlencoded({ extended: true }));
      console.log("[SERVER] URL Encoded Parser enabled.");
    }
  };

  private setupEnableModules = async (config: XrohrConfig, isEdge: boolean) => {
    const moduleInitializers: Record<
      string,
      (cfg: XrohrConfig) => Promise<void>
    > = {
      MIDDLEWARE: async () => {
        this.middlewareManager = new MiddlewareManager();
        this.middlewareManager.init();
      },
      AXIOS: async () => {
        const urls = config.defaults.mainNode?.edgeUrls;
        if (!urls || urls.length === 0) {
          console.warn(
            "[CONFIG WARNING] 'AXIOS' module is enabled but no edge URLs are configured in 'defaults.mainNode.edgeUrls'. Please provide at least one edge URL for Rheos to function properly.",
          );
          return;
        }
        this.rheosApp = new Rheos(urls);
        await this.rheosApp.init();
      },
      SPARKLITE: async () => {
        this.sparkLiteApp = new SparkLite();
        await this.sparkLiteApp.init();
      },
      MEMORIA: async () => {
        this.memoriaApp = new Memoria();
      },
    };

    for (const moduleName of config.enabledModules) {
      if (moduleName === "AXIOS" && isEdge) {
        DEBUG.warn(
          "[CONFIG WARNING] 'AXIOS' module will be initialized during handshake process for edge nodes.",
        );
        continue;
      }
      XRohrUtils.logSection(`${moduleName}`);
      const initFn = moduleInitializers[moduleName];

      if (!initFn) {
        DEBUG.warn(
          `[CONFIG] Module '${moduleName}' is unknown and will be skipped.`,
        );
        continue;
      }

      try {
        await initFn(config);
        DEBUG.success(
          `[CONFIG] Module '${moduleName}' initialized successfully.`,
        );
        this.self.modules.push(moduleName);
      } catch (error: any) {
        DEBUG.error(
          `FATAL: Failed to initialize mandatory module [${moduleName}].`,
        );
        DEBUG.error(error.message);

        // Exit with failure code 1
        process.exit(1);
      }
    }
  };

  private setupEnableServices = async (config: XrohrConfig) => {
    const serviceInitializers: Record<
      string,
      (cfg: XrohrConfig) => Promise<void>
    > = {
      JWT: async () => {
        if (!config.servicesConfig?.jwtService) {
          DEBUG.warn(
            "[CONFIG WARNING] 'JWT' service is enabled but 'jwtService' configuration is missing. Please provide 'jwtService' configuration details.",
          );
          return;
        }

        const key = JWTService.validateAndNormalizeKey(
          config.servicesConfig.jwtService.secretKey,
          config.topology.isEdgeNode,
          config.servicesConfig.jwtService.useRSA,
        );

        this.jwtService = new JWTService(key);
      },
    };

    for (const serviceName of config.enabledServices) {
      XRohrUtils.logSection(`${serviceName}`);
      const initFn = serviceInitializers[serviceName];

      if (!initFn) {
        DEBUG.warn(
          `[CONFIG] Service '${serviceName}' is unknown and will be skipped.`,
        );
        continue;
      }

      try {
        await initFn(config);
        DEBUG.success(
          `[CONFIG] Service '${serviceName}' initialized successfully.`,
        );
        this.self.services.push(serviceName);
      } catch (error: any) {
        DEBUG.error(
          `FATAL: Failed to initialize mandatory service [${serviceName}].`,
        );
        DEBUG.error(error.message);
      }
    }
  };
  // ==================================== PUBLIC =============================== //

  /**
   * @throws {Error} If Memoria module is not enabled in the configuration.
   * @returns {Memoria} memoriaApp - The Memoria instance.
   */
  public getMemoriaApp = (): Memoria => {
    if (!this.self.modules.includes("MEMORIA"))
      throw new Error("Memoria module is not enabled in the configuration.");

    return this.memoriaApp;
  };

  /**
   * @throws {Error} If SparkLite module is not enabled in the configuration.
   * @returns {SparkLite} sparkLiteApp - The SparkLite instance.
   */
  public getSparkLiteApp = (): SparkLite => {
    if (!this.self.modules.includes("SPARKLITE"))
      throw new Error("SparkLite module is not enabled in the configuration.");
    return this.sparkLiteApp;
  };

  /**
   * @throws {Error} If Rheos module is not enabled in the configuration.
   * @returns {Rheos} rheosApp - The Rheos instance.
   */
  public getRheosApp = (): Rheos => {
    if (!this.self.modules.includes("AXIOS"))
      throw new Error("Rheos module is not enabled in the configuration.");
    return this.rheosApp;
  };

  /**
   * @returns {Server} expressApp - The Express application instance.
   */
  public getExpressApp = (): Server => {
    return this.expressApp;
  };

  /**
   *
   * @returns {SimplexRouterManager} routerManager - The RouterManager Instance.
   */
  public getRouterManager = (): SimplexRouterManager => {
    return this.routerManager;
  };

  public getMiddlewareManager = () => {
    if (!this.self.modules.includes("MIDDLEWARE"))
      throw new Error("Middleware module is not enabled in the configuration.");
    return this.middlewareManager;
  };

  public getSelfManifest = (): NodeManifest => {
    return this.self;
  };

  /**
   * Starts the Express server on the configured port.
   * @returns A promise that resolves when the server is started.
   */
  public start = async (): Promise<void> => {
    return new Promise((resolve) => {
      this.expressApp.listen(this.port, () => {
        resolve();
      });
    });
  };
}

export default Xrohr;
