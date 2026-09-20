import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const cases=[
  {file:'src/constraints.js',from:'constraints.free=true',to:'constraints.free=false',test:'test/constraints.test.mjs',name:'free constraint is not applied'},
  {file:'src/history.js',from:'slice(-20)',to:'slice(-21)',test:'test/history.test.mjs',name:'history exceeds 20 records'},
  {file:'src/remote.js',from:'origin:originHeader',to:"origin:'http://127.0.0.1:1'",test:'test/mock-remote.test.mjs',name:'forwarded Origin is replaced'},
];
let killed=0;
for(const item of cases){const original=await readFile(item.file,'utf8');if(!original.includes(item.from))throw new Error(`MUTATION_ANCHOR_MISSING ${item.file}`);try{await writeFile(item.file,original.replace(item.from,item.to));const result=spawnSync(process.execPath,['--test','--test-reporter=tap',item.test],{encoding:'utf8'}),output=`${result.stdout??''}${result.stderr??''}`;if(result.status===0||!output.includes('ERR_ASSERTION'))throw new Error(`MUTATION_SURVIVED ${item.name}\n${output}`);killed++;console.log(`ERR_ASSERTION MUTATION_KILLED ${killed}/${cases.length}: ${item.name}`);}finally{await writeFile(item.file,original);}}
console.log(`MUTATION PASS ${killed}/${cases.length}`);
