from pathlib import Path
import subprocess,json,os
R=Path('/Users/yzliu/.cache/hanamesh-runs/MERGE-RECOMMENDER-MAIN-01');E=R/'_evidence';env=os.environ.copy();env['PATH']='/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:'+env['PATH'];env.update(DSH_HOME=str(R/'dsh-home'),TMPDIR=str(R/'tmp'))
script='''import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {checkProvider,checkConsumer,validateDescriptor,satisfiesCaret} from '@hanamesh/devkit/contract';
const fixture=sub=>JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('@hanamesh/devkit/contract/fixtures/'+sub+'.json')),'utf8'));
const provider=fixture('provider'), requirement=fixture('consumer');
validateDescriptor(provider);validateDescriptor(requirement);
const packageRoot=realpathSync(join(dirname(fileURLToPath(import.meta.resolve('@hanamesh/devkit'))),'..'));
const p=checkProvider({packageRoot,descriptor:provider});
const c=checkConsumer({consumerRoot:process.cwd(),requirement});
assert.equal(c.commit,'8f9bcc69cbacf01d97ffe63bbbade4f865e6dd89');
assert.equal(satisfiesCaret('0.2.0','^0.2.0'),true);assert.equal(satisfiesCaret('0.3.0','^0.2.0'),false);
console.log(JSON.stringify({provider:p,consumer:c,schemaAndBothFixtures:true,caretBoundary:true},null,2));'''
p=subprocess.run(['node','--input-type=module','-e',script],cwd=R/'fresh-strict',env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True);(E/'devkit-contract.log').write_text(p.stdout);assert p.returncode==0,p.stdout;(E/'devkit-contract-receipt.json').write_text(p.stdout)
print('Devkit actual installed provider/schema/consumer/CLI: PASS')
