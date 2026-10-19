import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const generated=JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8'));
await mkdir(path.join(root,'dist/cloudflare'),{recursive:true});
// This app uses Supabase, so Sites-only placeholder D1/R2 bindings are unnecessary.
const config={name:'campus360',account_id:'1f974812368cacbe5c40f3c111d1f3d9',main:'worker.mjs',compatibility_date:generated.compatibility_date,
 compatibility_flags:generated.compatibility_flags,workers_dev:true,preview_urls:false,
 assets:{directory:'../client',binding:'ASSETS'},
 vars:{SUPABASE_PORTAL_URL:'https://amtjrfkwbwsihhjzhorv.supabase.co/functions/v1/campus-portal'},
 observability:{enabled:true},keep_vars:true};
await writeFile(path.join(root,'dist/cloudflare/wrangler.json'),JSON.stringify(config,null,2)+'\n');
// A direct Cloudflare visitor must never be treated as a ChatGPT-attested owner.
await writeFile(path.join(root,'dist/cloudflare/worker.mjs'),`import app from '../server/index.js';
export default {fetch(request,env,ctx){
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.startsWith('oai-authenticated-user-')||name==='x-provision-token')headers.delete(name);
 const {OWNER_EMAIL,ACCOUNT_PROVISION_TOKEN,...safeEnv}=env;
 return app.fetch(new Request(request,{headers}),safeEnv,ctx);
}};
`);
console.log('Cloudflare export prepared: dist/cloudflare/wrangler.json');
console.log('Required Cloudflare secret before launch: SUPABASE_GATEWAY_TOKEN (configure securely; never commit it).');
