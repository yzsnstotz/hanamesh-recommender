from pathlib import Path
import json,subprocess,re,tarfile,hashlib,os
R=Path('/Users/yzliu/.cache/hanamesh-runs/MERGE-RECOMMENDER-MAIN-01');S=R/'source';E=R/'_evidence'
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],cwd=S,text=True).strip()
base=json.loads((E/'baseline-audit.json').read_text())['base'];m=json.loads((S/'package.json').read_text());old=json.loads((E/'baseline-package.json').read_text());assert m['exports']==old['exports'];assert m['dsh']==old['dsh'];assert m['hanamesh']==old['hanamesh'];assert m['scripts']==old['scripts'];assert m['engines']==old['engines']
assert not git('diff',base,'--','src','test','scripts','profile','LICENSE','AGENTS.md','docs/CONTEXT.md','docs/acceptance')
files=git('ls-files').splitlines();activeManifests=[f for f in files if Path(f).name=='package.json' and not f.startswith('docs/acceptance/')];assert activeManifests==['package.json'];assert not (S/'vendor').exists()
locks={}
def blocks(p):
 t=p.read_text();result={}
 for section in ['packages','snapshots']:
  st=t.split('\n'+section+':\n',1)[1].split('\n\n')[1:] if False else t.split('\n'+section+':\n',1)[1]
  if section=='packages':st=st.split('\nsnapshots:',1)[0]
  result[section]={a.strip():b for a,b in re.findall(r'^  (\S.*):\n(.*?)(?=^  \S|\Z)',st,re.M|re.S) if '@hanamesh/devkit@' not in a}
 return result
assert blocks(E/'baseline-pnpm-lock.yaml')==blocks(S/'pnpm-lock.yaml')
for name,p in [('source',S/'pnpm-lock.yaml'),('freshStrict',R/'fresh-strict/pnpm-lock.yaml'),('consumer',R/'consumer/pnpm-lock.yaml')]:
 text=p.read_text();locks[name]={'sha256':sha(p.read_bytes()),'privatePackages':sorted(set(re.findall(r"^  '?(@hanamesh/[^\n]+?):",text,re.M))),'identity':('@hanamesh/server-identity' in text),'registry':('@hanamesh/server-registry' in text),'overrides':('overrides:' in text)};assert not locks[name]['identity'] and not locks[name]['registry'] and not locks[name]['overrides']
assert '@hanamesh/devkit' not in (R/'consumer/pnpm-lock.yaml').read_text()
roots=[p.resolve() for p in (S/'node_modules/.pnpm').glob('*/node_modules/@hanamesh/devkit')];assert len(set(roots))==1
pkg=roots[0];dk=json.loads((pkg/'package.json').read_text());assert dk['name']=='@hanamesh/devkit' and dk['version']=='0.2.0';assert not dk.get('dependencies') and not dk.get('peerDependencies')
installed={str(p.relative_to(pkg)):sha(p.read_bytes()) for p in pkg.rglob('*') if p.is_file()};assert len(installed)==15
runtimeFiles=[f for f in files if f.startswith(('src/','test/','scripts/','profile/')) and (S/f).is_file()];assert all('@hanamesh/devkit' not in (S/f).read_text() for f in runtimeFiles if f.startswith('src/'))
def archive(p):
 with tarfile.open(p) as t:return {x.name:{'sha256':sha(t.extractfile(x).read()),'size':x.size,'mode':x.mode,'mtime':x.mtime,'uid':x.uid,'gid':x.gid,'uname':x.uname,'gname':x.gname,'type':x.type.decode(),'linkname':x.linkname,'pax_headers':x.pax_headers} for x in t if x.isfile()}
a=archive(R/'rollback/pack/hanamesh-recommender-0.1.0-rc.5.tgz');b=archive(R/'release/hanamesh-recommender-0.1.1-rc.1.tgz');changed=[f for f in a.keys()&b.keys() if a[f]!=b[f]];same=[f for f in a.keys()&b.keys() if a[f]==b[f]];assert sorted(changed)==['package/README.md','package/package.json'];assert all(f in same for f in a if f.startswith('package/dist/'));assert len(a)==len(b)==18
result={'base':base,'activeManifests':activeManifests,'subpackageManifests':[],'modulesManifests':[],'activeLocks':['pnpm-lock.yaml'],'historicalEvidenceManifests':[f for f in files if f.endswith('package.json') and f not in activeManifests],'historicalEvidenceLocks':[f for f in files if 'lock' in Path(f).name and f!='pnpm-lock.yaml'],'rootDependencyGroups':{g:m.get(g,{}) for g in ['dependencies','peerDependencies','peerDependenciesMeta','optionalDependencies','devDependencies']},'toolchainPinsPreserved':True,'businessSrcTestScriptsProfileLicenseContextUnchanged':True,'thirdPartySourceLockPackagesSnapshotsUnchanged':True,'locks':locks,'devkit':{'name':dk['name'],'version':dk['version'],'singleRealRoot':str(pkg),'installedFiles':installed,'exports':dk['exports'],'license':dk['license'],'runtimeDependencyOrPeer':False,'spec':m['devDependencies']['@hanamesh/devkit'],'sourceMainAndPeeledTag':'8f9bcc69cbacf01d97ffe63bbbade4f865e6dd89'},'runtimePrivateContracts':[],'applicableContracts':{'Devkit':'PASS (development only)','Identity 0.3 wallet uniqueness':'N/A: absent direct/peer/optional/dev, absent all active locks and installed public runtime closure, no wallet binding API','Registry':'N/A: absent direct/transitive','Lib Provision':'N/A: absent direct/transitive','AppHost':'N/A package dependency: duck-typed hanameshMarket seat unchanged','ServerUsage':'N/A: absent direct/transitive','Core':'N/A: absent direct/transitive'},'normalPack':{'version':m['version'],'sha256':sha((R/'release/hanamesh-recommender-0.1.1-rc.1.tgz').read_bytes()),'members':b,'baselineMembers':a,'unchangedMembers':sorted(same),'changedMembers':sorted(changed),'added':sorted(b.keys()-a.keys()),'removed':sorted(a.keys()-b.keys()),'DevkitRuntimeAbsent':True},'noOverrideAliasLocalSourceCopy':True}
(E/'complete-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'audit':'PASS','packFiles':len(b),'unchanged':len(same),'privateDependencyCount':1,'Identity':'N/A','allBusinessBytesPreserved':True}))
