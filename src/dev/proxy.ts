import type { TLSSocket } from "node:tls";
import type { ProxyServerOptions, ProxyServer } from "httpxy";
import type { H3Event } from "h3";

import { createProxyServer } from "httpxy";
import { createError, fromNodeHandler } from "h3";

export type HTTPProxy = {
  proxy: ProxyServer;
  handleEvent: (event: H3Event, opts?: ProxyServerOptions) => any;
};

export function createHTTPProxy(defaults: ProxyServerOptions = {}): HTTPProxy {
  const proxy = createProxyServer(defaults);

  proxy.on("proxyReq", (proxyReq, req) => {
    if (!proxyReq.hasHeader("x-forwarded-for")) {
      const address = req.socket.remoteAddress;
      if (address) {
        proxyReq.appendHeader("x-forwarded-for", address);
      }
    }
    if (!proxyReq.hasHeader("x-forwarded-port")) {
      const localPort = req?.socket?.localPort;
      if (localPort) {
        proxyReq.setHeader("x-forwarded-port", req.socket.localPort);
      }
    }
    if (!proxyReq.hasHeader("x-forwarded-Proto")) {
      const encrypted = (req?.connection as TLSSocket)?.encrypted;
      proxyReq.setHeader("x-forwarded-proto", encrypted ? "https" : "http");
    }
  });

  return {
    proxy,
    async handleEvent(event, opts) {
      try {
        await fromNodeHandler((req, res) => proxy.web(req, res, opts))(event);
      } catch (error: any) {
        event.response.setHeader("refresh", "3");
        throw createError({
          statusCode: 503,
          message: "Dev server is unavailable.",
          cause: error,
        });
      }
    },
  };
}
