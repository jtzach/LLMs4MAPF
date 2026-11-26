/* Run with node qa/engine.test.cjs. No external libraries. */
'use strict';
const assert = require('node:assert/strict');
const engine = require('../docs/engine.js');
const agent = (id,start,goal) => ({id,start,goal});
function scene(rows,agents,weights={}) {
  return {cols:rows[0].length,rows:rows.length,walls:rows.flatMap((row,y)=>[...row].flatMap((c,x)=>c==='#'?[[x,y]]:[])),agents,weights};
}
let passed=0;
function test(name,run) {run();passed++;console.log('PASS '+name);}
const cross=scene(['##.##','##.##','.....','##.##','##.##'],[agent('blue',[0,2],[4,2]),agent('orange',[2,0],[2,4])]);
const pocket=scene(['######','#.####','......','######'],[agent('blue',[0,2],[5,2]),agent('orange',[5,2],[0,2])]);

test('A* explores actual cells and finds an unobstructed shortest route',()=>{
 const s=scene(['.....','..#..','.....'],[]),r=engine.search(s,[0,1],[4,1]);
 assert.equal(r.status,'solved');assert.equal(r.cost,6);assert.ok(r.trace.some(t=>t.x===4&&t.y===1));
});
test('BFS minimizes steps; Dijkstra and A* minimize weighted travel',()=>{
 const s=scene(['.....','.....','.....'],[],{'1,1':9,'2,1':9,'3,1':9});
 const bfs=engine.search(s,[0,1],[4,1],'bfs'),d=engine.search(s,[0,1],[4,1],'dijkstra'),a=engine.search(s,[0,1],[4,1],'astar');
 assert.equal(bfs.steps,4);assert.equal(bfs.cost,4);assert.equal(bfs.terrainCost,28);
 assert.equal(d.cost,6);assert.equal(a.cost,d.cost);assert.ok(a.expanded<=d.expanded);
});
test('Disconnected start is a proven spatial failure',()=>{
 const s=scene(['.#.'],[agent('a',[0,0],[2,0])]);assert.equal(engine.search(s,[0,0],[2,0]).status,'failed');
 assert.equal(engine.solve(s,'cbs').status,'failed');
});
test('Blocked and malformed endpoints fail safely',()=>{
 const s=scene(['.#.'],[agent('a',[1,0],[2,0])]);assert.equal(engine.solve(s,'priority').status,'failed');
 assert.equal(engine.search(s,[-1,0],[2,0]).status,'failed');
 assert.equal(engine.validate(s,{a:[[1,0],[2,0]]}).ok,false);
});
test('Independent paths expose a center collision at time two',()=>{
 const r=engine.solve(cross,'independent');assert.equal(r.status,'collision');assert.equal(r.conflicts[0].time,2);assert.equal(r.conflicts[0].type,'vertex');
});
test('Prioritized search inserts a legal wait',()=>{
 const r=engine.solve(cross,'priority',{order:['blue','orange']});assert.equal(r.status,'solved');assert.equal(r.cost,9);assert.equal(r.makespan,5);assert.ok(engine.validate(cross,r.paths).ok);
});
test('CBS branches and proves the minimum sum of costs on a crossing',()=>{
 const r=engine.solve(cross,'cbs');assert.equal(r.status,'solved');assert.equal(r.cost,9);assert.ok(r.trace.some(t=>t.type==='constraint'));assert.ok(engine.validate(cross,r.paths).ok);
});
test('Changing a priority order can recover from its own fixed reservations',()=>{
 const a=engine.solve(pocket,'priority',{order:['blue','orange'],horizon:20}),b=engine.solve(pocket,'priority',{order:['orange','blue'],horizon:20});
 assert.notEqual(a.status,'solved');assert.equal(a.status,'limit');assert.equal(a.failedAgent,'orange');assert.equal(b.status,'solved');assert.ok(engine.validate(pocket,b.paths).ok);
 assert.ok(b.paths.blue.some((p,t)=>t&&p[0]===1&&p[1]===1&&p[0]===b.paths.blue[t-1][0]&&p[1]===b.paths.blue[t-1][1]));
});
test('Edge swaps are rejected even without shared end positions',()=>{
 const s=scene(['..','..'],[agent('a',[0,0],[1,0]),agent('b',[1,0],[0,0])]);
 const r=engine.solve(s,'independent');assert.equal(r.conflicts[0].type,'swap');
 const c=engine.solve(s,'cbs');assert.equal(c.status,'solved');assert.ok(engine.validate(s,c.paths).ok);
});
test('Goal occupancy remains reserved after arrival',()=>{
 const s=scene(['...','...'],[agent('a',[0,0],[1,0]),agent('b',[2,0],[0,0])]);
 const r=engine.solve(s,'priority');assert.equal(r.status,'solved');assert.ok(r.paths.b.some(p=>p[1]===1));assert.ok(engine.validate(s,r.paths).ok);
});
test('An agent initially at goal may need to move and return under CBS',()=>{
 const s=scene(['#.#','...'],[agent('a',[1,1],[1,1]),agent('b',[0,1],[2,1])]);
 const r=engine.solve(s,'cbs',{horizon:12});assert.equal(r.status,'solved');assert.ok(r.paths.a.length>1);assert.ok(engine.validate(s,r.paths).ok);
});
test('Invalid order and duplicate permanent goals are rejected',()=>{
 assert.equal(engine.solve(cross,'priority',{order:['blue','blue']}).status,'failed');
 const s=scene(['...'],[agent('a',[0,0],[1,0]),agent('b',[2,0],[1,0])]);assert.equal(engine.solve(s,'cbs').status,'failed');
});
test('Finite horizons and work budgets return limits',()=>{
 assert.equal(engine.solve(cross,'cbs',{horizon:3}).status,'limit');
 assert.equal(engine.solve(cross,'cbs',{maxHighLevel:1}).status,'limit');
 assert.equal(engine.search(cross,[0,2],[4,2],'astar',{maxExpansions:1}).status,'limit');
 const r=engine.solve(cross,'cbs',{maxExpansions:2});assert.equal(r.status,'limit');assert.ok(r.expanded<=2);
});
test('Trace and frontier snapshots are bounded',()=>{
 const s=scene(Array(20).fill('.'.repeat(20)),[]),r=engine.search(s,[0,0],[19,19],'dijkstra',{maxTrace:3,frontierSize:2});
 assert.equal(r.trace.length,3);assert.ok(r.trace.every(t=>t.frontier.length<=2));
});
test('Trailing waits at a goal do not inflate final-arrival cost',()=>{
 const s=scene(['...'],[agent('a',[0,0],[2,0])]);const r=engine.validate(s,{a:[[0,0],[1,0],[2,0],[2,0]]});assert.equal(r.cost,2);assert.equal(r.makespan,2);
});

