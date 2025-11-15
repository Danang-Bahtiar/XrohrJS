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

class Xrohr {
  private expressApp: Server;
  private routerManager: RouterManager;
  private port!: number;
  private sparkLiteApp!: SparkLite;
  private sparkLiteEnabled: boolean = false;
  private rheosApp!: Rheos;
  private rheosEnabled: boolean = false;
  private memoriaApp!: Map<string, Memoria>;
  private memoriaEnabled: boolean = false;
  private middlewareManager: MiddlewareManager;

  constructor() {
    this.routerManager = new RouterManager();
    this.middlewareManager = new MiddlewareManager();
    this.expressApp = new Server();
  }

  // ==================================== PRIVATE =============================== //
   private initialize = async () => {
    await this.middlewareManager.init();

    // load main config
    const config = await loadConfig();

    this.port = config.server.port;

    if (config.server.useDefaultCors) {
      this.expressApp.getApp().use(cors());
    } else {
      const corsConfig = this.createCorsConfig(config.server);
      this.expressApp.getApp().use(cors(corsConfig));
    }

    if (config.server.useJsonParser) {
      this.expressApp.getApp().use(express.json());
    }

    if (config.server.useUrlEncoded) {
      this.expressApp.getApp().use(express.urlencoded({ extended: true }));
    }

    if (config.router.useDefaultRouterRegistration) {
      this.routerManager.init(
        this.expressApp,
        config.router.apiPrefix,
        this.middlewareManager
      );
    }

    if (config.memoria.enabled) {
      this.memoriaApp = new Map();
      this.memoriaEnabled = true;
    }

    if (config.sparkLite.enabled) {
      this.sparkLiteEnabled = true;
      this.sparkLiteApp = new SparkLite();
      await this.sparkLiteApp.load();
    }

    if (config.axios.enabled) {
      this.rheosEnabled = true;
      this.rheosApp = new Rheos(
        config.axios.defaultTimeout,
        config.axios.baseURL,
        config.axios.subURL || ""
      );
      await this.rheosApp.load();
    }
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
  }

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

  public createMemoria = (
    name: string,
    key: string,
    schema: object
  ): ReturnTemplate => {
    try {
      if (!this.memoriaEnabled)
        throw new Error("Memoria module is not enabled in the configuration.");

      let memoria = this.memoriaApp.get(name);
      if (!memoria) {
        memoria = new Memoria(key, schema);
        this.memoriaApp.set(name, memoria);
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
}

export default Xrohr;
