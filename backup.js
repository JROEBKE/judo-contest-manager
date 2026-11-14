/** Downloads the current tournament state as a JSON backup. */
function saveFile(){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'judo-turnier-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Loads a previously exported JSON backup. */
function loadFile(event){
  const file = event.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onerror = () => {
    console.error('Backup-Datei konnte nicht gelesen werden:', reader.error);
    alert('Die Backup-Datei konnte nicht gelesen werden.');
  };
  reader.onload = event => {
    let imported;
    try {
      imported = JSON.parse(event.target.result);
    } catch(error) {
      console.error('Backup-Datei enthält kein gültiges JSON:', error);
      alert('Die Backup-Datei enthält kein gültiges JSON.');
      return;
    }

    try {
      data = normalizeTournamentData(imported);
    } catch(error) {
      console.error('Backup-Datei enthält ungültige Turnierdaten:', error);
      alert(`Ungültiges Backup: ${error.message}`);
      return;
    }

    save();
    document.getElementById('tournamentTitle').value = data.tournamentTitle;
    renderTeams();
    renderMatches();
  };
  reader.readAsText(file);
}
