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
 * The landing page, `llms.txt`/`llms-full.txt`, `sitemap.xml`, `robots.txt`,
 * `index.md`, and `og.svg` are generated for human readers, AI crawlers, and
 * citation engines (brand metadata, JSON-LD, FAQ, answer-first copy).
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

const ORIGIN = "https://schema.kya-os.org";
const SPEC_URL = "https://kya-os.org/mcp";
const SITE_URL = "https://kya-os.org";
const REPO_URL = "https://github.com/decentralized-identity/kya-os-mcp";
const DIF_URL = "https://identity.foundation";
const BUILD_ISO = new Date().toISOString(); // refreshed every deploy (freshness signal)
const BUILD_DATE = BUILD_ISO.slice(0, 10);

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
    const path = "/" + relative(distDir, file).split(/[/\\]/).join("/");
    index.push({
      $id: parsed.$id,
      title: typeof parsed.title === "string" ? parsed.title : null,
      description: typeof parsed.description === "string" ? parsed.description : "",
      path,
      canonical: path.replace(/\.json$/, ""),
      category: path.split("/")[3] ?? "other",
      version: (path.match(/v(\d+\.\d+\.\d+)\.json$/) || [, ""])[1],
    });
  }
}
index.sort((a, b) => a.$id.localeCompare(b.$id));

// ── shared content (defined before the writeFileSync block consumes it) ───────

const TITLE = "KYA-OS Protocol Schemas";
const DESCRIPTION =
  "Canonical registry of versioned JSON Schemas (draft 2020-12) for the KYA-OS protocol — handshake, detached proof, delegation, and discovery — served at stable $id URLs with open CORS.";
const LEAD =
  "schema.kya-os.org is the canonical registry for the KYA-OS protocol's JSON Schemas. It serves versioned, immutable schema documents — for handshakes, detached proofs, delegation credentials, audit records, and discovery — each at a stable $id URL with open CORS. Reference these schemas to validate KYA-OS messages, or resolve $ref pointers from any JSON Schema validator.";

const FAQ = [
  {
    q: "What is KYA-OS?",
    a: "KYA-OS is an open protocol for verifiable AI-agent identity, delegation, and proof. It defines how an agent proves who it is and what authority it holds — enforceable at the edge and compatible with the web. The protocol is donated to the Decentralized Identity Foundation (DIF).",
  },
  {
    q: "How do I reference a KYA-OS schema?",
    a: "Every schema is published at its canonical $id URL under schema.kya-os.org/v1/protocol/. Point a JSON Schema $ref or $schema field directly at that URL. All documents are served with open CORS and the application/schema+json content type, so validators and $ref resolvers can fetch them from any origin.",
  },
  {
    q: "What schema format is used?",
    a: "Every document is a JSON Schema draft 2020-12. Schemas are versioned (v1.0.0) and immutable at their $id: a published schema never changes in place, so consumers can pin a version with confidence. New revisions are published at a new version path rather than overwriting an existing one.",
  },
  {
    q: "Where is the KYA-OS specification?",
    a: "The full KYA-OS specification, including the Model Context Protocol (MCP) binding, lives at kya-os.org/mcp. The reference implementation and these schemas are maintained in the donated core repository at github.com/decentralized-identity/kya-os-mcp.",
  },
];

// ── helpers ─────────────────────────────────────────────────────────────────

/** Minimal HTML entity escaping for interpolated schema metadata. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Human label for a path category segment (/v1/protocol/<category>/...). */
function categoryLabel(key) {
  const map = { proof: "Proof", delegation: "Delegation", handshake: "Handshake", audit: "Audit", authorization: "Authorization", "well-known": "Discovery" };
  return map[key] ?? key.replace(/(^|[-_])(\w)/g, (_, __, c) => " " + c.toUpperCase()).trim();
}

const CATEGORY_ORDER = ["handshake", "proof", "delegation", "authorization", "audit", "well-known"];
function byCategory(schemas) {
  const groups = new Map();
  for (const s of schemas) {
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category).push(s);
  }
  return [...groups.keys()]
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    })
    .map((cat) => [cat, groups.get(cat).sort((a, b) => a.$id.localeCompare(b.$id))]);
}

// ── landing page ────────────────────────────────────────────────────────────

/** First sentence of a description, normalised to a single trailing period. */
function firstSentence(desc) {
  return desc.split(". ")[0].replace(/[.\s]+$/, "") + ".";
}

