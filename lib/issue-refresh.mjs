// One request at a time; hidden tabs stay idle and stopped sessions cannot update.
export function startIssueRefresh({refresh,onError,isVisible,subscribeWake,schedule=setTimeout,cancel=clearTimeout,interval=15000}){
 let stopped=false,inFlight=false,timer=null,controller=null;
 async function tick(){
  if(stopped||inFlight||!isVisible())return;
  if(timer!==null){cancel(timer);timer=null;}
  inFlight=true;controller=new AbortController();
  try{await refresh(controller.signal);}catch(error){if(!stopped&&!controller.signal.aborted)onError(error);}
  finally{inFlight=false;if(!stopped&&isVisible())timer=schedule(tick,interval);}
 }
 const unsubscribe=subscribeWake(tick);
 void tick();
 return ()=>{stopped=true;if(timer!==null)cancel(timer);controller?.abort();unsubscribe();};
}
