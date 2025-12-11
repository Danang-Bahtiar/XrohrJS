export interface AxiosResult {
  success: boolean;
  data?: any;
  error?: any;
}

/**
 * AxiosCall interface for configuring HTTP requests.
 * @interface AxiosCall
 * @property {string} name - The name of the Axios call configuration (ensure this to be unique!).
 * @property {("GET" | "POST" | "PUT" | "DELETE")} method - The HTTP method to be used.
 * @property {string} endpoint - The endpoint URL for the request.
 * @property {any} [data] - The data to be sent with the request (for POST and PUT methods).
 * @property {Record<string, string>} [headers] - Optional headers to include in the request.
 * @property {number} [timeout] - Optional timeout for the request in milliseconds.
 * @property {number} [priority] - Optional priority level for the request (1 = highest, advised to be reserved for and only for health check of the endpoint).
 */
export interface AxiosCall {
    name: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    endpoint: string;
    data?: any | (() => any | Promise<any>);
    headers?: Record<string, string>;
    timeout?: number;
    priority?: number;
    tryWithSubURL: boolean;
    onResponse?: (result: AxiosResult) => void | Promise<void>;
}