import {readdir,rm,mkdir,cp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

if(process.version!=='v24.13.1')throw new Error(`TARGET_NODE_MISMATCH ${process.version}`);
for(const file of await readdir(new URL('../src/',import.meta.url))){if(!file.endsWith('.js'))continue;const checked=spawnSync(process.execPath,['--check',new URL(`../src/${file}`,import.meta.url).pathname],{stdio:'inherit'});if(checked.status!==0)process.exit(checked.status??1);}
await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});await mkdir(new URL('../dist/',import.meta.url),{recursive:true});await cp(new URL('../src/',import.meta.url),new URL('../dist/',import.meta.url),{recursive:true});
console.log(JSON.stringify({status:'PASS',node:process.version,pnpm:process.env.npm_config_user_agent?.split(' ')[0]??null,files:(await readdir(new URL('../dist/',import.meta.url))).sort()}));
