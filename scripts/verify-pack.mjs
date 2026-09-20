import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url),pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8')),patch=await readFile(new URL('profile/cordis.patch.yml',root),'utf8');
assert.equal(pkg.name,'hanamesh-recommender');assert.match(pkg.version,/^0\.1\.0-rc\.\d+$/u);assert.equal(pkg.dsh.bundle.patch,'./profile/cordis.patch.yml');assert.equal((patch.match(/^\s*- id:/gm)??[]).length,1);assert.match(patch,/id: hanamesh-recommender/);
const forbiddenSiblings=['hanamesh-core','hanamesh-usage','@hanamesh/dsh-app-host'];for(const name of forbiddenSiblings)assert.equal(Object.hasOwn(pkg.dependencies??{},name)||Object.hasOwn(pkg.peerDependencies??{},name),false,`forbidden dependency ${name}`);
const sourceFiles=(await readdir(new URL('src/',root))).filter(file=>file.endsWith('.js'));for(const file of sourceFiles){const source=await readFile(new URL(`src/${file}`,root),'utf8');assert.equal(/voyage|jev|api[_-]key/iu.test(source),false,`provider material in src/${file}`);for(const name of forbiddenSiblings)assert.equal(source.includes(`from '${name}`)||source.includes(`from "${name}`),false,`forbidden import in ${file}`);}
const packed=spawnSync('npm',['pack','--dry-run','--json','--ignore-scripts'],{cwd:new URL('.',root),encoding:'utf8'});if(packed.status!==0)throw new Error(packed.stderr||packed.stdout);const report=JSON.parse(packed.stdout),files=new Set(report[0].files.map(row=>row.path));for(const required of ['dist/dsh.js','dist/client-ui.js','profile/cordis.patch.yml','docs/CONTEXT.md','README.md','LICENSE','AGENTS.md'])assert(files.has(required),`missing pack file ${required}`);
assert(![...files].some(file=>file.startsWith('test/')||file.startsWith('scripts/')||file==='.env'));
console.log(JSON.stringify({status:'PASS',package:`${pkg.name}@${pkg.version}`,fileCount:files.size,unpackedSize:report[0].unpackedSize,forbiddenDependencies:0,providerSourceMatches:0,bundlePatchEntries:1}));
