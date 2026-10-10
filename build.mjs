/**
 * Build the catalog the Layerscape app reads into `dist/`, checking its shape on the way.
 *
 * Out:
 *   index.json      every layer as the gallery lists it: featured first (by `order`), then
 *                   community layers newest first. Prompts stay out; they're in meta/.
 *   featured.json   the featured documents, in order, so the app gets them in one request.
 *   featured/, community/, meta/   the files themselves.
 *   _headers        CORS for the app, and short cache lifetimes for what changes on publish.
 *
 * The checks here are the ones that need nothing but the files: the catalog's own rules
 * (one layer per document, filed under its slug, with a record). The loader's checks on the
 * contents (schema, GLSL lint) run in the publish service on everything it commits, and in
 * the app repo for everything else: `npm run check:catalog -- ../layers`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const TIERS = ["featured", "community"];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OUT = "dist";

const problems = [];
const entries = [];
const featured = [];

const jsonIn = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : []);

function read(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    problems.push(`${path}: ${e.message}`);
    return null;
  }
}

const seen = new Set();
for (const tier of TIERS) {
  for (const file of jsonIn(tier)) {
    const slug = file.replace(/\.json$/, "");
    const at = `${tier}/${file}`;
    if (!SLUG.test(slug)) problems.push(`${at}: "${slug}" is not a slug (lowercase words joined by hyphens)`);
    if (seen.has(slug)) problems.push(`${at}: "${slug}" is on both shelves`);
    seen.add(slug);

    const doc = read(at);
    const meta = read(`meta/${file}`);
    if (!doc || !meta) continue;
    if (doc.version !== 8 || !Array.isArray(doc.layers) || doc.layers.length !== 1) {
      problems.push(`${at}: expected a MapLibre style with exactly one layer`);
      continue;
    }
    if (doc.layers[0].id !== slug) problems.push(`${at}: its layer id is "${doc.layers[0].id}", not its slug`);
    if (!doc.layers[0].metadata?.["layerscape:compute"]) problems.push(`${at}: its layer has no "layerscape:compute"`);
    if (typeof meta.title !== "string" || typeof meta.createdAt !== "string") {
      problems.push(`meta/${file}: needs a "title" and a "createdAt"`);
    }

    entries.push({
      slug,
      tier,
      title: meta.title,
      ...(meta.author ? { author: meta.author } : {}),
      ...(meta.agent ? { agent: meta.agent } : {}),
      createdAt: meta.createdAt,
      order: meta.order,
      doc,
    });
  }
}
for (const file of jsonIn("meta")) {
  if (!seen.has(file.replace(/\.json$/, ""))) problems.push(`meta/${file}: there's no layer for this record`);
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}

const byOrder = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.title.localeCompare(b.title);
const newest = (a, b) => b.createdAt.localeCompare(a.createdAt);
const sorted = [
  ...entries.filter((e) => e.tier === "featured").sort(byOrder),
  ...entries.filter((e) => e.tier === "community").sort(newest),
];
for (const e of sorted) if (e.tier === "featured") featured.push(e.doc);

// Empty dist/ rather than replace it, so a running `npm run dev` keeps serving it.
mkdirSync(OUT, { recursive: true });
for (const entry of readdirSync(OUT)) rmSync(`${OUT}/${entry}`, { recursive: true, force: true });
for (const dir of [...TIERS, "meta"]) if (existsSync(dir)) cpSync(dir, `${OUT}/${dir}`, { recursive: true });
writeFileSync(`${OUT}/index.json`, JSON.stringify({ layers: sorted.map(({ order, doc, ...entry }) => entry) }));
writeFileSync(`${OUT}/featured.json`, JSON.stringify({ layers: featured }));
writeFileSync(
  `${OUT}/_headers`,
  `/*
  Access-Control-Allow-Origin: *
/index.json
  Cache-Control: public, max-age=60
/featured.json
  Cache-Control: public, max-age=60
/featured/*
  Cache-Control: public, max-age=300
/community/*
  Cache-Control: public, max-age=300
/meta/*
  Cache-Control: public, max-age=300
`,
);
console.log(`✓ ${featured.length} featured, ${sorted.length - featured.length} community → ${OUT}/`);
