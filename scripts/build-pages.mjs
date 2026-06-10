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
 * citation engines. The page matches the kya-os.org design system (Space
 * Grotesk + JetBrains Mono, dark #0a0a0a, dot grid, white accent, card grid)
 * and ships with no client JS.
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

// ── shared content (defined before the emit block consumes it) ───────────────

const TITLE = "KYA-OS Protocol Schemas";
const DESCRIPTION =
  "The canonical registry of JSON Schemas for the KYA-OS protocol. Every schema is versioned and served at a stable $id URL with open CORS.";
const LEAD =
  "The canonical registry for the KYA-OS protocol's JSON Schemas. Every schema is versioned and immutable, served at a stable $id URL with open CORS. Reference one to validate KYA-OS messages, or to resolve $ref pointers from any JSON Schema validator.";

const FAQ = [
  {
    q: "What is KYA-OS?",
    a: "KYA-OS is an open protocol for verifiable AI-agent identity, delegation, and proof. It defines how an agent proves who it is and what authority it holds, enforceable at the edge and compatible with the web. The protocol is donated to the Decentralized Identity Foundation (DIF).",
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

// The canonical KYA-OS logo mark (from kya-os.org/mcp), recoloured to inherit
// `currentColor` so it follows the surrounding text colour.
const LOGO_PATH =
  "M85.807 0.190363C96.416 -0.0168199 107.047 -0.143695 117.645 0.291926C134.724 0.998586 147.873 9.07309 157.611 22.9492C157.866 23.3103 158.094 23.6932 158.301 24.081C158.37 24.2138 158.333 24.4052 158.349 24.6708C154.784 25.5474 151.167 26.2912 147.634 27.3271C113.453 37.3199 90.5985 70.3001 93.9134 105.671C96.5803 134.157 111.264 154.573 137.136 166.877C140.249 168.359 143.437 169.107 146.89 168.141C151.873 166.749 155.252 162.844 155.773 157.744C156.256 152.995 153.626 148.203 148.967 146.195C142.991 143.619 137.386 140.516 132.653 136.006C105.097 109.773 115.35 63.6591 151.714 50.7656C156.965 48.902 162.598 48.1099 169.033 46.5868C169.819 54.4646 171.275 61.3225 171.02 68.122C170.568 80.3992 173.527 91.5764 179.483 102.101C184.227 110.478 189.018 118.83 194.023 127.054C198.023 133.625 196.466 138.699 189.209 141.435C187.313 142.152 185.364 142.748 183.504 143.55C178.638 145.653 177.172 149.722 179.753 154.365C181.05 156.692 183.089 158.934 181.352 161.617C179.981 163.731 177.9 165.39 175.897 167.504C175.983 167.632 176.497 168.312 176.932 169.033C179.179 172.768 178.51 177.055 175.052 179.653C171.078 182.634 170.143 186.501 170.313 191.293C170.488 196.356 170.499 201.652 169.235 206.492C166.308 217.707 157.627 222.769 146.996 225.234C135.984 227.79 125.502 226.303 115.786 220.65C102.122 212.703 91.3686 202.141 87.8304 186.06C86.837 181.55 86.97 176.758 86.8744 172.094C86.5609 156.39 82.7148 141.7 74.5335 128.249C65.906 114.07 54.3559 102.68 39.2152 95.9911C24.2926 89.4034 14.4545 72.7434 19.6341 52.7314C27.619 21.8764 53.9585 0.811927 85.807 0.190363ZM14.4857 111.658C15.681 111.977 17.381 112.365 19.0384 112.875C44.8254 120.828 62.208 144.065 63.058 171.053C63.637 189.577 60.3325 207.247 53.0384 224.247C52.2044 226.186 51.2644 226.685 49.3255 226.335C42.3238 225.06 35.4866 223.423 29.7279 218.897C23.5122 214.015 21.2808 207.645 22.3646 199.899C22.7046 197.482 22.8426 194.969 22.5345 192.562C22.3485 191.123 21.4025 189.534 20.3294 188.493C14.6028 182.915 14.3688 181.927 17.8431 175.6C16.2017 173.847 14.3531 172.402 13.2269 170.521C12.021 168.503 12.4833 166.467 14.3001 164.528C15.7344 163.004 16.8446 160.926 17.4183 158.902C18.4594 155.263 16.8659 152.453 13.3597 151.066C10.7353 150.03 7.97805 149.329 5.38023 148.24C0.264303 146.094 -1.36161 141.69 1.1937 136.76C5.49146 128.472 9.92764 120.254 14.4857 111.664V111.658ZM63.9505 39.4452C53.825 39.4773 45.8567 47.5041 45.8832 57.6562C45.9044 67.5746 54.0216 75.6022 64.0091 75.581C74.1028 75.5597 82.2472 67.4581 82.2474 57.4335H82.2416C82.2416 47.3769 74.14 39.4134 63.9505 39.4452ZM169.043 46.5849C169.04 46.5857 169.036 46.586 169.033 46.5868V46.5849H169.043Z";
const LOGO_INLINE = `<svg viewBox="0 0 197 227" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${LOGO_PATH}"/></svg>`;

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

/** First sentence of a description, normalised to a single trailing period. */
function firstSentence(desc) {
  return desc.split(". ")[0].replace(/[.\s]+$/, "") + ".";
}

// ── landing page ────────────────────────────────────────────────────────────

function renderIndexHtml(schemas) {
  const groups = byCategory(schemas)
    .map(([cat, items]) => {
      const cards = items
        .map(
          (s) => `          <div class="card">
            <a class="card-link" href="${esc(s.canonical)}" aria-label="Open the ${esc(s.title ?? "")} schema"></a>
            <div class="card-head"><h3>${esc(s.title ?? s.$id)}</h3><span class="go" aria-hidden="true">&rarr;</span></div>
            ${s.description ? `<p class="desc">${esc(firstSentence(s.description))}</p>` : ""}
            <code class="id" title="Canonical $id — click to select, then copy">${esc(s.$id)}</code>
            <a class="raw" href="${esc(s.path)}">raw .json</a>
          </div>`,
        )
        .join("\n");
      return `        <h2 class="section-label">${esc(categoryLabel(cat))}</h2>
        <div class="cards">
${cards}
        </div>`;
    })
    .join("\n");

  const faqHtml = FAQ.map((f) => `        <div class="qa"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join("\n");

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: "KYA-OS", url: SITE_URL, description: "Open protocol for verifiable AI-agent identity, delegation, and proof.", sameAs: [REPO_URL, DIF_URL, SPEC_URL] },
      { "@type": "WebSite", "@id": `${ORIGIN}/#website`, name: TITLE, url: ORIGIN, description: DESCRIPTION, inLanguage: "en", publisher: { "@id": `${SITE_URL}/#org` } },
      {
        "@type": "DataCatalog",
        "@id": `${ORIGIN}/#catalog`,
        name: TITLE,
        url: ORIGIN,
        description: DESCRIPTION,
        dateModified: BUILD_ISO,
        isPartOf: { "@id": `${ORIGIN}/#website` },
        dataset: schemas.map((s) => ({ "@type": "Dataset", name: s.title ?? s.$id, description: s.description || `${s.title} schema (JSON Schema draft 2020-12).`, identifier: s.$id, url: `${ORIGIN}${s.canonical}`, encodingFormat: "application/schema+json", version: s.version || undefined, isPartOf: { "@id": `${ORIGIN}/#catalog` } })),
      },
      { "@type": "FAQPage", "@id": `${ORIGIN}/#faq`, mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
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
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
  :root{ --bg:#0a0a0a; --fg:#e0e0e0; --muted:#666; --faint:#888; --accent:#fff; --grid:#1a1a1a; }
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:"Space Grotesk",system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);
    line-height:1.6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;position:relative;overflow-x:hidden}
  /* subtle dot grid — the kya-os.org background */
  body::before{content:"";position:fixed;inset:0;background-image:radial-gradient(circle,var(--grid) 1px,transparent 1px);background-size:40px 40px;opacity:.5;pointer-events:none;z-index:0}
  .wrap{max-width:880px;margin:0 auto;padding:0 40px;position:relative;z-index:1}
  a{color:var(--fg);text-decoration:none}
  a:hover{color:var(--accent)}
  code,.mono{font-family:"JetBrains Mono","SF Mono",Monaco,monospace}
  ::selection{background:var(--accent);color:var(--bg)}

  header.bar{border-bottom:1px solid var(--grid);position:sticky;top:0;z-index:20;background:rgba(10,10,10,.82);backdrop-filter:blur(8px)}
  header.bar .wrap{display:flex;align-items:center;gap:16px;height:64px}
  .brand{display:flex;align-items:center;gap:11px;color:var(--accent);font-weight:600;font-size:16px;letter-spacing:-.01em}
  .brand svg{width:18px;height:21px;display:block}
  .brand .sub{color:var(--muted);font-weight:400}
  nav{margin-left:auto;display:flex;gap:24px;font-family:"JetBrains Mono",monospace;font-size:13px}
  nav a{color:var(--muted)}
  nav a:hover{color:var(--accent)}

  .hero{padding:80px 0 36px}
  .eyebrow{font-family:"JetBrains Mono",monospace;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:24px}
  h1{font-family:"Space Grotesk",sans-serif;font-size:clamp(42px,7vw,64px);font-weight:300;letter-spacing:-.02em;line-height:1.05;color:var(--accent)}
  .lede{max-width:660px;font-size:18px;line-height:1.85;color:var(--fg);margin-top:24px}
  .lede code{font-size:16px;color:var(--accent)}
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:32px}
  .chip{font-family:"JetBrains Mono",monospace;font-size:12.5px;color:var(--muted);border:1px solid var(--grid);padding:7px 13px;background:rgba(255,255,255,.02)}
  .chip b{color:var(--fg);font-weight:500}
  .chip a{color:var(--accent)}

  main{padding:28px 0 8px}
  .section-label{font-family:"JetBrains Mono",monospace;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:52px 0 18px}
  .section-label:first-child{margin-top:0}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(390px,1fr));gap:16px}
  @media(max-width:520px){.cards{grid-template-columns:1fr}}
  /* clickable card: a stretched link covers it (→ the schema); the $id and the
     raw-.json link sit above the overlay so they stay independently usable. */
  .card{position:relative;padding:26px;background:rgba(255,255,255,.02);border:1px solid var(--grid);transition:background .2s ease,border-color .2s ease}
  .card:hover{background:rgba(255,255,255,.04);border-color:var(--muted)}
  .card-link{position:absolute;inset:0;z-index:1}
  .card-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px}
  .card h3{font-size:18px;font-weight:600;color:var(--accent);letter-spacing:-.01em}
  .card .go{font-family:"JetBrains Mono",monospace;font-size:17px;color:var(--muted);transition:transform .2s ease,color .2s ease}
  .card:hover .go{color:var(--accent);transform:translateX(4px)}
  .card .desc{font-size:15px;line-height:1.6;color:var(--fg);margin-bottom:18px}
  .card .id{position:relative;z-index:2;display:block;font-size:12px;color:var(--muted);word-break:break-all;line-height:1.55;margin-bottom:16px;cursor:text;user-select:all}
  .card .id:hover{color:var(--fg)}
  .card .raw{position:relative;z-index:2;font-family:"JetBrains Mono",monospace;font-size:12.5px;color:var(--muted)}
  .card .raw:hover{color:var(--accent)}

  .faq{margin-top:64px;padding-top:8px}
  .qa{padding:24px 0;border-top:1px solid var(--grid)}
  .qa h3{font-size:18px;font-weight:600;color:var(--accent);margin-bottom:10px}
  .qa p{font-size:15.5px;line-height:1.7;color:var(--fg);max-width:72ch}

  footer{border-top:1px solid var(--grid);margin-top:72px;padding:28px 0 64px;color:var(--muted);font-size:13px}
  footer .wrap{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center}
  footer a{color:var(--muted)}
  footer a:hover{color:var(--accent)}
  footer .upd{font-family:"JetBrains Mono",monospace}
</style>
</head>
<body>
  <header class="bar"><div class="wrap">
    <a class="brand" href="${SITE_URL}">${LOGO_INLINE}KYA-OS<span class="sub">/ schema</span></a>
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
        <span class="chip">protocol <b>v1</b></span>
        <span class="chip"><a href="/schema-index.json">schema-index.json</a></span>
      </div>
    </section>

    <main>
${groups}

      <section class="faq">
        <h2 class="section-label">Frequently asked</h2>
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
  const lines = [`# ${TITLE}`, "", `> ${DESCRIPTION}`, "", LEAD, "", `- **Format:** JSON Schema draft 2020-12`, `- **Protocol version:** v1`, `- **Schemas published:** ${schemas.length}`, `- **Specification:** ${SPEC_URL}`, `- **Source:** ${REPO_URL}`, `- **Updated:** ${BUILD_DATE}`, "", "## Published schemas", ""];
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
  const head = [`# ${TITLE}`, "", `> ${DESCRIPTION}`, "", LEAD, "", "## Schemas", "", ...schemas.map((s) => `- [${s.title ?? s.$id}](${ORIGIN}${s.canonical}): ${s.description || "JSON Schema draft 2020-12."}`), "", "## Reference", "", `- [KYA-OS specification](${SPEC_URL})`, `- [schema-index.json](${ORIGIN}/schema-index.json)`, `- [Donated core repository](${REPO_URL})`, ""];
  if (!full) return head.join("\n") + `\nLast updated: ${BUILD_DATE}\n`;
  return head.join("\n") + ["## Frequently asked", "", ...FAQ.flatMap((f) => [`### ${f.q}`, "", f.a, ""]), `Last updated: ${BUILD_DATE}`, ""].join("\n");
}

