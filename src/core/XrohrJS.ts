import { XrohrConfig } from "../config/Xrohr.config.js";
import { RouterTemplate } from "../types/Router.types.js";
import { MiddlewareTemplate } from "../types/Middleware.types.js";
import { SparkLiteEvent } from "../types/Event.type.js";
import { AxiosCall } from "../types/Rheos.types.js";
import Xrohr from "./Xrohr.js";
import { SchemaDefinition } from "../types/Memoria.type.js";

class XrohrJS {
  constructor() {}

  // ==================================== STATIC =============================== //

  static create = async (): Promise<Xrohr> => {
    const app = new Xrohr();

    await app["initialize"]();

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

  static MemoriaSchema = (schema: SchemaDefinition) => {
    return schema;
  }
}

export default XrohrJS;
