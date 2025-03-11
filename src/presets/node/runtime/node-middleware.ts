import "#nitro-internal-pollyfills";
import { toNodeHandler } from "srvx/node";
import { useNitroApp } from "nitro/runtime";
import {
  startScheduleRunner,
  trapUnhandledNodeErrors,
} from "nitro/runtime/internal";

const nitroApp = useNitroApp();

export const middleware = toNodeHandler(nitroApp.h3App.fetch);

/** @experimental */
export const websocket = import.meta._websocket
  ? nitroApp.h3App.websocket
  : undefined;

// Trap unhandled errors
trapUnhandledNodeErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
