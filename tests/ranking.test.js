const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function calculateRanking(fixture){
  const tbody = {innerHTML:''};
  const legend = {style:{}};
  const context = {
    data: fixture,
    getTeamNames: () => fixture.teams.map(team => team.name),
    escapeHtml: value => String(value),
    formatNumber: value => String(value),
    document: {
      querySelector: () => tbody,
      getElementById: () => legend
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'ranking.js'), 'utf8'), context);
  context.calculateRanking();

  const rows = [...tbody.innerHTML.matchAll(/<tr class="([^"]*)"><td>(\d+)<\/td><td>(.*?)<\/td>/g)];
  return rows.map(([, className, rank, team]) => ({
    rank: Number(rank),
    team,
    direct: className.includes('direct')
  }));
}

const expectedRankings = {
  '01_direkter_vergleich_2er_entscheidet.json': [
    {rank:1,team:'Mannschaft A',direct:true},
    {rank:2,team:'Mannschaft B',direct:true},
    {rank:3,team:'Mannschaft C',direct:false},
    {rank:4,team:'Mannschaft D',direct:false}
  ],
  '02_direkter_vergleich_2er_unentschieden_gleicher_rang.json': [
    {rank:1,team:'Mannschaft A',direct:false},
    {rank:1,team:'Mannschaft B',direct:false},
    {rank:3,team:'Mannschaft C',direct:false}
  ],
  '03_direkter_vergleich_3er_minitabelle_entscheidet.json': [
    {rank:1,team:'Mannschaft E',direct:false},
    {rank:2,team:'Mannschaft A',direct:true},
    {rank:3,team:'Mannschaft B',direct:true},
    {rank:4,team:'Mannschaft C',direct:true},
    {rank:5,team:'Mannschaft D',direct:false}
  ],
  '04_direkter_vergleich_3er_zyklus_gleicher_rang.json': [
    {rank:1,team:'Mannschaft A',direct:false},
    {rank:1,team:'Mannschaft B',direct:false},
    {rank:1,team:'Mannschaft C',direct:false}
  ],
  '05_vier_mannschaften_komplett_gleich.json': [
    {rank:1,team:'Mannschaft A',direct:false},
    {rank:1,team:'Mannschaft B',direct:false},
    {rank:1,team:'Mannschaft C',direct:false},
    {rank:1,team:'Mannschaft D',direct:false}
  ],
  '06_keine_ergebnisse_alle_null.json': [
    {rank:1,team:'Mannschaft A',direct:false},
    {rank:1,team:'Mannschaft B',direct:false},
    {rank:1,team:'Mannschaft C',direct:false},
    {rank:1,team:'Mannschaft D',direct:false}
  ],
  '07_teilweise_ergebnisse_nur_saved_zaehlt.json': [
    {rank:1,team:'Mannschaft A',direct:false},
    {rank:2,team:'Mannschaft D',direct:false},
    {rank:3,team:'Mannschaft C',direct:false},
    {rank:4,team:'Mannschaft B',direct:false}
  ],
  '08_hin_und_rueckrunde_home_away.json': [
    {rank:1,team:'Mannschaft C',direct:false},
    {rank:2,team:'Mannschaft A',direct:false},
    {rank:2,team:'Mannschaft D',direct:false},
    {rank:4,team:'Mannschaft B',direct:false}
  ],
  '09_grenzwerte_kampfergebnis_0_und_9.json': [
    {rank:1,team:'Mannschaft C',direct:false},
    {rank:2,team:'Mannschaft B',direct:false},
    {rank:3,team:'Mannschaft A',direct:false},
    {rank:4,team:'Mannschaft D',direct:false}
  ],
  '10_grenzwerte_unterbewertung_0_und_900.json': [
    {rank:1,team:'Mannschaft A',direct:false},
    {rank:1,team:'Mannschaft D',direct:false},
    {rank:3,team:'Mannschaft B',direct:false},
    {rank:3,team:'Mannschaft C',direct:false}
  ]
};

for(const [file, expected] of Object.entries(expectedRankings)){
  test(`ranking fixture ${file}`, () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(root, 'testfiles', file), 'utf8'));
    assert.deepEqual(calculateRanking(fixture), expected);
  });
}
