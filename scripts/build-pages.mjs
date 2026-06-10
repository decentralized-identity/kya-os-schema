#!/usr/bin/env node
/**
 * Build the Cloudflare Pages deploy artifact that publishes the versioned
 * schema tree at https://schema.kya-os.org.
 *
 * Each schema is served both at its canonical (extensionless) `$id` path and at
 * the `.json` path, with `application/schema+json`, open CORS, and a cache
 * policy — the serving contract that external validators and `$ref` resolution
 * expect. A `schema-index.json` listing every published `$id` is emitted for
 * consumers that discover schemas programmatically.
 *
 * Output goes to `dist/` (gitignored); the deploy step uploads it to Pages.
 * Run: node scripts/build-pages.mjs   (or: pnpm run build:pages)
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const distDir = join(repoRoot, "dist");
const versionedTree = join(repoRoot, "schemas", "v1");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
cpSync(versionedTree, join(distDir, "v1"), { recursive: true });

/** Recursively collect every `.json` file under a directory. */
function jsonFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsonFiles(full));
    else if (entry.endsWith(".json")) out.push(full);
  }
  return out;
}

const index = [];
for (const file of jsonFiles(join(distDir, "v1"))) {
  const raw = readFileSync(file, "utf8");
  // Serve the canonical extensionless `$id` path alongside the `.json` file so
  // a fetch of the bare `$id` resolves without relying on redirect precedence.
  writeFileSync(file.replace(/\.json$/, ""), raw);
  const parsed = JSON.parse(raw);
  if (typeof parsed.$id === "string") {
    index.push({
      $id: parsed.$id,
      title: typeof parsed.title === "string" ? parsed.title : null,
      path: "/" + relative(distDir, file).split(/[/\\]/).join("/"),
    });
  }
}
index.sort((a, b) => a.$id.localeCompare(b.$id));

writeFileSync(
  join(distDir, "schema-index.json"),
  JSON.stringify({ schemas: index }, null, 2) + "\n",
);

writeFileSync(
  join(distDir, "_headers"),
  [
    "/v1/*",
    "  Content-Type: application/schema+json",
    "  Access-Control-Allow-Origin: *",
    "  Cache-Control: public, max-age=3600, s-maxage=86400",
    "/schema-index.json",
    "  Access-Control-Allow-Origin: *",
    "  Cache-Control: public, max-age=3600, s-maxage=86400",
    "",
  ].join("\n"),
);

writeFileSync(join(distDir, "index.html"), renderIndexHtml(index));

console.log(`Built Pages artifact: ${index.length} schemas -> ${relative(repoRoot, distDir)}/`);

/** Minimal HTML entity escaping for interpolated schema metadata. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Human label for a path category segment (/v1/protocol/<category>/...). */
function categoryLabel(key) {
  const map = {
    proof: "Proof",
    delegation: "Delegation",
    handshake: "Handshake",
    audit: "Audit",
    authorization: "Authorization",
    "well-known": "Discovery",
  };
  return map[key] ?? key.replace(/(^|[-_])(\w)/g, (_, __, c) => " " + c.toUpperCase()).trim();
}

/**
 * Render the published-schema landing page: a self-contained (no runtime deps,
 * inline CSS), grouped, styled listing of every schema with its canonical `$id`
 * and serve paths. Each schema links to the served document, not the `$id`
 * (the `$id` is shown as the canonical identifier; during the host migration it
 * may differ from where the document is currently served).
 */
