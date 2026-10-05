from pathlib import Path
import subprocess,json,tarfile,hashlib,base64,gzip,re
E=Path(__file__).resolve().parent;O=Path('/Users/yzliu/work/projects/hanamesh/hanamesh-recommender')
BASE='49e1b7509cf6736fd5b8484aec05557c56c99398';NEW='a0b3fe854cfbccbb9e0cdb85dff946bb632cd169'
def git(*a):return subprocess.check_output(['git','-C',str(O),*a])
files={ref:git('ls-tree','-r','--name-only',ref).decode().splitlines() for ref in [BASE,NEW]}
protected=[f for f in files[BASE] if f.startswith(('src/','test/','profile/')) or f in ['scripts/build.mjs','scripts/mock-server.mjs','scripts/serve-real-dsh-mock.mjs','scripts/real-dsh-ui-gate.mjs']]
for f in protected:assert git('show',BASE+':'+f)==git('show',NEW+':'+f),f
assert not git('diff',BASE,NEW,'--','src','test','profile')
assert not git('status','--porcelain=v1')
assert git('rev-parse','HEAD').decode().strip()==NEW
remote=git('ls-remote','origin','refs/heads/codex/consolidation-03-recommender').decode().split()[0];assert remote==NEW
private=json.loads(subprocess.check_output(['gh','api','repos/yzsnstotz/hanamesh-recommender','--jq','{full_name,private}']));assert private['private']
privatedocs=json.loads(subprocess.check_output(['gh','api','repos/yzsnstotz/hanamesh-docs','--jq','{full_name,private}']));assert privatedocs['private']
# Lock differences outside the two importer specifiers and the new devkit blocks must be zero.
oldlock=git('show',BASE+':pnpm-lock.yaml').decode();newlock=git('show',NEW+':pnpm-lock.yaml').decode()
normalized=oldlock
for p in ['@deepseek-ai/dsh-client-ui-settings','@deepseek-ai/dsh-client-ui-sidebar']:
 normalized=normalized.replace(f"      '{p}':\n        specifier: 0.1.5-alpha.1",f"      '{p}':\n        specifier: '>=0.1.5-alpha.1 <0.2.0'")
