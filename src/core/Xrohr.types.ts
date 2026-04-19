import { moduleName, serviceName } from "../config/Xrohr.config.js";

export interface NodeManifest {
    id: string;
    type: "main" | "edge";
    version: string;
    baseUrl: string;
    modules: moduleName[];
    services: serviceName[];
    defaultConfig?: {
        allowHydrateAPI?: boolean;
        allowHydrateMemories?: boolean;
        autoHydrateAPI?: boolean;
        autoHydrateMemories?: boolean;
    }
}