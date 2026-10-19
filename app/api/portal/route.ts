import {env} from 'cloudflare:workers';
import {portalSessionCookie} from '../../../lib/session-cookie';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const origin=req.headers.get('origin');
 if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'Invalid request origin'},{status:403});
 const e=env as any;
 if(!e.SUPABASE_PORTAL_URL||!e.SUPABASE_GATEWAY_TOKEN)return Response.json({error:'Supabase connection is not configured'},{status:503});
 const session=(req.headers.get('cookie')||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('__Host-campus360_session='))?.replace(/^__Host-campus360_session=/,'campus_session=')||'';
 const headers=new Headers({'Content-Type':req.headers.get('content-type')||'application/json','x-campus-gateway':e.SUPABASE_GATEWAY_TOKEN,'cookie':session});
 if(e.OWNER_EMAIL&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===e.OWNER_EMAIL.toLowerCase())headers.set('x-campus-owner','yes');
 if(e.ACCOUNT_PROVISION_TOKEN&&req.headers.get('x-provision-token')===e.ACCOUNT_PROVISION_TOKEN){headers.set('x-campus-provision','yes');headers.set('x-campus-owner','yes');}
 try{
  const body=await req.arrayBuffer();
  // No session cookie means no portal identity to restore. Keep privileged setup checks upstream.
  if(!session&&!headers.has('x-campus-owner')&&(req.headers.get('content-type')||'').includes('application/json')){
   try{if(JSON.parse(new TextDecoder().decode(body)).action==='me')return Response.json({user:null,setup:false,complaints:[]},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch{/* Let the account service validate malformed JSON. */}
  }
  const upstream=await fetch(e.SUPABASE_PORTAL_URL,{method:'POST',headers,body,redirect:'manual'});
  if(upstream.status>=300&&upstream.status<400)return Response.json({error:'Unexpected account service redirect'},{status:502});
  const out=new Headers({'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  const cookie=portalSessionCookie(upstream.headers.get('set-cookie'));
  if(cookie)out.append('Set-Cookie',cookie);
  const disposition=upstream.headers.get('content-disposition');if(disposition)out.set('content-disposition',disposition);
  return new Response(upstream.body,{status:upstream.status,headers:out});
 }catch(error:any){console.error('Supabase gateway request failed:',String(error?.message||'Unknown error').replaceAll(e.SUPABASE_GATEWAY_TOKEN,'[redacted]'));return Response.json({error:'The account service is temporarily unavailable. Please try again.'},{status:502});}
}
