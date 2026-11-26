/* node qa/scenarios.test.cjs — actual solver checks for the teaching maps. */
'use strict';
const assert = require('node:assert/strict');
const engine = require('../docs/engine.js');
const scenarios = require('../docs/scenarios.js');
const options = {horizon: 60, maxHighLevel: 500, maxExpansions: 25000};
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function searchAll(scene) {
  const {start, goal} = scene.agents[0];
  return ['bfs', 'dijkstra', 'astar'].map(a => engine.search(scene, start, goal, a));
}
function valid(scene, result) {
  assert.equal(result.status, 'solved');
  const v = engine.validate(scene, result.paths);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.cost, result.cost);
  assert.equal(v.makespan, result.makespan);
  assert.ok(result.makespan <= options.horizon);
  assert.ok(result.expanded <= options.maxExpansions);
}

test('Catalog contains fresh, editable, valid scenes with unique endpoints', () => {
  assert.deepEqual(scenarios.list.map(s => s.id), ['bfs-dijkstra', 'search-maze', 'weighted-city', 'fleet-crossing', 'cbs-bottleneck']);
  assert.equal(scenarios.get('missing'), null);
  for (const meta of scenarios.list) {
    assert.ok(['search', 'mapf'].includes(meta.kind));
    assert.equal(meta.name, meta.id);
    const s = scenarios.get(meta.id), blocked = new Set(s.walls.map(p => p.join(',')));
    assert.equal(blocked.size, s.walls.length);
    assert.equal(new Set(s.agents.map(a => a.id)).size, s.agents.length);
    for (const field of ['start', 'goal']) {
      assert.equal(new Set(s.agents.map(a => a[field].join(','))).size, s.agents.length);
      for (const a of s.agents) {
        const p = a[field];
        assert.ok(p[0] >= 0 && p[0] < s.cols && p[1] >= 0 && p[1] < s.rows);
        assert.ok(!blocked.has(p.join(',')));
        assert.ok(a.label && /^#[0-9a-f]{6}$/i.test(a.color));
      }
    }
    s.agents[0].start[0] = -100;
    s.walls.push([-1, -1]);
    s.weights['0,0'] = 99;
    const fresh = scenarios.get(meta.id);
    assert.notEqual(fresh.agents[0].start[0], -100);
    assert.ok(!fresh.walls.some(p => p[0] === -1));
    assert.notEqual(fresh.weights['0,0'], 99);
  }
});

test('Warehouse: same shortest route length, focused A* search', () => {
  const s = scenarios.get('search-maze'), results = searchAll(s);
  assert.equal(s.cols, 25); assert.equal(s.rows, 17); assert.equal(s.walls.length, 108);
  for (const r of results) { assert.equal(r.status, 'solved'); assert.equal(r.steps, 26); assert.equal(r.terrainCost, 26); }
  assert.deepEqual(results.map(r => r.expanded), [275, 275, 31]);
  assert.ok(results[2].expanded < results[0].expanded / 5);
});

test('Weighted city: shortest in moves is much more expensive', () => {
  const s = scenarios.get('weighted-city'), [bfs, dijkstra, astar] = searchAll(s);
  assert.equal(Object.keys(s.weights).length, 63);
  assert.deepEqual([bfs.steps, bfs.cost, bfs.terrainCost, bfs.expanded], [26, 26, 110, 292]);
  assert.deepEqual([dijkstra.steps, dijkstra.cost, dijkstra.expanded], [30, 30, 332]);
  assert.deepEqual([astar.steps, astar.cost, astar.expanded], [30, 30, 38]);
  assert.ok(bfs.steps < astar.steps && bfs.terrainCost > astar.terrainCost);
});

test('Twelve robots: six independent conflicts become safe reservation-based routes', () => {
  const s = scenarios.get('fleet-crossing');
  assert.equal(s.agents.length, 12);
  const independent = engine.solve(s, 'independent', options);
  const priority = engine.solve(s, 'priority', options);
  assert.equal(independent.status, 'collision'); assert.equal(independent.conflicts.length, 6);
  assert.equal(independent.cost, 272); assert.equal(independent.expanded, 284);
  assert.equal(engine.validate(s, independent.paths).ok, false);
  valid(s, priority);
  assert.equal(priority.cost, 292); assert.equal(priority.expanded, 1144);
  assert.equal(Object.keys(priority.paths).length, 12);
});

test('CBS cross-aisle map: genuine branch search improves this fixed priority order', () => {
  const s = scenarios.get('cbs-bottleneck');
  const independent = engine.solve(s, 'independent', options);
  const priority = engine.solve(s, 'priority', options);
  const cbs = engine.solve(s, 'cbs', options);
  assert.equal(independent.status, 'collision'); assert.equal(independent.conflicts.length, 2);
  assert.equal(independent.cost, 48);
  valid(s, priority); valid(s, cbs);
  assert.deepEqual([priority.cost, priority.makespan], [54, 17]);
  assert.deepEqual([cbs.cost, cbs.makespan, cbs.expanded, cbs.highLevelExpanded], [53, 16, 8749, 129]);
  assert.equal(cbs.optimalWithinHorizon, true);
  assert.ok(cbs.highLevelExpanded < options.maxHighLevel);
  assert.ok(cbs.trace.some(t => t.type === 'constraint' && t.constraint));
  assert.ok(cbs.trace.some(t => t.type === 'vertex' || t.type === 'swap'));
  const reordered = engine.solve(s, 'priority', {...options, order: ['a2', 'a3', 'a0', 'a1']});
  valid(s, reordered);
  assert.equal(reordered.cost, 53, 'A different priority can match CBS; avoid claiming universal superiority.');
});



// Deliberately isolate the difference between fewest moves and lowest cost.
test('Two routes: costs change the optimal path, uniform costs make the algorithms agree',()=>{
 const s=scenarios.get('bfs-dijkstra'), [b,d]=searchAll(s);
 assert.equal(b.steps,4);assert.equal(b.terrainCost,16);assert.equal(d.steps,8);assert.equal(d.terrainCost,8);
 assert.ok(b.path.some(p=>p[0]===3&&p[1]===3));assert.ok(d.path.some(p=>p[0]===3&&p[1]===1));
 s.weights={};const[u,v]=searchAll(s);assert.equal(u.steps,4);assert.equal(v.steps,4);assert.equal(u.terrainCost,4);assert.equal(v.terrainCost,4);assert.deepEqual(u.path,v.path);
});

console.log('\n' + passed + ' scenario tests passed.');
