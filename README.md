# Layerscape layers

Every published [Layerscape](https://layerscape.app) layer. A layer is a MapLibre style
document that computes one number per pixel from terrain, in GLSL, and colours it (see the
authoring guide at <https://layerscape.app/llms.txt>). This repo is the one place a layer is
shared from: a Layerscape link names a layer by its slug, and the app fetches it from here.
Git history is each layer's version history.

Everything here is in the public domain under the [Unlicense](LICENSE). Most of it is written
by chatbots from a person's description, and anyone may use, change and share it.

## Layout

```
featured/<slug>.json    curated layers, in everyone's list in the app
community/<slug>.json   layers published from the app, and the authoring guide's examples
meta/<slug>.json        the catalog's record of each layer
```

A layer's slug is also its layer id, so `featured/slope.json` holds a layer whose id is
`slope`. Layers published from the app get the label in kebab case plus a short hash of the
document, e.g. `skiable-couloirs-3fa9c1`; the guide's examples keep their plain ids
(`couloir`, `wind-shelter`, …) because the guide links them by path.

The document holds only what the app renders, plus `layerscape:author` (shown under the
legend). Everything the catalog knows about a layer lives in its record:

```json
{
  "title": "Skiable couloirs",
  "author": "Jane",
  "prompt": "skiable couloirs: 30–50°, north-facing, shaded by noon",
  "agent": "claude",
  "createdAt": "2026-10-10T09:12:44.000Z"
}
```

`prompt` (what the person asked their chatbot for) and `agent` (`claude`, `chatgpt` or
`other`) are there only if the person chose to publish them. Featured records also carry an
`order` for the app's list.

## How layers arrive

**Published from the app.** *Publish* sends a draft to the publish service
(`services/layer-publish` in the app repo). It checks that a person pressed the button
(Turnstile), rate-limits by address, runs the loader's checks again, renames the layer to its
slug and commits `community/<slug>.json` and `meta/<slug>.json` in one commit as the
Layerscape bot. Publishing the same layer twice lands on the same slug, so it commits once.

**Featured.** A maintainer promotes a community layer by pull request:

```sh
git mv community/<slug>.json featured/<slug>.json
# add "order" to meta/<slug>.json
```

The slug doesn't change, so every link to the layer keeps working. The app also bundles a copy
of the featured layers for when this catalog can't be reached; `npm run check:catalog` in the
app repo says when the two differ.

**The guide's examples** are community layers by Layerscape. The guide links each one here,
so renaming or moving one breaks the guide; `npm run check:catalog` catches that too.

## Moderation

Anything that passes the checks lands in `community/`, and a maintainer reviews it from time to
time. Removing a layer is deleting its two files. It stays in git history; taking something out
of history (personal data in a prompt, say) means rewriting it.

## Build and serve

```sh
npm install
npm run build     # checks the catalog's shape, writes dist/
npm run dev       # serves dist/ on http://localhost:8788
npm run deploy    # publishes to layers.layerscape.app (needs `npx wrangler login`)
```

The build writes `index.json` (every layer as the gallery lists it), `featured.json` (the
featured documents in one file) and the files themselves, with CORS headers. It is served as
Workers static assets on `layers.layerscape.app`; with the repo connected to Workers Builds,
every push redeploys, so a publish is live within a minute.

To run the app against a local catalog, start `npm run dev` here and the app with
`VITE_CATALOG_URL=http://localhost:8788 npm run dev`.

## Checks

`npm run build` checks what needs nothing but the files: one layer per document, filed under
its slug, with a record. The loader's checks on the contents (JSON Schema, GLSL lint) live in
the app repo and run there over a checkout of this one, cloned next to it:

```sh
npm run check:catalog -- ../layers
```

Run it on every pull request that adds or edits a layer.
