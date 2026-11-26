# LLMs4MAPF — interactive paper presentation

**[Open MAPF Lab](https://jtzach.github.io/LLMs4MAPF/)**

An interactive presentation of **Can Large Language Models Help Solve Multi-Agent Path Finding?** by Ioannis Tzachristas, Siyuan Xiao, Daniel Jess, Firas Zoghlami and Constantinos Antoniou (Technical University of Munich / BMW Group).

## Present or explore

- **Start demo:** a ten-minute presentation with fifteen sections, animated examples and speaking bullets.
- **Present manually:** the same content with Previous / Next, Pause / Resume and unlimited time on each screen. Arrow keys navigate; Escape returns to the lab.
- **Playground:** edit walls, starts, destinations and planning order; compare real algorithms.
- **BFS vs Dijkstra:** [open the two-route lesson](https://jtzach.github.io/LLMs4MAPF/?lesson=bfs-dijkstra). BFS chooses four moves costing 16; Dijkstra chooses eight moves costing 8. Equal tile costs make both choose the four-move route.
- **The study:** inspect saved observations, five LLM strategies, an actual request/response, and the classical decoder's saved routes.
- **BMW application:** explore a related synthetic rulebook demonstrator through its link or QR code.

The first five minutes explain routing and classical algorithms; the second five present the paper. See [timed presenter notes](PRESENTER_NOTES.txt).

## Run locally

No build step or dependency installation is required. Open `docs/index.html` in Chrome or Edge, or serve it:

```sh
python -m http.server 8766 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8766 . Local-file mode uses Blob Workers; hosted mode loads `worker.js`. The source uses relative URLs and works under a GitHub Pages project path.

## Algorithms and observations

The browser implements BFS, Dijkstra, A*, independent routing, prioritized space-time A* and resource-bounded Conflict-Based Search. The live teaching maps are separate from the external study benchmarks. A bounded search failure is not proof of impossibility; CBS's cost guarantee is limited to its configured horizon. All route checks reject vertex collisions and head-on swaps, and reserve goals after final arrival.

No live LLM calls or API keys are used. `docs/evidence.js` contains the saved presentation observations and recorded example; `docs/assets/recorded_prompt.txt` contains its full saved request. This repository currently contains the presentation and its teaching solver, not the full experimental execution archive. The data source is the Findings manuscript release `findings_20261125_restored_findings` prepared on 25 November 2026.

Lower costs on shared successful cases do not imply better overall success rates. LaCAM3 and EECBS are saved experimental references with their own execution settings; they are not implementations in this browser lab.

## Check the teaching solver

```sh
node tests/engine.test.cjs
node tests/scenarios.test.cjs
```

The checks cover legal moves, vertex and edge-swap collisions, goal occupancy, search limits, weighted route costs, planning-order sensitivity and CBS agreement with a small independent joint-state oracle.

## GitHub Pages

Publish from branch `main`, directory `/docs`. `.nojekyll` serves the files directly. No API secrets or external build service are required. Website assets and source live in `docs/`; presenter notes and portable solver tests remain alongside them.

## Application attribution

The BMW logo identifies the related project context. Original logo asset: [BMW Group](https://www.bmwgroup.com/etc.clientlibs/grpw-web/clientlibs/grpw-base/resources/images/logo/BMW_light.svg). Related application: [BMW-MAPF-project](https://yuanemail123-del.github.io/BMW-MAPF-project/). Its screenshot and QR are included for the presentation. The application is a synthetic rulebook demonstrator, separate from the paper's benchmarks; it is not evidence of a validated factory deployment or safety certification.