function renderIndexHtml(schemas) {
  // Group by the category segment of the serve path.
  const groups = new Map();
  for (const s of schemas) {
    const seg = s.path.split("/"); // ["", "v1", "protocol", <category>, ...]
    const category = seg[3] ?? "other";
    const version = (s.path.match(/v(\d+\.\d+\.\d+)\.json$/) || [, ""])[1];
    const canonical = s.path.replace(/\.json$/, "");
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push({ ...s, version, canonical });
  }
  const order = ["handshake", "proof", "delegation", "authorization", "audit", "well-known"];
  const cats = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

  const sections = cats
    .map((cat) => {
      const items = groups
        .get(cat)
        .sort((a, b) => a.$id.localeCompare(b.$id))
        .map(
          (s) => `        <li class="card">
          <div class="card-top">
            <h3>${esc(s.title ?? s.$id)}</h3>
            ${s.version ? `<span class="ver">v${esc(s.version)}</span>` : ""}
          </div>
          <code class="id">${esc(s.$id)}</code>
          <div class="links">
            <a href="${esc(s.canonical)}">schema</a>
            <a href="${esc(s.path)}" class="muted">.json</a>
          </div>
        </li>`,
        )
        .join("\n");
      return `      <section class="group">
        <h2><span class="dot"></span>${esc(categoryLabel(cat))}</h2>
        <ul class="cards">
${items}
        </ul>
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>KYA-OS — Protocol Schemas</title>
<meta name="description" content="Versioned JSON Schemas (draft 2020-12) for the KYA-OS protocol, served at their canonical $id." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
  :root{
    --bg:#f4f3ee; --surface:#ffffff; --ink:#17161c; --muted:#6c6a78; --faint:#9b99a6;
    --line:rgba(20,18,30,.10); --line2:rgba(20,18,30,.16);
    --accent:#4b3bff; --accent-soft:rgba(75,59,255,.08);
    --r:14px;
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:"Familjen Grotesk",system-ui,sans-serif;font-weight:400;line-height:1.6;-webkit-font-smoothing:antialiased;
    background-image:radial-gradient(900px 480px at 88% -8%,rgba(75,59,255,.10),transparent 60%);}
  .mono{font-family:"JetBrains Mono",ui-monospace,monospace}
  a{color:var(--accent);text-decoration:none}
  a:hover{text-decoration:underline}
  .wrap{max-width:1060px;margin:0 auto;padding:0 28px}

  header.bar{border-bottom:1px solid var(--line);background:rgba(244,243,238,.82);backdrop-filter:blur(10px);position:sticky;top:0;z-index:20}
  .bar .wrap{display:flex;align-items:center;gap:16px;height:62px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:-.02em;font-size:16px}
  .brand .mk{width:13px;height:13px;border-radius:4px;background:conic-gradient(from 210deg,var(--accent),#8a7bff,var(--accent));box-shadow:0 0 0 3px var(--accent-soft)}
  .brand .sub{color:var(--faint);font-weight:500}
  nav{margin-left:auto;display:flex;gap:22px;font-size:14px}
  nav a{color:var(--muted);font-weight:500}
  nav a:hover{color:var(--ink);text-decoration:none}

  .hero{padding:64px 0 30px}
  .eyebrow{font-family:"JetBrains Mono",monospace;font-size:12px;letter-spacing:.26em;text-transform:uppercase;color:var(--accent);margin-bottom:20px}
  h1{font-size:clamp(34px,6vw,60px);font-weight:700;letter-spacing:-.03em;line-height:1.02;margin:0}
  .lede{max-width:600px;color:var(--muted);font-size:18px;margin-top:20px}
  .lede code{font-family:"JetBrains Mono",monospace;font-size:14px;background:var(--accent-soft);color:var(--accent);padding:1px 6px;border-radius:6px}
  .chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:26px}
  .chip{font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--muted);border:1px solid var(--line2);border-radius:99px;padding:6px 13px;background:var(--surface)}
  .chip b{color:var(--ink);font-weight:500}

  main{padding:24px 0 40px}
  .group{margin-top:40px}
  .group h2{font-size:15px;font-weight:600;letter-spacing:.01em;display:flex;align-items:center;gap:10px;margin:0 0 16px;color:var(--ink)}
  .group h2 .dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}
  .cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
  .card{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:18px 20px;transition:border-color .18s,transform .18s,box-shadow .18s}
  .card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 12px 30px rgba(20,18,30,.07)}
  .card-top{display:flex;align-items:baseline;gap:10px;justify-content:space-between}
  .card h3{font-size:17px;font-weight:600;letter-spacing:-.01em;margin:0}
  .ver{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--faint);border:1px solid var(--line2);border-radius:6px;padding:2px 7px;white-space:nowrap}
  .id{display:block;font-family:"JetBrains Mono",monospace;font-size:11.5px;color:var(--muted);margin:11px 0 14px;word-break:break-all;line-height:1.5}
  .links{display:flex;gap:16px;font-size:13.5px;font-weight:500}
  .links a.muted{color:var(--muted)}

  footer{border-top:1px solid var(--line);padding:30px 0 60px;color:var(--faint);font-size:13px}
  footer .wrap{display:flex;flex-wrap:wrap;gap:8px 22px;align-items:center}
  footer a{color:var(--muted);font-weight:500}
</style>
</head>
<body>
  <header class="bar"><div class="wrap">
    <div class="brand"><span class="mk"></span>KYA-OS<span class="sub">/ schema</span></div>
    <nav>
      <a href="https://kya-os.org/mcp">Specification</a>
      <a href="/schema-index.json">Index JSON</a>
      <a href="https://github.com/decentralized-identity/kya-os-mcp">GitHub</a>
    </nav>
  </div></header>

  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">Decentralized Identity Foundation</div>
      <h1>Protocol Schemas</h1>
      <p class="lede">Versioned JSON Schemas (draft 2020-12) for the KYA-OS protocol, each served at its canonical <code>$id</code> with open CORS — ready for <code>$ref</code> resolution and external validation.</p>
      <div class="chips">
        <span class="chip"><b>${schemas.length}</b> schemas</span>
        <span class="chip">JSON Schema <b>draft 2020-12</b></span>
        <span class="chip">protocol <b>v1</b></span>
        <span class="chip"><a href="/schema-index.json">schema-index.json</a></span>
      </div>
    </section>

    <main>
${sections}
    </main>
  </div>

  <footer><div class="wrap">
    <span>KYA-OS Protocol Schemas · served at <span class="mono">schema.kya-os.org</span></span>
    <a href="https://kya-os.org/mcp">Specification</a>
    <a href="https://github.com/decentralized-identity/kya-os-mcp">Donated core</a>
  </div></footer>
</body>
</html>
`;
}
