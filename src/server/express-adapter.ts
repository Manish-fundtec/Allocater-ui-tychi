import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { Express } from "express";

function headerEntries(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function toResponseHeaders(headers: NodeJS.Dict<number | string | string[]>): Headers {
  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) responseHeaders.append(key, String(item));
    } else {
      responseHeaders.set(key, String(value));
    }
  }
  return responseHeaders;
}

/** Run the Express app inside this Next.js process and return a Web Response. */
export function callExpress(app: Express, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const socket = new Socket();

  const req = new IncomingMessage(socket);
  req.method = request.method;
  req.url = `${url.pathname}${url.search}`;
  req.headers = headerEntries(request.headers);
  req.httpVersion = "1.1";
  req.httpVersionMajor = 1;
  req.httpVersionMinor = 1;

  const res = new ServerResponse(req);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const finish = (chunk?: unknown) => {
      if (settled) return;
      settled = true;
      if (chunk != null && chunk !== "" && typeof chunk !== "function") {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      const status = res.statusCode || 200;
      const body =
        status === 204 || status === 304 || chunks.length === 0
          ? null
          : Buffer.concat(chunks);
      resolve(
        new Response(body, {
          status,
          headers: toResponseHeaders(res.getHeaders()),
        }),
      );
    };

    res.write = ((chunk: unknown) => {
      if (chunk != null && chunk !== "") {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return true;
    }) as ServerResponse["write"];

    res.end = ((chunk?: unknown) => {
      finish(chunk);
      return res;
    }) as ServerResponse["end"];

    res.on("error", reject);
    req.on("error", reject);

    const forward = async () => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        const body = Buffer.from(await request.arrayBuffer());
        if (body.length > 0) {
          req.headers["content-length"] = String(body.length);
          req.push(body);
        }
      }
      req.push(null);
      app(req, res);
    };

    forward().catch(reject);
  });
}