stripped=re.sub(r"      '@hanamesh/devkit':\n(?:        .*\n)+",'',newlock)
stripped=re.sub(r"  '@hanamesh/devkit@file:vendor/hanamesh-devkit-0.1.0-rc.1.tgz':\n(?:    .*\n)+\n",'',stripped)
stripped=stripped.replace("  '@hanamesh/devkit@file:vendor/hanamesh-devkit-0.1.0-rc.1.tgz': {}\n\n",'')
assert normalized==stripped
vendor=git('show',NEW+':vendor/hanamesh-devkit-0.1.0-rc.1.tgz');sha=hashlib.sha256(vendor).hexdigest()
assert sha=='3cf0b621ca2950fbe21c114d5b31ac1a55f97a67eb0a2dada77fb2d3bf2cb6ff'
assert 'sha512-'+base64.b64encode(hashlib.sha512(vendor).digest()).decode() in newlock
assert sha in git('show',NEW+':vendor/SHA256SUMS').decode()
# Exact parsed member headers, raw checksums, payloads and manifest changes.
def archive(p):
 raw=gzip.decompress(p.read_bytes());out={}
 with tarfile.open(p) as tf:
  order=tf.getnames()
  for m in tf:
   header=raw[m.offset:m.offset+512]
   out[m.name]={'digest':hashlib.sha256(tf.extractfile(m).read()).hexdigest() if m.isfile() else None,'size':m.size,'mode':m.mode,'uid':m.uid,'gid':m.gid,'uname':m.uname,'gname':m.gname,'mtime':m.mtime,'type':m.type.decode(),'linkname':m.linkname,'pax_headers':m.pax_headers,'raw_header_sha':hashlib.sha256(header).hexdigest(),'raw_size':header[124:136].decode(),'raw_checksum':header[148:156].decode()}
  manifest=json.load(tf.extractfile('package/package.json'))
 return {'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'gzip_header':p.read_bytes()[:10].hex(),'order':order,'members':out,'manifest':manifest}
a=archive(E/'hanamesh-recommender-0.1.0-rc.3.tgz');b=archive(E/'hanamesh-recommender-0.1.0-rc.4.tgz');variant=archive(E/'pnpm-variant.tgz')
assert len(a['members'])==len(b['members'])==17;assert a['order']==b['order']
differences={f:{k:[a['members'][f][k],b['members'][f][k]] for k in a['members'][f] if a['members'][f][k]!=b['members'][f][k]} for f in a['members']};differences={f:v for f,v in differences.items() if v}
assert set(differences)=={'package/package.json'};assert set(differences['package/package.json'])=={'digest','size','raw_header_sha','raw_size','raw_checksum'}
assert a['sha256']=='ddbc8d71c3cad4c7c6d858fabb24e568dd8990942a2f1a7f30c0e4b70c7f95c6';assert b['sha256']=='df0859572cbca375611c3124129b7c0dc90a7a00df7f3f34674255710f4e5653'
def delta(a,b,path=''):
 if isinstance(a,dict) and isinstance(b,dict):
  out=[]
  for k in sorted(a.keys()|b.keys()):
   p=path+'/'+k
   if k not in a:out.append({'path':p,'old':'<absent>','new':b[k]})
   elif k not in b:out.append({'path':p,'old':a[k],'new':'<absent>'})
   else:out+=delta(a[k],b[k],p)
  return out
 return [] if a==b else [{'path':path,'old':a,'new':b}]
manifestdiff=delta(a['manifest'],b['manifest']);assert len(manifestdiff)==9
variantdiff=delta(b['manifest'],variant['manifest']);assert {v['path'] for v in variantdiff}=={'/packageManager','/scripts/prepack'}
assert a['manifest']['dependencies'] if 'dependencies' in a['manifest'] else True
assert a['manifest'].get('dependencies')==b['manifest'].get('dependencies')
assert b['manifest']['peerDependencies']['@hanamesh/devkit']=='0.1.0-rc.1';assert b['manifest']['peerDependenciesMeta']['@hanamesh/devkit']=={'optional':True}
assert not any(f.endswith('.d.ts') for f in a['members']|b['members'])
def metrics(ref):
 rows={'src':[],'scripts_tools':[],'root_config':[],'tests':[],'other_tracked':[]}
 for f in files[ref]:
  bucket='src' if f.startswith('src/') else 'scripts_tools' if f.startswith(('scripts/','tools/')) else 'tests' if f.startswith(('test/','tests/')) else 'root_config' if '/' not in f and (f.endswith(('.json','.yaml','.yml','.mjs','.cjs','.js','.ts','.toml','.ini')) or f in ['.npmrc','.gitignore']) else 'other_tracked'
  data=git('show',ref+':'+f);rows[bucket].append({'file':f,'bytes':len(data),'lines':len(data.splitlines()) if b'\x00' not in data else None})
 stats={k:{'lines':sum(r['lines'] or 0 for r in v),'bytes':sum(r['bytes'] for r in v),'files':v} for k,v in rows.items()}
 for unit in ['lines','bytes']:
  dev=stats['scripts_tools'][unit]+stats['root_config'][unit];stats['dev_fraction_'+unit]=dev/(dev+stats['src'][unit])
 return stats
report={'source':NEW,'baseline':BASE,'origin_status':'clean','origin_remote_head':remote,'private':private,'docs_private':privatedocs,'protected_files':protected,'protected_byte_equal':True,'lock_existing_graph_byte_equal_after_exact_normalization':True,'vendor_sha256':sha,'vendor_sha512_lock_equal':True,'archives':{'baseline':a,'new':b,'pnpm_variant':variant},'member_diff':differences,'manifest_diff':manifestdiff,'pnpm_variant_diff':variantdiff,'metrics':{'baseline':metrics(BASE),'new':metrics(NEW)}}
(E/'audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['archives','metrics','protected_files']},indent=2))
print(json.dumps({'metrics':{ref:{key:{'lines':v['lines'],'bytes':v['bytes']} if isinstance(v,dict) else v for key,v in value.items()} for ref,value in report['metrics'].items()}},indent=2))
