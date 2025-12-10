import express from "express";
import RouterManager from "./RouterManager.js";
import { loadConfig } from "../loaders/config.loader.js";
import cors, { CorsOptions } from "cors";
import { ServerConfig } from "../config/Xrohr.config.js";
import Server from "./Server.js";
import SparkLite from "./SparkLite.js";
import Rheos from "./Rheos.js";
import Memoria from "./Memoria.js";
import MiddlewareManager from "./MiddlewareManager.js";
import { ReturnTemplate } from "../types/Return.type.js";
import { RouterTemplate } from "../types/Router.types.js";

class Xrohr {
  private expressApp: Server;
  private routerManager: RouterManager;
  private port!: number;
  private sparkLiteApp!: SparkLite;
  private sparkLiteEnabled: boolean = false;
  private rheosApp!: Rheos;
  private rheosEnabled: boolean = false;
  private memoriaApp!: Memoria;
  private memoriaEnabled: boolean = false;
  private middlewareManager: MiddlewareManager;

  constructor() {
    this.routerManager = new RouterManager();
    this.middlewareManager = new MiddlewareManager();
    this.expressApp = new Server();
  }

  // ==================================== PRIVATE =============================== //
  private logSection = (name: string) => {
    console.log(`\n========================================`);
    console.log(`   🚀 STARTING MODULE: ${name}`);
    console.log(`========================================`);
  };

  private initialize = async () => {
    // 1. Load Config
    this.logSection("CONFIGURATION");
    const config = await loadConfig();
    this.port = config.server.port;
    console.log(`[CONFIG] Loaded configuration. Port set to: ${this.port}`);

    // 2. Initialize Middleware Manager
    this.logSection("MIDDLEWARE MANAGER");
    await this.middlewareManager.init();
    console.log("[MIDDLEWARE] Middleware Manager initialized.");

    // 3. Express Core Setup
    this.logSection("EXPRESS CORE");
    if (config.server.useDefaultCors) {
      this.expressApp.getApp().use(cors());
      console.log("[SERVER] Using default CORS configuration.");
    } else {
      const corsConfig = this.createCorsConfig(config.server);
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

    // 4. Memoria (Synchronous init, but good to log)
    if (config.memoria.enabled) {
      this.logSection("MEMORIA (CACHE)");
      this.memoriaApp = new Memoria();
      this.memoriaEnabled = true;
      console.log("[MEMORIA] In-memory storage initialized.");
    }

    // 5. SparkLite (Events) - Await ensure events are ready before routes
    if (config.sparkLite.enabled) {
      this.logSection("SPARKLITE (EVENTS)");
      this.sparkLiteEnabled = true;
      this.sparkLiteApp = new SparkLite();
      await this.sparkLiteApp.load(); // Explicit await
      console.log("[SPARKLITE] Event system ready.");
    }

    // 6. Rheos (Axios) - Await ensures API clients are ready
    if (config.axios.enabled) {
      this.logSection("RHEOS (HTTP CLIENT)");
      this.rheosEnabled = true;
      this.rheosApp = new Rheos(
        config.axios
      );
      await this.rheosApp.load(); // Explicit await
      console.log("[RHEOS] HTTP Client wrappers loaded.");
    }

    // 7. Router (Last) - Routes might depend on Events/Axios, so load this last
    if (config.router.useDefaultRouterRegistration) {
      this.logSection("ROUTER MANAGER");
      // Ensure routerManager.init is treated as async if it does file loading
      await this.routerManager.init(
        this.expressApp,
        config.router.apiPrefix,
        this.middlewareManager
      );
      console.log("[ROUTER] All routes registered successfully.");
    }

    console.log(`\n========================================`);
    console.log(`   ✨ SYSTEM INITIALIZATION COMPLETE`);
    console.log(`========================================\n`);
  };

  private createCorsConfig = (config: ServerConfig): CorsOptions => {
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

  // ==================================== PUBLIC =============================== //

  public start = () => {
    this.expressApp.listen(this.port);
  };

  public getExpressApp = () => {
    return this.expressApp;
  };

  public getSparkLiteApp = () => {
    if (!this.sparkLiteEnabled)
      throw new Error("SparkLite module is not enabled in the configuration.");
    return this.sparkLiteApp;
  };

  public getMemoriaApp = () => {
    if (!this.memoriaEnabled)
      throw new Error("Memoria module is not enabled in the configuration.");
    return this.memoriaApp;
  };


  public createMemories = (name: string, key: string): ReturnTemplate => {
    try {
      if (!this.memoriaEnabled)
        throw new Error("Memoria module is not enabled in the configuration.");

      let memoria = this.memoriaApp.getMemoriesCollection(name);
      if (!memoria) {
        memoria = this.memoriaApp.createMemoriesCollection(name, key);
      }

      return {
        status: "Success",
        message: `Memoria for ${name} has been successfully created!`,
        error: null,
        data: memoria,
      };
    } catch (error) {
      return {
        status: "Failed",
        message: null,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Problems. Try again later.",
      };
    }
  };

  public getAxiosApp = () => {
    if (!this.rheosEnabled)
      throw new Error("Rheos module is not enabled in the configuration.");
    return this.rheosApp;
  };

  public executeAxiosCalls = async (priority: number) => {
    if (!this.rheosEnabled)
      throw new Error("Rheos module is not enabled in the configuration.");
    return await this.rheosApp.executeAutoCalls(priority);
  };

  public getMiddlewareManager = () => {
    return this.middlewareManager;
  };

  public registerConstructRoutes = async (routeConfig: RouterTemplate) => {
    return this.routerManager.constructLoader(
      routeConfig,
      this.memoriaApp,
      this.middlewareManager,
      this.expressApp
    );
  };

  public getRouterManager = () => {
    return this.routerManager;
  };
}

export default Xrohr;
