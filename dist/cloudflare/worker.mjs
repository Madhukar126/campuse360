import app from '../server/index.js';
export default {fetch(request,env,ctx){
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.startsWith('oai-authenticated-user-')||name==='x-provision-token')headers.delete(name);
 const {OWNER_EMAIL,ACCOUNT_PROVISION_TOKEN,...safeEnv}=env;
 return app.fetch(new Request(request,{headers}),safeEnv,ctx);
}};
