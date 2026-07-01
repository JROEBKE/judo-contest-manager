/** Removes the action column from match tables before printing. */
function stripActionColumnForPrint(html){
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  wrapper.querySelectorAll('table').forEach(table => {
    table.querySelectorAll('tr').forEach(row => {
      if(row.children.length > 0) row.children[row.children.length - 1].remove();
    });
  });
  return wrapper.innerHTML;
}

/** Prepares isolated print content and opens the browser print dialog. */
function printHtml(title, html){
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = `<h1>${title}</h1>${html}`;
  document.body.classList.add('printing');
  setTimeout(() => window.print(), 50);
}

/** Cleans up the temporary print area after printing. */
window.onafterprint = () => {
  document.body.classList.remove('printing');
  document.getElementById('printArea').innerHTML = '';
}

/** Prints one selected tournament day. */
function printDay(day){
  const dayEl = document.getElementById('day' + day);
  if(!dayEl){ alert('Für diesen Wettkampftag gibt es noch keine Begegnungen.'); return; }
  printHtml('Wettkampftag ' + day, stripActionColumnForPrint(dayEl.innerHTML));
}

/** Prints only the ranking section. */
function printRanking(){
  const rankEl = document.getElementById('rankingSection');
  printHtml('Rangliste', rankEl.innerHTML);
}
