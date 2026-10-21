import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const file = (name) => fileURLToPath(new URL("../" + name, import.meta.url));
const read = (name) => readFile(file(name), "utf8");

test("application JavaScript parses without executing browser code", async () => {
  const app = await read("app.js");
  assert.doesNotThrow(() => new vm.Script(app, { filename: "webapp/app.js" }));
  const worker = await read("sw.js");
  assert.doesNotThrow(() => new vm.Script(worker, { filename: "webapp/sw.js" }));
});

test("HTML references only local application assets and exposes accessible mail controls", async () => {
  const html = await read("index.html");
  assert.match(html, /name="viewport"/);
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(html, /aria-label="Search email"/);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /Local demo mode/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//i);
});

test("PWA metadata is valid and points to an existing local icon", async () => {
  const manifest = JSON.parse(await read("manifest.webmanifest"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((item) => item.src === "./icon.svg"));
  await access(file("icon.svg"));
});

test("offline cache contains the application shell and stays same-origin", async () => {
  const worker = await read("sw.js");
  for (const asset of ["./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon.svg"]) {
    assert.ok(worker.includes('"' + asset + '"'), "missing cached asset: " + asset);
    await access(file(asset === "./index.html" ? "index.html" : asset.slice(2)));
  }
  assert.match(worker, /url\.origin!==self\.location\.origin/);
  assert.match(worker, /request\.method!=="GET"/);
});

test("local mail actions are implemented without a network send path", async () => {
  const app = await read("app.js");
  assert.match(app, /localStorage\.getItem\(KEY\)/);
  assert.match(app, /localStorage\.setItem\(KEY/);
  assert.match(app, /function saveComposer\(asDraft\)/);
  assert.match(app, /function mutate\(id,action\)/);
  assert.match(app, /Moved to Trash/);
  assert.match(app, /No email was delivered/);
  assert.match(app, /replace\(\/\[&<>"'\]\/g/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /\bXMLHttpRequest\b/);
});

test("responsive and reduced-motion styles are present", async () => {
  const css = await read("styles.css");
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:focus-visible/);
});