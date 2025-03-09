import { promises as fsp } from "node:fs";
import { defineNitroPreset } from "../_utils/preset";
import { dirname, resolve } from "pathe";
import type { PackageJson } from "pkg-types";

const edgio = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
    commands: {
      deploy: "cd ./ && npm run deploy",
      preview: "cd ./ && npm run preview",
    },
    hooks: {
      async compiled(nitro) {
        /**
         * Output directory structure:
         * | .edgio (generated by Edgio CLI)
         * | edgio/prod.js
         * | public/*
         * | server/*
         * | edgio.config.js
         * | package.json
         * | routes.js
         */

        // Write edgio.config.js
        await writeFile(
          resolve(nitro.options.output.dir, "edgio.config.js"),
          `module.exports = ${JSON.stringify(
            {
              connector: "./edgio",
              routes: "./routes.js",
              backends: {},
              includeFiles: {
                "server/**": true,
              },
            },
            null,
            2
          )}`
        );

        // Write routes.js
        await writeFile(
          resolve(nitro.options.output.dir, "routes.js"),
          `
import { Router } from '@edgio/core/router'
import { isProductionBuild } from '@edgio/core/environment'

const router = new Router()

if (isProductionBuild()) {
  router.static('public')
}

router.fallback(({ renderWithApp }) => { renderWithApp() })

export default router
    `.trim()
        );

        // Write edgio/prod.js
        await writeFile(
          resolve(nitro.options.output.dir, "edgio/prod.js"),
          `
module.exports = async function entry (port) {
  process.env.PORT = process.env.NITRO_PORT = port.toString()
  console.log('Starting Edgio server on port', port)
  await import('../server/index.mjs')
  console.log('Edgio server started')
}
      `.trim()
        );

        // Write and prepare package.json for deployment
        await writeFile(
          resolve(nitro.options.output.dir, "package.json"),
          JSON.stringify(
            <PackageJson>{
              name: "nitro-edgio-output",
              version: "1.0.0",
              private: true,
              scripts: {
                build: "npm i && edgio build",
                deploy: "npm i && edgio deploy",
                start: "npm i && edgio run --production",
                preview: "npm i && edgio build && edgio run --production",
              },
              devDependencies: {
                "@edgio/cli": "^6",
                "@edgio/core": "^6",
              },
            },
            null,
            2
          )
        );
        await writeFile(
          resolve(nitro.options.output.dir, "package-lock.json"),
          ""
        );
      },
    },
  },
  {
    name: "edgio" as const,
    url: import.meta.url,
  }
);

export default [edgio] as const;

async function writeFile(path: string, contents: string) {
  await fsp.mkdir(dirname(path), { recursive: true });
  await fsp.writeFile(path, contents, "utf8");
}
