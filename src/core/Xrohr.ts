import express from "express";
import RouterManager from "../modules/Router/RouterManager.js";
import { loadConfig } from "../loaders/config.loader.js";
import cors from "cors";
import Server from "./Server.js";
import Memoria from "../modules/Memoria/Memoria.js";
import MiddlewareManager from "../modules/Middleware/MiddlewareManager.js";
import SparkLite from "../modules/SparkLite/SparkLite.js";
import Rheos from "../modules/Rheos/Rheos.js";
import XRohrUtils from "./Utils.js";
import SimplexRouterManager from "../modules/Router/SimplexRouterManager.js";

class Xrohr {
  // Server
  private expressApp: Server;
  private port!: number;

  // Middleware
  private middlewareManager: MiddlewareManager;

  // Memoria Module
  private memoriaEnabled: boolean = false;
  private memoriaApp!: Memoria;

  // SparkLite Module
  private sparkLiteEnabled: boolean = false;
  private sparkLiteApp!: SparkLite;

  // Axios Module
  private rheosEnabled: boolean = false;
  private rheosApp!: Rheos;

  // Actua Module
  private routerManager!: RouterManager | SimplexRouterManager;

  // API Config
  private autoHydrateAPI: boolean = false;
  private syncSecret: string = "";

  constructor() {
    this.middlewareManager = new MiddlewareManager();
    this.expressApp = new Server();
  }

  /**
   * Initializes the Xrohr application by loading configuration, setting up middleware, and initializing modules.
   */
  private initialize = async () => {
    // 1. Load Config
    XRohrUtils.logSection("CONFIGURATION");
    const config = await loadConfig();
    this.port = config.server.port;
    console.log(`[CONFIG] Loaded configuration. Port set to: ${this.port}`);

    // 2. Middleware Setup
    XRohrUtils.logSection("MIDDLEWARE SETUP");
    if (config.middleware.isEnabled) {
      await this.middlewareManager.init();
      console.log("[MIDDLEWARE] Middleware Manager initialized.");
    }

    // 3. Express Core Setup
    XRohrUtils.logSection("EXPRESS SERVER SETUP");
    if (config.server.useDefaultCors) {
      this.expressApp.getApp().use(cors());
      console.log("[SERVER] Using default CORS configuration.");
    } else {
      const corsConfig = XRohrUtils.createCorsConfig(config.server);
      this.expressApp.getApp().use(cors(corsConfig));
      console.log("[SERVER] Using custom CORS configuration.");
    }
    if (config.server.useJsonParser) {
      this.expressApp.getApp().use(express.json());
      console.log("[SERVER] JSON Parser enabled.");
    }
    if (config.server.useUrlEncoded) {
      this.expressApp.getApp().use(express.urlencoded({ extended: true }));
      console.log("[SERVER] URL Encoded Parser enabled.");
    }

    // 4. Memoria
    if (config.memoria.isEnabled) {
      XRohrUtils.logSection("MEMORIA (IN-MEMORY STORAGE)");
      this.memoriaEnabled = true;
      this.memoriaApp = new Memoria();
      console.log("[MEMORIA] In-memory storage initialized.");
    }

    // 5. SparkLite
    if (config.sparkLite.isEnabled) {
      XRohrUtils.logSection("SPARKLITE (EVENTS)");
      this.sparkLiteEnabled = true;
      this.sparkLiteApp = new SparkLite();
      await this.sparkLiteApp.load();
      console.log("[SPARKLITE] Event system ready.");
    }

    // 6. Rheos
    if (config.axios.isEnabled) {
      XRohrUtils.logSection("RHEOS (HTTP CLIENT)");
      this.rheosEnabled = true;
      this.rheosApp = new Rheos(config.axios);
      await this.rheosApp.load();
      console.log("[RHEOS] HTTP Client wrappers loaded.");
    }

    // 7. Router
    XRohrUtils.logSection("ROUTER MANAGER");
    if (config.restApi.useSimplex) {
      this.routerManager = new SimplexRouterManager(config.restApi.apiPrefix);
    } else {
      this.routerManager = new RouterManager(config.restApi.apiPrefix);
    }

    await this.routerManager.init(this.expressApp, this.middlewareManager);
    console.log("[ROUTER] All routes registered successfully.");

    // 8. Default Event Register
    XRohrUtils.logSection("DEFAULT EVENT REGISTRATION");
    // If using Simplex, register a default event listener for API calls
    if (config.restApi.useSimplex && this.sparkLiteEnabled) {
      // Register the Event that would be called by Global Route
      XRohrUtils.apiCallEvent(
        this.sparkLiteApp,
        this.routerManager as SimplexRouterManager,
        this.middlewareManager,
      );
      console.log("[DEFAULT EVENT] API_CALL event registered.");

      // Register the Global Route
      XRohrUtils.globalRouteHandler(
        config.restApi.apiPrefix,
        this.expressApp,
        this.sparkLiteApp,
      );
      console.log("[DEFAULT EVENT] GLOBAL_ROUTE_HANDLER registered.");
    }

    if (config.defaults.edgeNode?.apiRegisterEvent) {
      XRohrUtils.apiRegisterEvent(
        this.sparkLiteApp,
        this.expressApp,
        this.memoriaApp,
        this.routerManager,
        this.rheosApp,
      );
      console.log("[DEFAULT EVENT] API_REGISTER event registered.");
    }

    /**  Require autoHydrateAPI in main server to be true and allowAutoHydrate in edge node to be true to enable this feature. This is to prevent accidental auto-hydration that may cause issues in production if not properly configured. */
    if (config.defaults.edgeNode?.allowAutoHydrate) {
      XRohrUtils.autoHydrateRouteHandler(
        this.expressApp,
        this.sparkLiteApp,
        config.defaults.topology.syncSecret,
        this.memoriaApp,
      );
      console.log(
        "[DEFAULT EVENT] Auto-hydration API endpoint registered for edge node.",
      );
    }

    if (config.defaults.mainNode?.autoHydrateAPI) {
      this.autoHydrateAPI = true;
      const rawBase = config.axios.baseURL || "http://localhost:3001";
      const normalizedBase = rawBase.startsWith("http")
        ? rawBase
        : `http://${rawBase}`;
      const baseAddress = new URL(normalizedBase).origin;
      XRohrUtils.apiDeliverEvent(
        this.sparkLiteApp,
        this.rheosApp,
        `${baseAddress}/__xrohr__/auto-hydrate`,
      );
      console.log("[DEFAULT EVENT] API_DELIVER event registered.");

      this.syncSecret = config.defaults.topology.syncSecret;

      console.log(
        "[DEFAULT EVENT] Auto-hydration on startup is enabled. Main server will deliver API calls to edge nodes to push latest ConstructRecipes on startup.",
      );
    }

    console.log(
      "\n[XROHR] Initialization complete. Ready to start the server.",
    );
    console.log("========================================");
    if (config.defaults.topology.isEdgeNode) {
      console.log("   🌐 STARTING APPLICATION: EDGE NODE   ");
    } else {
      console.log("   🏛️ STARTING APPLICATION: MAIN SERVER ");
    }
    console.log("========================================");
  };

