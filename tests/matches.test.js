const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const matchesSource = fs.readFileSync(path.resolve(__dirname, '..', 'matches.js'), 'utf8');

function generateSchedule(teamCount, matCount = 2){
  const teams = Array.from({length:teamCount}, (_, index) => `Mannschaft ${index + 1}`);
  const sections = {
    teamsSection: {open:true},
    day1: {open:false},
    day2: {open:false}
  };
  const alerts = [];
  const context = {
    data: {matches:[], matCount},
    getTeamNames: () => teams,
    save() {},
    alert: message => alerts.push(message),
    document: {getElementById: id => sections[id] || null}
  };
  vm.createContext(context);
  vm.runInContext(matchesSource, context);
  context.renderMatches = () => {};
  context.generateMatches();
  return {matches:context.data.matches, sections, alerts};
}

for(const teamCount of [2, 4, 5, 6, 10]){
  for(const matCount of [1, 2, 3, 4]){
    test(`generates a valid schedule for ${teamCount} teams on ${matCount} mats`, () => {
      const {matches, sections, alerts} = generateSchedule(teamCount, matCount);
      const doubleRoundRobin = teamCount < 5;
      const expectedPairCount = teamCount * (teamCount - 1) / 2;
      const expectedMatchCount = expectedPairCount * (doubleRoundRobin ? 2 : 1);
      const matchesByPair = new Map();

      assert.deepEqual(alerts, []);
      assert.equal(matches.length, expectedMatchCount);
      assert.equal(matches.filter(match => match.day === 1).length,
        doubleRoundRobin ? expectedPairCount : Math.floor(expectedPairCount / 2));
      assert.equal(matches.filter(match => match.day === 2).length,
        doubleRoundRobin ? expectedPairCount : Math.ceil(expectedPairCount / 2));
      assert.equal(sections.teamsSection.open, false);
      assert.equal(sections.day1.open, true);

      matches.forEach(match => {
        const key = [match.a, match.b].sort().join('||');
        matchesByPair.set(key, [...(matchesByPair.get(key) || []), match]);
      });
      assert.equal(matchesByPair.size, expectedPairCount);
      for(const pairMatches of matchesByPair.values()){
        assert.equal(pairMatches.length, doubleRoundRobin ? 2 : 1);
        if(doubleRoundRobin){
          assert.deepEqual(
            pairMatches.map(match => [match.a, match.b]).sort(),
            pairMatches.map(match => [match.b, match.a]).sort()
          );
        }
      }

      const blocks = new Map();
      matches.forEach(match => {
        assert.ok(match.mat >= 1 && match.mat <= matCount);
        const key = `${match.day}:${match.block}`;
        blocks.set(key, [...(blocks.get(key) || []), match]);
      });
      for(const block of blocks.values()){
        assert.ok(block.length <= matCount);
        assert.equal(new Set(block.flatMap(match => [match.a, match.b])).size, block.length * 2);
        assert.equal(new Set(block.map(match => match.mat)).size, block.length);
      }
    });
  }
}

test('rejects schedules with fewer than two teams', () => {
  const {matches, alerts} = generateSchedule(1);
  assert.deepEqual(matches, []);
  assert.deepEqual(alerts, ['Bitte mindestens zwei Mannschaften initialisieren.']);
});
