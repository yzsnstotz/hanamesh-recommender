from pathlib import Path
import subprocess,os,json,hashlib,shutil
R=Path('/Users/yzliu/.cache/hanamesh-runs/MERGE-RECOMMENDER-MAIN-01');S=R/'source';E=R/'_evidence'
env=os.environ.copy();env['PATH']='/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:'+env['PATH'];env.update(DSH_HOME=str(R/'dsh-home'),HANAMESH_RUN_DIR=str(R),TMPDIR=str(R/'tmp'),CI='true')
cache=R/'npm-cache-gates';cache.mkdir(exist_ok=True);env['npm_config_cache']=str(cache)
receipts=[]
def run(label,args,cwd,expected=0):
 with (E/(label+'.log')).open('w') as log:p=subprocess.run(args,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT)
 receipts.append({'label':label,'args':args,'cwd':str(cwd),'exit':p.returncode,'expected':expected});(E/'gate-commands.json').write_text(json.dumps(receipts,indent=2)+'\n');assert p.returncode==expected, f'{label} exited {p.returncode}'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
(R/'release').mkdir(exist_ok=True)
run('normal-pack',['npm','pack','--pack-destination',str(R/'release')],S)
pack=R/'release/hanamesh-recommender-0.1.1-rc.1.tgz';assert pack.read_bytes()==(S/'artifacts'/pack.name).read_bytes();(R/'release/SHA256SUMS').write_text(sha(pack)+'  '+pack.name+'\n')
c=R/'consumer';c.mkdir(exist_ok=True)
old=json.loads((S/'docs/acceptance/metadata-devkit-vendor-rc5/consumer-package.json').read_text());old.pop('pnpm');old['dependencies']['hanamesh-recommender']='file:../release/'+pack.name;old['devDependencies']={'typescript':'5.9.3','@types/node':'24.13.4'};(c/'package.json').write_text(json.dumps(old,indent=2)+'\n')
for name,dest in [('consumer-probe.mjs','probe.mjs'),('consumer-consumer.ts','consumer.ts'),('consumer-negative.ts','negative.ts')]:shutil.copy2(S/'docs/acceptance/metadata-devkit-vendor-rc5'/name,c/dest)
run('consumer-strict-install',['pnpm','install','--strict-peer-dependencies','--store-dir','/Users/yzliu/.cache/hanamesh-deps/pnpm-store'],c)
h=sha(c/'pnpm-lock.yaml');run('consumer-frozen',['pnpm','install','--frozen-lockfile','--strict-peer-dependencies','--store-dir','/Users/yzliu/.cache/hanamesh-deps/pnpm-store'],c);assert h==sha(c/'pnpm-lock.yaml')
run('consumer-js',['node','probe.mjs'],c)
t=['pnpm','exec','tsc','--strict','--skipLibCheck','false','--allowJs','true','--checkJs','false','--maxNodeModuleJsDepth','10','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2024','--noEmit']
run('consumer-ts',t+['consumer.ts'],c);run('consumer-ts-negative',t+['negative.ts'],c,2);neg=(E/'consumer-ts-negative.log').read_text();assert neg.count('TS2322')==2
h=sha(R/'fresh-strict/pnpm-lock.yaml');run('fresh-strict-frozen',['pnpm','install','--frozen-lockfile','--strict-peer-dependencies','--store-dir','/Users/yzliu/.cache/hanamesh-deps/pnpm-store'],R/'fresh-strict');assert h==sha(R/'fresh-strict/pnpm-lock.yaml')
(E/'lock-stability.json').write_text(json.dumps({'consumer':sha(c/'pnpm-lock.yaml'),'freshStrict':h,'stableAfterFrozen':True},indent=2)+'\n')
print(json.dumps({'commands':len(receipts),'normalPack':sha(pack),'allExpectedExit':True}))
