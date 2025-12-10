import express, { Application } from "express";

class Server {
  private expressApp: Application;

  constructor() {
    this.expressApp = express();
  }

  public listen = (port: number, p0?: () => void) => {
    this.expressApp.listen(port, () => {
      console.log(`Service running on http://localhost:${port}`);
    });
  };

  public get = (path: string, handlersChain: any[]) => {
    this.expressApp.get(path, ...handlersChain)
  }

  public post = (path: string, handlersChain: any[]) => {
    this.expressApp.post(path, ...handlersChain)
  }

  public put = (path: string, handlersChain: any[]) => {
    this.expressApp.put(path, ...handlersChain)
  }

  public delete = (path: string, handlersChain: any[]) => {
    this.expressApp.delete(path, ...handlersChain)
  }

  public getApp = () => {
    return this.expressApp;
  }
}

export default Server;
