#!/usr/bin/env node
// Headless Firefox driven over WebDriver BiDi, usable inside the Claude Code sandbox.
// Usage: node bin/bidi.mjs <url> [step ...]
// Steps run in order:
//   shot:<file.png>   screenshot of the viewport
//   click:<x>,<y>     real pointer click at viewport coordinates
//   wait:<ms>         sleep
//   <js expression>   evaluated in the page (promises awaited), result printed as JSON
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [url, ...steps] = process.argv.slice(2);
if (!url) { console.error("usage: node bin/bidi.mjs <url> [step ...]"); process.exit(2); }

const proxy = new URL(process.env.HTTP_PROXY);
const port = 9222;
const profile = `${process.env.TMPDIR || "/tmp"}/bidi-firefox`;
mkdirSync(profile, { recursive: true });
// localhost is the sandbox's own netns, so even localhost must go through the proxy
writeFileSync(`${profile}/user.js`, [
  ["network.proxy.type", 1],
  ["network.proxy.http", proxy.hostname], ["network.proxy.http_port", +proxy.port],
  ["network.proxy.ssl", proxy.hostname], ["network.proxy.ssl_port", +proxy.port],
  ["network.proxy.no_proxies_on", ""],
  ["network.proxy.allow_hijacking_localhost", true],
].map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join("\n"));

const firefox = spawn("firefox", ["--headless", "--no-remote", "--profile", profile,
  "--remote-debugging-port", String(port)], { env: { ...process.env, HOME: profile }, stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; !ws; i++) {
  try {
    ws = await new Promise((resolve, reject) => {
      const s = new WebSocket(`ws://127.0.0.1:${port}/session`);
      s.onopen = () => resolve(s); s.onerror = reject;
    });
  } catch (e) {
    if (i > 50) { firefox.kill(); throw new Error("Firefox remote agent did not start"); }
    await sleep(200);
  }
}

let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id) {
    const p = pending.get(msg.id); pending.delete(msg.id);
    msg.type === "error" ? p.reject(new Error(`${msg.error}: ${msg.message}`)) : p.resolve(msg.result);
  } else if (msg.method === "network.authRequired") {
    // the sandbox proxy answers 407; headless Firefox cannot show a login dialog
    send("network.continueWithAuth", {
      request: msg.params.request.request, action: "provideCredentials",
      credentials: { type: "password", username: decodeURIComponent(proxy.username),
        password: decodeURIComponent(proxy.password) },
    });
  } else if (msg.method === "log.entryAdded") {
    console.log(`[console.${msg.params.level}] ${msg.params.text}`);
  }
};

try {
  await send("session.new", { capabilities: {} });
  await send("session.subscribe", { events: ["network.authRequired", "log.entryAdded"] });
  await send("network.addIntercept", { phases: ["authRequired"] });
  const context = (await send("browsingContext.getTree")).contexts[0].context;
  await send("browsingContext.setViewport", { context, viewport: { width: 1280, height: 800 } });
  await send("browsingContext.navigate", { context, url, wait: "complete" });

  for (const step of steps) {
    const [, cmd, arg] = step.match(/^(shot|click|wait):(.*)$/s) || [];
    if (cmd === "shot") {
      const { data } = await send("browsingContext.captureScreenshot", { context });
      writeFileSync(arg, Buffer.from(data, "base64"));
      console.log(`shot: ${arg}`);
    } else if (cmd === "click") {
      const [x, y] = arg.split(",").map(Number);
      await send("input.performActions", { context, actions: [{ type: "pointer", id: "mouse", actions: [
        { type: "pointerMove", x, y }, { type: "pointerDown", button: 0 }, { type: "pointerUp", button: 0 }] }] });
    } else if (cmd === "wait") {
      await sleep(Number(arg));
    } else {
      const expression = `(async () => JSON.stringify(await (${step})))()`;
      const res = await send("script.evaluate", { target: { context }, expression, awaitPromise: true });
      if (res.type === "exception") throw new Error(`${step}: ${res.exceptionDetails.text}`);
      console.log(`=> ${res.result.value ?? "undefined"}`);
    }
  }
} finally {
  await send("session.end").catch(() => {});
  ws.close();
  firefox.kill();
}
