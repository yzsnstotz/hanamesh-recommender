import cases from './baseline-cases.mjs';
import {createRequire} from 'node:module';const require=createRequire(process.argv[4]+'/package.json');const {runMutations}=await import(require.resolve('@hanamesh/devkit'));
await runMutations({root:process.argv[2],cases:cases.map((v,i)=>({...v,id:'original-'+i})),evidenceDir:process.argv[3]});
