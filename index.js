const { Store } = require("@lakaflibrairies/state-reactive");
const {
  parseBody,
  parseQueryParams,
  successResponse,
  errorResponse,
  generateKey,
  generateNotification,
} = require("./tools");

function NotificationServer(router, config = null) {
  if (!(router instanceof EventRouter)) {
    throw new Error("Router must be an EventRouter instance.");
  }
  const {
    eventPath = "notifications",
    requireAuth = false,
    keyLength = 10,
    timeout = 10, // in ms : milliseconds
  } = config || {};

  if (
    typeof eventPath !== "string" ||
    eventPath === "/" ||
    eventPath.startsWith("/") ||
    eventPath.includes(" ") ||
    eventPath.length === 0 ||
    /\s/.test(eventPath)
  ) {
    throw new Error("Invalid route.");
  }

  if (
    typeof keyLength !== "number" ||
    keyLength < 10 ||
    !Number.isInteger(keyLength)
  ) {
    throw new Error("keyLength must be an integer greater than 9.");
  }

  const timer = null;
  const { emits, listens, run } = router.journal();
  const initialState = {
    clients: [],
  };
  const localStore = new Store({
    state: initialState,
    mutations: {
      saveClient(state, client) {
        state.clients.push(client);
        return state;
      },
      updateClient(state, { clientId, newValues }) {
        const clientIndex = state.clients.findIndex(
          (item) => item.id === clientId
        );
        if (clientIndex === -1) {
          return state;
        }
        state.clients[clientIndex] = {
          ...state.clients[clientIndex],
          ...newValues,
        };
        return state;
      },
      deleteClient(state, clientId) {
        const clientIndex = state.clients.findIndex(
          (item) => item.id === clientId
        );
        if (clientIndex === -1) {
          return state;
        }
        state.clients.splice(clientIndex, 1);
        return state;
      },
      clean(state) {
        state.clients = [];
        return state;
      },
      logoutClient(state, clientId) {
        const clientIndex = state.clients.findIndex(
          (client) => client.id === clientId
        );
        state.clients[clientIndex].status = "registered";
        return state;
      },
      loginClient(state, clientId) {
        const clientIndex = state.clients.findIndex(
          (client) => client.id === clientId
        );
        state.clients[clientIndex].status = "online";
        return state;
      },
    },
    actions: {
      saveClient({ commit }, client) {
        return new Promise((resolve, reject) => {
          commit("saveClient", client);
          resolve();
        });
      },
      updateClient({ commit }, { clientId, newValues }) {
        return new Promise((resolve, reject) => {
          commit("updateClient", { clientId, newValues });
          resolve();
        });
      },
      deleteClient({ commit }, clientId) {
        return new Promise((resolve, reject) => {
          commit("deleteClient", clientId);
          resolve();
        });
      },
      clean({ commit }) {
        return new Promise((resolve, reject) => {
          commit("clean");
          resolve();
        });
      },
      logoutClient({ commit }, clientId) {
        return new Promise((resolve, reject) => {
          commit("logoutClient", clientId);
          resolve();
        });
      },
      loginClient({ commit }, clientId) {
        return new Promise((resolve, reject) => {
          commit("loginClient", clientId);
          resolve();
        });
      },
    },
    empty: [],
  });
  const uses = [];

  localStore.listenAction("update-client", (payload) => {
    const { clientId, newValues } = payload;
    localStore.dispatch("updateClient", { clientId, newValues });
  });

  const stores = {};

  const generateUniqueKey = () => {
    let key = generateKey(keyLength);

    const isBusy = (k) => {
      return localStore.snapshot.clients.map((client) => client.id).includes(k);
    };

    while (isBusy(key)) {
      key = generateKey(keyLength);
    }

    return key;
  };

  const createStore = (name, config) => {
    if (!/^[a-zA-Z_][0-9a-zA-Z_]+$/.test(name)) {
      throw new Error("Invalid name of store.");
    }
    if (name in stores) {
      throw new Error(
        "Store already exists. Use another name for create your store."
      );
    }

    stores[name] = new Store(config);

    return stores[name];
  };

  const getStores = () => {
    return stores;
  };

  const getClients = () => {
    return localStore.snapshot.clients;
  };

  const next = (scope = "") => {
    localStore.emit(scope + "next");
  };

  const loginClient = (req) => {
    const { clientId } = req.infrastructure.reserved;
    localStore.dispatch("loginClient", clientId);
  };

  const logoutClient = (req, res) => {
    const { clientId } = req.infrastructure.reserved;
    localStore.dispatch("logoutClient", clientId).then(() => {
      res.closeConnection();
    });
  };

  const startTimer = (req, res) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => logoutClient(req, res), timeout * 1000);
  };

  const messageController = async (req, res) => {
    const bodyPayload = await parseBody(req);
    const { credentials, endpoint, head, payload, reserved } = bodyPayload;

    if (typeof endpoint !== "string") {
      res.sendErrorResponse("ENDPOINT-ERROR", "Not found endpoint.");
      return;
    }

    req.infrastructure = { credentials, endpoint, head, payload, reserved };

    if (endpoint in listens) {
      const handlers = listens[endpoint];
      handlers.reverse();
      const [finalListener, ...middlewares] = handlers;
      middlewares.reverse();

      if (middlewares.length !== 0) {
        let index = 0;
        localStore.listenAction(`local-event@${event}--next`, () => {
          index++;
        });

        for (let i = 0; i === index; i++) {
          await middlewares[i](req, res, {
            next: () => next(`local-event@${event}--next`),
            emitAction: localStore.emit,
          });
        }

        if (index !== middlewares.length) {
          return;
        }
      }

      finalListener(req, res, {
        emitAction: localStore.emit,
      });
    } else {
      return res.sendErrorResponse("ENDPOINT-ERROR", "Not found endpoint.");
    }
  };

  const notificationController = async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const queryParams = parseQueryParams(req);
    const { messageHead, client } = queryParams;

    if (typeof messageHead !== "string" || messageHead !== "alive") {
      res.statusCode = 500;
      res.write("Invalid message head");
      res.end();
      return;
    }

    res.statusCode = 200;

    // Event test
    res.sendNotification("hello", { message: "hi" });

    if (client === "default") {
      const clientId = generateUniqueKey();
      await localStore.dispatch("saveClient", {
        id: clientId,
        name: "client-" + Date.now(),
        timeInterval: null,
        clientType: "unknown-client",
        status: "unknown-client",
        timestampRegistration: Date.now(),
        delay: null,
      });
      res.sendNotification("reconnection-required", { clientId });
      res.end();
      return;
    }

    const findClient = localStore.snapshot.clients.filter(
      (c) => c.id === client
    )[0];
    if (!findClient) {
      res.sendNotification("reset-connection-required", {
        clientId: "default",
      });
      res.end();
      return;
    } else {
      loginClient(req);
    }

    req.infrastructure = { reserved: { clientId: client } };

    const emittedEvents = Object.keys(emits);

    for (let event of emittedEvents) {
      localStore.listenAction(event, async () => {
        emits[event].reverse();
        const [finalListener, ...middlewares] = emits[event];
        middlewares.reverse();

        if (middlewares.length !== 0) {
          let index = 0;
          localStore.listenAction(`local-event@${event}--next`, () => {
            index++;
          });

          for (let i = 0; i === index; i++) {
            await middlewares[i](req, res, {
              currentEvent: event,
              next: () => next(`local-event@${event}--next`),
              emitAction: localStore.emit,
            });
          }

          if (index !== middlewares.length) {
            return;
          }
        }

        finalListener(req, res, {
          currentEvent: event,
          emitAction: localStore.emit,
        });
      });
    }

    typeof run === "function" && run(req, res, { emitAction: localStore.emit });

    startTimer(req, res);

    localStore.listenAction("restart-timeout", () => {
      startTimer(req, res);
    });
  };

  const use = (cb) => {
    if (typeof cb !== "function") {
      throw new Error("use callback must be a function.");
    }
    uses.push(cb);
    return { use };
  };

  const refactor = (req, res, { useCallback, p, computedPath }) => {
    res.sendSuccessResponse = (data) => {
      res.statusCode = 200;
      res.write(successResponse(data));
      res.end();
    };

    res.sendErrorResponse = (code, message) => {
      res.statusCode = 200;
      res.write(errorResponse({ code, message }));
      res.end();
    };

    res.sendNotification = (notificationName, payload) => {
      res.write(generateNotification({ notificationName, payload }));
    };

    res.closeConnection = () => {
      res.end();
    };

    if (typeof useCallback === "function") {
      useCallback(use);
    }

    req.stores = {};
    for (let item in stores) {
      req.stores[item] = () => stores[item];
    }

    if (uses.length !== 0) {
      let runNext = true;
      for (let iterator = 0; runNext && iterator < uses.length; iterator++) {
        runNext = uses[iterator](req, res);

        if (runNext && typeof runNext !== "boolean") {
          throw new Error(
            "Use callback must return a boolean or be a void function."
          );
        }

        runNext = runNext === undefined ? true : runNext;
      }

      if (!runNext) return;
    }

    if (!["POST", "GET"].includes(req.method)) {
      res.statusCode = 200;
      res.write(
        errorResponse({
          code: "METHOD-ERROR",
          message: "Cannot " + req.method,
        })
      );
      res.end();
      return;
    }

    if (p !== computedPath + "/notify-me") {
      res.statusCode = 200;
      res.write(
        errorResponse({
          code: "ENDPOINT-ERROR",
          message: "Not found endpoint.",
        })
      );
      res.end();
      return;
    }

    if (req.method === "GET") {
      notificationController(req, res);
      return;
    }

    messageController(req, res);
    return;
  };

  const createServer = (options = undefined) => {
    const {
      serverCallback = undefined,
      useCallback = undefined,
      appCallback = undefined,
    } = options || {};
    const computedPath = "/" + eventPath;

    if (serverCallback && typeof serverCallback !== "function") {
      throw new Error("serverCallback must be a function");
    }
    typeof serverCallback === "function" &&
      serverCallback({ createStore, getStores, getClients });

    const server = require("http").createServer((req, res) => {
      const [p, q] = req.url.split("?");

      if (!p.startsWith(computedPath)) {
        typeof appCallback === "function" && appCallback(req, res);
        return;
      }

      refactor(req, res, { useCallback, p, computedPath });
    });

    return server;
  };

  const useExpressApp = (
    /** @type { import("express").Express } */ application,
    options = undefined
  ) => {
    const { serverCallback = undefined, useCallback = undefined } =
      options || {};
    const computedPath = "/" + eventPath;

    if (serverCallback && typeof serverCallback !== "function") {
      throw new Error("serverCallback must be a function");
    }
    typeof serverCallback === "function" &&
      serverCallback({ createStore, getStores, getClients });

    application.use(computedPath, (req, res, next) => {
      const [p, q] = req.url.split("?");

      if (!p.startsWith(computedPath)) {
        next();
        return;
      }

      refactor(req, res, { useCallback, p, computedPath });
    });
  };

  Object.defineProperty(this, "createServer", {
    writable: false,
    value: createServer,
  });

  Object.defineProperty(this, "useExpressApp", {
    writable: false,
    value: useExpressApp,
  });
}

