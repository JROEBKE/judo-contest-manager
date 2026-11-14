/*
  Application state
  -----------------
  The whole tournament is stored in one JSON-compatible object and persisted in localStorage.
  This allows to implement it as a single static HTML file without any backend dependency and central data storage.
*/
const CURRENT_DATA_VERSION = 2;

function isRecord(value){
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function createEmptyTournament(){
  return {version:CURRENT_DATA_VERSION, tournamentTitle:'', teams:[], matches:[]};
}

/** Migrates supported old data and validates the tournament structure before use. */
function normalizeTournamentData(value){
  if(!isRecord(value)) throw new Error('Turnierdaten müssen ein JSON-Objekt sein.');

  const sourceVersion = value.version === undefined ? 1 : value.version;
  if(sourceVersion !== 1 && sourceVersion !== CURRENT_DATA_VERSION){
    throw new Error('Diese Turnierdaten-Version wird nicht unterstützt.');
  }

  const normalized = sourceVersion === 1
    ? {
      ...value,
      version:CURRENT_DATA_VERSION,
      tournamentTitle:value.tournamentTitle === undefined ? '' : value.tournamentTitle
    }
    : value;

  if(!Array.isArray(normalized.teams)) throw new Error('Die Mannschaftsliste ist ungültig.');
  if(normalized.teams.length > 10) throw new Error('Ein Turnier darf höchstens 10 Mannschaften enthalten.');
  if(!Array.isArray(normalized.matches)) throw new Error('Die Begegnungsliste ist ungültig.');
  if(typeof normalized.tournamentTitle !== 'string') throw new Error('Der Turniertitel muss Text sein.');

  const teams = normalized.teams.map((team, index) => {
    if(!isRecord(team) || typeof team.name !== 'string' || !team.name.trim()){
      throw new Error(`Mannschaft ${index + 1} hat keinen gültigen Namen.`);
    }
    if(typeof team.saved !== 'boolean'){
      throw new Error(`Der Speicherstatus von Mannschaft ${index + 1} ist ungültig.`);
    }
    return {...team, name:team.name.trim()};
  });

  const teamNames = new Set(teams.map(team => team.name));
  if(teamNames.size !== teams.length) throw new Error('Mannschaftsnamen müssen eindeutig sein.');

  const matches = normalized.matches.map((match, index) => {
    if(!isRecord(match)) throw new Error(`Begegnung ${index + 1} ist ungültig.`);
    if(typeof match.a !== 'string' || typeof match.b !== 'string' ||
       !teamNames.has(match.a) || !teamNames.has(match.b) || match.a === match.b){
      throw new Error(`Die Mannschaften in Begegnung ${index + 1} sind ungültig.`);
    }
    if(![1,2].includes(match.day) || !Number.isInteger(match.block) || match.block < 1 ||
       ![1,2].includes(match.mat)){
      throw new Error(`Tag, Block oder Matte von Begegnung ${index + 1} sind ungültig.`);
    }
    if(!Number.isInteger(match.fightsA) || match.fightsA < 0 || match.fightsA > 9 ||
       !Number.isInteger(match.fightsB) || match.fightsB < 0 || match.fightsB > 9 ||
       !Number.isInteger(match.scoreA) || match.scoreA < 0 || match.scoreA > 900 ||
       !Number.isInteger(match.scoreB) || match.scoreB < 0 || match.scoreB > 900){
      throw new Error(`Das Ergebnis von Begegnung ${index + 1} ist ungültig.`);
    }
    if(typeof match.saved !== 'boolean'){
      throw new Error(`Der Speicherstatus von Begegnung ${index + 1} ist ungültig.`);
    }
    return {...match};
  });

  return {...normalized, teams, matches};
}

function loadTournamentData(){
  let stored;
  try {
    stored = localStorage.getItem('turnier');
  } catch(error) {
    console.error('Turnierdaten konnten nicht gelesen werden:', error);
    alert('Die lokal gespeicherten Turnierdaten sind nicht verfügbar. Ein leeres Turnier wird geladen.');
    return createEmptyTournament();
  }
  if(stored === null) return createEmptyTournament();

  try {
    const parsed = JSON.parse(stored);
    const normalized = normalizeTournamentData(parsed);
    if(parsed.version !== normalized.version){
      try {
        localStorage.setItem('turnier', JSON.stringify(normalized));
      } catch(error) {
        console.error('Migrierte Turnierdaten konnten nicht gespeichert werden:', error);
        alert('Die Turnierdaten wurden migriert, konnten aber nicht dauerhaft gespeichert werden.');
      }
    }
    return normalized;
  } catch(error) {
    console.error('Lokal gespeicherte Turnierdaten sind ungültig:', error);
    alert(`Die lokal gespeicherten Turnierdaten sind ungültig (${error.message}). Ein leeres Turnier wird geladen.`);
    return createEmptyTournament();
  }
}

let data = loadTournamentData();
const save = () => localStorage.setItem('turnier', JSON.stringify(data));

/** Scrolls to a main section from the right-side navigation. */
function scrollToId(id){
  const el = document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

/** Updates and persists the tournament title. */
function updateTournamentTitle(title){
  data.tournamentTitle = title;
  save();
}

/** Toggles one main section and closes the other main sections. */
function toggleSection(id){
  const sectionIds = ['teamsSection','day1','day2','rankingSection'];
  const target = document.getElementById(id);
  if(!target || !sectionIds.includes(id)) return;

  const shouldOpen = !target.open;
  sectionIds.forEach(sectionId => {
    document.getElementById(sectionId).open = sectionId === id && shouldOpen;
  });
  scrollToId(id);
}

/**
 * Resets the tournament to the initial empty state.
 * This removes the persisted localStorage entry used by this page and re-renders all sections.
 */
function resetTournament(){
  const confirmed = confirm('Alle lokal gespeicherten Turnierdaten wirklich löschen?');
  if(!confirmed) return;

  localStorage.removeItem('turnier');
  data = createEmptyTournament();
  document.getElementById('tournamentTitle').value = '';
  document.getElementById('teamsSection').open = true;
  document.getElementById('day1').open = false;
  document.getElementById('day2').open = false;
  document.getElementById('rankingSection').open = false;

  const upload = document.getElementById('uploadFile');
  if(upload) upload.value = '';

  renderTeams();
  renderMatches();
  calculateRanking();
}

/** Initializes default teams and clears existing matches. Teams are editable immediately. */
function initTeams(){
  const n = parseInt(document.getElementById('teamCount').value, 10);
  data.version = CURRENT_DATA_VERSION;
  data.teams = [];
  data.matches = [];
  for(let i=1;i<=n;i++) data.teams.push({name:'Mannschaft ' + i, saved:false});
  renderTeams();
  renderMatches();
  save();
}

/** Renders team rows with Save/Edit actions. */
function renderTeams(){
  const c = document.getElementById('teamTable');
  c.innerHTML = '';

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Mannschaft</th><th>Aktion</th></tr></thead><tbody></tbody>';
  const tbody = table.querySelector('tbody');

  data.teams.forEach(team => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input value="${escapeHtml(team.name)}" ${team.saved ? 'disabled' : ''}></td><td></td>`;

    const btn = document.createElement('button');
    btn.textContent = team.saved ? 'Edit' : 'Speichern';
    btn.onclick = () => {
      if(team.saved){
        team.saved = false;
      } else {
        const value = tr.querySelector('input').value.trim();
        if(!value){ alert('Bitte einen Mannschaftsnamen eingeben.'); return; }
        team.name = value;
        team.saved = true;
      }
      renderTeams();
      save();
    };

    tr.children[1].appendChild(btn);
    tbody.appendChild(tr);
  });

  c.appendChild(table);
}

/** Returns all non-empty team names. Names are used even while a row is still in edit mode. */
function getTeamNames(){
  return data.teams.map(t => (t.name || '').trim()).filter(Boolean);
}

/** Escapes user-entered text before inserting it into HTML. */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/** Formats decimal values using German comma notation. */
function formatNumber(n){ return Number.isInteger(n) ? String(n) : String(n).replace('.', ','); }

function initializeApp(){
  document.getElementById('tournamentTitle').value = data.tournamentTitle || '';
  renderTeams();
  renderMatches();
  calculateRanking();
}

window.addEventListener('DOMContentLoaded', initializeApp);
