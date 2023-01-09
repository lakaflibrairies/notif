import http from "http";
import https from "https";
import type { Express } from "express";
import { InitialConfig, Store } from "@lakaflibrairies/state-reactive";

/**
 * @description
 * config parameter contains basic configuration of notification server.
 * It'a an object containing 4 keys
 * - eventPath: it's the path that notification server will use on the starting
 * - requireAuth: it's not actually used but a default value is provided.
 * - keyLength: represents the length of client id.
 * - timeout: represents the time in second from which the client will be disconnected.
 */
type ConfigType = {
  eventPath: string;
  requireAuth?: boolean;
  keyLength?: number;
  timeout: number;
};

export type ClientConfig = {
  id: string;
  name: string | null;
  timeInterval: number | null;
  clientType:
    | "website"
    | "web-app"
    | "mobile-app"
    | "desktop-app"
    | "client-test"
    | "unknown-client";
  status: "registered" | "unknown-client" | "online";
  timestampRegistration: number;
  delay: number | null;
};

export type Server = http.Server | https.Server;

export type IncomingMessage = http.IncomingMessage;

export type Req = IncomingMessage & {
  stores: Record<string, () => Store<any>>;
  infrastructure: {
    credentials?: Record<string, string | number | boolean | JSON>;
    endpoint: string;
    head?: Record<string, string>;
    payload?: Record<string, string | number | boolean | JSON>;
    reserved?: Record<string, string | number | boolean>;
  };
};

export type ServerResponse = http.ServerResponse;

export type Res = ServerResponse & {
  sendSuccessResponse: { (data: Record<string, any>): void };
  sendErrorResponse: { (code: string, message: string): void };
  sendNotification: { (notificationName: string, payload: any): void };
  closeConnection: { (): void };
};

export type Next = {
  (scope?: string): void;
};

export type EmitFunction = { (eventName: string, payload?: any): void };

export type RunHandler = {
  (
    req: Req,
    res: Res,
    options: {
      emitAction: EmitFunction;
    }
  ): void;
};

export type ApplicationMiddleware = {
  (
    req: Req,
    res: Res,
    options: {
      next?: Next;
      emitAction: EmitFunction;
      currentEvent?: string;
    }
  ): void;
};

export type RouterGroupFunction = {
  (router: EventRouterType): void;
};

// export type HandlersType = [...ApplicationMiddleware[], FinalListener];
export type HandlersType = ApplicationMiddleware[];

export type GroupHandlersType = [
  middlewares: ApplicationMiddleware[],
  routerCallback: RouterGroupFunction
];

export type EventRouterType = {
  group: (prefix: string, ...handlers: GroupHandlersType) => EventRouterType;
  listen: (action: string, ...handlers: HandlersType) => EventRouterType;
  emit: (action: string, ...handlers: HandlersType) => EventRouterType;
};

export type EventRouterConfig = {
  run: RunHandler;
  emits: {
    [event: string]: HandlersType;
  };
  listens: {
    [event: string]: HandlersType;
  };
};

export type UseCallbackFunction = (use: UseFunction) => void;

export type UseFunction = (cb: (req: Req, res: Res) => boolean | void) => {
  use: UseFunction;
};

export type ServerCallbackFunction = {
  (options: {
    createStore: (name: string, config: InitialConfig<T>) => Store<T>;
    getStores: () => Record<string, Store<any>>;
    getClients: () => ClientConfig[];
  }): void;
};

export type ApplicationCallbackFunction = {
  (req: IncomingMessage, res: ServerResponse): void;
};

export declare class NotificationServer {
  private timeout: number;
  private timer: NodeJS.Timeout;
  private eventPath: string;
  private requireAuth: boolean;
  private keyLength: number;
  private emits: Record<[event: string], HandlersType>;
  private listens: Record<[event: string], HandlersType>;
  private initialState: { clients: ClientConfig[] };
  private localStore: Store<{ clients: ClientConfig[] }>;
  private stores: Store<any>;
  private uses: Function[];

  constructor(router: EventRouter, config?: ConfigType);

  private loginClient(req: Req): void;
  private logoutClient(req: Req, res: Res): void;
  private startTimer(req: Req, res: Res): void;
  private generateUniqueKey(): string;
  private createStore<T>(name: string, config: InitialConfig<T>): Store<T>;
  private getStores(): Record<string, Store<any>>;
  private getClients(): ClientConfig[];
  private next: Next;
  private messageController(req: Req, res: Res): Promise<void>;
  private notificationController(req: Req, res: Res): Promise<void>;

  /**
   * @param options - It's an optional object that contains two keys functions
   * @documentation
   * ```md
   *    options contains two optionals keys functions
   *    - serverCallback : this function  can be used to create some elements in the application like a store.
   *      It provides one object as argument that contains three keys functions
   *        - createStore : used to create store in application
   *        - getStores : used to get all created stores
   *        - getClients : used to get all registered clients
   *    - appCallback : this function can be used to inject another application such as expressjs application
   * ```
   * @use
   * ```js
   * const { NotificationServer, EventRouter } = require("@lakaflibrairies/notif");
   *
   * const routes = new EventRouter();
   * // You can define listen and emit routes by calling them on routes.
   * routes.listen("listen-action", (req, res) => {
   *   res.sendSuccessResponse("Done !");
   * });
   *
   * const server = new NotificationServer(routes);
   *
   * function serverCallback({ createStore, getClients, getStores }) {
   *    createStore("store-name", {
   *      state: {},
   *      mutations: {},
   *      actions: {}
   *    });
   *
   *    console.log(getStores());
   *    console.log(getClients());
   * }
   *
   * server.connect({ serverCallback }).listen(3456, () => {
   *    console.log("Server starts on port 3456");
   * })
   * ```
   * @returns Returns a http server instance..
   */
  public createServer(options?: {
    serverCallback?: ServerCallbackFunction;
    appCallback?: ApplicationCallbackFunction;
    useCallback?: UseCallbackFunction;
  }): Server;

  public useExpressApp(
    application: Express,
    options?: {
      serverCallback?: ServerCallbackFunction;
      useCallback?: UseCallbackFunction;
    }
  ): void;
}

export declare class EventRouter {
  private journal: EventRouterConfig;

  constructor();

  /**
   * @param action - Action to listen
   * @param handlers - Handlers list to execute when action is listened
   * @returns Returns an EventRouterType object.
   */
  public listen(action: string, ...handlers: HandlersType): EventRouterType;

  /**
   * @param action - Action to emit
   * @param handlers - Handlers list to execute when action is emitted
   * @returns Returns an EventRouterType object.
   */
  public emit(action: string, ...handlers: HandlersType): EventRouterType;

  /**
   * @param prefix - Prefix to use to group listen and emit routes
   * @param handlers - Handlers list to execute on each grouped routes
   * @returns Returns an EventRouterType object.
   */
  public group(prefix: string, ...handlers: GroupHandlersType): EventRouterType;

  public run(handler: RunHandler): EventRouterType;

  /**
   * @returns Returns a router journal.
   */
  public get journal(): EventRouterConfig;
}
