import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

import { onRequest } from "firebase-functions/v2/https";
import { toNodeListener } from "h3";

const nitroApp = useNitroApp();

// TODO: add options support back using virtual template
const firebaseConfig = {} as any;

export const __firebaseServerFunctionName__ = onRequest(
  {
    // Must be set to public to allow all public requests by default
    invoker: "public",
    ...firebaseConfig.httpsOptions,
  },
  toNodeListener(nitroApp.h3App)
);
