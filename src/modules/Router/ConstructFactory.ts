import Memoria from "../Memoria/Memoria.js";
import Memories from "../Memoria/Memories.js";
import { Request, Response } from "express";
import Rheos from "../Rheos/Rheos.js";
import { AxiosCall } from "../Rheos/Rheos.types.js";
import { ForwardSource, MemoriaSource } from "./Router.types.js";

class ConstructFactory {
  constructor() {}

  // =====================================
  // MEMORIA HANDLER
  // =====================================
  public createMemoriaHandler = (
    construct: MemoriaSource,
    memoriaApp: Memoria,
    useSimplex: boolean,
  ) => {
    return async (req: Request, res: Response) => {
      try {
        const result = this.executeMemoria(construct, req, memoriaApp);
        if (useSimplex) {
          // In Simplex mode, we return the raw result directly to the caller (e.g., edge server)
          return { status: "Success", data: result };
        } else {
          return res.json({ status: "Success", data: result });
        }
      } catch (error) {
        if (useSimplex) {
          // In Simplex mode, we return the raw result directly to the caller (e.g., edge server)
          return { status: "Error", message: (error as Error).message };
        } else {
          return res
            .status(500)
            .json({ status: "Error", message: (error as Error).message });
        }
      }
    };
  };

  private executeMemoria = (
    construct: MemoriaSource,
    req: Request,
    memoriaApp: Memoria,
  ) => {
    const actionMap: Record<string, keyof Memories> = {
      get: "getRecord",
      create: "setRecord",
      update: "setRecord",
      remove: "removeRecord",
      getAll: "getAll",
    };

    // 1. Resource Check
    const memoria = memoriaApp.getMemoriesCollection(construct.resource);
    if (!memoria) throw new Error(`Resource ${construct.resource} not found`);

    const method = actionMap[construct.action];
    if (!method) throw new Error(`Invalid action: ${construct.action}`);

    // 2. Determine Raw Input Source
    const rawInput = req.body;

    const processItem = (item: any) => {
      if (construct.action === "get" || construct.action === "remove") {
        if (typeof item === "object") {
          return item.id || item.key || Object.values(item)[0];
        }
        return String(item);
      }
      return item;
    };

    // 3. Execute
    if (construct.action === "getAll") {
      return Array.from(memoria.getAll().values());
    }

    const processed = processItem(rawInput);
    // @ts-ignore
    const res = memoria[method](processed);
    return res ?? processed;
  };

  // =====================================
  // SIMPLEX HTTP
  // =====================================
  // construct was taken on handler creation
  // req was taken on handler call
  public createSimplexForwarHandler = (
    construct: ForwardSource,
    rheosApp: Rheos,
  ) => {
    return async (req: Request, res: Response) => {
      try {
        const fwConfig = construct.config || {};

        const hopByHopHeaders = [
          "connection",
          "keep-alive",
          "transfer-encoding",
          "te",
          "upgrade",
          "proxy-authorization",
          "proxy-authenticate",
          "host",
          "content-length",
        ];

        // 1. Define the type for your headers object
        const headersToForward: Record<string, any> = {};

        // 2. Filter and populate
        Object.keys(req.headers).forEach((key) => {
          if (!hopByHopHeaders.includes(key.toLowerCase())) {
            headersToForward[key] = req.headers[key];
          }
        });

        // 3. Now you can safely add the IP without "implicit any" errors
        if (fwConfig.includeIp) {
          const clientIp = req.ip || "";
          const existingXff = req.headers["x-forwarded-for"];

          headersToForward["x-forwarded-for"] = existingXff
            ? `${existingXff}, ${clientIp}`
            : clientIp;
        }

        const rheosConfig: AxiosCall = {
          name: "ForwardCall",
          // 1. Physical Network Method
          method: "POST",
          endpoint: construct.resource,
          // 2. The Headers Fix (Force TS to accept Express headers, or send undefined)
          headers: fwConfig.forwardHeaders
            ? (headersToForward as Record<string, string>)
            : {
                "Content-Type": "application/json",
              },
          // 3. The Payload Wrapper (Crucial for Simplex Inception!)
          data: {
            id: construct.targetId,
            method: construct.targetMethod,
            data: req.body,
          },
          tryWithSubURL: false,
          absoluteUri: true,
        };

        const mainServerResponse = await rheosApp["performRequest"](rheosConfig, "");

        return mainServerResponse;
      } catch (error: any) {
        const errMsg =
          error.name === "AbortError" ? "Gateway Timeout" : error.message;

        return { status: "Error", message: `Proxy Failed: ${errMsg}` };
      }
    };
  };

  // ========================================
  // STANDARD HTTP
  // ========================================
  public createHttpHandler = (construct: ForwardSource, rheosApp: Rheos) => {
    return async (req: Request, res: Response) => {
      try {
        const methodMap = {
          get: "GET",
          post: "POST",
          put: "PUT",
          delete: "DELETE",
        } as const;

        const fwConfig = construct.config || {};

        const rheosConfig: AxiosCall = {
          name: "ForwardCall",
          // 1. Physical Network Method
          method: methodMap[construct.targetMethod],
          // 2. The Headers Fix (Force TS to accept Express headers, or send undefined)
          headers: fwConfig.forwardHeaders
            ? (req.headers as Record<string, string>)
            : {
                "Content-Type": "application/json",
              },
          // 3. The Payload Wrapper (Crucial for Simplex Inception!)
          data: req.body,
          tryWithSubURL: false,
          absoluteUri: true,
          endpoint: construct.resource,
        };

        const mainServerResponse = rheosApp.executeConfig(rheosConfig);

        // return res.status(mainServerResponse.status).json(responseData);
      } catch (error: any) {
        const errMsg =
          error.name === "AbortError" ? "Gateway Timeout" : error.message;

        const status = error.name === "AbortError" ? 504 : 502;
        return res
          .status(status)
          .json({ status: "Error", message: `Proxy Failed: ${errMsg}` });
      }
    };
  };
}

export default ConstructFactory;
