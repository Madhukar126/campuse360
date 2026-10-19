import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';

// Exercise the real handler with the provider boundary mocked; no production credentials.
const source=(await readFile(new URL('../supabase/functions/campus-portal/index.ts',import.meta.url),'utf8'))
 .replace(/^import .*\n/,'').replace('export async function handler','async function handler').replace('Deno.serve(handler);','return handler;');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
let profile,session,calls;
const base={id:'student-id',name:'Synthetic Student',login:'SYNTHETIC001',role:'student',active:1,auth_id:'auth-id',credential_version:4,credentials_locked:false};
const digest=async(value)=>Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
const gatewayHash=await digest('test-gateway');
let cloudflareHash=await digest('test-cloudflare-gateway');
const db={from(table){
 const query={select(){return query},eq(){return query},gt(){return query},insert(){return query},
 single:async()=>({data:{token_hash:gatewayHash,cloudflare_token_hash:cloudflareHash}}),maybeSingle:async()=>({data:session}),
 then(resolve,reject){return Promise.resolve({data:null,count:1}).then(resolve,reject)}};
 return query;
},rpc:async(name,args)=>{
 calls.push({name,args});
 const values={c360_get_profile:profile,c360_auth_limit:true,c360_login_session:true,c360_account_directory:[{login:base.login,name:base.name,role:'student',active:1}],c360_import_roster:['SYNTHETIC001']};
 if(!(name in values))throw new Error('Unexpected RPC '+name);
 return {data:values[name],error:null};
},auth:{signInWithPassword:async()=>({data:{user:{id:'auth-id'}}}),signOut:async()=>({error:null})}};
const env={SUPABASE_URL:'https://test.invalid',SUPABASE_SECRET_KEYS:'{"default":"test-secret"}',SUPABASE_PUBLISHABLE_KEYS:'{"default":"test-public"}'};
const handler=new Function('createClient','Deno','crypto',compiled)(()=>db,{env:{get:k=>env[k]}},webcrypto);
async function invoke(body,loggedIn=false,gateway='test-gateway'){
 calls=[];session=loggedIn?{user_id:base.id,credential_version:4}:null;
 const res=await handler(new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json','x-campus-gateway':gateway,...(loggedIn?{cookie:'campus_session=test-session'}:{})},body:JSON.stringify(body)}));
 return {res,data:await res.json()};
}
profile={...base};
assert.equal((await invoke({action:'me'},false,'test-cloudflare-gateway')).res.status,200);
assert.equal((await invoke({action:'me'},false,'wrong-gateway')).res.status,403);
cloudflareHash=null;
assert.equal((await invoke({action:'me'},false,'test-cloudflare-gateway')).res.status,403);
assert.equal((await invoke({action:'me'})).res.status,200);
cloudflareHash=await digest('test-cloudflare-gateway');
let result=await invoke({action:'login',login:base.login,password:'synthetic-password',role:'student'});
assert.equal(result.res.status,200);assert.deepEqual(result.data.user,{name:base.name,login:base.login,role:'student'});
assert.match(result.res.headers.get('set-cookie'),/HttpOnly/);
for(const patch of [{active:0},{credentials_locked:true},{role:'staff'}]){
 profile={...base,...patch};result=await invoke({action:'login',login:base.login,password:'synthetic-password',role:'student'});
 assert.equal(result.res.status,401);assert.equal(calls.some(c=>c.name==='c360_login_session'),false);
}
profile=null;assert.equal((await invoke({action:'login',login:base.login,password:'synthetic-password',role:'student'})).res.status,401);
profile={...base};result=await invoke({action:'me'},true);assert.equal(result.data.user.login,base.login);
for(const patch of [{active:0},{credentials_locked:true},{credential_version:5}]){
 profile={...base,...patch};assert.equal((await invoke({action:'me'},true)).data.user,null);
}
profile={...base,role:'staff'};assert.equal((await invoke({action:'accounts'},true)).res.status,403);
profile={...base,role:'admin'};result=await invoke({action:'accounts'},true);assert.equal(result.res.status,200);
assert.deepEqual(Object.keys(result.data.accounts[0]).sort(),['active','login','name','role']);
result=await invoke({action:'roster',rows:[{login:'synthetic001',name:'Synthetic Student',role:'student'}]},true);
assert.equal(result.res.status,200);assert.equal(result.data.codes.length,1);assert.equal(result.data.codes[0].login,base.login);
assert.equal(calls.find(c=>c.name==='c360_import_roster').args.rows[0].code.length,64);
console.log('Encryption-aware Edge boundary: login, role, locked/disabled account, session version, directory and roster checks passed.');