function renderIndexHtml(schemas) {
  const grouped = byCategory(schemas);

  const rows = grouped
    .map(([cat, items]) => {
      const body = items
        .map(
          (s) => `          <tr>
            <td class="nm"><strong>${esc(s.title ?? s.$id)}</strong>${s.description ? `<span class="ds">${esc(firstSentence(s.description))}</span>` : ""}</td>
            <td><code class="id">${esc(s.$id)}</code></td>
            <td class="lk"><a href="${esc(s.canonical)}">schema</a> <a href="${esc(s.path)}" class="muted">.json</a></td>
          </tr>`,
        )
        .join("\n");
      return `          <tr class="grp"><th colspan="3"><span class="dot"></span>${esc(categoryLabel(cat))}</th></tr>\n${body}`;
    })
    .join("\n");

  const faqHtml = FAQ.map((f) => `        <div class="qa"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join("\n");

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "KYA-OS",
        url: SITE_URL,
        description: "Open protocol for verifiable AI-agent identity, delegation, and proof.",
        sameAs: [REPO_URL, DIF_URL, SPEC_URL],
      },
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        name: TITLE,
        url: ORIGIN,
        description: DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#org` },
      },
      {
        "@type": "DataCatalog",
        "@id": `${ORIGIN}/#catalog`,
        name: TITLE,
        url: ORIGIN,
        description: DESCRIPTION,
        dateModified: BUILD_ISO,
        isPartOf: { "@id": `${ORIGIN}/#website` },
        dataset: schemas.map((s) => ({
          "@type": "Dataset",
          name: s.title ?? s.$id,
          description: s.description || `${s.title} schema (JSON Schema draft 2020-12).`,
          identifier: s.$id,
          url: `${ORIGIN}${s.canonical}`,
          encodingFormat: "application/schema+json",
          version: s.version || undefined,
          isPartOf: { "@id": `${ORIGIN}/#catalog` },
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${ORIGIN}/#faq`,
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESCRIPTION)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${ORIGIN}/" />
<link rel="alternate" type="text/markdown" href="${ORIGIN}/index.md" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="KYA-OS" />
<meta property="og:title" content="${esc(TITLE)}" />
<meta property="og:description" content="${esc(DESCRIPTION)}" />
<meta property="og:url" content="${ORIGIN}/" />
<meta property="og:image" content="${ORIGIN}/og.svg" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(TITLE)}" />
<meta name="twitter:description" content="${esc(DESCRIPTION)}" />
<meta name="twitter:image" content="${ORIGIN}/og.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
  :root{
    --bg:#0a0a0a; --fg:#e0e0e0; --muted:#888; --faint:#666; --accent:#fff;
    --grid:#1a1a1a; --line:#1f1f1f; --surface:#101010;
    --green:#00ff88; --red:#ff0040; --r:12px;
  }
  @media (prefers-color-scheme: light){
    :root{ --bg:#fafafa; --fg:#1a1a1a; --muted:#555; --faint:#888; --accent:#0a0a0a;
      --grid:#ececec; --line:#e2e2e2; --surface:#fff; --green:#00b863; --red:#e60039; }
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--bg);color:var(--fg);
    font-family:"Space Grotesk",system-ui,sans-serif;font-weight:400;line-height:1.6;-webkit-font-smoothing:antialiased;
    background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
    background-size:44px 44px;background-position:-1px -1px}
  a{color:var(--fg);text-decoration:none;border-bottom:1px solid var(--line)}
  a:hover{border-color:var(--green);color:var(--green)}
  .wrap{max-width:1000px;margin:0 auto;padding:0 24px}
  code,.mono{font-family:"JetBrains Mono","SF Mono",monospace}

  header.bar{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);position:sticky;top:0;z-index:20}
  .bar .wrap{display:flex;align-items:center;gap:16px;height:58px}
  .brand{display:flex;align-items:center;gap:9px;font-weight:700;letter-spacing:-.01em;font-size:15px;border:0}
  .brand .mk{width:11px;height:11px;background:var(--green);box-shadow:0 0 10px var(--green)}
  .brand .sub{color:var(--faint);font-weight:400}
  nav{margin-left:auto;display:flex;gap:20px;font-size:13.5px}
  nav a{color:var(--muted);border:0}
  nav a:hover{color:var(--green)}

  .hero{padding:56px 0 22px}
  .eyebrow{font-family:"JetBrains Mono",monospace;font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--green);margin-bottom:18px}
  h1{font-size:clamp(32px,6vw,56px);font-weight:700;letter-spacing:-.03em;line-height:1.03;margin:0;color:var(--accent)}
  .lede{max-width:620px;color:var(--muted);font-size:17px;margin:18px 0 0}
  .lede code{font-size:14px;color:var(--fg)}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
  .chip{font-family:"JetBrains Mono",monospace;font-size:11.5px;color:var(--muted);border:1px solid var(--line);padding:5px 11px;background:var(--surface)}
  .chip b{color:var(--fg);font-weight:500}
  .chip a{border:0;color:var(--green)}

  main{padding:18px 0 10px}
  h2{font-size:13px;font-family:"JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:40px 0 14px;font-weight:500}
  table{width:100%;border-collapse:collapse;font-size:14px}
  thead th{text-align:left;font-weight:500;color:var(--faint);font-size:11px;text-transform:uppercase;letter-spacing:.08em;padding:0 14px 10px;border-bottom:1px solid var(--line)}
  tr.grp th{text-align:left;padding:22px 14px 9px;font-size:12px;font-weight:600;color:var(--fg);letter-spacing:.04em}
  tr.grp .dot{display:inline-block;width:7px;height:7px;background:var(--green);margin-right:9px;vertical-align:middle}
  tbody td{padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:top}
  td.nm strong{font-weight:600;color:var(--fg)}
  td.nm .ds{display:block;color:var(--faint);font-size:12.5px;margin-top:2px;max-width:46ch}
  code.id{font-size:11.5px;color:var(--muted);word-break:break-all}
  td.lk{white-space:nowrap}
  td.lk a{font-size:13px;border:0}
  td.lk a.muted{color:var(--faint)}
  tbody tr:hover td{background:var(--surface)}

  .faq{margin-top:48px;border-top:1px solid var(--line);padding-top:8px}
  .qa{padding:20px 0;border-bottom:1px solid var(--line)}
  .qa h3{font-size:16px;font-weight:600;margin:0 0 8px;color:var(--fg)}
  .qa p{margin:0;color:var(--muted);font-size:14.5px;max-width:72ch}

  footer{border-top:1px solid var(--line);margin-top:48px;padding:26px 0 56px;color:var(--faint);font-size:12.5px}
  footer .wrap{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center}
  footer a{color:var(--muted);border:0}
  footer .upd{font-family:"JetBrains Mono",monospace}
</style>
</head>
<body>
  <header class="bar"><div class="wrap">
    <a class="brand" href="/"><span class="mk"></span>KYA-OS<span class="sub">/ schema</span></a>
    <nav>
      <a href="${SPEC_URL}">Specification</a>
      <a href="/schema-index.json">Index</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="${REPO_URL}">GitHub</a>
    </nav>
  </div></header>

  <article class="wrap">
    <section class="hero">
      <div class="eyebrow">Decentralized Identity Foundation</div>
      <h1>Protocol Schemas</h1>
      <p class="lede">${esc(LEAD)}</p>
      <div class="chips">
        <span class="chip"><b>${schemas.length}</b> schemas</span>
        <span class="chip">JSON Schema <b>draft 2020-12</b></span>
        <span class="chip">protocol <b>v1</b></span>
        <span class="chip"><a href="/schema-index.json">schema-index.json</a></span>
      </div>
    </section>

    <main>
      <h2>Published schemas</h2>
      <table>
        <thead><tr><th>Schema</th><th>Identifier ($id)</th><th>Document</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>

      <section class="faq">
        <h2>Frequently asked</h2>
${faqHtml}
      </section>
    </main>
  </article>

  <footer><div class="wrap">
    <span>KYA-OS Protocol Schemas · <span class="mono">schema.kya-os.org</span></span>
    <span class="upd">Updated ${BUILD_DATE}</span>
    <a href="${SPEC_URL}">Specification</a>
    <a href="${REPO_URL}">Donated core</a>
  </div></footer>
</body>
</html>
`;
}

// ── markdown / llms.txt (AI-readable renditions) ─────────────────────────────

function renderMarkdown(schemas) {
  const lines = [
    `# ${TITLE}`,
    "",
    `> ${DESCRIPTION}`,
    "",
    LEAD,
    "",
    `- **Format:** JSON Schema draft 2020-12`,
    `- **Protocol version:** v1`,
    `- **Schemas published:** ${schemas.length}`,
    `- **Specification:** ${SPEC_URL}`,
    `- **Source:** ${REPO_URL}`,
    `- **Updated:** ${BUILD_DATE}`,
    "",
    "## Published schemas",
    "",
  ];
  for (const [cat, items] of byCategory(schemas)) {
    lines.push(`### ${categoryLabel(cat)}`, "");
    for (const s of items) {
      lines.push(`- **${s.title ?? s.$id}** — \`${s.$id}\``);
      if (s.description) lines.push(`  ${s.description}`);
    }
    lines.push("");
  }
  lines.push("## Frequently asked", "");
  for (const f of FAQ) lines.push(`### ${f.q}`, "", f.a, "");
  return lines.join("\n");
}

