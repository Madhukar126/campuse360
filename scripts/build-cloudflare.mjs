import {spawnSync} from 'node:child_process';
for(const args of [['scripts/run-framework.mjs','build'],['scripts/prepare-workers-export.mjs']]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit'});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
console.log('Cloudflare output: dist/cloudflare/wrangler.json');
