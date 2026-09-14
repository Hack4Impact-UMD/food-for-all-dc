#!/usr/bin/env node
// Copies the pdf.js worker into public/ so it is served byte-for-byte.
//
// Referencing the worker through webpack (new URL(..., import.meta.url)) lets
// react-scripts run it through Babel for the production browserslist. Babel
// rewrites its private class fields into imports of @babel/runtime helpers by
// absolute filesystem path, and because the worker is emitted as a standalone
// file those imports are never bundled. In the browser they resolve to the SPA
// fallback page, the worker fails to start, and every PDF fails to load. The
// development browserslist needs no transforms, so this only breaks deployed builds.
//
// The version is part of the filename so the file can be cached forever and
// can never drift from the pdf.js API that react-pdf loads.
//
// Runs automatically before `start`, `start:emulated`, and `build`.

import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Resolve pdfjs-dist the way react-pdf does, in case it ever nests its own copy.
const requireFromReactPdf = createRequire(
  path.join(appRoot, "node_modules", "react-pdf", "package.json")
);
const pdfjsPackageJson = requireFromReactPdf.resolve("pdfjs-dist/package.json");
const { version } = JSON.parse(readFileSync(pdfjsPackageJson, "utf8"));

const source = path.join(path.dirname(pdfjsPackageJson), "build", "pdf.worker.min.mjs");
const outputDir = path.join(appRoot, "public", "pdfjs");
const output = path.join(outputDir, `pdf.worker-${version}.min.mjs`);

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
copyFileSync(source, output);

console.log(`Copied pdf.js worker ${version} to ${path.relative(appRoot, output)}`);