  // ==================================== PUBLIC =============================== //

  /**
   * @throws {Error} If Memoria module is not enabled in the configuration.
   * @returns {Memoria} memoriaApp - The Memoria instance.
   */
  public getMemoriaApp = (): Memoria => {
    if (!this.memoriaEnabled)
      throw new Error("Memoria module is not enabled in the configuration.");

    return this.memoriaApp;
  };

  /**
   * @throws {Error} If SparkLite module is not enabled in the configuration.
   * @returns {SparkLite} sparkLiteApp - The SparkLite instance.
   */
  public getSparkLiteApp = (): SparkLite => {
    if (!this.sparkLiteEnabled)
      throw new Error("SparkLite module is not enabled in the configuration.");
    return this.sparkLiteApp;
  };

  /**
   * @throws {Error} If Rheos module is not enabled in the configuration.
   * @returns {Rheos} rheosApp - The Rheos instance.
   */
  public getRheosApp = (): Rheos => {
    if (!this.rheosEnabled)
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
   * @returns {SimplexRouterManager|RouterManager} routerManager - The RouterManager Instance.
   */
  public getRouterManager = (): SimplexRouterManager | RouterManager => {
    return this.routerManager;
  };

  public getMiddlewareManager = () => {
    return this.middlewareManager;
  }

  /**
   * Starts the Express server on the configured port.
   * @returns A promise that resolves when the server is started.
   */
  public start = async (): Promise<void> => {
    return new Promise((resolve) => {
      this.expressApp.listen(this.port, () => {
        try {
          // @TODO: Check for Startup Events
          if (this.autoHydrateAPI) {
            const constructMap = this.routerManager.getConstructIndex();

            const constructObject = Object.fromEntries(constructMap);

            this.sparkLiteApp.Publish("API_DELIVER", {
              configurationMap: constructObject,
              mainSyncSecret: this.syncSecret,
            });

            this.syncSecret = "";
          }
        } catch (error) {
          // @TODO: Handle startup event errors (e.g., log them, retry logic, etc.)
          console.error("[XROHR] Error during startup events:", error);
        }
        resolve();
      });
    });
  };
}

export default Xrohr;
