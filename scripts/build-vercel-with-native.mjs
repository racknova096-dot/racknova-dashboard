import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
const cloudOut = path.join(root, "dist");
const nativeOut = path.join(root, ".native-dashboard-build");
const feedRoot = path.join(cloudOut, "native-dashboard");
const feedFiles = path.join(feedRoot, "files");
const configPath = path.join(root, "src", "config.ts");
const appPath = path.join(root, "src", "App.tsx");
const cloudBackendLiteral = "racknova-backend-1.onrender.com";
const nativeReloadMarker = "/racknova-native/dashboard-update/status";

function runVite(args) {
  const result = spawnSync(process.execPath, [viteCli, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Vite terminó con código ${result.status}`);
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function walkFiles(dir, base = dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...walkFiles(absolute, base));
    } else if (entry.isFile()) {
      output.push({
        absolute,
        relative: path.relative(base, absolute).split(path.sep).join("/"),
      });
    }
  }
  return output.sort((a, b) => a.relative.localeCompare(b.relative));
}

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const item of walkFiles(source)) {
    const target = path.join(destination, ...item.relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(item.absolute, target);
  }
}

function patchNativeSources(configOriginal, appOriginal) {
  const configPattern = /export\s+const\s+API_URL\s*=\s*.*?;/s;
  const configReplacement = [
    "export const API_URL =",
    '  typeof window !== "undefined" ? window.location.origin : "";',
  ].join("\n");
  const configPatched = configOriginal.replace(configPattern, configReplacement);
  if (configPatched === configOriginal) {
    throw new Error("No pude preparar src/config.ts para API same-origin Native.");
  }

  const nativeRouter = '<BrowserRouter basename="/ui">';
  let appPatched = appOriginal;
  if (!appPatched.includes(nativeRouter)) {
    const matches = appPatched.match(/<BrowserRouter>/g) || [];
    if (matches.length !== 1) {
      throw new Error(`BrowserRouter inesperado: coincidencias=${matches.length}`);
    }
    appPatched = appPatched.replace("<BrowserRouter>", nativeRouter);
  }

  fs.writeFileSync(configPath, configPatched, "utf8");
  fs.writeFileSync(appPath, appPatched, "utf8");
}

function validateNativeBundle() {
  const textFiles = walkFiles(nativeOut).filter((item) =>
    /\.(?:html|js|css|json|txt|map)$/i.test(item.relative),
  );
  let autoReloadPresent = false;

  for (const item of textFiles) {
    const content = fs.readFileSync(item.absolute, "utf8");
    if (content.includes(cloudBackendLiteral)) {
      throw new Error(
        `El bundle Native contiene el backend Cloud en ${item.relative}. Debe usar window.location.origin.`,
      );
    }
    if (content.includes(nativeReloadMarker)) {
      autoReloadPresent = true;
    }
  }

  if (!autoReloadPresent) {
    throw new Error(
      "El bundle Native no contiene el monitor de actualización automática del Dashboard.",
    );
  }
}

console.log("=== RackNova Cloud Dashboard ===");
runVite(["build"]);

const configOriginal = fs.readFileSync(configPath, "utf8");
const appOriginal = fs.readFileSync(appPath, "utf8");

try {
  console.log("=== RackNova Native Dashboard Update Feed ===");
  patchNativeSources(configOriginal, appOriginal);
  fs.rmSync(nativeOut, { recursive: true, force: true });
  runVite([
    "build",
    "--base=/ui/",
    `--outDir=${nativeOut}`,
    "--emptyOutDir",
  ]);
  validateNativeBundle();
} finally {
  fs.writeFileSync(configPath, configOriginal, "utf8");
  fs.writeFileSync(appPath, appOriginal, "utf8");
}

const nativeIndex = path.join(nativeOut, "index.html");
if (!fs.existsSync(nativeIndex)) {
  throw new Error("La compilación Native no produjo index.html.");
}

fs.rmSync(feedRoot, { recursive: true, force: true });
copyTree(nativeOut, feedFiles);

const files = walkFiles(nativeOut).map((item) => {
  const stat = fs.statSync(item.absolute);
  return {
    path: item.relative,
    sha256: sha256File(item.absolute),
    size: stat.size,
  };
});

const aggregate = crypto
  .createHash("sha256")
  .update(files.map((item) => `${item.path}:${item.sha256}`).join("\n"))
  .digest("hex");
const sourceCommit =
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null;
const version = sourceCommit || aggregate;

const manifest = {
  schema_version: 1,
  product: "racknova-dashboard-native",
  version,
  source_commit: sourceCommit,
  generated_at: new Date().toISOString(),
  base_path: "/ui/",
  api_mode: "same-origin",
  content_sha256: aggregate,
  files,
};

fs.mkdirSync(feedRoot, { recursive: true });
fs.writeFileSync(
  path.join(feedRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

fs.rmSync(nativeOut, { recursive: true, force: true });
console.log(
  `Native update feed listo: ${files.length} archivos, versión ${version}`,
);