function EventRouter() {
  const journal = {
    run: null,
    emits: {},
    listens: {
      "reconnection-required": [
        (req, res, { emitAction }) => {
          const {
            clientId,
            clientType = "unknown-client",
          } = req.infrastructure.payload;

          if (
            !clientId ||
            ![
              "website",
              "web-app",
              "mobile-app",
              "desktop-app",
              "client-test",
            ].includes(clientType)
          ) {
            return res.sendErrorResponse("DATA-ERROR", "Invalid data.");
          }
          emitAction("update-client", {
            clientId,
            newValues: {
              clientType,
              timeInterval,
            },
          });
          res.sendSuccessResponse(clientId);
        },
      ],
      "hi": [
        (req, res, { emitAction }) => {
          const {
            clientId,
            clientType = "unknown-client",
          } = req.infrastructure.payload;

          if (
            !clientId ||
            ![
              "website",
              "web-app",
              "mobile-app",
              "desktop-app",
              "client-test",
            ].includes(clientType)
          ) {
            return res.sendErrorResponse("DATA-ERROR", "Invalid data.");
          }

          emitAction("restart-timeout");
          res.sendSuccessResponse("Done");
        }
      ]
    },
  };

  const run = (handler) => {
    if (typeof handler !== "function") {
      throw new Error("Run handler must be a function handler.");
    }
    journal.run = handler;
    return {
      listen,
      emit,
      group,
    };
  };

  const listen = (action, ...handlers) => {
    const verifyHandlersType = handlers.map((h) => typeof h === "function");

    if (verifyHandlersType.includes(false)) {
      throw new Error("Handler must be a handler function.");
    }

    journal.listens[action] = handlers;
    return {
      listen,
      emit,
      group,
    };
  };

  const emit = (action, ...handlers) => {
    const verifyHandlersType = handlers.map((h) => typeof h === "function");

    if (verifyHandlersType.includes(false)) {
      throw new Error("Handler must be a handler function.");
    }

    journal.emits[action] = handlers;
    return {
      listen,
      emit,
      group,
    };
  };

  const group = (prefix, ...handlers) => {
    if (typeof prefix !== "string" || prefix === "") {
      throw new Error("Argument prefix of group must be a not empty string.");
    }

    const [middlewares, routerCallback] = handlers;

    if (!Array.isArray(middlewares)) {
      throw new Error(
        "Invalid group signature. middleware argument must be an array containing ApplicationMiddleware."
      );
    }

    if (middlewares.map((f) => typeof f === "function").includes(false)) {
      throw new Error(
        "Invalid middleware item in middlewares argument. Middleware item must be a ApplicationMiddleware."
      );
    }

    const routeBuilder = {
      listen: (action, ...subHandlers) => {
        listen(`${prefix}/${action}`, ...middlewares, ...subHandlers);
        return routeBuilder;
      },
      emit: (action, ...subHandlers) => {
        emit(`${prefix}/${action}`, ...middlewares, ...subHandlers);
        return routeBuilder;
      },
      group: (action, ...subHandlers) => {
        group(`${prefix}/${action}`, ...middlewares, ...subHandlers);
        return routeBuilder;
      },
    };
    routerCallback(routeBuilder);
    return { listen, emit, group };
  };

  Object.defineProperty(this, "run", {
    writable: false,
    value: run,
  });
  Object.defineProperty(this, "listen", {
    writable: false,
    value: listen,
  });
  Object.defineProperty(this, "emit", {
    writable: false,
    value: emit,
  });
  Object.defineProperty(this, "group", {
    writable: false,
    value: group,
  });
  Object.defineProperty(this, "journal", {
    writable: false,
    value: () => journal,
  });
}

exports.NotificationServer = NotificationServer;
exports.EventRouter = EventRouter;
