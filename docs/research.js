/* Compact presentation of the saved route-generation observations. */
(() => {
 const $=s=>document.querySelector(s),E=window.MAPF_EVIDENCE;
 function showRoutes(panel='puzzles'){
  MAPFLab.state.study='routes';document.querySelectorAll('[data-study]').forEach(b=>b.classList.toggle('active',b.dataset.study==='routes'));
  const methods=[['JT','Direct routes'],['VR','Feedback repair'],['Fresh','Fresh retry']];
  $('#study-content').innerHTML=`<div class="route-evidence"><div class="route-evidence-head"><h2>Does feedback beat simply trying again?</h2><div><button data-route-panel="puzzles" class="seg-button ${panel==='puzzles'?'selected':''}">Puzzles · 432</button><button data-route-panel="small" class="seg-button ${panel==='small'?'selected':''}">Small MovingAI · 150</button></div></div><div class="route-evidence-table"><div class="route-evidence-row route-evidence-labels"><span>Language model</span>${methods.map(([m,n])=>`<strong style="--method:${{JT:'#74aaff',VR:'#ffae69',Fresh:'#54ead4'}[m]}">${n}</strong>`).join('')}</div>${E.models.map(model=>`<div class="route-evidence-row"><strong>${model.name}</strong>${methods.map(([method])=>{const r=E.results.find(r=>r.panel===panel&&r.model===model.name&&r.method===method);return `<div class="route-score" style="--method:${{JT:'#74aaff',VR:'#ffae69',Fresh:'#54ead4'}[method]}"><span><b>${r.successes}</b> / ${r.n}<small>${r.rate.toFixed(1)}%</small></span><i><em style="width:${r.rate}%"></em></i></div>`;}).join('')}</div>`).join('')}</div><p class="route-evidence-note">Cases with a valid final plan. ${panel==='puzzles'?'All 432 scheduled cases count, including 15 proved-unsolvable cases.':'All 150 scheduled cases count.'} These are observed success rates; the rows do not establish statistical significance.</p></div>`;
  document.querySelectorAll('[data-route-panel]').forEach(b=>b.onclick=()=>showRoutes(b.dataset.routePanel));
 }
 const tab=document.createElement('button');tab.dataset.study='routes';tab.textContent='Routes & retries';tab.onclick=()=>showRoutes();$('.study-tabs').append(tab);
 window.MAPFResearch={showRoutes};
})();
