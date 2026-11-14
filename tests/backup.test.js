const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createBackupHarness(fileContents){
  const alerts = [];
  const errors = [];
  const titleInput = {value:''};
  let stored = null;
  let renderCount = 0;
  class FileReaderStub {
    readAsText(){
      this.onload({target:{result:fileContents}});
    }
  }
  const context = {
    localStorage: {
      getItem: () => null,
      setItem: (key, value) => { stored = value; },
      removeItem() {}
    },
    window: {addEventListener() {}},
    document: {getElementById: id => id === 'tournamentTitle' ? titleInput : null},
    FileReader: FileReaderStub,
    alert: message => alerts.push(message),
    console: {error: (...args) => errors.push(args)}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'ui.js'), 'utf8'), context);
  context.renderTeams = () => { renderCount++; };
  context.renderMatches = () => { renderCount++; };
  vm.runInContext(fs.readFileSync(path.join(root, 'backup.js'), 'utf8'), context);

  return {
    context,
    alerts,
    errors,
    titleInput,
    get stored(){ return stored; },
    get renderCount(){ return renderCount; }
  };
}

function upload(harness){
  harness.context.loadFile({target:{files:[{name:'backup.json'}]}});
}

test('imports and migrates a valid legacy backup', () => {
  const fixture = JSON.parse(fs.readFileSync(
    path.join(root, 'testfiles', '01_direkter_vergleich_2er_entscheidet.json'),
    'utf8'
  ));
  delete fixture.version;
  const harness = createBackupHarness(JSON.stringify(fixture));

  upload(harness);

  const imported = vm.runInContext('data', harness.context);
  assert.equal(imported.version, 2);
  assert.equal(imported.tournamentTitle, 'Testturnier 2026');
  assert.equal(harness.titleInput.value, 'Testturnier 2026');
  assert.equal(harness.renderCount, 2);
  assert.equal(JSON.parse(harness.stored).version, 2);
  assert.deepEqual(harness.alerts, []);
});

test('rejects invalid backup data without replacing the current tournament', () => {
  const fixture = JSON.parse(fs.readFileSync(
    path.join(root, 'testfiles', '01_direkter_vergleich_2er_entscheidet.json'),
    'utf8'
  ));
  fixture.matches[0].fightsA = 99;
  const harness = createBackupHarness(JSON.stringify(fixture));

  upload(harness);

  const current = vm.runInContext('data', harness.context);
  assert.equal(current.teams.length, 0);
  assert.equal(harness.stored, null);
  assert.equal(harness.renderCount, 0);
  assert.match(harness.alerts[0], /ungültiges Backup.*Ergebnis/i);
});

test('reports malformed backup JSON', () => {
  const harness = createBackupHarness('{invalid json');

  upload(harness);

  assert.equal(harness.stored, null);
  assert.match(harness.alerts[0], /kein gültiges JSON/i);
  assert.equal(harness.errors.length, 1);
});

test('builds a dated backup filename with the tournament title', () => {
  const harness = createBackupHarness(null);
  vm.runInContext('data.tournamentTitle = "Bezirkspokal 2026"', harness.context);

  assert.equal(
    harness.context.getBackupFileName(new Date(2026, 0, 5)),
    '20260105-Bezirkspokal-2026-backup.json'
  );
});

test('uses JudoContest when no usable tournament title exists', () => {
  const harness = createBackupHarness(null);
  const date = new Date(2026, 10, 14);

  assert.equal(harness.context.getBackupFileName(date), '20261114-JudoContest-backup.json');
  vm.runInContext('data.tournamentTitle = " /:*? "', harness.context);
  assert.equal(harness.context.getBackupFileName(date), '20261114-JudoContest-backup.json');
});

test('removes filename-unsafe characters from tournament titles', () => {
  const harness = createBackupHarness(null);
  vm.runInContext('data.tournamentTitle = "Final: Runde 1/2"', harness.context);

  assert.equal(
    harness.context.getBackupFileName(new Date(2026, 0, 5)),
    '20260105-Final-Runde-12-backup.json'
  );
});
