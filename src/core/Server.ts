import express, { Application } from "express";

/**
 * Wrapper class for the Express application.
 * Handles the initialization, routing, and lifecycle of the HTTP server.
 */
class Server {
  private expressApp: Application;

  constructor() {
    this.expressApp = express();
  }

  /**
   * Starts the Express server and listens for incoming connections.
   * * @param {number} port - The network port to bind the server to.
   * @param {() => void} [callback] - Optional callback function executed immediately after the server successfully starts listening.
   */
  public listen = (port: number, callback?: () => void) => {
    this.expressApp.listen(port, () => {
      if (callback) {
        callback();
      }
    });
  };

  /**
   * Registers a GET route on the Express application.
   * * @param {string} path - The URL path for the route (e.g., '/api/data').
   * @param {any[]} handlersChain - An array of Express middleware and the final route handler.
   */
  public get = (path: string, handlersChain: any[]) => {
    this.expressApp.get(path, ...handlersChain);
  };

  /**
   * Registers a POST route on the Express application.
   * * @param {string} path - The URL path for the route (e.g., '/api/data').
   * @param {any[]} handlersChain - An array of Express middleware and the final route handler.
   */
  public post = (path: string, handlersChain: any[]) => {
    this.expressApp.post(path, ...handlersChain);
  };

  /**
   * Registers a PUT route on the Express application.
   * * @param {string} path - The URL path for the route (e.g., '/api/data').
   * @param {any[]} handlersChain - An array of Express middleware and the final route handler.
   */
  public put = (path: string, handlersChain: any[]) => {
    this.expressApp.put(path, ...handlersChain);
  };

  /**
   * Registers a DELETE route on the Express application.
   * * @param {string} path - The URL path for the route (e.g., '/api/data').
   * @param {any[]} handlersChain - An array of Express middleware and the final route handler.
   */
  public delete = (path: string, handlersChain: any[]) => {
    this.expressApp.delete(path, ...handlersChain);
  };

  /**
   * Retrieves the raw, underlying Express application instance.
   * Useful for passing the app to third-party modules or global handlers.
   * * @returns {Application} The instantiated Express app object.
   */
  public getApp = (): Application => {
    return this.expressApp;
  };
}

export default Server;
