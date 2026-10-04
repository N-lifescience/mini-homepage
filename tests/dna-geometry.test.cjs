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
const { dnaPoint, dnaBaseEndpoints, factorPosition, polymerasePosition, transcriptionSite, transcriptionTimeline, strandOpening, rnaPoint } = modulePort.exports;
const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));

test('factors bind before polymerase recruitment and synthesis begins afterward', () => {
  const beforeRecruitment = transcriptionTimeline(.18);
  assert.equal(beforeRecruitment.factorBinding, 1);
  assert.equal(beforeRecruitment.polymeraseBinding, 0);
  assert.equal(beforeRecruitment.elongation, 0);
  const assembled = transcriptionTimeline(.34);
  assert.equal(assembled.polymeraseBinding, 1);
  assert.equal(assembled.elongation, 0);
  assert.equal(strandOpening(.17, .34), 0, 'DNA must remain paired during recruitment');
  assert.equal(transcriptionSite(.34), transcriptionSite(0));
  for (const index of [0, 1]) {
    const contact = dnaPoint(.17 + (index ? .03 : -.03), 0, .18);
    assert.ok(distance(factorPosition(index, 0), contact) > 1.5);
    assert.ok(distance(factorPosition(index, .18), contact) < .3, 'factor should dock on DNA first');
  }
  const dna = dnaPoint(.17, 0, 0);
  assert.ok(distance(polymerasePosition(0), dna) > 2, 'unbound polymerase must stay off DNA');
  assert.ok(transcriptionTimeline(.55).elongation > 0);
});

test('polymerase stays on the DNA template as scroll and helix rotation change', () => {
  let previousSite = -1;
  for (let step = 0; step <= 100; step++) {
    const progress = step / 100;
    const site = transcriptionSite(progress);
    assert.ok(site >= previousSite, 'scrolling forward must move forward along DNA');
    previousSite = site;
    for (const twist of [0, .4, 1.7]) {
      if (progress < .34) continue; // The enzyme is still being recruited before this point.
      const dna = dnaPoint(site, 0, progress, twist);
      const enzyme = polymerasePosition(progress, twist);
      assert.ok(Math.abs(enzyme[0] - dna[0] - .25) < 1e-10);
      assert.equal(enzyme[1], dna[1]);
      assert.ok(Math.abs(enzyme[2] - dna[2] - .45) < 1e-10);
    }
  }
});

test('DNA stays open behind the enzyme while the section ahead remains helical', () => {
  const initialSite = transcriptionSite(.5);
  assert.ok(strandOpening(initialSite, .5) > .99);
  assert.ok(strandOpening(initialSite, .9) > .99);
  for (const progress of [.5, .65, .8]) {
    const site = transcriptionSite(progress);
    assert.ok(strandOpening(site, progress) > .99);
    assert.ok(strandOpening(site + .3, progress) < .001);
    const traversedSite = (transcriptionSite(0) + site) / 2;
    assert.ok(strandOpening(traversedSite, progress) > .99);
    assert.ok(strandOpening(traversedSite, 1) >= strandOpening(traversedSite, progress));
  }
});

test('every DNA base retains its full length and stays attached throughout unzipping', () => {
  for (let step = 0; step <= 100; step++) {
    for (let pair = 0; pair < 36; pair++) {
      const s = (pair + .5) / 36;
      for (const strand of [0, 1]) {
        const [anchor, tip] = dnaBaseEndpoints(s, strand, step / 100, .4);
        assert.ok(Math.abs(distance(anchor, tip) - 1.06) < 1e-10);
        assert.ok(distance(anchor, dnaPoint(s, strand, step / 100, .4)) < 1e-10);
      }
    }
  }
  for (const s of [.2, .4, .6, .75]) {
    assert.ok(distance(dnaBaseEndpoints(s, 0, .3)[1], dnaBaseEndpoints(s, 1, .3)[1]) < 1e-10);
    assert.ok(distance(dnaBaseEndpoints(s, 0, 1)[1], dnaBaseEndpoints(s, 1, 1)[1]) > .6);
  }
});

test('both transcription factors travel with the recruited polymerase', () => {
  for (const twist of [0, .4, 1.7]) {
    for (const index of [0, 1]) {
      const first = factorPosition(index, .34, twist);
      const enzyme = polymerasePosition(.34, twist);
      const offset = first.map((value, axis) => value - enzyme[axis]);
      for (const progress of [.4, .55, .7, .85, 1]) {
        const factor = factorPosition(index, progress, twist);
        const movingEnzyme = polymerasePosition(progress, twist);
        assert.ok(factor[1] >= first[1], 'the factor must advance with the enzyme');
        for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(factor[axis] - movingEnzyme[axis] - offset[axis]) < 1e-10);
      }
    }
  }
});

test('RNA exits the moving enzyme and leaves a longer strand behind it', () => {
  let lastLength = 0;
  for (const progress of [.4, .55, .7, .85, 1]) {
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
