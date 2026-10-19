import {mkdir,writeFile,copyFile,access} from 'node:fs/promises';
await mkdir('.sites-runtime',{recursive:true});
await writeFile('.sites-runtime/execution-profile.json',JSON.stringify({executionProfile:'portable'},null,2)+'\n');
try{await access('.dev.vars');}catch{await copyFile('.dev.vars.example','.dev.vars');}
console.log('Portable profile selected. Configure the ignored .dev.vars file, then run pnpm dev.');
