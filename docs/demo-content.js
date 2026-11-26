/* Fifteen sections: five minutes of foundations, five minutes of the paper. */
(() => {
 const L=window.MAPFLab,$=s=>document.querySelector(s),click=s=>$(s)?.click();
 const modeless=fn=>{fn();if($('#modal').open){$('#modal').close();$('#modal').show();}};
 window.MAPFDemoScenes=[
  {chapter:0,seconds:30,name:'One shared floor',description:'Our paper: Can Large Language Models Help Solve Multi-Agent Path Finding?',bullets:['Each robot has its own start and destination.','All robots share the same limited space.','The question is how to coordinate their movements.'],phases:[
   [0,'Imagine delivery carts in a warehouse, all trying to reach different places.'],
   [12,'A route that is good for one robot can get in the way of another.'],
   [22,'Multi-Agent Path Finding means choosing routes that work together.']]},
  {chapter:1,seconds:25,name:'What makes a valid route?',bullets:['Move one square up, down, left or right — or wait.','Walls block movement; matching rings mark destinations.','Every robot must arrive without colliding.'],phases:[
   [0,'Each color belongs to one robot and its destination.'],
   [10,'Watch one robot wait while the other passes through the crossing.'],
   [18,'Arriving does not remove a robot: it still occupies its destination.']]},
  {chapter:2,seconds:30,name:'Two kinds of collision',bullets:['Two robots cannot occupy the same square at the same time.','They cannot swap positions through each other.','Individual shortest routes can still create an invalid team plan.'],phases:[
   [0,'These shortest routes put both robots in the same square together.'],
   [11,'A head-on swap is also forbidden.',()=>click('[data-demo="swap"]')],
   [21,'A planned wait avoids the crossing collision.',()=>click('[data-demo="safe"]')]]},
  {chapter:3,seconds:45,name:'Three searches in a warehouse',title:'Watch the search spread — or focus.',description:'The same 25 × 17 warehouse, the same start and goal. Three real search algorithms.',setup:()=>L.configureScenario({preset:'search-maze',algorithm:'astar',compare:true}),bullets:['BFS explores in order of the number of moves.','Dijkstra explores in order of cost so far.','A* adds an estimate of the remaining distance.'],phases:[
   [0,'The colored cells show where each algorithm looks for a route.'],
   [16,'Every move costs one here, so BFS and Dijkstra explore the same cells. The next example changes the costs.'],
   [31,'Here, A* explores 31 cells rather than 275. All three find a 26-step route.']]},
  {chapter:3,seconds:35,name:'BFS counts moves; Dijkstra counts cost',title:'BFS counts moves. Dijkstra counts cost.',description:'Same map, same destination. Change the tile costs to see when their routes differ.',setup:()=>L.configureScenario({preset:'bfs-dijkstra',algorithm:'dijkstra',compare:true,algorithms:['bfs','dijkstra']}),bullets:['BFS chooses the route with the fewest moves.','Dijkstra chooses the route with the lowest total cost.','When every move costs one, both choose a shortest route.'],phases:[
   [0,'Follow each chosen route. The number on a square is the cost of entering it.'],
   [13,'BFS takes four moves costing 16. Dijkstra takes eight moves costing 8: twice as many moves, half the cost.',()=>{if(!Object.values(L.state.scene.weights).some(w=>w>1))click('#equal-cost-toggle');}],
   [25,'Now every square costs one. Both algorithms choose the short route: four moves, cost four.',()=>{if(Object.values(L.state.scene.weights).some(w=>w>1))click('#equal-cost-toggle');}]]},
  {chapter:4,seconds:35,name:'Why planning order matters',bullets:['Plan one robot, then reserve its squares and times.','Later robots must fit around those reservations.','Changing the order can change whether a plan is found.'],phases:[
   [0,'Mint is planned first. Its reserved route leaves no way through for Amber.'],
   [12,'Reverse the order: Amber is planned first, and Mint can use the side pocket.',()=>click('#reverse-order')],
   [25,'Failure under one fixed order does not prove that the puzzle is impossible.']]},
  {chapter:5,seconds:45,name:'A twelve-robot rush hour',title:'Twelve robots. Six opposing pairs.',description:'Independent shortest routes versus reservations in space and time, on the same warehouse floor.',setup:()=>L.configureScenario({preset:'fleet-crossing',algorithm:'priority',compare:true,algorithms:['independent','priority']}),bullets:['Six pairs travel in opposite directions through shared aisles.','Independent routes produce six conflicts in this example.','Prioritized planning finds valid routes for all twelve robots.'],phases:[
   [0,'On the left, each robot plans alone. On the right, later plans avoid earlier reservations.'],
   [16,'Waiting and detours make the right-hand plan longer, but collision-free.'],
   [31,'A low route cost is useful only when the combined plan is valid.']]},
  {chapter:5,seconds:55,name:'How CBS resolves conflicts',title:'Resolve conflicts by reconsidering routes.',description:'Four robots cross between storage racks. Compare a fixed planning order with Conflict-Based Search.',setup:()=>L.configureScenario({preset:'cbs-bottleneck',algorithm:'cbs',compare:true}),bullets:['CBS detects a collision in a candidate plan.','It branches into alternatives that constrain different robots.','It searches the alternatives by total route cost.'],phases:[
   [0,'Independent routes collide; the fixed priority order and CBS both find valid plans.'],
   [16,'Here, fixed priority costs 54 total steps and CBS costs 53. This is a result for this scene.'],
   [29,'A real CBS decision: two robots want the same place or crossing.',()=>modeless(()=>L.inspectBranches())],
   [39,'Each branch restricts one robot and searches for a replacement route.',()=>click('#branch-next')],
   [48,'CBS can reconsider earlier choices. Another priority order can also reach cost 53 here.',()=>click('#branch-next')]]},
  {chapter:6,seconds:95,name:'The paper: five LLM strategies',bullets:['An LLM can propose complete timed routes or only a planning order.','For ordering, the same classical planner builds the routes.','An independent checker assesses the resulting routes.'],phases:[
   [0,'Direct routes: the LLM writes every robot’s timed route.',()=>L.showMethod('direct')],
   [12,'Feedback repair: the checker reports a problem; the LLM tries to fix the routes.',()=>L.showMethod('repair')],
   [25,'Fresh retry: ask again from the original task, without the error report.',()=>L.showMethod('fresh')],
   [37,'Map ordering: the LLM sees the map and chooses which robot is planned first.',()=>L.showMethod('map')],
   [50,'Conflict ordering: the LLM chooses an order from summaries of likely conflicts.',()=>L.showMethod('conflict')],
   [65,'This is an actual saved DeepSeek response: an agent order, not a set of routes.',()=>{modeless(()=>L.recordedExample());click('#recorded-play');}],
   [80,'The classical decoder produced the routes being replayed. The full grid was not in this LLM request.']]},
  {chapter:7,seconds:35,name:'The benchmark experiment',bullets:['Five models: Luna, Gemini, DeepSeek, Qwen and Mistral.','POGEMA Puzzles: 432 scheduled cases; MovingAI: 150 small and 440 larger.','All five strategies on small cases; ordering only on larger cases.'],phases:[
   [0,'The paper uses two external benchmark sources, separate from these teaching maps.'],
   [12,'We check final moves, destinations and collisions, then measure success and route cost.'],
   [24,'All scheduled cases count, including 15 proved-unsolvable Puzzles cases.']]},
  {chapter:7,seconds:35,name:'Routes, feedback and retries',title:'Does feedback help more than another try?',description:'Saved outcomes for the three route-generation strategies; every number comes from the study.',setup:()=>MAPFResearch.showRoutes('puzzles'),bullets:['Direct routes sometimes succeed on small tasks.','Feedback repair is not consistently better than a fresh retry.','The observed effects depend on the model and benchmark.'],phases:[
   [0,'On Puzzles, Luna solves 238 directly, 263 with repair and 275 with a fresh retry.'],
   [12,'Gemini shows the opposite repair-versus-retry pattern: 55 with repair and 40 with a fresh retry.'],
   [23,'The smaller MovingAI cases also show why we need the fresh-retry control.',()=>MAPFResearch.showRoutes('small')]]},
  {chapter:8,seconds:40,name:'Who solves more large cases?',bullets:['Longest-first uses no LLM: plan longer individual routes first.','Compare ordering methods using the same classical route planner.','Luna solves 374 or 375 large cases; Longest-first solves 399.'],phases:[
   [0,'Changing the planning order can help or hurt the final routes.'],
   [13,'For Luna, Map ordering solves 374 and Conflict ordering 375 of the 440 larger cases.'],
   [26,'The simple Longest-first rule solves more. Stronger classical references are shown with their own settings.']]},
  {chapter:9,seconds:40,name:'Where the LLM helps',bullets:['Compare route costs only where both methods return valid plans.','Luna Conflict ordering and Longest-first share 359 successes.','Luna saves 8.25 travel and waiting steps on average in that subset.'],phases:[
   [0,'Success rate and route cost answer different questions.'],
   [14,'The saving is 8.25 steps on average, with a 95% interval from 4.20 to 12.15.'],
   [27,'Longest-first alone solves 40 cases; Luna alone solves 16. The cost benefit is not overall superiority.',()=>click('[data-outcome="rule"]')]]},
  {chapter:10,seconds:25,name:'What could language add?',bullets:['Translate an operator’s instruction into explicit planning constraints.','Use classical planning to construct routes.','Check the interpretation and routes; these proposed benefits need testing.'],phases:[
   [0,'A possible application: “Give the medicine cart priority.”',()=>{L.showFuture('hospital');click('#future-play');}],
   [13,'Another: “The upper aisle is closed.” Language could help express the constraint.',()=>{L.showFuture('warehouse');click('#future-play');}]]},
  {chapter:11,seconds:30,name:'BMW: a rule-constrained application',bullets:['Routes must respect permitted zones and crossing priorities.','The linked BMW project illustrates a synthetic operational rulebook.','Next question: can LLMs translate these rules into correct constraints?'],phases:[
   [0,'This BMW project adds operational restrictions to shared-space routing.'],
   [11,'Robots must respect zones, yield to forklifts and follow handover rules.'],
   [21,'Scan the QR to explore. This demonstrator is separate from the paper’s benchmark experiments.']]}
 ];
})();
