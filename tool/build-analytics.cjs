const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const tempDir = path.join(root, "temp");
const entry = path.join(root, "js/analytics.js");

fs.mkdirSync(tempDir, { recursive: true });

const browserResult = esbuild.buildSync({
    entryPoints: [entry],
    outfile: path.join(tempDir, "analytics.browser.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["chrome76", "firefox78", "safari12"],
    sourcemap: false,
    minify: false,
    metafile: true,
});

esbuild.buildSync({
    entryPoints: [entry],
    outfile: path.join(tempDir, "analytics.cjs"),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: ["node18"],
    sourcemap: false,
    minify: false,
});

const output = fs.readFileSync(path.join(tempDir, "analytics.browser.js"), "utf8");
const forbidden = [
    { label: "optional chaining", pattern: /\?\./ },
    { label: "nullish coalescing", pattern: /\?\?/ },
    { label: "private class field", pattern: /#[a-zA-Z_$][\w$]*\s*[=;(]/ },
];
forbidden.forEach(({ label, pattern }) => {
    if (pattern.test(output)) throw new Error(`analytics browser bundle still contains ${label}`);
});

const bytes = browserResult.metafile.outputs[path.join(tempDir, "analytics.browser.js")]
    ? browserResult.metafile.outputs[path.join(tempDir, "analytics.browser.js")].bytes
    : Buffer.byteLength(output);

const exportsObject = require(path.join(tempDir, "analytics.cjs"));
[
    "createAnalytics",
    "createRemotePageResolver",
    "createVue3AnalyticsPlugin",
    "stableSampleScore",
].forEach((name) => {
    if (typeof exportsObject[name] !== "function") throw new Error(`missing analytics export: ${name}`);
});

console.log(`[analytics] browser bundle validated: ${bytes} bytes`);
console.log(`[analytics] exports validated: ${Object.keys(exportsObject).sort().join(", ")}`);
