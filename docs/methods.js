/* Five study methods, drawn as workflows. Teaching examples are not experiment records. */
(() => {
  'use strict';
  const view = document.getElementById('methods-view');
  if (!view) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const methods = {
    direct: {
      name:'Direct routes', lane:'routes', inputTitle:'The routing problem', inputLines:['Map + starts + goals','Movement and safety rules'],
      request:'“Write every robot’s position at every time step.”',
      response:'A complete set of timed routes, including any waiting.',
      distinction:'The language model writes the routes. The checker decides whether they are valid.',
      mobileAction:'Write timed routes', retry:null
    },
    repair: {
      name:'Feedback repair', lane:'routes', inputTitle:'Problem + first answer', inputLines:['Map + starts + goals','Previous route attempt'],
      request:'“At step 2, two robots share a square. Return corrected routes.”',
      response:'A revised set of timed routes, checked again.',
      distinction:'After an invalid answer, the checker’s error is sent back with the previous attempt.',
      mobileAction:'Revise timed routes', retry:'ERROR REPORT → TRY TO FIX IT'
    },
    fresh: {
      name:'Fresh retry', lane:'routes', inputTitle:'The original problem', inputLines:['Same map + starts + goals','No previous answer or error'],
      request:'“Write routes for this original problem again.”',
      response:'A new set of timed routes, checked in exactly the same way.',
      distinction:'After an invalid answer, try again from the original prompt. No error report is supplied.',
      mobileAction:'Write routes again', retry:'ORIGINAL PROMPT → ANOTHER ATTEMPT'
    },
    map: {
      name:'Map ordering', lane:'orders', inputTitle:'The full map', inputLines:['Map + starts + goals','Choose who is planned first'],
      request:'“Look at this map. In what order should the robots be planned?”',
      response:'A robot order, for example 3 → 1 → 2. The planner builds the routes.',
      distinction:'The language model chooses an order. The same classical planner constructs and reserves routes.',
      mobileAction:'Choose planning order', retry:null
    },
    conflict: {
      name:'Conflict ordering', lane:'orders', inputTitle:'A conflict summary', inputLines:['Likely robot interactions','Route lengths + map statistics'],
      request:'“These robots may interfere. Choose a useful planning order.”',
      response:'A robot order, for example 3 → 1 → 2. The planner builds the routes.',
      distinction:'The model receives a summary of likely conflicts instead of the full grid; the route planner is unchanged.',
      mobileAction:'Choose planning order', retry:null
    }
  };
  const keys = Object.keys(methods);
  let current = 'direct';
  const arrows = `<defs>
    <marker id="mf-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker>
    <pattern id="mf-grid" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0H0V14" fill="none" stroke="#456170" stroke-width=".7"/></pattern>
  </defs>`;
  const desktop = `<svg class="mf-diagram" viewBox="0 0 1300 296" role="img" aria-labelledby="mf-diagram-title mf-diagram-desc">
    <title id="mf-diagram-title">Two ways language models contribute to routing</title><desc id="mf-diagram-desc"></desc>${arrows}
    <g class="mf-feedback-path"><path class="mf-edge mf-error-edge" d="M1170 105V23H378V61" marker-end="url(#mf-arrow)"/><rect x="615" y="9" width="298" height="26" rx="13"/><text x="764" y="27" text-anchor="middle">CHECKER’S ERROR + PREVIOUS ANSWER</text></g>
    <g class="mf-fresh-path"><path class="mf-edge mf-fresh-edge" d="M100 110V23H378V61" marker-end="url(#mf-arrow)"/><rect x="115" y="9" width="235" height="26" rx="13"/><text x="233" y="27" text-anchor="middle">SAME PROMPT · NO ERROR REPORT</text></g>
    <g class="mf-input-node"><rect x="9" y="110" width="182" height="112" rx="10"/><text class="mf-small-label" x="25" y="131">WHAT THE LLM SEES</text><text id="mf-input-title" class="mf-node-title" x="25" y="154"></text><text id="mf-input-line1" class="mf-node-copy" x="25" y="177"></text><text id="mf-input-line2" class="mf-node-copy" x="25" y="195"></text><path d="M25 208H91" stroke="#5d8396" stroke-width="2"/></g>
    <g class="mf-routes-lane">
      <text class="mf-lane-label" x="269" y="46">1. ASK THE MODEL TO WRITE ROUTES</text>
      <path class="mf-edge" d="M191 145H229V97H270" marker-end="url(#mf-arrow)"/>
      <g class="mf-llm-node mf-stage"><rect x="270" y="62" width="219" height="73" rx="10"/><text class="mf-small-label" x="287" y="83">LANGUAGE MODEL</text><text class="mf-node-title" id="mf-route-action" x="287" y="108">Write timed routes</text><path class="mf-spark" d="M462 78l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/></g>
      <path class="mf-edge" d="M489 98H538" marker-end="url(#mf-arrow)"/>
      <g class="mf-route-artifact"><text class="mf-output-label" x="560" y="76">TIMED ROUTES</text><circle cx="567" cy="98" r="5" fill="#74aaff"/><path d="M582 98H699" stroke="#74aaff" stroke-width="2"/><circle cx="588" cy="98" r="4"/><circle cx="622" cy="98" r="4"/><circle cx="656" cy="98" r="4"/><circle cx="690" cy="98" r="4"/><circle cx="567" cy="119" r="5" fill="#ff7d9b"/><path d="M582 119H699" stroke="#ff7d9b" stroke-width="2"/><circle cx="588" cy="119" r="4"/><circle cx="622" cy="119" r="4"/><circle cx="656" cy="119" r="4"/><circle cx="690" cy="119" r="4"/><text class="mf-node-copy" x="715" y="108">positions + waiting</text></g>
      <path class="mf-edge" d="M880 98H1007Q1030 98 1030 121V141H1068" marker-end="url(#mf-arrow)"/>
    </g>
    <g class="mf-orders-lane">
      <text class="mf-lane-label" x="269" y="176">2. ASK THE MODEL WHO SHOULD GO FIRST</text>
      <path class="mf-edge" d="M191 185H229V226H270" marker-end="url(#mf-arrow)"/>
      <g class="mf-llm-node mf-stage"><rect x="270" y="190" width="219" height="73" rx="10"/><text class="mf-small-label" x="287" y="211">LANGUAGE MODEL</text><text class="mf-node-title" x="287" y="236">Choose planning order</text><path class="mf-spark" d="M462 206l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/></g>
      <path class="mf-edge" d="M489 226H525" marker-end="url(#mf-arrow)"/>
      <g class="mf-order-artifact"><text class="mf-output-label" x="545" y="205">ROBOT ORDER</text><circle cx="555" cy="229" r="12" fill="#ff7d9b"/><text class="mf-agent-number" x="555" y="233">3</text><text class="mf-order-arrow" x="574" y="234">→</text><circle cx="609" cy="229" r="12" fill="#74aaff"/><text class="mf-agent-number" x="609" y="233">1</text><text class="mf-order-arrow" x="628" y="234">→</text><circle cx="663" cy="229" r="12" fill="#ffae69"/><text class="mf-agent-number" x="663" y="233">2</text></g>
      <path class="mf-edge mf-classical-edge" d="M691 226H732" marker-end="url(#mf-arrow)"/>
      <g class="mf-planner-node mf-stage"><rect x="742" y="190" width="259" height="73" rx="10"/><text class="mf-small-label" x="760" y="211">CLASSICAL PLANNER</text><text class="mf-node-title" x="760" y="235">Build and reserve routes</text><text class="mf-node-copy" x="760" y="252">One robot at a time, in that order</text></g>
      <path class="mf-edge mf-classical-edge" d="M1001 226H1030V183H1068" marker-end="url(#mf-arrow)"/>
    </g>
    <g class="mf-checker-node mf-stage"><rect x="1078" y="105" width="210" height="114" rx="12"/><text class="mf-small-label" x="1097" y="127">INDEPENDENT CHECKER</text><text class="mf-node-title" x="1097" y="151">Check the routes</text><text class="mf-node-copy" x="1097" y="173">Legal moves · reach goals</text><text class="mf-node-copy" x="1097" y="192">No shared squares or swaps</text><path class="mf-check" d="M1250 143l7 7 13-16"/></g>
    <text class="mf-verdict" x="1182" y="245" text-anchor="middle">VALID SOLUTION OR FAILURE</text>
  </svg>`;
  view.classList.add('mf-ready');
  view.innerHTML = `<div class="mf-shell">
    <div class="mf-tabs" role="tablist" aria-label="Five language-model methods">${keys.map((key,i)=>`<button class="mf-method-tab" type="button" role="tab" id="mf-tab-${key}" data-mf-method="${key}" aria-controls="mf-workflow"><span>${String(i+1).padStart(2,'0')}</span><strong>${methods[key].name}</strong></button>`).join('')}</div>
    <div class="mf-role-key" aria-label="Workflow colors"><span><i class="mf-key-llm"></i> Language model proposes</span><span><i class="mf-key-planner"></i> Classical planner constructs</span><span><i class="mf-key-checker"></i> Independent checker verifies</span><em>ILLUSTRATIVE WORKFLOW</em></div>
    <div class="mf-workflow" id="mf-workflow" role="tabpanel" tabindex="0">${desktop}<div id="mf-mobile-workflow"></div></div>
    <div class="mf-exchange"><div><span class="mf-example-label">ILLUSTRATIVE REQUEST TO THE LLM</span><p id="mf-request"></p></div><div><span class="mf-example-label">WHAT THE LLM RETURNS</span><p id="mf-response"></p></div></div>
    <p class="mf-distinction" id="mf-distinction"></p>
    <details class="mf-recorded"><summary>Inspect an actual saved Conflict ordering exchange <span>DeepSeek V4 Flash ↗</span></summary><div class="mf-recorded-body"><p>This saved record is separate from the illustrative workflow above. The model returned an order; a classical planner produced the routes.</p><div class="mf-recorded-exchange"><div><h3>Saved instruction field</h3><pre id="mf-saved-instruction"></pre></div><div><h3>Complete saved response</h3><pre id="mf-saved-response"></pre></div></div><details><summary>Show the complete saved request</summary><pre id="mf-saved-request"></pre></details></div></details>
  </div>`;

  function mobileDiagram(method, cfg) {
    const ordering = cfg.lane === 'orders';
    const checkY = ordering ? 375 : 279;
    const end = checkY + 101;
    const stage = (y, cls, role, title, subtitle='') => `<g class="${cls}"><rect x="45" y="${y}" width="288" height="68" rx="10"/><text class="mf-small-label" x="62" y="${y+20}">${escape(role)}</text><text class="mf-node-title" x="62" y="${y+43}">${escape(title)}</text>${subtitle?`<text class="mf-node-copy" x="62" y="${y+59}">${escape(subtitle)}</text>`:''}</g>`;
    const edge = (y1,y2,cls='')=>`<path class="mf-edge ${cls}" d="M189 ${y1}V${y2}" marker-end="url(#mf-arrow)"/>`;
    return `<svg viewBox="0 0 378 ${end}" class="mf-mobile-diagram" role="img" aria-label="${escape(cfg.name+' workflow. '+cfg.distinction)}">
      ${stage(8,'mf-input-node','WHAT THE LLM SEES',cfg.inputTitle,cfg.inputLines[0])}${edge(76,99)}
      ${stage(109,'mf-llm-node','LANGUAGE MODEL',cfg.mobileAction)}${edge(177,203)}
      <text class="mf-mobile-artifact" x="189" y="225" text-anchor="middle">${ordering?'Robot order: 3 → 1 → 2':'Timed positions for every robot'}</text>
      ${ordering?`${edge(238,270,'mf-classical-edge')}${stage(279,'mf-planner-node','CLASSICAL PLANNER','Build and reserve routes')}${edge(347,365,'mf-classical-edge')}`:edge(238,269)}
      ${stage(checkY,'mf-checker-node','INDEPENDENT CHECKER','Legal, collision-free routes?', 'Legal moves · goals · no collisions')}
      <text class="mf-verdict" x="189" y="${end-10}" text-anchor="middle">VALID SOLUTION OR FAILURE</text>
      ${method==='repair'?`<path class="mf-edge mf-error-edge" d="M45 ${checkY+34}H18V143H43" marker-end="url(#mf-arrow)"/><text class="mf-mobile-loop-label" transform="translate(12,230) rotate(-90)" text-anchor="middle">ERROR + PREVIOUS ANSWER</text>`:''}
      ${method==='fresh'?'<path class="mf-edge mf-fresh-edge" d="M333 42H358V143H335" marker-end="url(#mf-arrow)"/><text class="mf-mobile-loop-label" transform="translate(371,93) rotate(90)" text-anchor="middle">SAME PROMPT AGAIN</text>':''}
    </svg>`;
  }

  function show(method='direct') {
    if (!Object.prototype.hasOwnProperty.call(methods,method)) method = 'direct';
    current = method;
    const cfg = methods[method];
    view.dataset.method = method;
    view.dataset.lane = cfg.lane;
    view.querySelectorAll('.mf-method-tab').forEach(tab => {
      const selected = tab.dataset.mfMethod === method;
      tab.classList.toggle('selected',selected);
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    view.querySelector('#mf-workflow').setAttribute('aria-labelledby','mf-tab-'+method);
    const texts = {
      '#mf-diagram-title':cfg.name+' workflow', '#mf-diagram-desc':cfg.distinction,
      '#mf-input-title':cfg.inputTitle, '#mf-input-line1':cfg.inputLines[0], '#mf-input-line2':cfg.inputLines[1],
      '#mf-route-action':cfg.lane==='routes'?cfg.mobileAction:'Write timed routes',
      '#mf-request':cfg.request, '#mf-response':cfg.response, '#mf-distinction':cfg.distinction
    };
    for (const [selector,text] of Object.entries(texts)) view.querySelector(selector).textContent=text;
    view.querySelector('#mf-mobile-workflow').innerHTML=mobileDiagram(method,cfg);
    const active = view.querySelector('.mf-method-tab.selected');
    if (view.getBoundingClientRect().width < 680) active?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    return cfg;
  }
  view.querySelector('.mf-tabs').addEventListener('click',event=>{
    const tab=event.target.closest('[data-mf-method]');
    if(tab)show(tab.dataset.mfMethod);
  });
  view.querySelector('.mf-tabs').addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-mf-method]');
    if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    let index=keys.indexOf(tab.dataset.mfMethod);
    if(event.key==='Home')index=0;else if(event.key==='End')index=keys.length-1;else index=(index+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
    show(keys[index]);view.querySelector('#mf-tab-'+keys[index]).focus();
  });
  const recorded=window.MAPF_EVIDENCE?.recorded;
  if(recorded){
    view.querySelector('#mf-saved-instruction').textContent=recorded.instruction||'';
    view.querySelector('#mf-saved-response').textContent=recorded.response||'';
    view.querySelector('#mf-saved-request').textContent=(recorded.messages||[]).map(message=>message.role.toUpperCase()+'\n'+message.content).join('\n\n');
  }else view.querySelector('.mf-recorded').hidden=true;
  window.MAPFMethods={show,get current(){return current;},methods:keys.map(key=>({id:key,name:methods[key].name}))};
  show('direct');
})();
