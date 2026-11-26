/* One ten-minute presentation, with automatic and manual navigation. */
(() => {
 'use strict';
 const $=s=>document.querySelector(s),L=window.MAPFLab,scenes=window.MAPFDemoScenes;
 let total=0;for(const s of scenes){s.start=total;total+=s.seconds;}
 const cues=scenes.flatMap((s,i)=>s.phases.map((p,j)=>({scene:i,phase:j,time:s.start+p[0]})));
 let active=false,paused=false,manual=false,elapsed=0,base=0,index=-1,phase=-1,generation=0,loop=0,finishedAt=0,seekJob=0,returnChapter=0;
 const format=n=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 async function ready(){if($('#lab').hidden)return;for(let i=0;i<190&&$('#compute-state').textContent==='COMPUTING…';i++)await wait(50);}
 function cueIndex(){let i=0;for(let j=0;j<cues.length;j++){if(cues[j].time>elapsed+.05)break;i=j;}return i;}
 function playVisual(){
  if(!active)return;if(paused){L.pauseVisuals();return;}
  if($('#compute-state').textContent==='COMPUTING…')return;
  if($('#modal').open){L.resumeVisuals();return;}
  if($('#lab').hidden){L.resumeVisuals();return;}
  if(!L.state.playing)L.play();
 }
 async function settleVisual(rev){await ready();if(!active||rev!==generation)return;playVisual();}
 function renderHeading(){const s=scenes[index];if(s.title)$('#chapter-title').textContent=s.title;if(s.description)$('#chapter-description').textContent=s.description;}
 async function enter(next,at){
  const rev=++generation;index=next;phase=-1;finishedAt=0;$('#demo-curtain').classList.add('closed');L.pauseVisuals();
  await wait(260);if(!active||rev!==generation)return;
  L.closeModal();L.gotoChapter(scenes[index].chapter);scenes[index].setup?.();renderHeading();
  $('#demo-bullets').replaceChildren(...scenes[index].bullets.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  await ready();if(!active||rev!==generation)return;
  applyPhases(at);await ready();if(!active||rev!==generation)return;
  $('#speed').value='1';L.state.speed=1;$('#demo-curtain').classList.remove('closed');refresh();playVisual();
 }
 function applyPhases(local){
  const s=scenes[index];for(let i=phase+1;i<s.phases.length;i++){
   const [time,text,action]=s.phases[i];if(time>local+.01)break;phase=i;$('#demo-caption-text').textContent=text;
   if(action){action();if(paused)L.pauseVisuals();settleVisual(generation);}
  }
  renderHeading();refresh();
 }
 function refresh(){
  $('#demo-clock').textContent=manual?format(elapsed)+' / '+format(total):format(Math.max(0,total-elapsed));
  $('#demo-clock').title=manual?'Position in the ten-minute presentation':'Automatic playback time remaining';
  $('#demo-progress').style.width=Math.min(100,100*elapsed/total)+'%';$('#demo-seek').value=String(Math.floor(elapsed));
  $('#demo-mode').textContent=manual?'Manual mode':'Auto mode';$('#demo-mode').setAttribute('aria-pressed',String(manual));
  $('#demo-pause').textContent=paused?'Resume':'Pause';$('#demo-pause').setAttribute('aria-pressed',String(paused));
  $('#demo-prev').disabled=cueIndex()===0;$('#demo-next').textContent=cueIndex()===cues.length-1?'Finish →':'Next →';
  if(index>=0)$('#demo-scene-label').textContent=String(index+1).padStart(2,'0')+' / '+scenes.length+' · '+scenes[index].name+' · '+(Math.max(0,phase)+1)+'/'+scenes[index].phases.length;
 }
 function tick(now){
  if(!active)return;
  if(!paused){
   if(!manual){elapsed=Math.min(total,(now-base)/1000);if(elapsed>=total){finish();return;}}
   const next=scenes.findIndex(s=>elapsed<s.start+s.seconds);
   if(next!==index)enter(next,elapsed-scenes[next].start);
   else if(!$('#demo-curtain').classList.contains('closed')){
    applyPhases(elapsed-scenes[index].start);
    if(!$('#lab').hidden&&!$('#modal').open&&$('#compute-state').textContent!=='COMPUTING…'&&!L.state.playing){
     if(L.state.time>=L.state.maxTime){if(!finishedAt)finishedAt=now;if(now-finishedAt>2300){finishedAt=0;L.play();}}
     else playVisual();
    }
   }
  }
  refresh();loop=requestAnimationFrame(tick);
 }
 function start(mode='auto'){
  clearTimeout(seekJob);const replay=!$('#demo-finish').hidden;if(active)exit();if(!replay)returnChapter=L.state.chapter;
  active=true;paused=false;manual=mode==='manual';elapsed=0;index=-1;phase=-1;base=performance.now();
  document.body.classList.add('demo-mode');$('#demo-hud').hidden=false;$('#demo-caption').hidden=false;$('#demo-finish').hidden=true;$('#demo-seek').max=String(total-1);refresh();loop=requestAnimationFrame(tick);
 }
 function togglePause(){if(!active)return;paused=!paused;if(paused)L.pauseVisuals();else{base=performance.now()-elapsed*1000;playVisual();}refresh();}
 function setMode(value){if(!active)return;manual=value;clearTimeout(seekJob);base=performance.now()-elapsed*1000;refresh();}
 function seek(seconds){if(!active)return;elapsed=Math.max(0,Math.min(total-.01,seconds));base=performance.now()-elapsed*1000;refresh();const next=scenes.findIndex(s=>elapsed<s.start+s.seconds);enter(next,elapsed-scenes[next].start);}
 function move(direction){
  if(!active)return;clearTimeout(seekJob);manual=true;paused=false;
  const next=cueIndex()+direction;if(next>=cues.length){finish();return;}if(next<0)return;
  const cue=cues[next];elapsed=cue.time;base=performance.now()-elapsed*1000;
  // Forward within a section preserves the current map and applies its next cue.
  if(cue.scene===index&&direction>0&&!$('#demo-curtain').classList.contains('closed')){applyPhases(elapsed-scenes[index].start);playVisual();}
  else enter(cue.scene,elapsed-scenes[cue.scene].start);
  refresh();
 }
 function finish(){
  clearTimeout(seekJob);active=false;generation++;cancelAnimationFrame(loop);L.pauseVisuals();L.closeModal();$('#demo-curtain').classList.remove('closed');$('#demo-hud').hidden=true;$('#demo-caption').hidden=true;$('#demo-finish').hidden=false;$('#demo-return').focus();
 }
 function exit(){
  clearTimeout(seekJob);active=false;generation++;cancelAnimationFrame(loop);L.pauseVisuals();L.closeModal();document.body.classList.remove('demo-mode');$('#demo-hud').hidden=true;$('#demo-caption').hidden=true;$('#demo-finish').hidden=true;$('#demo-curtain').classList.remove('closed');L.gotoChapter(returnChapter);
 }
 $('#start-demo').onclick=()=>start();$('#nav-demo').onclick=()=>start();$('#begin').onclick=()=>start('manual');$('#demo-replay').onclick=()=>start(manual?'manual':'auto');
 $('#demo-return').onclick=exit;$('#demo-exit').onclick=exit;$('#demo-pause').onclick=togglePause;$('#demo-mode').onclick=()=>setMode(!manual);$('#demo-next').onclick=()=>move(1);$('#demo-prev').onclick=()=>move(-1);
 $('#demo-seek').oninput=e=>{clearTimeout(seekJob);seekJob=setTimeout(()=>seek(Number(e.target.value)),100);};
 document.addEventListener('keydown',e=>{
  if(!active||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  if(['Space','Escape','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Space')togglePause();if(e.code==='Escape')exit();if(e.code==='ArrowRight')move(1);if(e.code==='ArrowLeft')move(-1);}
 },true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!paused)togglePause();});
 window.MAPFDemo={start,exit,pause:togglePause,seek,next:()=>move(1),previous:()=>move(-1),setMode,duration:total,cues,scenes:scenes.map(s=>({name:s.name,start:s.start,seconds:s.seconds,bullets:s.bullets})),getState:()=>({active,paused,manual,elapsed,index,phase})};
 if(new URLSearchParams(location.search).get('lesson')==='bfs-dijkstra'){start('manual');seek(scenes[4].start);}
})();
