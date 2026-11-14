const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const uiSource = fs.readFileSync(path.join(root, 'ui.js'), 'utf8');

function loadUi(storedValue){
  const alerts = [];
  const errors = [];
  let savedValue = storedValue;
  const context = {
    localStorage: {
      getItem: () => storedValue,
      setItem: (key, value) => { savedValue = value; },
      removeItem() {}
    },
    window: {addEventListener() {}},
    alert: message => alerts.push(message),
    console: {error: (...args) => errors.push(args)}
  };
  vm.createContext(context);
  vm.runInContext(uiSource, context);
  return {
    context,
    data: vm.runInContext('data', context),
    alerts,
    errors,
    get savedValue(){ return savedValue; }
  };
}

test('migrates versionless tournament data to the current schema', () => {
  const legacy = JSON.parse(fs.readFileSync(
    path.join(root, 'testfiles', '01_direkter_vergleich_2er_entscheidet.json'),
    'utf8'
  ));
  delete legacy.version;
  delete legacy.tournamentTitle;

  const {context} = loadUi(null);
  const migrated = context.normalizeTournamentData(legacy);

  assert.equal(migrated.version, 3);
  assert.equal(migrated.matCount, 2);
  assert.equal(migrated.tournamentTitle, '');
  assert.equal(migrated.teams.length, 4);
  assert.equal(migrated.matches.length, 6);
});

test('persists version-1 localStorage migration', () => {
  const legacy = JSON.parse(fs.readFileSync(
    path.join(root, 'testfiles', '01_direkter_vergleich_2er_entscheidet.json'),
    'utf8'
  ));
  delete legacy.version;

  const {data, savedValue} = loadUi(JSON.stringify(legacy));

  assert.equal(data.version, 3);
  assert.equal(data.matCount, 2);
  assert.equal(JSON.parse(savedValue).version, 3);
});

test('migrates version-2 data to the current schema with two mats', () => {
  const legacy = JSON.parse(fs.readFileSync(
    path.join(root, 'testfiles', '01_direkter_vergleich_2er_entscheidet.json'),
    'utf8'
  ));
  legacy.version = 2;

  const {context} = loadUi(null);
  const migrated = context.normalizeTournamentData(legacy);

  assert.equal(migrated.version, 3);
  assert.equal(migrated.matCount, 2);
});

test('validates mat count while preserving existing matches after a setting change', () => {
  const fixture = JSON.parse(fs.readFileSync(
    path.join(root, 'testfiles', '01_direkter_vergleich_2er_entscheidet.json'),
    'utf8'
  ));
  const {context} = loadUi(null);

  assert.throws(
    () => context.normalizeTournamentData({...fixture, version:3, matCount:5}),
    /Mattenanzahl/
  );
  const normalized = context.normalizeTournamentData({
    ...fixture,
    version:3,
    matCount:1,
    matches:fixture.matches.map(match => ({...match, mat:4}))
  });
  assert.equal(normalized.matCount, 1);
  assert.equal(normalized.matches[0].mat, 4);
});

test('persists mat count changes for future schedules', () => {
  const harness = loadUi(null);

  harness.context.updateMatCount('4');

  assert.equal(vm.runInContext('data.matCount', harness.context), 4);
  assert.equal(JSON.parse(harness.savedValue).matCount, 4);
});

test('rejects invalid results and unsupported data versions', () => {
  const fixture = JSON.parse(fs.readFileSync(
    path.join(root, 'testfiles', '01_direkter_vergleich_2er_entscheidet.json'),
    'utf8'
  ));
  const {context} = loadUi(null);

  const invalidResult = structuredClone(fixture);
  invalidResult.matches[0].fightsA = 10;
  assert.throws(() => context.normalizeTournamentData(invalidResult), /Ergebnis/);

  assert.throws(
    () => context.normalizeTournamentData({...fixture, version:99}),
    /Version/
  );
});

test('reports malformed localStorage data and starts with an empty tournament', () => {
  const {data, alerts, errors} = loadUi('{invalid json');

  assert.deepEqual(JSON.parse(JSON.stringify(data)), {
    version:3,
    tournamentTitle:'',
    matCount:2,
    teams:[],
    matches:[]
  });
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /ungültig/i);
  assert.equal(errors.length, 1);
});
