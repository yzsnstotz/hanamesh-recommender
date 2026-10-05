import json,re,subprocess
from pathlib import Path
E=Path(__file__).resolve().parent
lock=subprocess.check_output(['git','-C','/Users/yzliu/work/projects/hanamesh/hanamesh-recommender','show','49e1b7509cf6736fd5b8484aec05557c56c99398:pnpm-lock.yaml'],text=True)
def section(lock,kind):return lock.split('\n'+kind+':\n')[1].split('\nsnapshots:\n')[0] if kind=='packages' else lock.split('\nsnapshots:\n')[1]
def blocks(s):
 starts=list(re.finditer(r'^  \S[^\n]*',s,re.M));out={}
 for i,m in enumerate(starts):
  header=m.group();key=header.rsplit(':',1)[0].strip();end=starts[i+1].start() if i+1<len(starts) else len(s)
  out[key]=s[m.start():end].strip()
 return out
basePackages=blocks(section(lock,'packages'));baseSnapshots=blocks(section(lock,'snapshots'))
report={}
for label in ['baseline','new']:
 c=(E/(label+'-consumer/pnpm-lock.yaml')).read_text();packages=blocks(section(c,'packages'));snapshots=blocks(section(c,'snapshots'))
 packages={k:v for k,v in packages.items() if not k.startswith('hanamesh-recommender@')}
 snapshots={k:v for k,v in snapshots.items() if not k.startswith('hanamesh-recommender@')}
 assert packages.keys()==basePackages.keys()
 for key in packages:
  assert re.search(r'^    resolution: .+$',packages[key],re.M).group()==re.search(r'^    resolution: .+$',basePackages[key],re.M).group()
 assert snapshots==baseSnapshots,(label,'snapshots',set(snapshots)^set(baseSnapshots))
 log=(E/(label+'-consumer.log')).read_text();assert log.count('error TS2322:')==2;assert 'devkitInstalled":false' in log
 report[label]={'runtimePackageCount':len(packages),'packageVersionResolutionAndIntegrityExact':True,'runtimeSnapshotGraphExact':True,'devkitInstalled':False,'strictTsInvalidAssignmentsRejected':2,'testOverridesOnly':'consumer override pins affect peer range metadata, not resolved versions/integrity or runtime dependency graph'}
 assert '@hanamesh/devkit@' not in c
(E/'consumer-closure.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
