import {env} from 'cloudflare:workers';

export async function getCampusAiToken(request:Request):Promise<string|Response>{
 const e=env as any;
 if(!e.SUPABASE_PORTAL_URL||!e.SUPABASE_GATEWAY_TOKEN||!e.CAMPUS360_AI_URL)return Response.json({error:'CAMPUS360 AI is not configured on this Worker.'},{status:503});
 const cookie=(request.headers.get('cookie')||'').split(';').map(p=>p.trim()).find(p=>p.startsWith('__Host-campus360_session='))?.replace(/^__Host-campus360_session=/,'campus_session=');
 if(!cookie)return Response.json({error:'Please log in to use CAMPUS360 AI.'},{status:401});
 const response=await fetch(e.SUPABASE_PORTAL_URL,{method:'POST',headers:{'Content-Type':'application/json','x-campus-gateway':e.SUPABASE_GATEWAY_TOKEN,cookie},body:JSON.stringify({action:'ai-token'}),redirect:'manual'});
 if(!response.ok)return Response.json({error:response.status===401?'Please log in again.':'CAMPUS360 authentication is temporarily unavailable.'},{status:response.status===401?401:503});
 const payload=await response.json() as {access_token?:string};
 if(!payload.access_token)return Response.json({error:'Could not establish an AI session.'},{status:502});
 return payload.access_token;
}
export function validateSameOrigin(request:Request):Response|null{
 const origin=request.headers.get('origin');
 return origin&&origin!==new URL(request.url).origin?Response.json({error:'Invalid request origin.'},{status:403}):null;
}
export async function proxyToCampusAi(request:Request,path:string,body:ArrayBuffer,contentType:string):Promise<Response>{
 const e=env as any,token=await getCampusAiToken(request);
 if(token instanceof Response)return token;
 try{
  const upstream=await fetch(`${String(e.CAMPUS360_AI_URL).replace(/\/$/,'')}${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':contentType},body,redirect:'manual'});
  if(upstream.status>=300&&upstream.status<400)return Response.json({error:'Unexpected AI service redirect.'},{status:502});
  return new Response(upstream.body,{status:upstream.status,headers:{'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'The CAMPUS360 AI service is temporarily unavailable.'},{status:502});}
}
