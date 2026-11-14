/** Downloads the current tournament state as a JSON backup. */
function saveFile(){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = getBackupFileName();
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Builds a portable backup filename from the local date and optional tournament title. */
function getBackupFileName(date = new Date()){
  const datePrefix = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('');
  const title = String(data.tournamentTitle || '')
    .trim()
    .replace(/[<>:"\/\\|?*\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '') || 'JudoContest';

  return `${datePrefix}-${title}-backup.json`;
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
    document.getElementById('matCount').value = String(data.matCount);
    renderTeams();
    renderMatches();
  };
  reader.readAsText(file);
}
