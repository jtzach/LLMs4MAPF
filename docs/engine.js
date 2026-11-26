/* MAPF Lab educational solvers. Unit-time multi-agent planning; weighted single-agent search.
 * No model calls or dependencies. Bounded searches report limits, never global infeasibility.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MAPFEngine = api;
  // A local-file presentation can start a Blob Worker without fetching scripts.
  if (root) root.MAPFWorkerSource = 'self.MAPFEngine = (' + factory.toString() + ')();';
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const pointKey = p => p[0] + ',' + p[1];
  const equal = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
  const distance = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  const at = (path, time) => path[Math.min(time, path.length - 1)];
  const integer = (value, fallback, minimum, maximum) => Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, Math.floor(value))) : fallback;
  const clock = () => typeof performance === 'object' ? performance.now() : Date.now();

  class Heap {
    constructor(compare) { this.items = []; this.compare = compare; }
    get length() { return this.items.length; }
    push(value) {
      let i = this.items.length; this.items.push(value);
      while (i) { const parent = (i - 1) >> 1; if (this.compare(this.items[parent], value) <= 0) break;
        this.items[i] = this.items[parent]; i = parent; }
      this.items[i] = value;
    }
    pop() {
      const first = this.items[0], last = this.items.pop();
      if (this.items.length) {
        let i = 0;
        while (i * 2 + 1 < this.items.length) {
          let child = i * 2 + 1;
          if (child + 1 < this.items.length && this.compare(this.items[child + 1], this.items[child]) < 0) child++;
          if (this.compare(last, this.items[child]) <= 0) break;
          this.items[i] = this.items[child]; i = child;
        }
        this.items[i] = last;
      }
      return first;
    }
  }

  function gridOf(scene) {
    if (!scene || !Number.isInteger(scene.cols) || !Number.isInteger(scene.rows)
        || scene.cols < 1 || scene.rows < 1 || scene.cols > 64 || scene.rows > 64) {
      throw Error('The grid must have integer dimensions between 1 and 64.');
    }
    const walls = new Set();
    for (const p of scene.walls || []) {
      if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger)
          || p[0] < 0 || p[0] >= scene.cols || p[1] < 0 || p[1] >= scene.rows) {
        throw Error('A wall lies outside the grid.');
      }
      walls.add(pointKey(p));
    }
    const weights = scene.weights || {};
    if (Object.values(weights).some(v => !Number.isFinite(v) || v < 1)) {
      throw Error('Terrain costs must be finite numbers of at least one.');
    }
    return {
      cols: scene.cols, rows: scene.rows, walls,
      open(p) { return Array.isArray(p) && p.length === 2 && p.every(Number.isInteger)
        && p[0] >= 0 && p[0] < scene.cols && p[1] >= 0 && p[1] < scene.rows && !walls.has(pointKey(p)); },
      weight(p) { return weights[pointKey(p)] || 1; }
    };
  }

  function agentsOf(scene, grid) {
    if (!Array.isArray(scene.agents) || !scene.agents.length || scene.agents.length > 12) {
      throw Error('Choose between one and twelve agents.');
    }
    const ids = new Set();
    for (const a of scene.agents) {
      if (!a || typeof a.id !== 'string' || !a.id || ids.has(a.id)) throw Error('Agent IDs must be unique nonempty strings.');
      if (!grid.open(a.start) || !grid.open(a.goal)) throw Error('Every agent needs an open start and goal inside the grid.');
      ids.add(a.id);
    }
    return scene.agents;
  }

  function backtrack(node) {
    const path = [];
    while (node) { path.push(node.p.slice()); node = node.parent; }
    return path.reverse();
  }

  function search(scene, start, goal, algorithm = 'astar', options = {}) {
    const began = clock(), trace = [], empty = { status: 'failed', path: null, trace, expanded: 0, cost: null };
    let grid;
    try { grid = gridOf(scene); if (!grid.open(start) || !grid.open(goal)) throw Error('Start and goal must be open grid cells.'); }
    catch (error) { return { ...empty, reason: error.message, elapsedMs: clock() - began }; }
    if (!['bfs', 'dijkstra', 'astar'].includes(algorithm)) return { ...empty, reason: 'Unknown single-agent algorithm.' };
    const maxExpansions = integer(options.maxExpansions, 50000, 1, 100000);
    const maxTrace = integer(options.maxTrace, 750, 0, 1000);
    const frontierSize = integer(options.frontierSize, 70, 0, 100);
    const heuristic = p => algorithm === 'astar' ? distance(p, goal) : 0;
    let serial = 0, expanded = 0;
    const heap = new Heap((a, b) => a.f - b.f || a.h - b.h || a.serial - b.serial);
    const first = { p: start.slice(), g: 0, h: heuristic(start), parent: null, serial: serial++ };
    first.f = first.h; heap.push(first);
    const best = new Map([[pointKey(start), 0]]), closed = new Set();
    while (heap.length) {
      if (expanded >= maxExpansions) return { ...empty, status: 'limit', expanded, reason: 'Search expansion limit reached.', elapsedMs: clock() - began };
      const node = heap.pop(), key = pointKey(node.p);
      if (closed.has(key) || node.g > best.get(key)) continue;
      closed.add(key); expanded++;
      const entry = { type: 'expand', x: node.p[0], y: node.p[1], g: node.g, f: node.f, h: node.h,
        frontier: heap.items.filter(n => !closed.has(pointKey(n.p))).slice(0, frontierSize).map(n => n.p.slice()) };
      if (trace.length < maxTrace) trace.push(entry);
      if (equal(node.p, goal)) {
        const path = backtrack(node);
        return { status: 'solved', path, trace, expanded, cost: node.g, steps: path.length - 1,
          terrainCost: path.slice(1).reduce((sum, p) => sum + grid.weight(p), 0),
          metric: algorithm === 'bfs' ? 'steps' : 'terrain-cost', elapsedMs: clock() - began };
      }
      for (const move of DIRS) {
        const p = [node.p[0] + move[0], node.p[1] + move[1]];
        if (!grid.open(p)) continue;
        const nextKey = pointKey(p), g = node.g + (algorithm === 'bfs' ? 1 : grid.weight(p));
        if (g >= (best.get(nextKey) ?? Infinity)) continue;
        best.set(nextKey, g);
        const h = heuristic(p); heap.push({ p, g, h, f: g + h, parent: node, serial: serial++ });
      }
    }
    return { ...empty, expanded, reason: 'Walls disconnect the start from the goal.', elapsedMs: clock() - began };
  }

  function validate(scene, paths) {
    let grid, agents;
    try { grid = gridOf(scene); agents = agentsOf(scene, grid); }
    catch (error) { return { ok: false, issues: [{ type: 'input', message: error.message }], conflicts: [], cost: null, makespan: null }; }
    const issues = [], conflicts = [], arrivals = [];
    for (const agent of agents) {
      const path = paths && paths[agent.id];
      if (!Array.isArray(path) || !path.length) { issues.push({ type: 'missing', agent: agent.id }); continue; }
      if (path.length > 10000) { issues.push({ type: 'path-length', agent: agent.id }); continue; }
      if (!equal(path[0], agent.start) || !equal(path[path.length - 1], agent.goal)) issues.push({ type: 'endpoint', agent: agent.id });
      for (let time = 0; time < path.length; time++) {
        if (!grid.open(path[time])) issues.push({ type: 'obstacle', agent: agent.id, time });
        else if (time && Array.isArray(path[time - 1]) && distance(path[time], path[time - 1]) > 1) issues.push({ type: 'move', agent: agent.id, time });
      }
      let arrival = path.length - 1;
      while (arrival > 0 && equal(path[arrival - 1], agent.goal)) arrival--;
      arrivals.push(arrival);
    }
    if (issues.length) return { ok: false, issues, conflicts, cost: null, makespan: null };
    const horizon = Math.max(...agents.map(a => paths[a.id].length - 1));
    for (let time = 0; time <= horizon; time++) for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j], pa = at(paths[a.id], time), pb = at(paths[b.id], time);
      if (equal(pa, pb)) conflicts.push({ type: 'vertex', time, agents: [a.id, b.id], cell: pa.slice() });
      else if (time && equal(at(paths[a.id], time - 1), pb) && equal(at(paths[b.id], time - 1), pa)) {
        conflicts.push({ type: 'swap', time, agents: [a.id, b.id], edge: [at(paths[a.id], time - 1).slice(), pa.slice()] });
      }
    }
    return { ok: conflicts.length === 0, issues, conflicts, cost: arrivals.reduce((sum, n) => sum + n, 0), makespan: Math.max(...arrivals) };
  }

  // Space-time A*: entering the goal is terminal only when staying there is legal.
  // States include time, so a wait and a later revisit are distinct possibilities.
  function timedSearch(grid, agent, constraints, reservations, horizon, budget) {
    budget.searches++;
    const vertex = new Set(), edge = new Set();
    for (const c of constraints) {
      if (c.agent !== agent.id) continue;
      if (c.type === 'vertex') vertex.add(pointKey(c.cell) + '@' + c.time);
      else edge.add(pointKey(c.from) + '>' + pointKey(c.to) + '@' + c.time);
    }
    const vertexBlocked = (p, t) => vertex.has(pointKey(p) + '@' + t) || reservations.some(path => equal(at(path, t), p));
    if (vertexBlocked(agent.start, 0)) return { status: 'failed', reason: 'The start is occupied or forbidden at time zero.' };
    const canStay = (p, t) => {
      for (let future = t; future <= horizon; future++) if (vertexBlocked(p, future)
          || edge.has(pointKey(p) + '>' + pointKey(p) + '@' + future)) return false;
      return true;
    };
    let serial = 0;
    const heap = new Heap((a, b) => a.f - b.f || a.walk - b.walk || a.lastMove - b.lastMove || a.h - b.h || a.serial - b.serial);
    const h = distance(agent.start, agent.goal);
    heap.push({ p: agent.start, time: 0, h, f: h, walk: 0, lastMove: 0, parent: null, serial: serial++ });
    const closed = new Set();
    while (heap.length) {
      if (budget.expanded >= budget.maximum) return { status: 'limit', reason: 'Search expansion limit reached.' };
      const node = heap.pop(), state = pointKey(node.p) + '@' + node.time;
      if (closed.has(state)) continue;
      closed.add(state); budget.expanded++;
      if (equal(node.p, agent.goal) && canStay(node.p, node.time)) return { status: 'solved', path: backtrack(node) };
      if (node.time >= horizon) continue;
      for (const move of [[0, 0], ...DIRS]) {
        const p = [node.p[0] + move[0], node.p[1] + move[1]], time = node.time + 1;
        if (!grid.open(p) || vertexBlocked(p, time)) continue;
        if (edge.has(pointKey(node.p) + '>' + pointKey(p) + '@' + time)) continue;
        if (reservations.some(path => equal(at(path, time - 1), p) && equal(at(path, time), node.p))) continue;
        const key = pointKey(p) + '@' + time;
        if (closed.has(key)) continue;
        const h = distance(p, agent.goal), moved = distance(p, node.p);
        heap.push({ p, time, h, f: time + h, walk: node.walk + moved, lastMove: moved, parent: node, serial: serial++ });
      }
    }
    return { status: 'limit', reason: 'No route found within the time horizon for these fixed reservations or constraints.' };
  }

  function solve(scene, algorithm = 'priority', options = {}) {
    const began = clock(), trace = [], budget = { expanded: 0, searches: 0, maximum: integer(options.maxExpansions, 50000, 1, 500000) };
    const horizon = integer(options.horizon, 64, 1, 80), maxHighLevel = integer(options.maxHighLevel, 1000, 1, 10000);
    let grid, agents;
    function finish(status, paths = {}, reason = '', extra = {}) {
      const complete = agents && agents.every(a => paths[a.id]);
      const checked = complete ? validate(scene, paths) : { conflicts: [], cost: null, makespan: null };
      return { status, paths, expanded: budget.expanded, searches: budget.searches, conflicts: checked.conflicts,
        cost: checked.cost, makespan: checked.makespan, trace, reason, horizon,
        metric: 'sum-of-arrival-steps', elapsedMs: clock() - began, ...extra };
    }
    try { grid = gridOf(scene); agents = agentsOf(scene, grid); }
    catch (error) { return finish('failed', {}, error.message); }
    if (!['independent', 'priority', 'cbs'].includes(algorithm)) return finish('failed', {}, 'Unknown multi-agent algorithm.');
    if (algorithm !== 'independent') {
      if (new Set(agents.map(a => pointKey(a.start))).size !== agents.length) return finish('failed', {}, 'Two agents already share a start cell.');
      if (new Set(agents.map(a => pointKey(a.goal))).size !== agents.length) return finish('failed', {}, 'Two agents cannot permanently occupy the same goal.');
    }
    const spatial = {};
    // A spatial reachability check distinguishes a disconnected map from a time-limit failure.
    for (const agent of agents) {
      if (budget.expanded >= budget.maximum) return finish('limit', spatial, 'Search expansion limit reached.');
      const result = search({ ...scene, weights: {} }, agent.start, agent.goal, 'astar', { maxTrace: 0, maxExpansions: Math.max(1, budget.maximum - budget.expanded) });
      budget.searches++; budget.expanded += result.expanded;
      if (result.status !== 'solved') return finish(result.status, spatial, result.reason);
      spatial[agent.id] = result.path;
    }
    if (algorithm === 'independent') {
      const check = validate(scene, spatial);
      return finish(check.ok ? 'solved' : 'collision', spatial,
        check.ok ? 'The independent routes happen to be compatible.' : 'Each route works alone, but the routes collide when executed together.');
    }
    if (algorithm === 'priority') {
      const order = options.order || agents.map(a => a.id);
      if (!Array.isArray(order) || order.length !== agents.length || new Set(order).size !== agents.length
          || order.some(id => !agents.some(a => a.id === id))) return finish('failed', {}, 'The planning order must contain every agent exactly once.');
      const paths = {}, reservations = [];
      for (const id of order) {
        const agent = agents.find(a => a.id === id), result = timedSearch(grid, agent, [], reservations, horizon, budget);
        if (result.status !== 'solved') {
          trace.push({ type: 'blocked', agent: id, order: order.slice(), reason: result.reason });
          return finish(result.status, paths, result.reason, { failedAgent: id, order: order.slice() });
        }
        paths[id] = result.path; reservations.push(result.path);
        trace.push({ type: 'reserved', agent: id, arrival: result.path.length - 1, path: result.path });
      }
      return finish('solved', paths, 'All agents have collision-free timed routes for this planning order.', { order: order.slice() });
    }

    // Standard two-level Conflict-Based Search. The high-level key is sum of costs.
    // Low-level searches use unit costs and remain complete only within the chosen horizon.
    let serial = 0, highExpanded = 0, last = null;
    const heap = new Heap((a, b) => a.cost - b.cost || a.conflicts.length - b.conflicts.length || a.serial - b.serial);
    function node(paths, constraints, depth) {
      const check = validate(scene, paths);
      return { paths, constraints, depth, cost: check.cost, conflicts: check.conflicts, serial: serial++ };
    }
    if (agents.some(a => spatial[a.id].length - 1 > horizon)) return finish('limit', spatial, 'The shortest route exceeds the chosen time horizon.');
    heap.push(node(spatial, [], 0));
    const seenConstraints = new Set(['']);
    while (heap.length && highExpanded < maxHighLevel && budget.expanded < budget.maximum) {
      const current = heap.pop(); last = current; highExpanded++;
      if (!current.conflicts.length) return finish('solved', current.paths, 'CBS found a minimum-sum-cost plan within the search horizon.', { highLevelExpanded: highExpanded, optimalWithinHorizon: true });
      const conflict = current.conflicts[0];
      if (trace.length < 1000) trace.push({ type: 'conflict', ...conflict, cost: current.cost, depth: current.depth, node: highExpanded });
      for (const id of conflict.agents) {
        const path = current.paths[id];
        const constraint = conflict.type === 'vertex'
          ? { type: 'vertex', agent: id, cell: conflict.cell.slice(), time: conflict.time }
          : { type: 'edge', agent: id, from: at(path, conflict.time - 1).slice(), to: at(path, conflict.time).slice(), time: conflict.time };
        const constraints = [...current.constraints, constraint];
        const fingerprint = constraints.map(c => JSON.stringify(c)).sort().join('|');
        if (seenConstraints.has(fingerprint)) continue;
        seenConstraints.add(fingerprint);
        const result = timedSearch(grid, agents.find(a => a.id === id), constraints, [], horizon, budget);
        if (trace.length < 1000) trace.push({ type: 'constraint', agent: id, constraint, status: result.status, depth: current.depth + 1 });
        if (result.status === 'solved') heap.push(node({ ...current.paths, [id]: result.path }, constraints, current.depth + 1));
      }
    }
    return finish('limit', last ? last.paths : spatial,
      budget.expanded >= budget.maximum ? 'CBS reached its search expansion budget.'
        : highExpanded >= maxHighLevel ? 'CBS reached its conflict-tree node budget.'
          : 'CBS found no plan within the chosen time horizon.', { highLevelExpanded: highExpanded, optimalWithinHorizon: false });
  }

  return Object.freeze({ search, solve, validate, version: '1.0.0' });
});
