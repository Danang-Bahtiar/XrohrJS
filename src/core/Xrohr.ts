import express from "express";
import RouterManager from "./RouterManager.js";
import { loadConfig } from "../loaders/config.loader.js";
import cors, { CorsOptions } from "cors";
import { ServerConfig, XrohrConfig } from "../config/Xrohr.config.js";
import { RouterTemplate } from "../types/Router.types.js";
import Server from "./Server.js";
import { MiddlewareTemplate } from "../types/Middleware.types.js";
import SparkLite from "./SparkLite.js";
import { SparkLiteEvent } from "../types/Event.type.js";
import Rheos from "./Rheos.js";
import { AxiosCall } from "../types/Rheos.types.js";

class XrohrJS {
  private expressApp: Server;
  private routerManager: RouterManager;
  private port!: number;
  private sparkLiteApp!: SparkLite;
  private sparkLiteEnabled: boolean = false;
  private RheosApp!: Rheos;
  private rheosEnabled: boolean = false;

  constructor() {
    this.routerManager = new RouterManager();
    this.expressApp = new Server();
  }

  // ==================================== STATIC =============================== //

  static create = async () => {
    const app = new XrohrJS();

    await app.setup();

    return app;
  };

  /**
   * Creates a Route configuration.
   * Should be in directory ./src/routes/
   * @param config 
   * @returns 
   */
  static Route = (config: RouterTemplate) => {
    return config;
  };

  /**
   * Creates a Middleware configuration.
   * Should be in directory ./src/middlewares/
   * @param config 
   * @returns 
   */
  static Middleware = (config: MiddlewareTemplate) => {
    return config;
  };

  /**
   * Creates a XrohrJS configuration.
   * Should be in root directory.
   * @param config
   * @returns
   */
  static XrohrConfig = (config: XrohrConfig): XrohrConfig => {
    return config;
  };

  /**
   * Creates a SparkLiteEvent configuration.
   * Should be in directory ./src/events/
   * Should have .event.ts or .event.js extension.
   * @param config 
   * @returns 
   */
  static SparkEvent = (config: SparkLiteEvent) => {
    return config;
  };

  /**
   * Creates an AxiosCall configuration.
   * Should be in directory ./src/axiosCalls/
   * Should have .axios.ts or .axios.js extension.
   * @param config 
   * @returns 
   */
  static AxiosCall = (config: AxiosCall) => {
    return config;
  };

  // ==================================== PRIVATE =============================== //

  private setup = async () => {
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
      this.routerManager.init(this.expressApp, config.router.apiPrefix);
    }

    if (config.sparkLite.enabled) {
      this.sparkLiteEnabled = true;
      this.sparkLiteApp = new SparkLite();
      await this.sparkLiteApp.load();
    }

    if (config.axios.enabled) {
      this.rheosEnabled = true;
      this.RheosApp = new Rheos(
        config.axios.defaultTimeout,
        config.axios.baseURL,
        config.axios.subURL || ""
      );
      this.RheosApp.load();
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

  public getSparkApp = () => {
    if (this.sparkLiteEnabled) {
      return this.sparkLiteApp;
    } else {
      throw new Error("SparkLite module is not enabled in the configuration.");
    }
  };

  public getAxiosApp = () => {
    if (this.rheosEnabled) {
      return this.RheosApp;
    } else {
      throw new Error("Rheos module is not enabled in the configuration.");
    }
  };

  public executeAxiosCalls = async (priority: number) => {
    if (this.rheosEnabled) {
      return await this.RheosApp.executeAutoCalls(priority);
    } else {
      throw new Error("Rheos module is not enabled in the configuration.");
    }
  };

  // public registerCustomRouter = (router: RouterTemplate) => {
  //   this.routerManager.customRegister(router, this.expressApp);
  // };
}

export default XrohrJS;
