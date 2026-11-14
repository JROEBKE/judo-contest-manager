const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('navigation opens only the selected section and toggles it closed', () => {
  const sectionIds = ['teamsSection','day1','day2','rankingSection'];
  const sections = Object.fromEntries(sectionIds.map(id => [
    id,
    {open:id === 'teamsSection', scrollIntoView() {}}
  ]));
  const context = {
    localStorage: {getItem:() => null, setItem() {}, removeItem() {}},
    window: {addEventListener() {}},
    document: {getElementById:id => sections[id] || null}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'ui.js'), 'utf8'), context);

  context.toggleSection('day1');
  assert.deepEqual(sectionIds.map(id => sections[id].open), [false, true, false, false]);

  context.toggleSection('day1');
  assert.deepEqual(sectionIds.map(id => sections[id].open), [false, false, false, false]);
});

test('section navigation uses keyboard-operable buttons with explicit targets', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const nav = html.match(/<div class="side-panel nav">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(nav, 'navigation panel should exist');
  assert.doesNotMatch(nav, /<a\b/);

  const targets = [...nav.matchAll(/<button\b[^>]*aria-controls="([^"]+)"/g)]
    .map(([, target]) => target);
  assert.deepEqual(targets, ['teamsSection','day1','day2','rankingSection']);
});

test('offers live match and ranking views in separate tabs', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const panel = html.match(/<div class="side-panel live-panel">([\s\S]*?)<\/div>/)?.[1];

  assert.ok(panel, 'live views panel should exist');
  assert.match(panel, /Live Views/);
  assert.match(panel, /openLiveView\('matches'\)[^>]*>Begegnungen/);
  assert.match(panel, /openLiveView\('ranking'\)[^>]*>Live Ranking/);
});

test('opens the selected live view in a separate tab', () => {
  const opened = [];
  const context = {
    localStorage: {getItem:() => null, setItem() {}, removeItem() {}},
    window: {
      addEventListener() {},
      open:(...args) => { opened.push(args); }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'ui.js'), 'utf8'), context);

  context.openLiveView('matches');
  context.openLiveView('ranking');

  assert.deepEqual(opened, [
    ['./live.html?view=matches','_blank','noopener,noreferrer'],
    ['./live.html?view=ranking','_blank','noopener,noreferrer']
  ]);
});
