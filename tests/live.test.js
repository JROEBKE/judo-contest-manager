const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const rankingSource = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
const liveSource = fs.readFileSync(path.join(root, 'live.js'), 'utf8');

function makeTournament(matches = []){
  return {
    version:3,
    tournamentTitle:'Testturnier',
    matCount:2,
    teams:[
      {name:'Mannschaft A', saved:true},
      {name:'Mannschaft B', saved:true},
      {name:'Mannschaft C', saved:true},
      {name:'Mannschaft D', saved:true}
    ],
    matches
  };
}

function makeMatch(a, b, block, mat, saved = false, fightsA = 0, fightsB = 0){
  return {
    a,b,day:1,block,mat,fightsA,fightsB,
    scoreA:fightsA * 10,scoreB:fightsB * 10,saved
  };
}

function createLiveHarness(view, tournament){
  const elements = new Map([
    'liveTitle','liveStatus','liveError','liveContent','matchesView',
    'matchesBoard','rankingView','rankingEmpty','directLegend'
  ].map(id => [id, {innerHTML:'',textContent:'',hidden:false,style:{}}]));
  const rankingBody = {innerHTML:''};
  const listeners = {};
  const errors = [];
  let stored = JSON.stringify(tournament);
  const context = {
    localStorage: {getItem:() => stored},
    window: {
      location:{search:`?view=${view}`},
      addEventListener:(type, listener) => { listeners[type] = listener; }
    },
    document: {
      title:'',
      getElementById:id => elements.get(id),
      querySelector:selector => selector === '#rankingTable tbody' ? rankingBody : null
    },
    console:{error:(...args) => errors.push(args)},
    URLSearchParams,
    Date
  };
  vm.createContext(context);
  vm.runInContext(rankingSource, context);
  vm.runInContext(liveSource, context);
  listeners.DOMContentLoaded();

  return {
    context,
    elements,
    rankingBody,
    errors,
    update(nextTournament){
      stored = JSON.stringify(nextTournament);
      listeners.storage({key:'turnier',newValue:stored});
    }
  };
}

test('shows the next unsaved matches in order on each mat and updates after a result is saved', () => {
  const tournament = makeTournament([
    makeMatch('Mannschaft A','Mannschaft B',1,1),
    makeMatch('Mannschaft C','Mannschaft D',1,2),
    makeMatch('Mannschaft A','Mannschaft C',2,1),
    makeMatch('Mannschaft B','Mannschaft D',2,2),
    {...makeMatch('Mannschaft A','Mannschaft D',1,1), day:2, block:1},
    {...makeMatch('Mannschaft B','Mannschaft C',1,2), day:2, block:1}
  ]);
  const harness = createLiveHarness('matches', tournament);
  let board = harness.elements.get('matchesBoard').innerHTML;

  assert.equal(harness.elements.get('liveTitle').textContent, 'Begegnungen – Testturnier');
  assert.match(board, /Matte 1[\s\S]*Aktuell[\s\S]*Mannschaft A[\s\S]*Nächste Begegnung[\s\S]*Mannschaft A/);
  assert.match(board, /Matte 2[\s\S]*Aktuell[\s\S]*Mannschaft C[\s\S]*Nächste Begegnung[\s\S]*Mannschaft B/);
  assert.equal((board.match(/class="match-slot/g) || []).length, 4);
  assert.match(fs.readFileSync(path.join(root, 'live.html'), 'utf8'), /Mannschaftsaufstellungen abgeben/);

  tournament.matches[0].saved = true;
  tournament.matches[1].saved = true;
  harness.update(tournament);
  board = harness.elements.get('matchesBoard').innerHTML;
  assert.match(board, /Matte 1[\s\S]*Aktuell[\s\S]*Mannschaft A[\s\S]*Ende von Wettkampftag 1/);
  assert.match(board, /Matte 2[\s\S]*Aktuell[\s\S]*Mannschaft B[\s\S]*Ende von Wettkampftag 1/);

  tournament.matches[2].saved = true;
  harness.update(tournament);
  board = harness.elements.get('matchesBoard').innerHTML;
  assert.match(board, /Matte 1[\s\S]*Keine offene Begegnung[\s\S]*Ende von Wettkampftag 1/);
  assert.doesNotMatch(board, /Mannschaft A <span aria-label="gegen">–<\/span> Mannschaft D/);
  assert.match(board, /Matte 2[\s\S]*Aktuell[\s\S]*Mannschaft B[\s\S]*Ende von Wettkampftag 1/);

  tournament.matches[3].saved = true;
  harness.update(tournament);
  board = harness.elements.get('matchesBoard').innerHTML;
  assert.match(board, /Matte 1[\s\S]*Aktuell[\s\S]*Mannschaft A[\s\S]*Ende von Wettkampftag 2/);
  assert.match(board, /Matte 2[\s\S]*Aktuell[\s\S]*Mannschaft B[\s\S]*Ende von Wettkampftag 2/);
  assert.deepEqual(harness.errors, []);
});

test('renders the shared ranking calculation and refreshes it after saved results change', () => {
  const tournament = makeTournament([
    makeMatch('Mannschaft A','Mannschaft B',1,1,true,3,1)
  ]);
  const harness = createLiveHarness('ranking', tournament);

  assert.equal(harness.elements.get('liveTitle').textContent, 'Ranking – Testturnier');
  assert.match(harness.rankingBody.innerHTML, /Mannschaft A<\/td><td>1<\/td><td>1:0/);

  tournament.matches.push(makeMatch('Mannschaft A','Mannschaft C',2,1,true,2,1));
  harness.update(tournament);
  assert.match(harness.rankingBody.innerHTML, /Mannschaft A<\/td><td>2<\/td><td>2:0/);
  assert.equal(harness.elements.get('rankingView').hidden, false);
  assert.deepEqual(harness.errors, []);
});

test('shows an explicit message when live tournament data is malformed', () => {
  const harness = createLiveHarness('matches', makeTournament());

  harness.update({teams:'invalid',matches:[]});

  assert.equal(harness.elements.get('liveContent').hidden, true);
  assert.match(harness.elements.get('liveError').textContent, /ungültiges Format/i);
  assert.equal(harness.elements.get('liveError').hidden, false);
});
