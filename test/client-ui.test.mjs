import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function loadClient({responder}={}){
  const source=await readFile(new URL('../src/client-ui.js',import.meta.url),'utf8');let exported;
  const React={createElement:(...args)=>({args}),useState:initial=>[initial,()=>{}],useEffect:()=>{},useCallback:value=>value};
  const window={__ModuleLoader__:{load({factory}){exported=factory(name=>{assert.equal(name,'react');return React;});}}};
  const requests=[],copied=[];
  const fakeGlobal={
    navigator:{language:'en',clipboard:{writeText:async value=>{copied.push(value);}}},
    fetch:async(path,init)=>{
      const body=init?.body===undefined?undefined:JSON.parse(init.body);requests.push({path,body});
      const reply=responder?.(path,body)??{status:200,value:{}};
      return {ok:reply.status<400,status:reply.status,headers:{get:name=>name==='x-hanamesh-semantic-mode'?'stub':null},json:async()=>reply.value};
    },
  };
  vm.runInNewContext(source,{window,globalThis:fakeGlobal,document:{},navigator:{language:'en'},URL,console,setTimeout,clearTimeout});
  return {source,exported,requests,copied};
}

function walk(node,visit){
  if(Array.isArray(node)){for(const item of node)walk(item,visit);return;}
  if(!node||typeof node!=='object'||!Array.isArray(node.args))return;
  visit(node.args[0],node.args[1]??{});
  for(const child of node.args.slice(2))walk(child,visit);
}
function buttons(node){const found=[];walk(node,(type,props)=>{if(type==='button')found.push(props);});return found;}

const card={objectId:'cap.repo-master',hanaId:'repo-master',name:'RepoMaster',matchPercent:92,reasons:['a'],checks:[],install:{kind:'dsh_plugin',command:'dsh plugin add repo-master'},detailsUrl:'https://market.hanamesh.com/hana/repo-master'};
const appCard={...card,hanaId:'vibe',install:{kind:'hanamesh_app',packageName:'vibe-app',libraryUrl:'/hanamesh/library'}};

async function press(exported,rec,action,responder,extra={}){
  const notices=[];
  const tree=exported.RecommendationCard({rec,t:exported.messages.en,requestId:'req-1',onNotice:value=>notices.push(value),onAlternatives:()=>{},...extra});
  const button=buttons(tree).find(props=>props['data-action']===action);
  assert(button,`no ${action} button`);
  button.onClick();
  for(let tick=0;tick<12;tick++)await new Promise(resolve=>setTimeout(resolve,0));
  return notices;
}

test('client module exposes three locales and registers settings entry plus independent panel', async () => {
  const {source,exported}=await loadClient();
  assert.deepEqual(Object.keys(exported.messages).sort(),['en','ja','zh']);
  assert.match(source,/settings\.section/);assert.match(source,/shell\.overlay/);assert.match(source,/sidebar\.footer\.action/);
  for(const locale of ['zh','en','ja'])for(const key of ['install','details','alternatives','noMatch','invoke','marketMissing','pluginEnabled','appOpened','restartRequired'])assert.equal(typeof exported.messages[locale][key],'string');
});

test('client follow-up mapper implements the same four whitelist constraints', async () => {
  const {exported}=await loadClient();
  const value=exported.applyConstraintInput('task',{},'必须免费 只要本地 不要 shell 权限 再给 2 个');
  assert.deepEqual(JSON.parse(JSON.stringify(value)),{query:'task',constraints:{free:true,localOnly:true,noShell:true},more:2,mapped:['free','localOnly','noShell','more:2']});
});

test('recommendation card source includes required content and all four feedback actions', async () => {
  const {source}=await loadClient();
  for(const token of ['matchPercent','reasons','checks','install','details','alternatives'])assert.match(source,new RegExp(token));
  for(const action of ['select','install','open','dismiss'])assert.match(source,new RegExp(`['"]${action}['"]`));
  assert.match(source,/navigator\.clipboard\.writeText/);
});

