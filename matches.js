/** Creates a normalized match object. The block number is internal and is only used for grouping. */
function createMatch(a,b,day,block,mat){
  return {a,b,day,block,mat,fightsA:0,fightsB:0,scoreA:0,scoreB:0,saved:false};
}

/** Generates all unique one-way pairings for round-robin mode. */
function generateAllPairs(teams){
  const pairs = [];
  for(let i=0;i<teams.length;i++){
    for(let j=i+1;j<teams.length;j++) pairs.push({a:teams[i], b:teams[j]});
  }
  return pairs;
}
/**
 * Generates round-robin rounds using the circle method.
 * A null placeholder is added for odd team counts so each round can be calculated uniformly.
 */
function generateRoundRobinRounds(teams){
  const arr = teams.slice();
  if(arr.length % 2 === 1) arr.push(null);

  const n = arr.length;
  const rounds = [];
  let rotation = arr.slice();

  for(let r=0;r<n-1;r++){
    const matches = [];
    for(let i=0;i<n/2;i++){
      const a = rotation[i];
      const b = rotation[n-1-i];
      if(a !== null && b !== null){
        // Alternate display order to avoid one team always being shown first.
        matches.push(r % 2 === 0 ? {a:a,b:b} : {a:b,b:a});
      }
    }
    rounds.push(matches);
    // Keep the first element fixed and rotate all others.
    rotation = [rotation[0], rotation[n-1], ...rotation.slice(1,n-1)];
  }

  return rounds;
}
/** Counts how often each team appears in a match list. Used for fair day distribution. */
function countAppearances(matches, teams){
  const counts = Object.fromEntries(teams.map(t => [t,0]));
  matches.forEach(m => { counts[m.a]++; counts[m.b]++; });
  return counts;
}
/**
 * Splits matches into day 1 and day 2 as evenly as possible.
 * The heuristic prefers teams that appear less often and avoids leaving a team unused on day 1.
 */
function selectBalancedDayMatches(allPairs, teams, targetMatchCount){
  const remaining = allPairs.slice();
  const selected = [];
  const counts = Object.fromEntries(teams.map(t => [t,0]));
  const maxAppearances = Math.ceil((targetMatchCount * 2) / teams.length);

  while(selected.length < targetMatchCount && remaining.length){
    let bestIndex = 0;
    let bestScore = Infinity;

    for(let i=0;i<remaining.length;i++){
      const m = remaining[i];
      const wouldA = counts[m.a] + 1;
      const wouldB = counts[m.b] + 1;

      const overPenalty = (wouldA > maxAppearances ? 100 : 0) + (wouldB > maxAppearances ? 100 : 0);
      const lowUsageScore = counts[m.a] + counts[m.b];
      const imbalanceScore = Math.abs(counts[m.a] - counts[m.b]);
      const score = overPenalty + lowUsageScore * 10 + imbalanceScore;

      if(score < bestScore){ bestScore = score; bestIndex = i; }
    }

    const chosen = remaining.splice(bestIndex,1)[0];
    selected.push(chosen);
    counts[chosen.a]++;
    counts[chosen.b]++;
  }
 // Safety correction: avoid a team having no day-1 match if a clean swap is possible.
  let selectedCounts = countAppearances(selected, teams);
  const missingTeams = teams.filter(t => selectedCounts[t] === 0);

  missingTeams.forEach(missing => {
    const candidateFromRemaining = remaining.find(m => m.a === missing || m.b === missing);
    if(!candidateFromRemaining) return;

    const swapOut = selected.find(m => {
      const nextCounts = {...selectedCounts};
      nextCounts[m.a]--;
      nextCounts[m.b]--;
      return nextCounts[m.a] > 0 && nextCounts[m.b] > 0;
    });

    if(swapOut){
      const outIdx = selected.findIndex(m => pairKey(m) === pairKey(swapOut));
      const inIdx = remaining.findIndex(m => pairKey(m) === pairKey(candidateFromRemaining));
      selected[outIdx] = candidateFromRemaining;
      remaining[inIdx] = swapOut;
      selectedCounts = countAppearances(selected, teams);
    }
  });

  return {day1:selected, day2:remaining};
}
/**
 * Creates a stable key for an unordered pairing.
 *
 * Why this function exists:
 * A vs B and B vs A are the same pairing for lookup/swap logic, even though the display order differs.
 * Sorting both team names before joining creates a stable identifier:
 *   pairKey({a:'A', b:'B'}) === pairKey({a:'B', b:'A'})
 * This prevents false mismatches when home/away order changes, especially in return rounds or swaps.
 */
function pairKey(m){
  return [m.a,m.b].sort().join('||');
}

/** Builds time blocks with no team scheduled on more than one mat at a time. */
function buildBlocks(matches, matCount){
  if(!Number.isInteger(matCount) || matCount < 1 || matCount > 4){
    throw new RangeError('Die Mattenanzahl muss zwischen 1 und 4 liegen.');
  }
  const remaining = matches.slice();
  const blocks = [];
  let previousTeams = new Set();

  while(remaining.length){
    let bestBlock = [];
    let bestOverlap = Infinity;

    function findBestBlock(startIndex, block, usedTeams, overlap){
      if(block.length > bestBlock.length ||
         (block.length === bestBlock.length && overlap < bestOverlap)){
        bestBlock = block;
        bestOverlap = overlap;
      }
      if(block.length === matCount) return;

      for(let i=startIndex;i<remaining.length;i++){
        const match = remaining[i];
        if(usedTeams.has(match.a) || usedTeams.has(match.b)) continue;

        const nextUsedTeams = new Set(usedTeams);
        nextUsedTeams.add(match.a);
        nextUsedTeams.add(match.b);
        const nextOverlap = overlap +
          Number(previousTeams.has(match.a)) + Number(previousTeams.has(match.b));
        findBestBlock(i + 1, [...block, match], nextUsedTeams, nextOverlap);
      }
    }

    findBestBlock(0, [], new Set(), 0);
    blocks.push(bestBlock);
    const blockMatches = new Set(bestBlock);
    for(let i=remaining.length-1;i>=0;i--){
      if(blockMatches.has(remaining[i])) remaining.splice(i,1);
    }
    previousTeams = new Set(bestBlock.flatMap(match => [match.a, match.b]));
  }

  return blocks;
}

