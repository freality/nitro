import "#nitro-internal-pollyfills";
import { withQuery } from "ufo";
import { useNitroApp } from "nitro/runtime";
import { normalizeLambdaOutgoingHeaders } from "./_utils";

import type { StreamingResponse } from "@netlify/functions";
import type { Readable } from "node:stream";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";

const nitroApp = useNitroApp();

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream, context) => {
    const query = {
      ...event.queryStringParameters,
    };
    const url = withQuery(event.rawPath, query);
    const method = event.requestContext?.http?.method || "get";

    const headers = new Headers();
    for (const [key, value] of Object.entries(event.headers)) {
      if (value) {
        headers.set(key, value);
      }
    }
    if ("cookies" in event && event.cookies) {
      for (const cookie of event.cookies) {
        headers.append("cookie", cookie);
      }
    }

    const response = await nitroApp.fetch(url, {
      h3: { _platform: { aws: { event, context } } },
      method,
      headers,
      body: event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf8")
        : event.body,
    });

    const isApiGwV2 = "cookies" in event || "rawPath" in event;
    const cookies = response.headers.getSetCookie();
    const httpResponseMetadata: Omit<StreamingResponse, "body"> = {
      statusCode: response.status,
      ...(cookies.length > 0 && {
        ...(isApiGwV2
          ? { cookies }
          : { multiValueHeaders: { "set-cookie": cookies } }),
      }),
      headers: {
        ...normalizeLambdaOutgoingHeaders(
          response.headers,
          true /* stripCookies */
        ),
        "Transfer-Encoding": "chunked",
      },
    };

    if (response.body) {
      const writer = awslambda.HttpResponseStream.from(
        responseStream,
        httpResponseMetadata
      );
      const reader = response.body.getReader();
      await streamToNodeStream(reader, responseStream);
      writer.end();
    }
  }
);

async function streamToNodeStream(
  reader: Readable | ReadableStreamDefaultReader,
  writer: NodeJS.WritableStream
) {
  let readResult = await reader.read();
  while (!readResult.done) {
    writer.write(readResult.value);
    readResult = await reader.read();
  }
  writer.end();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace awslambda {
    // https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html
    function streamifyResponse(
      handler: (
        event: APIGatewayProxyEventV2,
        responseStream: NodeJS.WritableStream,
        context: Context
      ) => Promise<void>
    ): any;

    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace HttpResponseStream {
      function from(
        stream: NodeJS.WritableStream,
        metadata: {
          statusCode: APIGatewayProxyStructuredResultV2["statusCode"];
          headers: APIGatewayProxyStructuredResultV2["headers"];
        }
      ): NodeJS.WritableStream;
    }
  }
}
