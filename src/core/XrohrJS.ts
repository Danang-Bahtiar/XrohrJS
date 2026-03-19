import { XrohrConfig } from "../config/Xrohr.config.js";
import { MiddlewareTemplate } from "../modules/Middleware/Middleware.types.js";
import { SparkLiteEvent } from "../modules/SparkLite/Event.type.js";
import { AxiosCall } from "../modules/Rheos/Rheos.types.js";
import Xrohr from "./Xrohr.js";
import { SchemaDefinition } from "../modules/Memoria/Memoria.type.js";
import { RouterDefinition } from "../modules/Router/Router.types.js";

class XrohrJS {
  constructor() {}

  // ==================================== STATIC =============================== //

  /**
   * Creates and initializes a new Xrohr application instance.
   * @returns 
   */
  static create = async (): Promise<Xrohr> => {
    const app = new Xrohr();

    await app["initialize"]();

    return app;
  };

  /**
   * Creates a Route configuration.
   * Should be in directory ./src/routes/
   * @param config - The route configuration.
   * @returns
   */
  static Route = (config: RouterDefinition) => {
    return config;
  };

  /**
   * Creates a Middleware configuration.
   * Should be in directory ./src/middlewares/
   * @param config - The middleware configuration.
   * @returns
   */
  static Middleware = (config: MiddlewareTemplate) => {
    return config;
  };

  /**
   * Creates a XrohrJS configuration.
   * Should be in root directory.
   * @param config - The XrohrJS configuration.
   * @returns
   */
  static XrohrConfig = (config: XrohrConfig): XrohrConfig => {
    return config;
  };

  /**
   * Creates a SparkLiteEvent configuration.
   * Should be in directory ./src/events/
   * Should have .event.ts or .event.js extension.
   * @param config - The SparkLiteEvent configuration.
   * @returns
   */
  static SparkEvent = (config: SparkLiteEvent) => {
    return config;
  };

  /**
   * Creates an AxiosCall configuration.
   * Should be in directory ./src/axiosCalls/
   * Should have .axios.ts or .axios.js extension.
   * @param config - The AxiosCall configuration.
   * @returns
   */
  static AxiosCall = (config: AxiosCall) => {
    return config;
  };

  /**
   * Creates a Memoria Schema definition.
   * @param schema - The schema definition.
   * @returns 
   */
  static MemoriaSchema = (schema: SchemaDefinition) => {
    return schema;
  }
}

export default XrohrJS;
