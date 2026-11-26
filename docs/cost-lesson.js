/* Two routes, one destination: actual BFS/Dijkstra outputs, replayed by travel cost. */
(() => {
 const $=s=>document.querySelector(s);
 const active=s=>s.preset==='bfs-dijkstra';
 function routePosition(scene,path,spent){
  if(!path?.length)return 0;let remaining=Math.max(0,spent);
  for(let i=1;i<path.length;i++){const cost=scene.weights?.[path[i].join(',')]||1;if(remaining<cost)return i-1+remaining/cost;remaining-=cost;}
  return path.length-1;
 }
 function sync(s){
  const on=active(s);s.costLesson=on;document.body.dataset.costLesson=String(on);$('#cost-lesson-banner').hidden=!on;
  if(!on)return;const weighted=Object.values(s.scene.weights||{}).some(w=>w>1);
  $('#equal-cost-toggle').setAttribute('aria-pressed',String(!weighted));
  $('#equal-cost-toggle').textContent=weighted?'Make every tile cost 1':'Restore orange tiles to cost 5';
  $('#cost-legend').innerHTML=weighted?'<span><i class="cost-tile normal">1</i> normal move</span><span><i class="cost-tile expensive">5</i> orange move</span>':'<span><i class="cost-tile normal">1</i> every move has the same cost</span>';
 }
 function card(s,r,i){
  const values=(r.path||[]).slice(1).map(p=>s.scene.weights?.[p.join(',')]||1),sum=values.reduce((a,b)=>a+b,0);
  const formula=values.length&&values.every(v=>v===1)?`${values.length} moves × 1 = ${sum}`:values.length<=10?values.join(' + ')+' = '+sum:`${values.length} moves; total cost ${sum}`;
  const bfs=r.algorithm==='bfs',name=bfs?'Breadth-first search (BFS)':r.algorithm==='dijkstra'?'Dijkstra':'A*';
  return `<article class="compare-card cost-card" style="--cost-accent:${bfs?'#ffae69':'#54ead4'}"><div class="compare-title"><h3>${name}</h3><span class="cost-objective">${bfs?'FEWEST MOVES':'LOWEST TOTAL COST'}</span></div><div class="compare-canvas"><canvas id="compare-${i}" aria-label="${name} selected route"></canvas></div><div class="cost-totals"><div><strong>${r.steps??'—'}</strong><span>moves</span></div><div><strong>${Number.isFinite(r.cost)?r.cost:'—'}</strong><span>total cost</span></div></div><p class="cost-formula">${r.status==='solved'?formula:'No route found'}</p><div class="cost-arrival" id="cost-arrival-${i}">Ready to move</div></article>`;
 }
 function viewScene(s,r){return {...s.scene,agents:s.scene.agents.map(a=>({...a,color:r.algorithm==='bfs'?'#ffae69':'#54ead4'}))};}
 function frame(s,r){return {paths:r.path?.length?{[s.scene.agents[0].id]:r.path}:{},time:routePosition(s.scene,r.path,s.time),searchTrace:[],searchProgress:0,showPaths:true,showLabels:true,showTileCosts:true,conflicts:[]};}
 function paint(s){
  s.results.forEach((r,i)=>{const el=$('#cost-arrival-'+i);if(!el)return;el.textContent=r.status!=='solved'?'No valid route':s.time>=r.cost?`Arrived · ${r.cost} cost units`:`Travelling · ${Math.min(r.cost,Math.floor(s.time))} of ${r.cost} cost units`;el.classList.toggle('arrived',s.time>=r.cost&&r.status==='solved');});
  $('#live-explanation').textContent='Playback follows travel cost, not algorithm runtime. The robot takes five times longer to enter a 5-cost tile.';
 }
 $('#equal-cost-toggle').onclick=()=>{const s=MAPFLab.state;if(!active(s))return;const weighted=Object.values(s.scene.weights||{}).some(w=>w>1);s.scene.weights=weighted?{}:MAPFScenarios.get('bfs-dijkstra').weights;const d=window.MAPFDemo?.getState();if(d?.active&&!$('#demo-caption').hidden)$('#demo-caption-text').textContent=weighted?'Every square now costs one. Both algorithms choose four moves, costing four.':'With orange squares costing five again, BFS takes four moves costing 16; Dijkstra takes eight moves costing 8.';MAPFLab.run(!(d?.active&&d.paused));};
 window.MAPFCostLesson={active,sync,card,viewScene,frame,paint,routePosition};
})();