// Independent oracle: Dijkstra on joint configurations plus irrevocable completion bits.
// A finished robot stays at goal at zero future cost. An unfinished robot contributes
// one unit per beat; it may pass its goal and finish later if that helps another robot.
function jointOracle(s,maxCost=30) {
 const walls=new Set(s.walls.map(p=>p.join(','))),free=p=>p[0]>=0&&p[0]<s.cols&&p[1]>=0&&p[1]<s.rows&&!walls.has(p.join(','));
 const eq=(a,b)=>a[0]===b[0]&&a[1]===b[1],all=(1<<s.agents.length)-1;
 const queue=[{p:s.agents.map(a=>a.start),mask:0,cost:0}],best=new Map();
 const moves=[[0,0],[1,0],[0,1],[-1,0],[0,-1]];
 while(queue.length){
  queue.sort((a,b)=>a.cost-b.cost);const n=queue.shift(),k=n.p.map(p=>p.join(',')).join('|')+'@'+n.mask;
  if(n.cost>(best.get(k)??Infinity))continue;
  if(n.mask===all)return n.cost;if(n.cost>=maxCost)continue;
  // Zero-cost irreversible choice to stop at a reached goal.
  for(let i=0;i<s.agents.length;i++)if(!(n.mask&(1<<i))&&eq(n.p[i],s.agents[i].goal)){
   const mask=n.mask|(1<<i),key=n.p.map(p=>p.join(',')).join('|')+'@'+mask;
   if(n.cost<(best.get(key)??Infinity)){best.set(key,n.cost);queue.push({...n,mask});}
  }
  const choices=n.p.map((p,i)=>n.mask&(1<<i)?[p]:moves.map(m=>[p[0]+m[0],p[1]+m[1]]).filter(free));
  function visit(p,i){if(i<choices.length){for(const q of choices[i])visit([...p,q],i+1);return;}
   for(let a=0;a<p.length;a++)for(let b=a+1;b<p.length;b++)if(eq(p[a],p[b])||(eq(p[a],n.p[b])&&eq(p[b],n.p[a])))return;
   const cost=n.cost+s.agents.length-n.mask.toString(2).replace(/0/g,'').length,key=p.map(q=>q.join(',')).join('|')+'@'+n.mask;
   if(cost<(best.get(key)??Infinity)){best.set(key,cost);queue.push({p,mask:n.mask,cost});}
  }visit([],0);
 }
 return Infinity;
}
test('CBS sum of costs agrees with an independent joint-state oracle',()=>{
 const fixtures=[
  scene(['...','...'],[agent('a',[0,0],[2,0]),agent('b',[2,0],[0,0])]),
  scene(['...','.#.','...'],[agent('a',[0,0],[2,2]),agent('b',[2,2],[0,0])]),
  scene(['#.#','...'],[agent('a',[1,1],[1,1]),agent('b',[0,1],[2,1])]),
  scene(['...','...','...'],[agent('a',[0,1],[2,1]),agent('b',[1,0],[1,2]),agent('c',[2,2],[0,2])])
 ];
 for(const s of fixtures){const expected=jointOracle(s),actual=engine.solve(s,'cbs',{horizon:16,maxExpansions:50000});assert.equal(actual.status,'solved');assert.equal(actual.cost,expected);}
});
console.log(JSON.stringify({passed,version:engine.version}));
