/* Deterministic teaching maps, not research benchmark instances.
 * Every get() call returns a fresh scene so editing never changes another demo.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MAPFScenarios = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const colors = ['#54ead4', '#ffae69', '#74aaff', '#ff7d9b', '#d8b4ff', '#f3df8b',
    '#8de585', '#f498db', '#83ddff', '#ff836b', '#c9d67a', '#c2b4ff'];
  const labels = ['Mint', 'Amber', 'Blue', 'Rose', 'Violet', 'Gold',
    'Lime', 'Pink', 'Sky', 'Coral', 'Olive', 'Lavender'];
  function agent(index, start, goal) {
    return {id: 'a' + index, label: labels[index], color: colors[index], start, goal};
  }
  function empty(cols, rows) { return {cols, rows, walls: [], weights: {}, agents: []}; }
  function rack(scene, x0, y0, width, height) {
    for (let y = y0; y < y0 + height; y++)
      for (let x = x0; x < x0 + width; x++) scene.walls.push([x, y]);
  }
  function warehouse() {
    const s = empty(25, 17);
    for (const x of [3, 10, 17]) for (const y of [2, 7, 12]) rack(s, x, y, 4, 3);
    return s;
  }
  const builders = {
    'bfs-dijkstra': function () {
      const s=empty(7,5),free=new Set();
      for(let x=1;x<=5;x++){free.add(x+',1');free.add(x+',3');}
      free.add('1,2');free.add('5,2');
      for(let y=0;y<s.rows;y++)for(let x=0;x<s.cols;x++)if(!free.has(x+','+y))s.walls.push([x,y]);
      for(const x of [2,3,4])s.weights[x+',3']=5;
      s.agents=[{...agent(0,[1,3],[5,3]),label:'R',goalLabel:'G'}];return s;
    },
    'search-maze': function () {
      const s = warehouse();
      s.agents = [agent(0, [1, 8], [23, 8])];
      return s;
    },
    'weighted-city': function () {
      const s = empty(29, 19);
      for (const x of [3, 9, 15, 21]) for (const y of [2, 12]) rack(s, x, y, 4, 5);
      // These 63 road cells have an abstract traversal cost of five, not a
      // calibrated travel-time or physical traffic model.
      for (let x = 4; x <= 24; x++) for (let y = 8; y <= 10; y++) s.weights[x + ',' + y] = 5;
      s.agents = [agent(0, [1, 9], [27, 9])];
      return s;
    },
    'fleet-crossing': function () {
      const s = warehouse();
      [1, 4, 6, 9, 11, 15].forEach((y, i) => {
        s.agents.push(agent(2 * i, [1, y], [23, y]), agent(2 * i + 1, [23, y], [1, y]));
      });
      return s;
    },
    'cbs-bottleneck': function () {
      const s = empty(17, 11);
      for (const x of [3, 10]) for (const y of [2, 6]) rack(s, x, y, 4, 3);
      s.agents = [
        agent(0, [8, 0], [8, 10]), agent(1, [8, 10], [8, 0]),
        agent(2, [1, 5], [15, 5]), agent(3, [15, 5], [1, 5])
      ];
      return s;
    }
  };
  const list = [
    {
      id:'bfs-dijkstra',name:'bfs-dijkstra',title:'BFS vs Dijkstra: two routes',kind:'search',
      description:'Four expensive moves or eight cheap moves: two routes to the same goal.',
      story:'BFS takes four moves costing 16. Dijkstra takes eight moves costing 8. With every tile costing one, both take four moves costing 4.',
      algorithms:['bfs','dijkstra'],defaultAlgorithm:'dijkstra',
      expected:{bfs:{steps:4,terrainCost:16},dijkstra:{steps:8,terrainCost:8}}
    },
    {
      id: 'search-maze', name: 'search-maze', title: 'Warehouse search', kind: 'search',
      description: 'Find a route through nine storage racks on a 25 × 17 grid.',
      story: 'All floor tiles cost one. BFS and Dijkstra spread broadly; A* uses distance to the goal to focus its search. All three find a 26-step route.',
      algorithms: ['bfs', 'dijkstra', 'astar'], defaultAlgorithm: 'astar',
      expected: {cost: 26, expansions: {bfs: 275, dijkstra: 275, astar: 31}}
    },
    {
      id: 'weighted-city', name: 'weighted-city', title: 'City with a slow road', kind: 'search',
      description: 'Cross a 29 × 19 city: the direct road has five-times-cost tiles.',
      story: 'BFS finds the shortest route in moves: 26 moves, but 110 cost units. Dijkstra and A* take a 30-move detour costing 30. Fewer moves need not mean lower cost.',
      algorithms: ['bfs', 'dijkstra', 'astar'], defaultAlgorithm: 'dijkstra',
      expected: {bfs: {steps: 26, terrainCost: 110, expanded: 292}, dijkstra: {steps: 30, terrainCost: 30, expanded: 332}, astar: {steps: 30, terrainCost: 30, expanded: 38}}
    },
    {
      id: 'fleet-crossing', name: 'fleet-crossing', title: 'Twelve-robot warehouse', kind: 'mapf',
      description: 'Six opposing pairs share the aisles of a 25 × 17 warehouse.',
      story: 'Independent shortest routes produce six conflicts. Planning one robot at a time reserves its route; later robots wait or detour. All twelve then arrive safely.',
      algorithms: ['independent', 'priority'], defaultAlgorithm: 'priority',
      expected: {independent: {status: 'collision', cost: 272, conflicts: 6}, priority: {status: 'solved', cost: 292}}
    },
    {
      id: 'cbs-bottleneck', name: 'cbs-bottleneck', title: 'Cross-aisle coordination', kind: 'mapf',
      description: 'Four robots meet between storage racks on a 17 × 11 grid.',
      story: 'The displayed fixed priority order costs 54 total steps. CBS branches on conflicts and finds 53, with the last robot arriving one step earlier. This is a result for this scene, not a universal advantage.',
      algorithms: ['independent', 'priority', 'cbs'], defaultAlgorithm: 'cbs',
      expected: {independent: {status: 'collision', cost: 48, conflicts: 2}, priority: {status: 'solved', cost: 54, makespan: 17}, cbs: {status: 'solved', cost: 53, makespan: 16, highLevelExpanded: 129, expanded: 8749}}
    }
  ];
  return {
    list,
    get: function (name) { return Object.prototype.hasOwnProperty.call(builders, name) ? builders[name]() : null; }
  };
});