function renderLlms(schemas, full) {
  const head = [
    `# ${TITLE}`,
    "",
    `> ${DESCRIPTION}`,
    "",
    LEAD,
    "",
    "## Schemas",
    "",
    ...schemas.map((s) => `- [${s.title ?? s.$id}](${ORIGIN}${s.canonical}): ${s.description || "JSON Schema draft 2020-12."}`),
    "",
    "## Reference",
    "",
    `- [KYA-OS specification](${SPEC_URL})`,
    `- [schema-index.json](${ORIGIN}/schema-index.json)`,
    `- [Donated core repository](${REPO_URL})`,
    "",
  ];
  if (!full) return head.join("\n") + `\nLast updated: ${BUILD_DATE}\n`;
  return head.join("\n") + ["## Frequently asked", "", ...FAQ.flatMap((f) => [`### ${f.q}`, "", f.a, ""]), `Last updated: ${BUILD_DATE}`, ""].join("\n");
}

// ── crawler files ────────────────────────────────────────────────────────────

function renderSitemap(schemas) {
  const urls = [
    { loc: `${ORIGIN}/`, lastmod: BUILD_DATE, priority: "1.0" },
    { loc: `${ORIGIN}/schema-index.json`, lastmod: BUILD_DATE, priority: "0.6" },
    ...schemas.map((s) => ({ loc: `${ORIGIN}${s.canonical}`, lastmod: BUILD_DATE, priority: "0.8" })),
  ];
  const body = urls
    .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function renderRobots() {
  // Explicitly welcome general + AI crawlers; advertise the sitemap.
  const bots = ["*", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"];
  return bots.map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n") + `\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
}

function renderOgImage(count) {
  // 1200x630 branded card. Server-side renderers may lack Space Grotesk, so the
  // fallback sans-serif still produces a clean, on-brand preview.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0a"/>
  <g stroke="#1a1a1a" stroke-width="1">${Array.from({ length: 27 }, (_, i) => `<line x1="${i * 44}" y1="0" x2="${i * 44}" y2="630"/>`).join("")}${Array.from({ length: 15 }, (_, i) => `<line x1="0" y1="${i * 44}" x2="1200" y2="${i * 44}"/>`).join("")}</g>
  <rect x="80" y="300" width="14" height="14" fill="#00ff88"/>
  <text x="108" y="313" font-family="'Space Grotesk',system-ui,sans-serif" font-size="22" letter-spacing="6" fill="#888">KYA-OS / SCHEMA</text>
  <text x="78" y="400" font-family="'Space Grotesk',system-ui,sans-serif" font-size="92" font-weight="700" fill="#ffffff">Protocol Schemas</text>
  <text x="80" y="452" font-family="'JetBrains Mono',monospace" font-size="24" fill="#00ff88">schema.kya-os.org</text>
  <text x="80" y="500" font-family="'JetBrains Mono',monospace" font-size="20" fill="#666">JSON Schema draft 2020-12 · ${count} schemas · v1</text>
</svg>
`;
}

function renderHeaders() {
  return [
    "/v1/*",
    "  Content-Type: application/schema+json",
    "  Access-Control-Allow-Origin: *",
    "  Cache-Control: public, max-age=3600, s-maxage=86400",
    "/schema-index.json",
    "  Access-Control-Allow-Origin: *",
    "  Cache-Control: public, max-age=3600, s-maxage=86400",
    "/llms.txt",
    "  Content-Type: text/plain; charset=utf-8",
    "  Access-Control-Allow-Origin: *",
    "/llms-full.txt",
    "  Content-Type: text/plain; charset=utf-8",
    "  Access-Control-Allow-Origin: *",
    "/index.md",
    "  Content-Type: text/markdown; charset=utf-8",
    "  Access-Control-Allow-Origin: *",
    "/sitemap.xml",
    "  Content-Type: application/xml; charset=utf-8",
    "/og.svg",
    "  Content-Type: image/svg+xml",
    "  Cache-Control: public, max-age=86400",
    "",
  ].join("\n");
}

// ── emit (runs last: every const + function above is now initialized) ────────

writeFileSync(join(distDir, "schema-index.json"), JSON.stringify({ schemas: index.map((s) => ({ $id: s.$id, title: s.title, path: s.path })) }, null, 2) + "\n");
writeFileSync(join(distDir, "index.html"), renderIndexHtml(index));
writeFileSync(join(distDir, "index.md"), renderMarkdown(index));
writeFileSync(join(distDir, "llms.txt"), renderLlms(index, false));
writeFileSync(join(distDir, "llms-full.txt"), renderLlms(index, true));
writeFileSync(join(distDir, "sitemap.xml"), renderSitemap(index));
writeFileSync(join(distDir, "robots.txt"), renderRobots());
writeFileSync(join(distDir, "og.svg"), renderOgImage(index.length));
writeFileSync(join(distDir, "_headers"), renderHeaders());

console.log(`Built Pages artifact: ${index.length} schemas -> ${relative(repoRoot, distDir)}/ (brand + AEO)`);