/** Converts internal blocks into stored matches and balances usage across configured mats. */
function appendBlocksAsMatches(day, blocks, matCount){
  const matCounts = Array(matCount).fill(0);
  blocks.forEach((block, blockIndex) => {
    const mats = matCounts
      .map((count, index) => ({mat:index + 1, count}))
      .sort((a, b) => a.count - b.count || a.mat - b.mat);
    block.forEach((match, index) => {
      const mat = mats[index].mat;
      data.matches.push(createMatch(match.a, match.b, day, blockIndex + 1, mat));
      matCounts[mat - 1]++;
    });
  });
}

/** Generates the tournament schedule according to the configured team count. */
function generateMatches(){
  const teams = getTeamNames();
  if (new Set(teams).size !== teams.length) {
    alert('Mannschaftsnamen müssen eindeutig sein.');
    return;
  }
  if(teams.length < 2){ alert('Bitte mindestens zwei Mannschaften initialisieren.'); return; }

  data.matches = [];
  const matCount = data.matCount;

  if(teams.length < 5){
    // First leg on day 1, reverse leg on day 2.
    const rounds = generateRoundRobinRounds(teams);
    const firstLeg = [];
    const secondLeg = [];

    rounds.forEach(round => {
      round.forEach(m => firstLeg.push({a:m.a, b:m.b}));
      round.forEach(m => secondLeg.push({a:m.b, b:m.a}));
    });

    appendBlocksAsMatches(1, buildBlocks(firstLeg, matCount), matCount);
    appendBlocksAsMatches(2, buildBlocks(secondLeg, matCount), matCount);
  } else {
    // One complete round-robin distributed across two days.
    const allPairs = generateAllPairs(teams);
    const targetDay1Matches = Math.floor(allPairs.length / 2);
    const split = selectBalancedDayMatches(allPairs, teams, targetDay1Matches);

    appendBlocksAsMatches(1, buildBlocks(split.day1, matCount), matCount);
    appendBlocksAsMatches(2, buildBlocks(split.day2, matCount), matCount);
  }

  renderMatches();
  document.getElementById('teamsSection').open = false;
  document.getElementById('day1').open = true;
  save();
}

/** Renders matches grouped by day. */
function renderMatches(){
  [1,2].forEach(day => {
    const c = document.getElementById('matchesDay' + day);
    c.innerHTML = '';
    const list = data.matches.filter(m => m.day === day);
    if(!list.length) return;

    const table = document.createElement('table');
    table.className = 'matches-table';
    table.innerHTML = '<thead><tr><th>Matte</th><th>Mannschaft 1</th><th>Mannschaft 2</th><th>Kampfergebnis</th><th>Unterbewertung</th><th>Aktion</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');

    list.forEach(m => {
      const index = data.matches.indexOf(m);
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>Matte ${m.mat}</td>
        <td>${escapeHtml(m.a)}</td>
        <td>${escapeHtml(m.b)}</td>
        <td><input type="number" min="0" max="9" value="${m.fightsA}" ${m.saved?'disabled':''}> : <input type="number" min="0" max="9" value="${m.fightsB}" ${m.saved?'disabled':''}></td>
        <td><input type="number" min="0" max="900" value="${m.scoreA}" ${m.saved?'disabled':''}> : <input type="number" min="0" max="900" value="${m.scoreB}" ${m.saved?'disabled':''}></td>
        <td class="action-cell"></td>`;

      if(m.saved){
        if(m.fightsA > m.fightsB){ tr.children[1].classList.add('win'); tr.children[2].classList.add('loss'); }
        else if(m.fightsA < m.fightsB){ tr.children[2].classList.add('win'); tr.children[1].classList.add('loss'); }
      }

      const btn = document.createElement('button');
      btn.textContent = m.saved ? 'Edit' : 'Speichern';
      btn.onclick = () => handleMatch(index, tr);
      tr.children[5].appendChild(btn);
      tbody.appendChild(tr);
    });

    c.appendChild(table);
  });

  calculateRanking();
}

/** Saves a match result or reopens it for editing. Only saved matches are ranked. */
function handleMatch(index, row){
  const m = data.matches[index];
  const inputs = row.querySelectorAll('input');

  if(!m.saved){
    const values = [...inputs].map(input => parseInt(input.value, 10));
    if(values.some(v => Number.isNaN(v))){ alert('Bitte alle Ergebnisfelder befüllen.'); return; }
    if(values[0] < 0 || values[0] > 9 || values[1] < 0 || values[1] > 9){ alert('Kampfergebnis muss zwischen 0 und 9 liegen.'); return; }
    if(values[2] < 0 || values[2] > 900 || values[3] < 0 || values[3] > 900){ alert('Unterbewertung muss zwischen 0 und 900 liegen.'); return; }

    m.fightsA = values[0];
    m.fightsB = values[1];
    m.scoreA = values[2];
    m.scoreB = values[3];
    m.saved = true;
  } else {
    m.saved = false;
  }

  renderMatches();
  save();
}
