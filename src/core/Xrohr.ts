import express, { Application } from "express";
import RouterManager from "./RouterManager.js";
import { loadConfig } from "../loaders/config.loader.js";
import cors, { CorsOptions } from "cors";
import { ServerConfig, XrohrConfig } from "../types/Xrohr.config.js";
import { RouterTemplate } from "../types/Router.types.js";
import Server from "./Server.js";
import { MiddlewareTemplate } from "../types/Middleware.types.js";

class XrohrJS {
  private expressApp: Server;
  private routerManager: RouterManager;
  private port!: number;

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

  static Route = (config: RouterTemplate) => {
    return config;
  }

  static Middleware = (config: MiddlewareTemplate) => {
    return config;
  }

  static xrohrConfig = (config: XrohrConfig) : XrohrConfig => {
    return config;
  }

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
      this.routerManager.init(this.expressApp, config.server.apiPrefix);
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

  // public registerCustomRouter = (router: RouterTemplate) => {
  //   this.routerManager.customRegister(router, this.expressApp);
  // };
}

export default XrohrJS;
