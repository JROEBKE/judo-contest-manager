/*
  Application state
  -----------------
  The whole tournament is stored in one JSON-compatible object and persisted in localStorage.
  This allows to implement it as a single static HTML file without any backend dependency and central data storage.
*/
let data = JSON.parse(localStorage.getItem('turnier')) || {version:1, teams:[], matches:[]};
if(data && !data.version){ data.version = 1; }
const save = () => localStorage.setItem('turnier', JSON.stringify(data));

/** Scrolls to a main section from the right-side navigation. */
function scrollToId(id){
  const el = document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

/**
 * Resets the tournament to the initial empty state.
 * This removes the persisted localStorage entry used by this page and re-renders all sections.
 */
function resetTournament(){
  const confirmed = confirm('Alle lokal gespeicherten Turnierdaten wirklich löschen?');
  if(!confirmed) return;

  localStorage.removeItem('turnier');
  data = {version:1, teams:[], matches:[]};

  const upload = document.getElementById('uploadFile');
  if(upload) upload.value = '';

  renderTeams();
  renderMatches();
  calculateRanking();
}

/** Initializes default teams and clears existing matches. Teams are editable immediately. */
function initTeams(){
  const n = parseInt(document.getElementById('teamCount').value, 10);
  data.version = 1;
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
  renderTeams();
  renderMatches();
  calculateRanking();
}

window.addEventListener('DOMContentLoaded', initializeApp);
