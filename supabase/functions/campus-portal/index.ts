import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
const enc=new TextEncoder();
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const uid=()=>crypto.randomUUID();
const output=(d:unknown,status=200,cookie?:string)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
const publicUser=(u:any)=>({name:u.name,login:u.login,role:u.role});
const normalized=(s:unknown)=>String(s||'').trim().toUpperCase();
const now=()=>new Date().toISOString();
export async function handler(req:Request){
 if(req.method!=='POST')return output({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')!;
 const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
 const key=keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const check=async(query:any)=>{const {data,error}=await query;if(error)throw new Error(error.message);return data;};
 const findProfile=(l:string|null=null,id:string|null=null)=>check(db.rpc('c360_get_profile',{l,uid:id}));
 try{
  const gateway=req.headers.get('x-campus-gateway');if(!gateway)return output({error:'Forbidden'},403);
  const config=await check(db.from('c360_gateway').select('token_hash,cloudflare_token_hash').eq('id',1).single());
  const gatewayHash=await digest(gateway);
  if(gatewayHash!==config.token_hash&&gatewayHash!==config.cloudflare_token_hash)return output({error:'Forbidden'},403);
  const form=(req.headers.get('content-type')||'').includes('multipart/form-data')?await req.formData():null;
  const b:any=form?{action:'upload',id:form.get('id')}:await req.json();
  const token=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('campus_session='))?.slice(15);
  let u:any=null;
  if(token){const s=await check(db.from('c360_sessions').select('user_id,credential_version').eq('token',await digest(token)).gt('expires',Date.now()).maybeSingle());if(s){u=await findProfile(null,s.user_id);if(u&&(!u.active||u.credentials_locked||u.credential_version!==s.credential_version))u=null;}}
  const roleCount=await db.from('c360_users').select('id',{count:'exact',head:true}).eq('role','admin');if(roleCount.error)throw roleCount.error;
  const owner=req.headers.get('x-campus-owner')==='yes';
  if(b.action==='me')return output({user:u?publicUser(u):null,setup:!roleCount.count&&owner});
  const login=normalized(b.login);
  if(login.length>150)return output({error:'Login ID is too long.'},400);
  async function throttle(bucket:string){if(!await check(db.rpc('c360_auth_limit',{b:bucket})))throw new Error('Too many attempts. Try again in 15 minutes.');}
  function validatePassword(){if(typeof b.password!=='string'||b.password.length<12||b.password.length>128)throw new Error('Use a password between 12 and 128 characters.');if(b.password!==b.confirmPassword)throw new Error('Passwords do not match.');}
  async function verifyPassword(profile:any,password:string){
   const publicKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
   const auth=createClient(url,publicKeys.default||Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await auth.auth.signInWithPassword({email:(await digest(profile.login))+'@accounts.campus360.invalid',password});
   if(error||data.user?.id!==profile.auth_id)throw new Error('Check your current password.');
   // These temporary provider tokens never reach the client.
   await auth.auth.signOut();
  }
  async function finishPasswordChange(claim:any){
   if(!claim)throw new Error('Recovery code is invalid, expired or already used.');
   const {error}=await db.auth.admin.updateUserById(claim.auth_id,{password:b.password});
   // Keep the incremented credential version even on failure, invalidating old portal sessions.
   const unlocked=await db.from('c360_users').update({credentials_locked:false}).eq('id',claim.id).eq('credential_version',claim.version).select('id');
   if(unlocked.error||!unlocked.data?.length)throw new Error('Account recovery needs administrator assistance.');
   if(error)throw new Error('Password could not be changed. Ask your administrator for a new recovery code.');
   await check(db.from('c360_audits').insert({actor:claim.id,action:'password-changed',target:claim.id}));
   return output({ok:true},200,'campus_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  }
  async function createAccount(login:string,name:string,role:string,password:string,id?:string){
   const email=(await digest(login))+'@accounts.campus360.invalid';
   const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{portal_role:role}});
   if(error)throw new Error(error.message);
   const profile={id:id||data.user.id,login,name,role,active:1,auth_id:data.user.id};
   const res=await db.from('c360_users').upsert(profile,{onConflict:'id'});
   if(res.error){await db.auth.admin.deleteUser(data.user.id);throw new Error(res.error.message)}
   return profile;
  }
  if(b.action==='bootstrap'){
   if(roleCount.count||!owner)return output({error:'Administrator setup is unavailable.'},403);
   validatePassword();
   await createAccount(normalized(b.login),String(b.name).slice(0,100),'admin',b.password,'initial-admin');return output({ok:true});
  }
  if(b.action==='provision-student'){
   if(req.headers.get('x-campus-provision')!=='yes')return output({error:'Forbidden'},403);
   if(!b.login||!b.name||String(b.password||'').length<8)throw new Error('Provide valid student credentials.');
   const login=normalized(b.login);const existing=await findProfile(login);
   if(existing?.auth_id)throw new Error('This account already exists.');
   await createAccount(login,String(b.name).slice(0,100),'student',b.password,existing?.id);
   await check(db.from('c360_roster').upsert({login,name:String(b.name).slice(0,100),role:'student',code:'owner-provisioned',used:1}));
   await check(db.from('c360_audits').insert({actor:'site-owner',action:'student-provisioned',target:login}));return output({ok:true,login});
  }
  if(b.action==='activate'){
   validatePassword();await throttle('activate:'+login);
   const roster=await check(db.rpc('c360_claim_activation',{l:login,h:await digest(String(b.code||'').trim()),r:String(b.role||'')}));
   const profile=await createAccount(login,roster.name,roster.role,b.password);
   await check(db.from('c360_audits').insert({actor:profile.id,action:'account-activated',target:login}));
   return output({ok:true});
  }
  if(b.action==='reset-password'){
   validatePassword();await throttle('reset:'+login);
   const claim=await check(db.rpc('c360_begin_recovery',{l:login,h:await digest(String(b.code||'').trim())}));
   return await finishPasswordChange(claim);
  }
  if(b.action==='login'){
   const login=normalized(b.login);await throttle('login:'+login);
   const profile=await findProfile(login);
   const publicKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
   const auth=createClient(url,publicKeys.default||Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await auth.auth.signInWithPassword({email:(await digest(login))+'@accounts.campus360.invalid',password:String(b.password||'')});
   if(error||!profile||!profile.active||profile.credentials_locked||profile.role!==b.role||profile.auth_id!==data.user?.id){await check(db.from('c360_audits').insert({actor:'anonymous',action:'login-failed',target:login}));return output({error:'Check your credentials and selected role.'},401);}
   // Auth verifies the password; an opaque portal session stays in an HTTP-only cookie.
   await auth.auth.signOut();
   const t=uid()+uid();if(!await check(db.rpc('c360_login_session',{uid:profile.id,v:profile.credential_version,t:await digest(t)})))return output({error:'Your account changed during sign-in. Please sign in again.'},401);
   return output({user:publicUser(profile)},200,`campus_session=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);
  }
  if(!u)return output({error:'Please log in.'},401);
  if(b.action==='logout'){if(token)await check(db.from('c360_sessions').delete().eq('token',await digest(token)));return output({ok:true},200,'campus_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');}
  if(b.action==='change-password'){
   validatePassword();await throttle('change:'+u.id);await verifyPassword(u,String(b.currentPassword||''));
   const claim=await check(db.rpc('c360_begin_password_change',{uid:u.id,v:u.credential_version}));
   return await finishPasswordChange(claim);
  }
  if(b.action==='accounts'){
   if(u.role!=='admin')return output({error:'Forbidden'},403);
   const accounts=await check(db.rpc('c360_account_directory'));
   return output({accounts});
  }
  if(b.action==='issue-recovery'||b.action==='reissue-activation'){
   if(u.role!=='admin')return output({error:'Forbidden'},403);
   if(String(b.reason||'').trim().length<10)throw new Error('Describe the identity verification in at least 10 characters.');
   await throttle('issue-code:'+u.id);await verifyPassword(u,String(b.currentPassword||''));
   const code=uid().replaceAll('-',''),hash=await digest(code),expires=new Date(Date.now()+(b.action==='issue-recovery'?1800000:604800000)).toISOString();
   if(b.action==='issue-recovery'){
    const target=await findProfile(login);
    if(!target?.active||!target.auth_id||target.role==='admin')throw new Error('Choose an active student or staff account. Admin recovery requires the project owner.');
    await check(db.from('c360_recovery').upsert({user_id:target.id,code_hash:hash,expires_at:expires}));
   }else{
    const existing=await findProfile(login);
    if(existing?.auth_id)throw new Error('This account already exists. Use password recovery.');
    const changed=await check(db.rpc('c360_reissue_activation',{l:login,h:hash,e:expires}));
    if(!changed)throw new Error('Import this account into the roster first.');
   }
   await check(db.from('c360_audits').insert({actor:u.id,action:b.action+': '+String(b.reason).trim().slice(0,200),target:login}));
   return output({code,login,expires});
  }
  if(b.action==='roster'){
   if(u.role!=='admin')return output({error:'Forbidden'},403);
   if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>100)throw new Error('Import between 1 and 100 records.');
   const records=[];const codes=[];
   for(const r of b.rows){if(!String(r.login||'').trim()||String(r.login).length>150||!String(r.name||'').trim()||!['student','staff'].includes(r.role))throw new Error('Each record needs login, name and student/staff role.');const login=normalized(r.login),code=uid().replaceAll('-','');records.push({login,name:String(r.name).trim().slice(0,100),role:r.role,code:await digest(code),expires_at:new Date(Date.now()+604800000).toISOString()});codes.push({login,code})}
   const inserted=await check(db.rpc('c360_import_roster',{rows:records}));
   return output({codes:codes.filter(c=>inserted.includes(c.login)),note:'Codes apply only to newly imported accounts. Deliver them privately.'});
  }
  async function operation(p:any){return await check(db.rpc('c360_operation',{p,actor:u.id}));}
  if(b.action==='upload'){
   await operation({action:'upload-permission',id:b.id});
   const file=form?.get('file') as File;if(!file||!['image/jpeg','image/png','application/pdf'].includes(file.type)||file.size<1||file.size>5242880)throw new Error('Upload JPG, PNG or PDF, up to 5 MB.');
   const bytes=await file.arrayBuffer(),a=new Uint8Array(bytes);
   if(!(file.type==='image/jpeg'&&a[0]===255&&a[1]===216||file.type==='image/png'&&a[0]===137&&a[1]===80||file.type==='application/pdf'&&a[0]===37&&a[1]===80))throw new Error('File contents do not match its type.');
   const id=uid(),key=b.id+'/'+id;
   await check(db.storage.from('campus360-evidence').upload(key,bytes,{contentType:file.type,upsert:false}));
   const saved=await db.from('c360_attachments').insert({id,complaint_id:b.id,key,type:file.type,size:file.size});
   if(saved.error){await db.storage.from('campus360-evidence').remove([key]);throw new Error('Could not save attachment.');}
   return output({ok:true});
  }
  if(b.action==='download'){
   const a=await operation({action:'download-permission',id:b.id,attachment:b.attachment});
   const data=await check(db.storage.from('campus360-evidence').download(a.key));
   return new Response(data,{headers:{'Content-Type':a.type,'Content-Disposition':`attachment; filename="evidence-${a.id}.${a.type==='application/pdf'?'pdf':a.type==='image/png'?'png':'jpg'}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  return output(await operation(b));
 }catch(e:any){
  const message=e.message||'';
  const safe=/Forbidden|Please log in|Issue not found|Reporter identity|purpose|status change|Staff access|Only students|Complete title|Include an explanation|already exists|already been used|activation|characters|Upload JPG|File contents|Each record|Import between|Attachment not found|Passwords do not match|Too many attempts|current password|Recovery code|Password could not|Account recovery|identity verification|Choose an active|Import this account/.test(message)?message:'The request could not be completed. Please check your details and try again.';
  return output({error:safe},message.includes('Too many attempts')?429:/Forbidden|restricted|read-only/.test(message)?403:400);
 }
}
Deno.serve(handler);
