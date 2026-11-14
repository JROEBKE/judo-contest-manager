/** Replaces match inputs with their current values and removes the action column. */
function stripActionColumnForPrint(table){
  const printableTable = table.cloneNode(true);
  const inputs = table.querySelectorAll('input');
  printableTable.querySelectorAll('input').forEach((input, index) => {
    input.replaceWith(document.createTextNode(inputs[index].value));
  });
  printableTable.querySelectorAll('tr').forEach(row => {
    if(row.children.length > 0) row.children[row.children.length - 1].remove();
  });
  return printableTable.outerHTML;
}

/** Prepares isolated print content and opens the browser print dialog. */
function printHtml(title, html){
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = html;
  const heading = document.createElement('h1');
  heading.textContent = title;
  printArea.prepend(heading);
  document.body.classList.add('printing');
  window.print();
}

/** Adds the optional tournament title to the printed section heading. */
function getPrintTitle(section){
  const tournamentTitle = (data.tournamentTitle || '').trim();
  return tournamentTitle ? section + ' - ' + tournamentTitle : section;
}

/** Cleans up the temporary print area after printing. */
window.onafterprint = () => {
  document.body.classList.remove('printing');
  document.getElementById('printArea').innerHTML = '';
}

/** Prints one selected tournament day. */
function printDay(day){
  const dayEl = document.getElementById('day' + day);
  const table = dayEl && dayEl.querySelector('table');
  if(!table){ alert('Für diesen Wettkampftag gibt es noch keine Begegnungen.'); return; }
  printHtml(getPrintTitle('Wettkampftag ' + day), stripActionColumnForPrint(table));
}

/** Prints only the ranking section. */
function printRanking(){
  const rankEl = document.getElementById('rankingSection');
  printHtml(getPrintTitle('Rangliste'), rankEl.querySelector('table').outerHTML);
}
