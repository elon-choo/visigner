#!/usr/bin/env node
'use strict';
// serve-shoot.js — serve a page, then run shoot.js against the live URL, then tear everything down.
// Built-in modules ONLY (http, net, fs, path, child_process) — no deps, supply-chain clean.
//
// Two modes:
//   (A) STATIC DIR — a built-in http server serves <dir> on an EPHEMERAL port (OS-assigned via listen(0)),
//       so it never collides with a port already in use. Use for a folder of static HTML/CSS/JS (the common case).
//         node serve-shoot.js --dir ./dist [--file index.html] [--out /tmp/shots]
//   (B) SERVE COMMAND — spawn a user-provided dev/preview server (e.g. `vite preview`, `npx serve`, a Next.js
//       start) and wait for its port to accept connections before shooting. The command owns its own port, so you
//       tell us where to hit it with --url (or --port, which builds http://127.0.0.1:<port>/<file>).
//         node serve-shoot.js --serve "npm run preview" --port 4173 [--file ""] [--out /tmp/shots]
//         node serve-shoot.js --serve "npx --yes serve -l 5000 ./dist" --url http://127.0.0.1:5000/
//       The chosen port is also exported to the child as $PORT so a port-aware server can pick it up.
//
// shoot.js gates (390px overflow, broken assets, AXE a11y, etc.) and its env knobs pass straight through:
//   AXE=1 GATE_EXIT=1 node serve-shoot.js --dir ./dist     # fail (exit 1) on a gate violation
// serve-shoot.js exits with shoot.js's own exit code, so GATE_EXIT=1 propagates as a CI failure.
//
// NOTE: shoot.js needs a browser engine (playwright/patchright). In CI `npm ci` + `npx patchright install chromium`
// provide it. Locally, point NODE_PATH at an install that has it, e.g.:
//   NODE_PATH=/path/to/detail-page/node_modules AXE=1 GATE_EXIT=1 node serve-shoot.js --dir ./public

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ---- tiny flag parser (only the flags we define; everything after `--` is forwarded to shoot.js) ----
function parseArgs(argv) {
  const o = { passthrough: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { o.passthrough = argv.slice(i + 1); break; }
    else if (a === '--dir') o.dir = argv[++i];
    else if (a === '--file') o.file = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--serve') o.serve = argv[++i];
    else if (a === '--port') o.port = argv[++i];
    else if (a === '--url') o.url = argv[++i];
    else if (a === '--host') o.host = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else { console.error('serve-shoot: unknown arg', a); o.bad = true; }
  }
  return o;
}

const USAGE = `usage:
  node serve-shoot.js --dir <staticDir> [--file index.html] [--out <dir>] [--host 127.0.0.1]
  node serve-shoot.js --serve "<command>" (--port <n> | --url <url>) [--file <path>] [--out <dir>]
env: AXE=1, GATE_EXIT=1, and every shoot.js knob pass through to the shoot child.`;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

// ---- (A) built-in static file server, scoped to `root`, no path traversal ----
function startStaticServer(root, host) {
  const ROOT = path.resolve(root);
  if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) {
    throw new Error(`--dir is not a directory: ${ROOT}`);
  }
  const server = http.createServer((req, res) => {
    try {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      // resolve inside ROOT only — reject anything that escapes it
      const filePath = path.normalize(path.join(ROOT, rel));
      if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403); res.end('forbidden'); return;
      }
      fs.readFile(filePath, (err, buf) => {
        if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found: ' + rel); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        res.end(buf);
      });
    } catch (e) { res.writeHead(500); res.end(String(e && e.message || e)); }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, host, () => resolve({ server, port: server.address().port })); // listen(0) → ephemeral port
  });
}

// ---- wait until a TCP port accepts a connection (for a spawned --serve command) ----
function waitForPort(port, host, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const sock = net.connect(port, host);
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() > deadline) reject(new Error(`timed out waiting for ${host}:${port} after ${timeoutMs}ms`));
        else setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

// ---- run shoot.js against `url`; resolves with its exit code (env inherited so AXE/GATE_EXIT/NODE_PATH pass through) ----
function runShoot(url, outDir, passthrough) {
  const shoot = path.join(__dirname, 'shoot.js');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [shoot, url, outDir, ...passthrough], { stdio: 'inherit', env: process.env });
    child.on('exit', (code, signal) => resolve(signal ? 1 : (code == null ? 1 : code)));
    child.on('error', (e) => { console.error('serve-shoot: failed to spawn shoot.js:', e.message); resolve(1); });
  });
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); process.exit(0); }
  if (args.bad || (!args.dir && !args.serve)) { console.error(USAGE); process.exit(2); }

  const host = args.host || '127.0.0.1';
  const file = args.file != null ? args.file : 'index.html';
  const outDir = args.out || path.join(require('os').tmpdir(), `serve-shoot-${process.pid}`);
  fs.mkdirSync(outDir, { recursive: true });

  let server = null;
  let child = null;
  let exitCode = 1;
  // ensure teardown runs no matter how we leave
  const teardown = () => {
    try { if (server) server.close(); } catch (_) {}
    try { if (child && !child.killed) child.kill('SIGTERM'); } catch (_) {}
  };
  process.on('SIGINT', () => { teardown(); process.exit(130); });

  try {
    let url;
    if (args.dir) {
      // ---- mode A: static dir on ephemeral port ----
      const s = await startStaticServer(args.dir, host);
      server = s.server;
      const f = file.replace(/^\//, '');
      url = `http://${host}:${s.port}/${f}`;
      console.error(`serve-shoot: static server for ${path.resolve(args.dir)} on ${host}:${s.port} → ${url}`);
    } else {
      // ---- mode B: spawn user-provided serve command, wait for its port ----
      if (!args.url && !args.port) { console.error('serve-shoot: --serve requires --url or --port'); teardown(); process.exit(2); }
      const port = args.port ? Number(args.port)
        : Number((args.url.match(/:(\d+)/) || [])[1] || (args.url.startsWith('https') ? 443 : 80));
      child = spawn(args.serve, { stdio: 'inherit', shell: true, env: { ...process.env, PORT: String(port) } });
      child.on('error', (e) => { console.error('serve-shoot: serve command failed to start:', e.message); });
      console.error(`serve-shoot: spawned serve command, waiting for ${host}:${port} ...`);
      await waitForPort(port, host, Number(process.env.SERVE_TIMEOUT_MS || 30000));
      const f = file.replace(/^\//, '');
      url = args.url || `http://${host}:${port}/${f}`;
      console.error(`serve-shoot: ${host}:${port} is up → ${url}`);
    }

    exitCode = await runShoot(url, outDir, args.passthrough);
    console.error(`serve-shoot: shoot.js exited ${exitCode}; output in ${outDir}`);
  } catch (e) {
    console.error('serve-shoot: FATAL', e && e.message || e);
    exitCode = 2;
  } finally {
    teardown();
  }
  process.exit(exitCode);
})();