test('card derives the duck-typed market target and kind from the recommendation itself', async () => {
  const {exported}=await loadClient();
  const plain=value=>JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(exported.targetOf(card)),{itemId:'repo-master',packageName:'repo-master'});
  assert.deepEqual(plain(exported.targetOf(appCard)),{itemId:'vibe',packageName:'vibe-app'});
  assert.deepEqual(plain(exported.targetOf({})),{});
  assert.equal(exported.kindOf(card),'plugin');assert.equal(exported.kindOf(appCard),'app');
});

test('the three card actions post to the market routes with that target', async () => {
  const {exported,requests}=await loadClient({responder:path=>path.endsWith('/invoke')?{status:200,value:{state:'app-opened'}}:{status:200,value:{}}});
  await press(exported,appCard,'details');
  await press(exported,appCard,'install');
  await press(exported,appCard,'invoke');
  const paths=requests.map(row=>row.path);
  assert(paths.includes('/api/hanamesh/recommender/open-details'));
  assert(paths.includes('/api/hanamesh/recommender/install'));
  assert(paths.includes('/api/hanamesh/recommender/invoke'));
  assert.deepEqual(requests.find(row=>row.path.endsWith('/invoke')).body,{itemId:'vibe',packageName:'vibe-app',kind:'app'});
  assert.deepEqual(requests.find(row=>row.path.endsWith('/install')).body,{itemId:'vibe',packageName:'vibe-app'});
  assert.equal(requests.find(row=>row.path.endsWith('/open-details')).body.url,'https://market.hanamesh.com/hana/repo-master');
});

// RC-11 in the client: each of the three host answers becomes a different, honest message.
test('RC-11 client renders the three invoke states distinctly', async () => {
  const cases=[
    {state:'app-opened',expect:'appOpened'},
    {state:'install-started',status:'started',expect:'installStarted'},
    {state:'install-started',status:'restart-required',restartRequired:true,expect:'restartRequired'},
  ];
  for(const item of cases){
    const {exported}=await loadClient({responder:path=>path.endsWith('/invoke')?{status:200,value:item}:{status:200,value:{}}});
    const notices=await press(exported,appCard,'invoke');
    assert.deepEqual(notices,[exported.messages.en[item.expect]],JSON.stringify(item));
  }
  const {exported}=await loadClient({responder:path=>path.endsWith('/invoke')?{status:200,value:{state:'plugin-enabled',startSession:true}}:{status:200,value:{}}});
  assert.equal(exported.RecommenderPanel(),null,'a closed panel with nothing to hand over renders nothing');
  const notices=await press(exported,card,'invoke');
  assert.deepEqual(notices,[],'an enabled plugin hands off to the session toast, not an in-panel notice');
  const toast=exported.RecommenderPanel();
  assert.equal(toast.args[0],'div');assert.equal(toast.args[1].className,'hmr-toast');
  assert.match(JSON.stringify(toast),/RepoMaster is enabled\. A new session was started for you\./);
  exported.setHandoff('');
  assert.equal(exported.RecommenderPanel(),null);
});

test('RC-11 degradation: without the market seat the card says so and still offers the command', async () => {
  const {exported,copied}=await loadClient({responder:()=>({status:503,value:{error:{code:'RECOMMENDER_MARKET_UNAVAILABLE'}}})});
  const installNotices=await press(exported,card,'install');
  assert.equal(installNotices.length,1);
  assert.match(installNotices[0],/Install the HanaMesh market \(app-host\) first\./);
  assert.match(installNotices[0],/dsh plugin add repo-master/);
  assert.deepEqual(copied,['dsh plugin add repo-master']);
  const invokeNotices=await press(exported,appCard,'invoke');
  assert.equal(invokeNotices.length,1);
  assert.equal(invokeNotices[0],exported.messages.en.marketMissing,'an app has no command to fall back on, so only the readable notice');
});
