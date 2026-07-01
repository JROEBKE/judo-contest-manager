/** Creates the initial ranking accumulator for all teams. */
function initStats(){
  const s = {};
  getTeamNames().forEach(t => {
    s[t] = {team:t,matches:0,win:0,loss:0,deltaMatches:0,fightsWin:0,fightsLoss:0,scoreWin:0,scoreLoss:0,direct:false};
  });
  return s;
}

/** Applies one saved match to the ranking accumulator. */
function applyMatchToStats(s, m){
  if(!s[m.a] || !s[m.b]) return;

  s[m.a].matches++; s[m.b].matches++;
  s[m.a].fightsWin += m.fightsA; s[m.a].fightsLoss += m.fightsB;
  s[m.b].fightsWin += m.fightsB; s[m.b].fightsLoss += m.fightsA;
  s[m.a].scoreWin += m.scoreA; s[m.a].scoreLoss += m.scoreB;
  s[m.b].scoreWin += m.scoreB; s[m.b].scoreLoss += m.scoreA;

  if(m.fightsA > m.fightsB){
    s[m.a].win++; s[m.a].deltaMatches++;
    s[m.b].loss++; s[m.b].deltaMatches--;
  } else if(m.fightsA < m.fightsB){
    s[m.b].win++; s[m.b].deltaMatches++;
    s[m.a].loss++; s[m.a].deltaMatches--;
  } else {
    // Tournament rule: a draw gives 0.5 match delta to both teams.
    s[m.a].deltaMatches += 0.5;
    s[m.b].deltaMatches += 0.5;
  }
}

/** Adds derived delta values after all saved matches have been accumulated. */
function finalizeStats(arr){
  arr.forEach(x => {
    x.deltaFights = x.fightsWin - x.fightsLoss;
    x.deltaScore = x.scoreWin - x.scoreLoss;
  });
  return arr;
}

/** Base ranking comparator: match delta, then fight delta, then sub-score delta. */
function compareBase(a,b){
  return (b.deltaMatches - a.deltaMatches) || (b.deltaFights - a.deltaFights) || (b.deltaScore - a.deltaScore);
}

/** Resolves tied groups by evaluating only direct matches between the tied teams. */
function directCompareGroup(group){
  if(group.length < 2) return group;

  const names = new Set(group.map(x => x.team));
  const directStats = {};
  group.forEach(x => {
    directStats[x.team] = {team:x.team,matches:0,win:0,loss:0,deltaMatches:0,fightsWin:0,fightsLoss:0,scoreWin:0,scoreLoss:0};
  });

  data.matches
    .filter(m => m.saved && names.has(m.a) && names.has(m.b))
    .forEach(m => applyMatchToStats(directStats, m));

  const directArr = finalizeStats(Object.values(directStats));
  directArr.sort(compareBase);

  const decisive = directArr.some((x,i) => i > 0 && compareBase(directArr[i-1], x) !== 0);
  if(!decisive) return group.map(x => ({...x, sameRank:true}));

  const byTeam = Object.fromEntries(group.map(x => [x.team, x]));
  return directArr.map(d => ({...byTeam[d.team], direct:true}));
}

/** Calculates and renders the live ranking. */
function calculateRanking(){
  const s = initStats();
  data.matches.filter(m => m.saved).forEach(m => applyMatchToStats(s, m));

  let ranking = finalizeStats(Object.values(s));
  ranking.sort(compareBase);

  const final = [];
  for(let i=0;i<ranking.length;){
    const group = [ranking[i]];
    let j = i + 1;
    while(j < ranking.length && compareBase(ranking[i], ranking[j]) === 0){
      group.push(ranking[j]);
      j++;
    }
    final.push(...directCompareGroup(group));
    i = j;
  }

  const tbody = document.querySelector('#rankingTable tbody');
  tbody.innerHTML = '';

  let displayRank = 1;
  final.forEach((x,i) => {
    if(i > 0){
      const prev = final[i-1];
      const equalAfterAll = compareBase(prev,x) === 0 && !prev.direct && !x.direct;
      if(!equalAfterAll) displayRank = i + 1;
    }

    tbody.innerHTML += `<tr class="${x.direct ? 'direct' : ''}"><td>${displayRank}</td><td>${escapeHtml(x.team)}</td><td>${x.matches}</td><td>${x.win}:${x.loss}</td><td>${formatNumber(x.deltaMatches)}</td><td>${x.fightsWin}:${x.fightsLoss}</td><td>${x.deltaFights}</td><td>${x.scoreWin}:${x.scoreLoss}</td><td>${x.deltaScore}</td></tr>`;
  });

  const directLegend = document.getElementById('directLegend');
  if(directLegend) directLegend.style.display = final.some(x => x.direct) ? 'block' : 'none';
}
