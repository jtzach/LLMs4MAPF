/* MAPF Lab canvas renderer. Coordinates are [column, row]. No network or model calls. */
(function (root) {
  'use strict';
  const PALETTE = ['#54ead4', '#ffae69', '#74aaff', '#ff7d9b', '#b69aff', '#ffe08b'];
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const MONO = '"Cascadia Code", Consolas, monospace';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const coordKey = (x, y) => x + ',' + y;
  const equal = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
  const pointAt = (path, t) => path[Math.min(Math.max(0, t), path.length - 1)];
  function alpha(hex, opacity) {
    if (/^#[a-f0-9]{6}$/i.test(hex)) {
      return 'rgba(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',') + ',' + opacity + ')';
    }
    if (/^#[a-f0-9]{3}$/i.test(hex)) return alpha('#' + hex.slice(1).split('').map(c => c + c).join(''), opacity);
    return hex;
  }
  function rounded(ctx, x, y, w, h, radius) {
    radius = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
  }
  function create(canvas, callbacks) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('MAPFView.create needs a canvas');
    callbacks = callbacks || {};
    const ctx = canvas.getContext('2d');
    let scene = { cols: 1, rows: 1, walls: [], agents: [] };
    let state = { paths: {}, time: 0, searchTrace: [], searchProgress: 0, showPaths: true, showLabels: true, conflicts: [] };
    let walls = new Set(), viewport = { width: 640, height: 400, cell: 24, ox: 20, oy: 20 };
    let destroyed = false, visible = true, raf = 0, pulseTimer = 0, pointerDown = false, lastDrag = null;
    const reduceMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    canvas.style.display = 'block';
    canvas.style.width = '100%'; canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.style.cursor = callbacks.onCell ? 'crosshair' : 'default';
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interactive route map. Filled markers are robots; matching rings are destinations.');

    function center(p) { return [viewport.ox + (p[0] + .5) * viewport.cell, viewport.oy + (p[1] + .5) * viewport.cell]; }
    function visibleNow() { return visible && !document.hidden && canvas.getClientRects().length > 0; }
    function queue() {
      if (!destroyed && !raf && visibleNow()) raf = requestAnimationFrame(draw);
    }
    function resize() {
      if (destroyed) return;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width || canvas.parentElement?.clientWidth || 640);
      const height = Math.max(1, rect.height || canvas.parentElement?.clientHeight || 400);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const paddingX = width < 380 ? 18 : 28, paddingY = height < 280 ? 17 : 28;
      const cell = Math.max(1, Math.min((width - 2 * paddingX) / scene.cols, (height - 2 * paddingY) / scene.rows));
      viewport = { width, height, cell, ox: (width - cell * scene.cols) / 2, oy: (height - cell * scene.rows) / 2 };
      queue();
    }
    function drawFloor() {
      const { width, height, cell: c, ox, oy } = viewport;
      const bg = ctx.createRadialGradient(width * .48, height * .42, 0, width * .48, height * .42, Math.max(width, height) * .7);
      bg.addColorStop(0, '#10232e'); bg.addColorStop(1, '#08121a');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
      rounded(ctx, ox - 1, oy - 1, scene.cols * c + 2, scene.rows * c + 2, Math.min(12, c * .2));
      ctx.fillStyle = '#0c1c26'; ctx.fill(); ctx.strokeStyle = '#2a4656'; ctx.lineWidth = 1; ctx.stroke();
      for (let y = 0; y < scene.rows; y++) for (let x = 0; x < scene.cols; x++) {
        const px = ox + x * c, py = oy + y * c;
        if ((x + y) % 2 === 0) { ctx.fillStyle = 'rgba(32,64,78,.10)'; ctx.fillRect(px + .5, py + .5, c - 1, c - 1); }
        const weight = scene.weights?.[coordKey(x, y)] || 1;
        if (weight > 1 && !walls.has(coordKey(x, y))) {
          ctx.fillStyle = alpha('#ffae69', Math.min(.28, .07 + weight * .018));
          rounded(ctx, px + 2, py + 2, c - 4, c - 4, Math.min(5, c * .12)); ctx.fill();
          ctx.strokeStyle = alpha('#ffae69', .14); ctx.lineWidth = 1;
          for (let d = 7; d < c - 5; d += 7) { ctx.beginPath(); ctx.moveTo(px + d, py + c - 4); ctx.lineTo(px + c - 4, py + d); ctx.stroke(); }
          if (!state.showTileCosts && c >= 22) { ctx.font = '600 ' + Math.max(10, c * .21) + 'px ' + MONO; ctx.fillStyle = '#d3ae81'; ctx.textAlign = 'right'; ctx.fillText('×' + weight, px + c - 5, py + c - 5); }
        }
        if (state.showTileCosts && !walls.has(coordKey(x, y))) {
          ctx.save(); ctx.font = '650 ' + Math.min(15, Math.max(8, c * .23)) + 'px ' + MONO;
          ctx.fillStyle = weight > 1 ? '#ffd1a2' : '#a7c0cb'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
          ctx.fillText(String(weight), px + c - Math.max(3, c * .08), py + Math.max(3, c * .07)); ctx.restore();
        }
      }
      ctx.strokeStyle = 'rgba(119,163,185,.095)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < scene.cols; x++) { ctx.moveTo(ox + x * c, oy); ctx.lineTo(ox + x * c, oy + scene.rows * c); }
      for (let y = 1; y < scene.rows; y++) { ctx.moveTo(ox, oy + y * c); ctx.lineTo(ox + scene.cols * c, oy + y * c); }
      ctx.stroke();
      if (c >= 22) {
        ctx.font = '10px ' + MONO; ctx.fillStyle = '#678494'; ctx.textAlign = 'center';
        for (let x = 0; x < scene.cols; x++) ctx.fillText(x, ox + (x + .5) * c, oy - 10);
        ctx.textAlign = 'right';
        for (let y = 0; y < scene.rows; y++) ctx.fillText(y, ox - 9, oy + (y + .5) * c + 3);
      }
    }
    function drawSearch() {
      if (state.showTileCosts) return;
      const trace = state.searchTrace || [], count = clamp(Math.floor(state.searchProgress || 0), 0, trace.length), c = viewport.cell;
      if (!count) return;
      const current = trace[count - 1];
      const seen = new Set();
      for (let i = 0; i < count; i++) {
        const node = trace[i], k = coordKey(node.x, node.y);
        if (seen.has(k) || walls.has(k)) continue;
        seen.add(k); const px = viewport.ox + node.x * c, py = viewport.oy + node.y * c;
        ctx.fillStyle = alpha('#54ead4', .10 + .14 * (i / Math.max(1, count)));
        rounded(ctx, px + 1.5, py + 1.5, c - 3, c - 3, Math.min(5, c * .13)); ctx.fill();
        if (state.showCosts && c >= 30) { ctx.font = '11px ' + MONO; ctx.fillStyle = '#73a79f'; ctx.textAlign = 'center'; ctx.fillText(String(Math.round(node.g * 10) / 10), px + c / 2, py + c / 2 + 4); }
      }
      for (const item of current.frontier || []) {
        const p = Array.isArray(item) ? item : [item.x, item.y];
        if (seen.has(coordKey(...p)) || walls.has(coordKey(...p))) continue;
        const [x, y] = center(p); ctx.strokeStyle = alpha('#ffe08b', .52); ctx.lineWidth = Math.max(1, c * .035);
        rounded(ctx, x - c * .40, y - c * .40, c * .80, c * .80, Math.min(5, c * .1)); ctx.stroke();
      }
      const [x, y] = center([current.x, current.y]);
      ctx.save(); ctx.shadowColor = '#54ead4'; ctx.shadowBlur = Math.min(20, c * .6);
      ctx.strokeStyle = '#a2ffed'; ctx.lineWidth = Math.max(1.5, c * .045);
      rounded(ctx, x - c * .43, y - c * .43, c * .86, c * .86, Math.min(6, c * .12)); ctx.stroke(); ctx.restore();
    }
    function drawWalls() {
      const c = viewport.cell;
      for (const p of scene.walls || []) {
        const x = viewport.ox + p[0] * c, y = viewport.oy + p[1] * c, inset = c > 18 ? 2.5 : .7;
        const h = Math.min(6, c * .11);
        rounded(ctx, x + inset, y + inset + h, c - inset * 2, c - inset * 2, Math.min(6, c * .14));
        ctx.fillStyle = '#030a10'; ctx.fill();
        const wall = ctx.createLinearGradient(x, y, x, y + c);
        wall.addColorStop(0, '#345061'); wall.addColorStop(1, '#233b4a');
        rounded(ctx, x + inset, y + inset, c - inset * 2, c - inset * 2 - h, Math.min(6, c * .14));
        ctx.fillStyle = wall; ctx.fill(); ctx.strokeStyle = '#456170'; ctx.lineWidth = c > 15 ? 1 : .5; ctx.stroke();
        if (c > 27) { ctx.strokeStyle = 'rgba(156,183,196,.13)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + c * .22, y + c * .34); ctx.lineTo(x + c * .78, y + c * .34); ctx.moveTo(x + c * .22, y + c * .56); ctx.lineTo(x + c * .78, y + c * .56); ctx.stroke(); }
      }
    }
    function pathLine(points) {
      ctx.beginPath(); points.forEach((p, i) => { const q = center(p); i ? ctx.lineTo(...q) : ctx.moveTo(...q); });
    }
    function drawPaths() {
      if (state.showPaths === false) return;
      const c = viewport.cell;
      (scene.agents || []).forEach((agent, i) => {
        const path = state.paths?.[agent.id]; if (!path?.length) return;
        const color = agent.color || PALETTE[i % PALETTE.length];
        ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        pathLine(path); ctx.strokeStyle = alpha(color, state.showTileCosts ? .65 : .32); ctx.lineWidth = state.showTileCosts ? Math.max(2.3, c * .08) : Math.max(1.3, c * .055); ctx.setLineDash([Math.max(3, c * .13), Math.max(3, c * .10)]); ctx.stroke(); ctx.setLineDash([]);
        const floor = Math.floor(Math.max(0, state.time || 0)), segment = path.slice(0, Math.min(path.length, floor + 1));
        const frac = clamp((state.time || 0) - floor, 0, 1), a = pointAt(path, floor), b = pointAt(path, floor + 1);
        if (a && b && frac > 0) segment.push([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]);
        if (segment.length > 1) { pathLine(segment); ctx.strokeStyle = alpha(color, .62); ctx.lineWidth = Math.max(2, c * .07); ctx.shadowColor = alpha(color, .4); ctx.shadowBlur = 7; ctx.stroke(); }
        ctx.shadowBlur = 0;
        if (c > 24) for (let j = 1; j < path.length; j += 3) {
          const from = center(path[j - 1]), to = center(path[j]); if (equal(path[j - 1], path[j])) continue;
          const angle = Math.atan2(to[1] - from[1], to[0] - from[0]), x = (from[0] + to[0]) / 2, y = (from[1] + to[1]) / 2, r = Math.min(4, c * .075);
          ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r, -r); ctx.lineTo(-r, r); ctx.closePath(); ctx.fillStyle = alpha(color, .45); ctx.fill(); ctx.restore();
        }
        ctx.restore();
      });
    }
    function drawGoals(pulse) {
      const c = viewport.cell;
      (scene.agents || []).forEach((agent, i) => {
        const color = agent.color || PALETTE[i % PALETTE.length], [sx, sy] = center(agent.start), [x, y] = center(agent.goal), r = c * .33;
        ctx.save();
        ctx.beginPath(); ctx.arc(sx, sy, c * .18, 0, Math.PI * 2); ctx.strokeStyle = alpha(color, .22); ctx.lineWidth = 1; ctx.stroke();
        const p = state.paths?.[agent.id], reached = p && state.time >= p.length - 1;
        if (reached) { ctx.beginPath(); ctx.arc(x, y, r + c * (.05 + .04 * pulse), 0, Math.PI * 2); ctx.strokeStyle = alpha(color, .2 + .10 * pulse); ctx.lineWidth = 2; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#0a1b25'; ctx.fill(); ctx.strokeStyle = alpha(color, .8); ctx.lineWidth = Math.max(1.2, c * .038); ctx.setLineDash([c * .09, c * .06]); ctx.stroke(); ctx.setLineDash([]);
        if (state.showLabels !== false && c >= 16) { const label = String(agent.goalLabel || agent.label || agent.id); ctx.font = '650 ' + Math.min(13, Math.max(8, c * .23)) + 'px ' + FONT; ctx.fillStyle = alpha(color, .9); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y, c * .54); }
        ctx.restore();
      });
    }
    function drawAgents(pulse) {
      const c = viewport.cell, time = Math.max(0, Number(state.time) || 0), frame = Math.floor(time), fraction = time - frame;
      const positions = (scene.agents || []).map(a => { const p = state.paths?.[a.id] || [a.start], from = pointAt(p, frame), to = pointAt(p, frame + 1); return { agent: a, path: p, from, to, p: [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction] }; });
      positions.forEach((item, i) => {
        const agent = item.agent, color = agent.color || PALETTE[i % PALETTE.length]; let [x, y] = center(item.p);
        const overlaps = positions.filter(v => equal(v.p, item.p));
        if (overlaps.length > 1) { const index = overlaps.indexOf(item), angle = -Math.PI / 2 + 2 * Math.PI * index / overlaps.length; x += Math.cos(angle) * c * .13; y += Math.sin(angle) * c * .13; }
        const selected = state.selectedAgent === agent.id, r = c * (overlaps.length > 1 ? .22 : .26);
        ctx.save(); ctx.translate(x, y);
        ctx.beginPath(); ctx.ellipse(0, r * .61, r * 1.22, r * .65, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fill();
        if (selected) { ctx.beginPath(); ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2); ctx.strokeStyle = alpha(color, .55 + .2 * pulse); ctx.lineWidth = 2; ctx.stroke(); }
        ctx.shadowColor = alpha(color, .8); ctx.shadowBlur = c > 18 ? 10 + pulse * 3 : 3;
        rounded(ctx, -r, -r, r * 2, r * 2, r * .40); ctx.fillStyle = '#102531'; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, c * .045); ctx.stroke(); ctx.shadowBlur = 0;
        rounded(ctx, -r * .82, -r * .82, r * 1.64, r * 1.64, r * .29); ctx.fillStyle = alpha(color, .20); ctx.fill();
        if (state.showLabels !== false && c >= 15) { ctx.font = '750 ' + Math.min(14, Math.max(8, c * .245)) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#effffe'; ctx.fillText(String(agent.label || agent.id), 0, .4, r * 1.6); }
        else { ctx.beginPath(); ctx.arc(0, 0, Math.max(1, r * .25), 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
        let dx = item.to[0] - item.from[0], dy = item.to[1] - item.from[1];
        if (!dx && !dy && frame > 0) { const prev = pointAt(item.path, frame - 1); dx = item.from[0] - prev[0]; dy = item.from[1] - prev[1]; }
        if ((dx || dy) && c > 20) { ctx.rotate(Math.atan2(dy, dx)); ctx.beginPath(); ctx.moveTo(r * 1.27, 0); ctx.lineTo(r * .91, -r * .24); ctx.lineTo(r * .91, r * .24); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
        ctx.restore();
      });
    }
    function drawConflicts(pulse) {
      const c = viewport.cell, time = Number(state.time) || 0;
      for (const conflict of state.conflicts || []) {
        const at = conflict.time ?? conflict.t;
        if (Math.abs(time - at) > .55 && state.highlightAllConflicts !== true) continue;
        let cell = conflict.cell || conflict.p;
        if (!cell) { const id = conflict.agents?.[0], path = state.paths?.[id]; if (path) cell = pointAt(path, at); }
        if (!cell) continue;
        const [x, y] = center(cell);
        ctx.save(); ctx.strokeStyle = '#ff6483'; ctx.lineWidth = Math.max(2, c * .055); ctx.shadowColor = '#ff6483'; ctx.shadowBlur = 16;
        if (conflict.type === 'swap') {
          let edge = conflict.edge;
          if (!edge && conflict.agents?.length) { const p = state.paths?.[conflict.agents[0]]; if (p) edge = [pointAt(p, at - 1), pointAt(p, at)]; }
          if (edge?.length === 2) { pathLine(edge); ctx.lineWidth = Math.max(4, c * .15); ctx.globalAlpha = .65; ctx.stroke(); ctx.globalAlpha = 1; }
        }
        ctx.beginPath(); ctx.arc(x, y, c * (.44 + pulse * .035), 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        if (c > 28) { ctx.fillStyle = '#ff94a8'; ctx.font = '800 ' + Math.max(11, c * .2) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x + c * .40, y - c * .40); }
        ctx.restore();
      }
    }
    function drawHover() {
      const p = state.hover; if (!p) return;
      const c = viewport.cell, [x, y] = center(p);
      ctx.strokeStyle = 'rgba(215,244,250,.55)'; ctx.lineWidth = 1.5;
      rounded(ctx, x - c * .46, y - c * .46, c * .92, c * .92, Math.min(6, c * .14)); ctx.stroke();
    }
    function draw(now) {
      raf = 0;
      if (destroyed || !visibleNow()) return;
      const pulse = reduceMotion.matches ? .5 : (Math.sin((now || performance.now()) / 580) + 1) / 2;
      ctx.clearRect(0, 0, viewport.width, viewport.height);
      drawFloor(); drawSearch(); drawWalls(); drawPaths(); drawGoals(pulse); drawAgents(pulse); drawConflicts(pulse); drawHover();
      if (!reduceMotion.matches && !pulseTimer) pulseTimer = setTimeout(() => { pulseTimer = 0; queue(); }, 80);
    }
    function getCellAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect(), x = (clientX - rect.left) * viewport.width / rect.width, y = (clientY - rect.top) * viewport.height / rect.height;
      const cx = Math.floor((x - viewport.ox) / viewport.cell), cy = Math.floor((y - viewport.oy) / viewport.cell);
      return cx >= 0 && cx < scene.cols && cy >= 0 && cy < scene.rows ? [cx, cy] : null;
    }
    function down(event) {
      const p = getCellAt(event.clientX, event.clientY); if (!p) return;
      pointerDown = true; lastDrag = coordKey(...p); canvas.setPointerCapture?.(event.pointerId);
      if (callbacks.onCell) { event.preventDefault(); callbacks.onCell(p[0], p[1], event); }
      state.hover = p; queue();
    }
    function move(event) {
      const p = getCellAt(event.clientX, event.clientY); state.hover = p;
      if (pointerDown && p && coordKey(...p) !== lastDrag) {
        lastDrag = coordKey(...p); if (callbacks.onDragCell) { event.preventDefault(); callbacks.onDragCell(p[0], p[1], event); }
      }
      queue();
    }
    function up(event) { pointerDown = false; lastDrag = null; if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId); }
    function leave() { if (!pointerDown) { state.hover = null; queue(); } }
    function onVisibility() { if (!document.hidden) { resize(); queue(); } }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', onVisibility);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; observer?.observe(canvas);
    const intersection = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting !== false; if (visible) queue(); }) : null; intersection?.observe(canvas);
    resize();
    return {
      setScene(next) {
        scene = { cols: next.cols, rows: next.rows, walls: next.walls || [], weights: next.weights || {}, agents: next.agents || [] };
        walls = new Set(scene.walls.map(p => coordKey(...p)));
        state = { paths: {}, time: 0, searchTrace: [], searchProgress: 0, showPaths: true, showLabels: true, conflicts: [] };
        canvas.setAttribute('aria-label', 'Route map, ' + scene.cols + ' columns by ' + scene.rows + ' rows, with ' + scene.agents.length + ' agents. Filled markers are agents and matching rings are destinations.');
        resize();
      },
      setState(next) { state = { ...state, ...next }; queue(); },
      resize,
      getCellAt,
      destroy() {
        destroyed = true; cancelAnimationFrame(raf); clearTimeout(pulseTimer); observer?.disconnect(); intersection?.disconnect();
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }
  root.MAPFView = { create, palette: PALETTE.slice() };
})(typeof window !== 'undefined' ? window : globalThis);
