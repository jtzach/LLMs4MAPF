importScripts('engine.js');
self.onmessage=e=>{const {id,kind,scene,algorithm,options}=e.data;try{const result=kind==='search'?MAPFEngine.search(scene,scene.agents[0].start,scene.agents[0].goal,algorithm,options):MAPFEngine.solve(scene,algorithm,options);self.postMessage({id,result});}catch(err){self.postMessage({id,error:err.message});}};
