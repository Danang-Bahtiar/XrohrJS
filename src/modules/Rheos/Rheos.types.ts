export interface AxiosResult {
  success: boolean;
  data?: any;
  error?: any;
}

/**
 * Configuration options for how an Axios call is distributed and handled across the edge network.
 * @param type - The strategy for selecting which nodes to call: "primary" (default) calls the primary node, "random" calls a random node, and "all" calls all nodes.
 * @note The "all" strategy will execute the call on all available nodes once and only once. ignoring the onFail and maxRetries options. Use with caution as it may lead to increased load and potential performance issues if there are many nodes.
 * @param onFail - The strategy for handling failures: "retry" (default) retries the call, "fallback" calls the next available node in edgeNode.mainUrls or mainNode.edgeUrls, and "ignore" ignores the failure.
 * @param maxRetries - The maximum number of retries if the onFail strategy is set to "retry". Default is 3.
 * @param retryDelay - The delay in milliseconds between retries if the onFail strategy is set to "retry". Default is 1000ms.
 * @param timeout - The maximum time in milliseconds to wait for a response before considering the call as failed. Default is 5000ms.
 */
export interface CallStrategyOptions {
    type?: "primary" | "random" | "all";
    onFail?: "retry" | "fallback" | "ignore";
    maxRetries?: number; 
    retryDelay?: number;
    timeout?: number;
}

/**
 * Defines a managed HTTP request task with built-in orchestration, reliability strategies, and response handling.
 * This interface allows you to specify the HTTP method, endpoint, request body, headers, and how the call should be distributed across the edge network. It also provides options for handling responses and failures in a flexible manner.
 * @param name - A unique name for the Axios call, used for identification and logging purposes.
 * @param method - The HTTP method to use for the request (GET, POST, PUT, DELETE).
 * @param endpoint - The URL or path to which the request should be sent. If absoluteUri is false, this will be treated as a relative path appended to the base URL of the target node.
 * @param body - The request payload, which can be a static value or a function that returns the payload (synchronously or asynchronously). This allows for dynamic generation of the request body at the time of the call. (this will goes into req.body of the receiving node)
 * @param headers - An optional object containing HTTP headers to include in the request.
 * @param absoluteUri - A boolean flag indicating whether the endpoint is an absolute URI (true) or a relative path (false). If false, the endpoint will be combined with the base URL of the target node. if true, the endpoint will be used as-is without modification and ignoring any urls in the edgeNode.mainUrls or mainNode.edgeUrls list.
 * @param strategy - An optional object specifying the call strategy for distribution and failure handling across the edge network.
 * @param onResponse - An optional callback function that will be invoked with the result of the Axios call, allowing for custom handling of the response data or errors.
 * @description This interface is designed to work within a distributed edge network, where calls may need to be orchestrated across multiple nodes with varying reliability. The strategy options provide flexibility in how calls are routed and how failures are managed, making it suitable for complex applications that require robust communication between nodes.
 */
export interface AxiosCall {
    name: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    endpoint: string;
    body?: any | (() => any | Promise<any>);
    headers?: Record<string, string>;
    absoluteUri: boolean;
    strategy?: CallStrategyOptions; // Grouped options
    onResponse?: (result: AxiosResult) => void | Promise<void>;
}