const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const modulePort = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/dna-geometry.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
vm.runInNewContext(code, { exports: modulePort.exports, module: modulePort });
const { dnaPoint, polymerasePosition, transcriptionSite, strandOpening, rnaPoint } = modulePort.exports;

test('polymerase stays on the DNA template as scroll and helix rotation change', () => {
  let previousSite = -1;
  for (let step = 0; step <= 100; step++) {
    const progress = step / 100;
    const site = transcriptionSite(progress);
    assert.ok(site >= previousSite, 'scrolling forward must move forward along DNA');
    previousSite = site;
    for (const twist of [0, .4, 1.7]) {
      const dna = dnaPoint(site, 0, progress, twist);
      const enzyme = polymerasePosition(progress, twist);
      assert.ok(Math.abs(enzyme[0] - dna[0] - .25) < 1e-10);
      assert.equal(enzyme[1], dna[1]);
      assert.ok(Math.abs(enzyme[2] - dna[2] - .45) < 1e-10);
    }
  }
});

test('DNA stays open behind the enzyme while the section ahead remains helical', () => {
  const initialSite = transcriptionSite(.2);
  assert.ok(strandOpening(initialSite, .2) > .9);
  assert.ok(strandOpening(initialSite, .9) > .99);
  for (const progress of [.3, .5, .8]) {
    const site = transcriptionSite(progress);
    assert.ok(strandOpening(site, progress) > .99);
    assert.ok(strandOpening(site + .3, progress) < .001);
    const traversedSite = (transcriptionSite(0) + site) / 2;
    assert.ok(strandOpening(traversedSite, progress) > .99);
    assert.ok(strandOpening(traversedSite, 1) >= strandOpening(traversedSite, progress));
  }
});

test('RNA exits the moving enzyme and leaves a longer strand behind it', () => {
  let lastLength = 0;
  for (const progress of [.2, .4, .6, .8, 1]) {
    const enzyme = polymerasePosition(progress, .4);
    const root = rnaPoint(0, progress, .4);
    assert.ok(Math.abs(root[0] - enzyme[0] + .18) < 1e-10);
    assert.ok(Math.abs(root[1] - enzyme[1] + .32) < 1e-10);
    const tip = rnaPoint(1, progress, .4);
    const length = Math.hypot(...tip.map((value, axis) => value - root[axis]));
    assert.ok(length > lastLength);
    assert.ok(tip[1] < root[1]);
    lastLength = length;
  }
});
