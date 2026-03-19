import { Request, Response } from "express";
import Server from "../../core/Server.js";
import path from "path";
import { glob } from "glob";

class RouterUtils {
  static apiExpressRegister = (
    path: string,
    method: string,
    expressApp: Server,
    handlers: any[],
  ) => {
    switch (method) {
      case "get":
        expressApp.get(path, handlers);
        break;
      case "post":
        expressApp.post(path, handlers);
        break;
      case "put":
        expressApp.put(path, handlers);
        break;
      case "delete":
        expressApp.delete(path, handlers);
        break;
      default:
        console.warn(`[WARN] Unsupported method '${method}'.`);
        break;
    }
  };

  static createMockRequest = (reqData: any, method: string, reqHeader: any, reqIp: any) => {
    return {
      body: reqData,
      method: method,
      query: {},
      params: {},
      headers: reqHeader,
      ip: reqIp
    } as Partial<Request> as Request;
  };

  static createMockResponse = (
    isResponded: boolean,
    resolve: (data: any) => void,
  ) => {
    return {
      status: function (code: number) {
        return this;
      }, // Ignore status codes in Simplex
      json: function (data: any) {
        if (!isResponded) {
          isResponded = true;
          resolve(data);
        }
        return this;
      },
      send: function (data: any) {
        if (!isResponded) {
          isResponded = true;
          resolve(data);
        }
        return this;
      },
    } as unknown as Response;
  };

  static fileDiscovery = async () => {
    const routePath = path.resolve(process.cwd(), "./src/routes");
    const routeDir = path.join(routePath, "/**/*.{ts,js}").replace(/\\/g, "/");
    return await glob(routeDir);
  };
}

export default RouterUtils;
