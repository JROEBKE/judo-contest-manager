const LIVE_DATA_KEY = 'turnier';
const EMPTY_LIVE_TOURNAMENT = {tournamentTitle:'', matCount:2, teams:[], matches:[]};
let data;
let activeView;

function isLiveRecord(value){
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, character => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[character]));
}

function getTeamNames(){
  return data.teams.map(team => team.name);
}

function formatNumber(value){
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

function parseLiveTournament(raw){
  if(raw === null) return {...EMPTY_LIVE_TOURNAMENT};

  const tournament = JSON.parse(raw);
  if(!isLiveRecord(tournament) ||
     !Array.isArray(tournament.teams) ||
     !Array.isArray(tournament.matches)){
    throw new Error('Das gespeicherte Turnier hat ein ungültiges Format.');
  }
  const tournamentTitle = tournament.tournamentTitle === undefined ? '' : tournament.tournamentTitle;
  if(typeof tournamentTitle !== 'string'){
    throw new Error('Der Turniertitel muss Text sein.');
  }
  if(tournament.matCount !== undefined &&
     (!Number.isInteger(tournament.matCount) || tournament.matCount < 1 || tournament.matCount > 4)){
    throw new Error('Die Mattenanzahl muss eine ganze Zahl zwischen 1 und 4 sein.');
  }

  const teamNames = new Set();
  tournament.teams.forEach((team, index) => {
    if(!isLiveRecord(team) || typeof team.name !== 'string' || !team.name.trim()){
      throw new Error(`Mannschaft ${index + 1} hat keinen gültigen Namen.`);
    }
    if(teamNames.has(team.name)){
      throw new Error('Mannschaftsnamen müssen eindeutig sein.');
    }
    teamNames.add(team.name);
  });

  tournament.matches.forEach((match, index) => {
    if(!isLiveRecord(match) ||
       typeof match.a !== 'string' || typeof match.b !== 'string' ||
       !teamNames.has(match.a) || !teamNames.has(match.b) || match.a === match.b ||
       ![1,2].includes(match.day) || !Number.isInteger(match.block) || match.block < 1 ||
       !Number.isInteger(match.mat) || match.mat < 1 || match.mat > 4 ||
       typeof match.saved !== 'boolean' ||
       !Number.isInteger(match.fightsA) || match.fightsA < 0 || match.fightsA > 9 ||
       !Number.isInteger(match.fightsB) || match.fightsB < 0 || match.fightsB > 9 ||
       !Number.isInteger(match.scoreA) || match.scoreA < 0 || match.scoreA > 900 ||
       !Number.isInteger(match.scoreB) || match.scoreB < 0 || match.scoreB > 900){
      throw new Error(`Begegnung ${index + 1} ist ungültig.`);
    }
  });

  return {
    ...tournament,
    tournamentTitle,
    matCount:tournament.matCount === undefined ? 2 : tournament.matCount
  };
}

function showLiveError(error){
  console.error('Live-Ansicht konnte nicht aktualisiert werden:', error);
  document.getElementById('liveError').textContent =
    `Turnierdaten konnten nicht geladen werden: ${error.message}`;
  document.getElementById('liveError').hidden = false;
  document.getElementById('liveContent').hidden = true;
  document.getElementById('liveStatus').textContent = 'Aktualisierung fehlgeschlagen';
}

function formatMatch(match){
  return `
    <div class="team-pair">
      <span class="team-name">${escapeHtml(match.a)}</span>
      <span class="versus" aria-label="gegen">–</span>
      <span class="team-name">${escapeHtml(match.b)}</span>
    </div>`;
}

function renderMatchSlot(match, label, emptyMessage, className){
  const labelHtml = label ? `<span class="match-label">${label}</span>` : '';
  const content = match ? formatMatch(match) : `<div class="slot-message">${emptyMessage}</div>`;
  return `<section class="match-slot ${className}">${labelHtml}${content}</section>`;
}

function renderMatchesView(){
  const pending = data.matches
    .map((match, index) => ({...match, originalIndex:index}))
    .filter(match => !match.saved)
    .sort((a, b) => a.day - b.day || a.block - b.block ||
      a.mat - b.mat || a.originalIndex - b.originalIndex);
  const activeDay = [1,2].find(day => pending.some(match => match.day === day));
  const currentDayMatches = activeDay
    ? pending.filter(match => match.day === activeDay)
    : [];
  const highestScheduledMat = data.matches.reduce(
    (highest, match) => Math.max(highest, match.mat), 0
  );
  const matCount = Math.max(data.matCount, highestScheduledMat);
  const board = document.getElementById('matchesBoard');

  board.innerHTML = Array.from({length:matCount}, (_, index) => {
    const mat = index + 1;
    const matches = currentDayMatches.filter(match => match.mat === mat);
    const current = matches[0];
    const next = current && matches.find(match => match.day === current.day && match !== current);
    const currentSlot = renderMatchSlot(
      current,
      'Aktuell',
      'Keine offene Begegnung',
      'current-match'
    );
    const nextSlot = next
      ? renderMatchSlot(next, 'Nächste Begegnung', '', 'next-match')
      : activeDay
        ? renderMatchSlot(null, '', `Ende von Wettkampftag ${activeDay}`, 'day-end')
        : renderMatchSlot(null, 'Danach', 'Keine nächste Begegnung', 'next-match');

    return `
      <article class="mat-card">
        <h2>Matte ${mat}</h2>
        ${currentSlot}
        ${nextSlot}
      </article>`;
  }).join('');
}

function renderLiveView(){
  const viewLabel = activeView === 'ranking' ? 'Ranking' : 'Begegnungen';
  const title = data.tournamentTitle.trim();
  document.getElementById('liveTitle').textContent =
    title ? `${viewLabel} – ${title}` : viewLabel;
  document.title = document.getElementById('liveTitle').textContent;
  document.getElementById('liveStatus').textContent =
    `Live-Aktualisierung aktiv · Stand ${new Date().toLocaleTimeString('de-DE')}`;
  document.getElementById('liveError').hidden = true;
  document.getElementById('liveContent').hidden = false;

  const matchesView = document.getElementById('matchesView');
  const rankingView = document.getElementById('rankingView');
  matchesView.hidden = activeView !== 'matches';
  rankingView.hidden = activeView !== 'ranking';

  if(activeView === 'matches'){
    renderMatchesView();
  } else {
    document.getElementById('rankingEmpty').hidden = data.teams.length > 0;
    calculateRanking();
  }
}

function refreshLiveView(raw){
  try {
    data = parseLiveTournament(raw);
    renderLiveView();
  } catch(error) {
    showLiveError(error);
  }
}

function handleLiveStorage(event){
  if(event.key !== LIVE_DATA_KEY && event.key !== null) return;
  refreshLiveView(event.newValue);
}

function initializeLiveView(){
  const view = new URLSearchParams(window.location.search).get('view') || 'matches';
  if(view !== 'matches' && view !== 'ranking'){
    showLiveError(new Error('Die angeforderte Live-Ansicht ist unbekannt.'));
    return;
  }
  activeView = view;
  window.addEventListener('storage', handleLiveStorage);

  try {
    refreshLiveView(localStorage.getItem(LIVE_DATA_KEY));
  } catch(error) {
    showLiveError(error);
  }
}

window.addEventListener('DOMContentLoaded', initializeLiveView);
