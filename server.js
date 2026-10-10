const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIRECTORY = path.join(ROOT, "data");
const MAX_BODY_SIZE = 10 * 1024;
const publicFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/script.js", "script.js"],
  ["/photo.jpg", "photo.jpg"],
]);
const imageContentTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

function serveStaticFile(request, response) {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { error: "Invalid URL." });
    return;
  }
  let publicFile = publicFiles.get(decodedPath);
  let contentType;

  if (decodedPath.startsWith("/images/")) {
    const imageName = decodedPath.slice("/images/".length);
    const extension = path.extname(imageName).toLowerCase();
    if (
      imageName === path.basename(imageName) &&
      /^[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:jpe?g|png|webp)$/i.test(imageName)
    ) {
      publicFile = path.join("images", imageName);
      contentType = imageContentTypes.get(extension);
    }
  }

  if (!publicFile) {
    sendJson(response, 404, { error: "Page not found." });
    return;
  }
  const filePath = path.join(ROOT, publicFile);

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") {
        sendJson(response, 404, { error: "Page not found." });
        return;
      }

      console.error("Unable to read website file:", error);
      sendJson(response, 500, { error: "Unable to load this page." });
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentType || contentTypes[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;

    request.on("data", (chunk) => {
      if (tooLarge) {
        return;
      }

      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_SIZE) {
        tooLarge = true;
        reject(Object.assign(new Error("Message is too large."), { statusCode: 413 }));
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function cleanField(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
}

async function handleContactRequest(request, response) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    sendJson(response, 415, { error: "Send your message as JSON." });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch (error) {
    if (error.statusCode === 413) {
      if (!response.destroyed) {
        sendJson(response, 413, { error: "Your message is too large." });
      }
      return;
    }

    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Please submit a valid message." });
      return;
    }

    console.error("Unable to receive contact request:", error);
    if (!response.destroyed) {
      sendJson(response, 400, { error: "Unable to read your message." });
    }
    return;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    sendJson(response, 400, { error: "Please submit a valid message." });
    return;
  }

  const name = cleanField(payload.name, 100);
  const email = cleanField(payload.email, 254);
  const message = cleanField(payload.message, 3000);
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!name || !emailIsValid || message.length < 10) {
    sendJson(response, 400, {
      error: "Add your name, a valid email address, and a message of at least 10 characters.",
    });
    return;
  }

  try {
    await fs.promises.mkdir(DATA_DIRECTORY, { recursive: true });
    await fs.promises.appendFile(
      path.join(DATA_DIRECTORY, "contact-messages.jsonl"),
      `${JSON.stringify({ name, email, message, receivedAt: new Date().toISOString() })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  } catch (error) {
    console.error("Unable to save contact request:", error);
    sendJson(response, 500, { error: "Your message could not be saved. Please try again later." });
    return;
  }

  sendJson(response, 201, { message: "Thanks for reaching out. Your message has been sent." });
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/contact")) {
    if (request.method !== "POST" || new URL(request.url, `http://${request.headers.host}`).pathname !== "/api/contact") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    handleContactRequest(request, response).catch((error) => {
      console.error("Unexpected contact form error:", error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Something went wrong. Please try again later." });
      }
    });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  serveStaticFile(request, response);
});

server.listen(PORT, () => {
  console.log(`Portfolio website running at http://localhost:${PORT}`);
});
