from pathlib import Path
import subprocess, os, json, shutil, hashlib, tempfile, datetime
R=Path(__file__).resolve().parents[2]; E=Path(__file__).resolve().parent
ORIGIN=Path('/Users/yzliu/work/projects/hanamesh/hanamesh-recommender')
BASE='49e1b7509cf6736fd5b8484aec05557c56c99398'; NEW='a0b3fe854cfbccbb9e0cdb85dff946bb632cd169'
W=R/'verifier-environment'
# Only reset this verifier's own paths; previous evidence survives in git and history.
if W.exists():
 archive=E/'history'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');archive.mkdir(parents=True)
 for p in E.iterdir():
  if p.suffix in ('.log','.json','.tgz') or p.name in ('baseline-mutations','new-mutations','baseline-consumer','new-consumer'):shutil.copytree(p,archive/p.name) if p.is_dir() else shutil.copy2(p,archive/p.name)
 shutil.rmtree(W)
W.mkdir(); cache=Path(tempfile.mkdtemp(prefix='hm-recommender-verifier-npm-'))
(E/'npm-cache-path.json').write_text(json.dumps({'path':str(cache)}))
env=os.environ.copy();env.update(PATH='/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:'+env['PATH'],DSH_HOME=str(W/'dsh-home'),HANAMESH_RUN_DIR=str(W/'run'),npm_config_cache=str(cache))
(W/'dsh-home').mkdir();(W/'run').mkdir()
receipts=[]
def run(name,args,cwd=W,expected=0):
 p=subprocess.run(args,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 (E/(name+'.log')).write_text(p.stdout)
 receipts.append({'step':name,'argv':args,'cwd':str(cwd),'exit':p.returncode,'expected':expected})
 (E/'steps.json').write_text(json.dumps(receipts,indent=2)+'\n')
 print(name,'exit',p.returncode,flush=True)
 assert p.returncode==expected,(name,p.stdout[-2200:])
 return p.stdout
run('node-version',['node','--version']);run('pnpm-version',['pnpm','--version'])
for label,ref in [('baseline',BASE),('new',NEW)]:
 parent=W/label;parent.mkdir();repo=parent/'hanamesh-recommender'
 run(label+'-clone',['git','clone','--no-hardlinks',str(ORIGIN),str(repo)])
 run(label+'-checkout',['git','checkout','-b','codex/verify-'+label,ref],repo)
 run(label+'-remote',['git','remote','set-url','origin','https://github.com/yzsnstotz/hanamesh-recommender.git'],repo)
 if label=='baseline':
  output=run('baseline-original-install',['pnpm','install','--frozen-lockfile','--offline'],repo,1)
  assert 'ERR_PNPM_OUTDATED_LOCKFILE' in output
  lock=repo/'pnpm-lock.yaml';text=lock.read_text();assert text.count('specifier: 0.1.5-alpha.1')==5
  for package in ['@deepseek-ai/dsh-client-ui-settings','@deepseek-ai/dsh-client-ui-sidebar']:
   before=f"      '{package}':\n        specifier: 0.1.5-alpha.1"
   assert text.count(before)==1;text=text.replace(before,f"      '{package}':\n        specifier: '>=0.1.5-alpha.1 <0.2.0'")
  lock.write_text(text);run('baseline-lock-normalization',['git','diff','--','pnpm-lock.yaml'],repo)
 run(label+'-install',['pnpm','install','--frozen-lockfile','--offline'],repo)
 run(label+'-check',['pnpm','run','check'],repo)
 (repo/'artifacts').mkdir(exist_ok=True)
 run(label+'-npm-pack',['npm','pack','--json','--pack-destination','artifacts'],repo)
 version='3' if label=='baseline' else '4';tgz=repo/f'artifacts/hanamesh-recommender-0.1.0-rc.{version}.tgz'
 shutil.copy2(tgz,E/tgz.name)
 (Path(str(tgz)+'.sha256')).write_text(hashlib.sha256(tgz.read_bytes()).hexdigest()+'  '+tgz.name+'\n')
 if label=='new':
  shutil.copytree(W/'run/_evidence/mutations',E/'new-mutations',dirs_exist_ok=True)
  run('new-global-preflight',['bash','/Users/yzliu/work/Docs/Projects/hanamesh/tools/preflight.sh',str(repo),'--strict-env'],repo)
  run('new-source-status',['git','status','--porcelain=v1'],repo)
 else:
  # Original runner logs its assertion kills; independent raw TAP per original case is also collected.
  source=subprocess.check_output(['git','show',BASE+':scripts/mutations.mjs'],cwd=ORIGIN,text=True)
  (E/'baseline-cases.mjs').write_text(source[source.index('const cases='):source.index('let killed=')]+"export default cases;\n")
  (E/'baseline-mutant-driver.mjs').write_text("import cases from './baseline-cases.mjs';\nimport {createRequire} from 'node:module';const require=createRequire(process.argv[4]+'/package.json');const {runMutations}=await import(require.resolve('@hanamesh/devkit'));\nawait runMutations({root:process.argv[2],cases:cases.map((v,i)=>({...v,id:'original-'+i})),evidenceDir:process.argv[3]});\n")
  # Import only the reviewed vendor engine from our new installed checkout after it exists, below.
 compiler='/Users/yzliu/work/projects/hanamesh/hanamesh-core/node_modules/typescript/bin/tsc'
 run(label+'-compiler',['node',compiler,'--version'])
 run(label+'-consumer',['node',str(E/'consumer.mjs'),str(E/tgz.name),str(W/'consumer-run'),compiler])
 dest=E/(label+'-consumer');dest.mkdir(exist_ok=True)
 for file in ['package.json','pnpm-lock.yaml','probe.mjs','consumer.ts','negative.ts']:shutil.copy2(W/'consumer-run/consumer'/file,dest/file)
 if label=='new':
  variant=repo/'artifacts/variant';variant.mkdir();run('pnpm-pack-variant',['pnpm','pack','--pack-destination',str(variant)],repo)
  shutil.copy2(variant/tgz.name,E/'pnpm-variant.tgz');shutil.rmtree(variant)
  assert hashlib.sha256((E/'pnpm-variant.tgz').read_bytes()).hexdigest()!=hashlib.sha256(tgz.read_bytes()).hexdigest()
  run('new-npm-pack-restored',['npm','pack','--json','--pack-destination','artifacts'],repo)
  assert tgz.read_bytes()==(E/tgz.name).read_bytes()
  run('new-final-source-status',['git','status','--porcelain=v1'],repo)
newRepo=W/'new/hanamesh-recommender';baseRepo=W/'baseline/hanamesh-recommender'
driver=E/'baseline-mutant-driver.mjs'
run('baseline-raw-mutations',['node',str(driver),str(baseRepo),str(E/'baseline-mutations'),str(newRepo)])
run('assertion-control',['node',str(E/'assertion-control.mjs'),str(newRepo),str(E/'assertion-control')])
shutil.rmtree(W/'baseline');shutil.rmtree(W/'consumer-run');shutil.rmtree(cache)
(E/'cleanup.json').write_text(json.dumps({'removed':['own baseline checkout/build/dependencies','own pure consumer runtime','own pnpm variant build',str(cache)],'kept':['latest new checkout/build/archive','all raw evidence and both rollback archives']},indent=2)+'\n')
run('archive-source-audit',['python3',str(E/'audit.py')])
run('consumer-closure-audit',['python3',str(E/'consumer-closure.py')])
print('gate execution complete',flush=True)