// ── crawler files ────────────────────────────────────────────────────────────

function renderSitemap(schemas) {
  const urls = [{ loc: `${ORIGIN}/`, priority: "1.0" }, { loc: `${ORIGIN}/schema-index.json`, priority: "0.6" }, ...schemas.map((s) => ({ loc: `${ORIGIN}${s.canonical}`, priority: "0.8" }))];
  const body = urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${BUILD_DATE}</lastmod><priority>${u.priority}</priority></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function renderRobots() {
  const bots = ["*", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"];
  return bots.map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n") + `\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
}

function renderOgImage(count) {
  // 1200x630 branded card matching the site: dark bg, dot grid, real logo mark,
  // white wordmark. Server-side renderers may lack web fonts; sans-serif still
  // produces a clean preview.
  const dots = [];
  for (let y = 40; y < 630; y += 40) for (let x = 40; x < 1200; x += 40) dots.push(`<circle cx="${x}" cy="${y}" r="1.4" fill="#1a1a1a"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0a"/>
  ${dots.join("")}
  <g transform="translate(80,150) scale(0.62)" fill="#ffffff"><path d="${LOGO_PATH}"/></g>
  <text x="230" y="220" font-family="'Space Grotesk',system-ui,sans-serif" font-size="22" letter-spacing="6" fill="#888">KYA-OS / SCHEMA</text>
  <text x="226" y="320" font-family="'Space Grotesk',system-ui,sans-serif" font-size="88" font-weight="600" fill="#ffffff">Protocol Schemas</text>
  <text x="230" y="372" font-family="'JetBrains Mono',monospace" font-size="22" fill="#888">${count} schemas · protocol v1</text>
  <text x="230" y="470" font-family="'JetBrains Mono',monospace" font-size="22" fill="#e0e0e0">schema.kya-os.org</text>
</svg>
`;
}

function renderHeaders() {
  return [
    "/v1/*", "  Content-Type: application/schema+json", "  Access-Control-Allow-Origin: *", "  Cache-Control: public, max-age=3600, s-maxage=86400",
    "/schema-index.json", "  Access-Control-Allow-Origin: *", "  Cache-Control: public, max-age=3600, s-maxage=86400",
    "/llms.txt", "  Content-Type: text/plain; charset=utf-8", "  Access-Control-Allow-Origin: *",
    "/llms-full.txt", "  Content-Type: text/plain; charset=utf-8", "  Access-Control-Allow-Origin: *",
    "/index.md", "  Content-Type: text/markdown; charset=utf-8", "  Access-Control-Allow-Origin: *",
    "/sitemap.xml", "  Content-Type: application/xml; charset=utf-8",
    "/og.svg", "  Content-Type: image/svg+xml", "  Cache-Control: public, max-age=86400",
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

console.log(`Built Pages artifact: ${index.length} schemas -> ${relative(repoRoot, distDir)}/ (kya-os.org brand + AEO)`);
