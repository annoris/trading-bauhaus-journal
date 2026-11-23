import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = join(repoRoot, "site");
const indexPath = join(siteRoot, "index.html");
const skipScreenshots = process.argv.includes("--skip-screenshots");

const REQUIRED_SCREENSHOTS = [
  "01-dashboard-overview.png",
  "02-trades-explorer.png",
  "03-trade-replay-modal.png",
  "04-pnl-calendar.png",
  "05-reports-analytics.png",
  "06-setups-mistakes.png",
  "07-journal-prop-firms.png",
  "08-mobile-dashboard.png",
];

const OBSOLETE_PATHS = [
  join(repoRoot, "docs", "imagenes-proyecto"),
  join(repoRoot, "scripts", "capture-screenshots.cjs"),
  join(repoRoot, "docs", "screenshots", "01-welcome-showcase.png"),
];

for (const obsolete of OBSOLETE_PATHS) {
  let exists = true;
  try {
    await access(obsolete);
  } catch {
    exists = false;
  }
  if (exists) {
    throw new Error(`Obsolete legacy artifact must be removed: ${obsolete}`);
  }
}

await access(join(siteRoot, ".nojekyll"));
const html = await readFile(indexPath, "utf8");

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const seenIds = new Set();
const duplicateIds = [];
for (const id of ids) {
  if (seenIds.has(id)) duplicateIds.push(id);
  seenIds.add(id);
}
if (duplicateIds.length) {
  throw new Error(
    `Duplicate HTML IDs found in site/index.html: ${[...new Set(duplicateIds)].join(", ")}`,
  );
}

let resources = 0;

function isExternalOrSpecial(ref) {
  return !ref || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(ref);
}

async function checkReference(ref, from, baseRoot, { allowHtmlAnchors = false } = {}) {
  const trimmed = ref.trim();
  if (isExternalOrSpecial(trimmed)) return false;
  if (trimmed.startsWith("#")) {
    if (allowHtmlAnchors && !/^#view=[a-z-]+$/i.test(trimmed) && !seenIds.has(trimmed.slice(1))) {
      throw new Error(`Missing HTML anchor in ${from}: ${trimmed}`);
    }
    return false;
  }
  const rawPath = trimmed.split(/[?#]/)[0];
  if (!rawPath) return false;
  let cleanPath = rawPath;
  try {
    cleanPath = decodeURIComponent(rawPath);
  } catch {
    // Keep raw path when not percent-encoded.
  }
  const target = resolve(
    cleanPath.startsWith("/") ? baseRoot : dirname(from),
    cleanPath.replace(/^\/+/, ""),
  );
  await access(target);
  return true;
}

for (const [, ref] of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
  if (await checkReference(ref, indexPath, siteRoot, { allowHtmlAnchors: true })) resources++;
}

for (const [metaTag] of html.matchAll(/<meta\b[^>]*>/gi)) {
  const attr = (name) => metaTag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1];
  const key = (attr("property") || attr("name") || "").toLowerCase();
  if (key === "og:image" || key === "twitter:image") {
    const content = attr("content");
    if (content && (await checkReference(content, indexPath, siteRoot))) resources++;
  }
}

async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(entryPath)));
    else result.push(entryPath);
  }
  return result;
}

let scriptsChecked = 0;
for (const filePath of [...(await walk(siteRoot)), ...(await walk(join(repoRoot, "scripts")))]) {
  const ext = extname(filePath);
  if (ext === ".js" || ext === ".mjs") {
    execFileSync(process.execPath, ["--check", filePath], { stdio: "inherit" });
    scriptsChecked++;
  }
  if (ext === ".css") {
    const css = await readFile(filePath, "utf8");
    for (const [, ref] of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) {
      if (await checkReference(ref, filePath, siteRoot)) resources++;
    }
  }
}

let verifiedScreenshots = 0;
if (!skipScreenshots) {
  for (const shotName of REQUIRED_SCREENSHOTS) {
    const shotPath = join(repoRoot, "docs", "screenshots", shotName);
    let info;
    try {
      info = await stat(shotPath);
    } catch {
      throw new Error(`Missing required screenshot: docs/screenshots/${shotName}`);
    }
    if (!info.isFile() || info.size <= 0) {
      throw new Error(`Screenshot is empty or invalid: docs/screenshots/${shotName}`);
    }
    verifiedScreenshots++;
  }
}

let readmeRefs = 0;
const readmePath = join(repoRoot, "README.md");
const readme = await readFile(readmePath, "utf8");
const prose = readme.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");

for (const match of prose.matchAll(
  /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g,
)) {
  const ref = match[1] || match[2];
  if (await checkReference(ref, readmePath, repoRoot)) readmeRefs++;
}

for (const match of prose.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
  if (await checkReference(match[1], readmePath, repoRoot)) readmeRefs++;
}

for (const match of prose.matchAll(
  /\[[^\]]+\]\(\s*(docs\/[^)#\s]+(?:#[^)\s]+)?|LICENSE|SECURITY\.md|CHANGELOG\.md)\s*\)/g,
)) {
  if (await checkReference(match[1], readmePath, repoRoot)) readmeRefs++;
}

let docLinks = 0;
for (const filePath of await walk(join(repoRoot, "docs"))) {
  if (extname(filePath) !== ".md") continue;
  const docContent = await readFile(filePath, "utf8");
  const docProse = docContent.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
  for (const match of docProse.matchAll(
    /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g,
  )) {
    const ref = match[1] || match[2];
    if (await checkReference(ref, filePath, repoRoot)) docLinks++;
  }
}

console.log(
  `OK: ${resources} site references, HTML anchors, ${scriptsChecked} JS/MJS syntax checks, ${verifiedScreenshots} screenshots, ${readmeRefs} README links, and ${docLinks} docs links verified.`,
);
