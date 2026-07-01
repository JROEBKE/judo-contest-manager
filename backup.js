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
  reader.onload = e => {
    try {
      const obj = JSON.parse(e.target.result);

      if(!obj.teams || !obj.matches){
        throw new Error('Ungültiges Backup');
      }

      obj.version = obj.version || 1;
      data = obj;
      save();
      renderTeams();
      renderMatches();
    } catch(e){
      alert('Ungültige Datei.');
    }
  };
  reader.readAsText(file);
}
