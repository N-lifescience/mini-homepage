/* Regression tests run the real hook with deterministic React/Firebase ports.
   No production credentials, network writes, or extra test dependencies. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function fixture() {
  let cursor = 0, values = [], effects = [], queuedEffects = [], changed = false;
  let subscriber, authCallback, server, transactionError, write, writes = 0;
  const listeners = new Map();
  const timers = new Map();
  const navigator = { onLine: true };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], next => { const result = typeof next === 'function' ? next(values[i]) : next; if (result !== values[i]) { values[i] = result; changed = true; } }]; },
    useRef(initial) { const i = cursor++; return values[i] ??= { current: initial }; },
    useCallback(fn) { cursor++; return fn; },
    useMemo(fn) { cursor++; return fn(); },
    useEffect(fn, deps) { const i = cursor++; const prior = effects[i]; if (!prior || deps.some((d, n) => d !== prior.deps[n])) queuedEffects.push(() => { prior?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); }
  };
  const firebase = {
    isGuestbookEnabled: true, getStore: () => ({}), currentUser: () => ({ uid: 'owner' }), setKnownOwnerUid() {},
    subscribeAuthState(callback) { authCallback = callback; callback({ uid: 'owner' }); return () => {}; }
  };
  const firestore = {
    doc: () => ({}), onSnapshot(...args) { subscriber = { next: args.at(-2), error: args.at(-1) }; return () => {}; },
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    async runTransaction(store, fn) { if (transactionError) throw transactionError; await fn({ get: async () => ({ data: () => server }), set(ref, data) { write = data; writes++; server = data; } }); },
  };
  const modules = new Map();
  function load(file) {
    const filename = path.resolve(root, file); if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    const requireMock = spec => {
      if (spec === 'react') return react;
      if (spec === 'firebase/firestore') return firestore;
      if (spec === './firebase') return firebase;
      const relative = spec.startsWith('@/') ? `src/${spec.slice(2)}` : path.relative(root, path.resolve(path.dirname(filename), spec));
      return load(relative + '.ts');
    };
    vm.runInNewContext(code, { require: requireMock, exports: module.exports, module, navigator,
      TextEncoder, URL, process: { env: {} }, console,
      window: { setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
        addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } }
    }, { filename });
    return module.exports;
  }
  const site = load('src/lib/site-content.ts');
  const editor = load('src/lib/editor-state.ts');
  let state;
  function render() { for (let i = 0; i < 12; i++) { changed = false; cursor = 0; state = site.useSiteContent(); const queue = queuedEffects; queuedEffects = []; queue.forEach(fn => fn()); if (!changed) return state; } throw new Error('Hook render did not settle'); }
  function snapshot(raw, fromCache = false, hasPendingWrites = false) { server = raw; subscriber.next({ data: () => raw, metadata: { fromCache, hasPendingWrites } }); return render(); }
  const original = site.defaultContent(); original.ownerUid = 'owner';
  render();
  return { render, snapshot, site, editor, original, navigator, listeners, timers,
    get state() { return state; }, get write() { return write; }, get writes() { return writes; },
    set error(value) { transactionError = value; }, set server(value) { server = value; },
    failLoad() { subscriber.error(new Error('unavailable')); return render(); },
    signOut() { authCallback(null); return render(); }
  };
}

test('initial cached/default data never becomes ready; authoritative content wins', () => {
  const f = fixture(); assert.equal(f.state.ready, false);
  f.snapshot(undefined, true); assert.equal(f.state.ready, false);
  const fresh = structuredClone(f.original); fresh.profile.introDescription = '최신 소개';
  f.snapshot(fresh); assert.equal(f.state.ready, true); assert.equal(f.state.content.profile.introDescription, '최신 소개');
  const stale = structuredClone(fresh); stale.profile.introDescription = '예전 소개';
  f.snapshot(stale, true); assert.equal(f.state.content.profile.introDescription, '최신 소개');
  f.snapshot(stale, false, true); assert.equal(f.state.content.profile.introDescription, '최신 소개');
});

test('load errors and timeout do not expose old defaults', () => {
  const f = fixture(); f.failLoad(); assert.equal(f.state.ready, false); assert.ok(f.state.loadError);
  const g = fixture(); [...g.timers.values()].forEach(fn => fn()); g.render(); assert.equal(g.state.ready, false); assert.ok(g.state.loadError);
});

test('draft updates, undo/redo and discard never write to Firestore', () => {
  const f = fixture(); f.snapshot(f.original); f.state.beginEditing(); f.render();
  f.state.update({ profile: { ...f.state.content.profile, teacherName: '편집한 이름' } }); f.render();
  assert.equal(f.state.dirty, true); assert.equal(f.writes, 0); assert.ok(f.listeners.has('beforeunload'));
  f.state.undo(); f.render(); assert.equal(f.state.content.profile.teacherName, f.original.profile.teacherName); assert.equal(f.state.dirty, false);
  f.state.redo(); f.render(); assert.equal(f.state.content.profile.teacherName, '편집한 이름');
  f.state.discard(); f.render(); assert.equal(f.state.dirty, false); assert.equal(f.state.content.profile.teacherName, f.original.profile.teacherName);
});

test('failed saves retain the draft and report failure; retry publishes only after acknowledgement', async () => {
  const f = fixture(); f.snapshot(f.original); f.state.beginEditing(); f.render();
  f.state.update({ profile: { ...f.state.content.profile, teacherName: '보존할 이름' } }); f.render();
  f.error = new Error('network failure'); assert.equal(await f.state.save(), false); f.render();
  assert.equal(f.state.saveStatus, 'error'); assert.equal(f.state.dirty, true); assert.equal(f.state.content.profile.teacherName, '보존할 이름');
  f.error = null; assert.equal(await f.state.save(), true); f.render();
  assert.equal(f.write.profile.teacherName, '보존할 이름'); assert.equal(f.write.updatedAt, 'SERVER_TIMESTAMP'); assert.equal(f.state.dirty, false); assert.equal(f.state.saveStatus, 'saved');
});

test('server-side conflict detection prevents stale drafts overwriting another window', async () => {
  const f = fixture(); f.snapshot(f.original); f.state.beginEditing(); f.render();
  f.state.update({ profile: { ...f.state.content.profile, teacherName: '내 초안' } }); f.render();
  const remote = structuredClone(f.original); remote.profile.teacherName = '다른 창의 수정'; f.server = remote;
  assert.equal(await f.state.save(), false); f.render(); assert.equal(f.writes, 0); assert.equal(f.state.content.profile.teacherName, '내 초안');
  f.snapshot(remote); assert.equal(f.state.conflict, true); f.state.discard(); f.render(); assert.equal(f.state.content.profile.teacherName, '다른 창의 수정');
});

test('deleting tabs and nested content is permanent; optional tabs do not resurrect', async () => {
  const f = fixture(); f.snapshot(f.original); f.state.beginEditing(); f.render();
  const blocks = { ...f.state.content.blocks }; delete blocks.photo;
  f.state.update({ blocks, tabs: f.state.content.tabs.filter(tab => !['photo', 'oekaki'].includes(tab.kind)) }); f.render();
  assert.equal(await f.state.save(), true); assert.equal('photo' in f.write.blocks, false);
  const normalized = f.site.normalize(f.write); assert.equal(normalized.tabs.some(tab => tab.kind === 'oekaki'), false);
});

test('fixed wave link, safe protocols and stable defaults are enforced', () => {
  const f = fixture(); const a = f.site.defaultContent(), b = f.site.defaultContent();
  assert.equal(f.editor.contentFingerprint(a), f.editor.contentFingerprint(b));
  assert.equal(f.editor.contentFingerprint({ a: 1, b: 2 }), f.editor.contentFingerprint({ b: 2, a: 1 }));
  const fixed = f.site.normalize({ waveLinks: [{ id: 'other', label: '다른 링크', href: 'https://example.com' }] });
  assert.equal(fixed.waveLinks[0].id, 'dorms-activity'); assert.equal(f.editor.safeHref('javascript:alert(1)'), false);
  a.waveLinks[1].href = 'data:text/html,unsafe'; assert.ok(f.editor.validateContent(a));
});

test('offline saves fail visibly and signing out removes owner draft', async () => {
  const f = fixture(); f.snapshot(f.original); f.state.beginEditing(); f.render();
  f.state.update({ profile: { ...f.state.content.profile, teacherName: '임시 내용' } }); f.render();
  f.navigator.onLine = false; assert.equal(await f.state.save(), false); f.render(); assert.equal(f.state.dirty, true); assert.equal(f.writes, 0);
  f.signOut(); assert.equal(f.state.isOwner, false); assert.equal(f.state.dirty, false);
});

test('an open but unchanged editor follows new server content without a false conflict', () => {
  const f = fixture(); f.snapshot(f.original); f.state.beginEditing(); f.render();
  const remote = structuredClone(f.original); remote.profile.teacherName = '방금 저장된 이름';
  f.snapshot(remote); assert.equal(f.state.content.profile.teacherName, '방금 저장된 이름');
  assert.equal(f.state.dirty, false); assert.equal(f.state.conflict, false);
});
