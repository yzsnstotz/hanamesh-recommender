// REAL_DSH + REAL_UI gate driver (recovery 2026-09-21). Not part of the npm pack.
// Drives the DSH web UI in a real Chrome (CDP over WebSocket, no puppeteer) against a
// running DSH host that already has hanamesh-recommender installed, records every
// request the plugin makes, takes screenshots and writes a JSON summary.
//
// usage: node scripts/real-dsh-ui-gate.mjs --dsh-origin http://127.0.0.1:PORT --out DIR [--server mock|real] [--real-origin https://api.hanamesh.com]
// env:   HM_CHROMIUM (browser binary, default Google Chrome), HM_UI_QUERY (first task text)
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createServer} from 'node:net';

const args=process.argv.slice(2);const opt=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback;};
const dshOrigin=opt('--dsh-origin');const out=opt('--out');const server=opt('--server','mock');
if(!dshOrigin||!out)throw new Error('usage: --dsh-origin <origin> --out <dir>');
const chrome=process.env.HM_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await mkdir(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=createServer();await new Promise((res,rej)=>s.once('error',rej).listen(0,'127.0.0.1',res));const p=s.address().port;await new Promise(r=>s.close(r));return p;}

const debugPort=await freePort();const profileDir=join(out,'chrome-profile');
const browser=spawn(chrome,[`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--window-size=1440,1000','--lang=zh-CN','about:blank'],{stdio:'ignore'});
process.on('exit',()=>{try{browser.kill('SIGTERM');}catch{}});
let targets;for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${debugPort}/json/list`);targets=await r.json();if(targets?.length)break;}catch{}await pause(200);}
const page=targets.find(t=>t.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
let id=0;const pending=new Map();const events=[];
ws.onmessage=({data})=>{const msg=JSON.parse(data);if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(new Error(msg.error.message)):resolve(msg.result);}else if(msg.method)events.push(msg);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception?.description??''));return r.result.value;};
const until=async(expr,timeout=20000,label=expr)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expr).catch(()=>false))return true;await pause(250);}throw new Error(`timeout waiting for ${label}`);};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(out,`${name}.png`),Buffer.from(r.data,'base64'));return `${name}.png`;};
const click=async selector=>{const ok=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.click();return true;})()`);if(!ok)throw new Error(`no element ${selector}`);};
const type=async(selector,text)=>{await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.focus();const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(el,${JSON.stringify(text)});el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);};
const enter=async selector=>{await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));return true;})()`);};

await send('Page.enable');await send('Network.enable');await send('Runtime.enable');
const requests=[];const responses=new Map();
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes('/api/hanamesh/recommender/'))requests.push({id:m.params.requestId,method:m.params.request.method,url:new URL(m.params.request.url).pathname,body:m.params.request.postData??null});if(m.method==='Network.responseReceived'&&m.params.response.url.includes('/api/hanamesh/recommender/'))responses.set(m.params.requestId,{status:m.params.response.status,mode:m.params.response.headers['x-hanamesh-semantic-mode']??m.params.response.headers['X-Hanamesh-Semantic-Mode']??null});});

const summary={server,dshOrigin,steps:[],requests:[],screenshots:[]};
const step=(name,detail)=>{summary.steps.push({name,...detail});console.log(JSON.stringify({step:name,...detail}));};

process.on('unhandledRejection',async error=>{try{await shot('99-failure');await writeFile(join(out,'99-failure.txt'),`${error?.stack??error}\n\n${await evaluate('document.body.innerText.slice(0,4000)').catch(()=>'')}`);}catch{}browser.kill('SIGTERM');process.exit(1);});
await send('Page.navigate',{url:dshOrigin.includes('?')?dshOrigin:dshOrigin+'/'});
await until(`!!document.querySelector('button.hmr-footer')`,60000,'sidebar footer action (plugin client module loaded)');
// First-run host dialog (Internal Testing Notice) sits above the shell overlay; dismiss it like a user would.
for(let i=0;i<20;i++){const dismissed=await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^(Continue|继续|続行|Configure later|稍后配置|後で設定)$/.test(x.textContent.trim()));if(b){b.click();return true;}return false;})()`);if(dismissed){await pause(600);continue;}await pause(250);}
summary.screenshots.push(await shot('01-home-with-footer-action'));step('client-module-loaded',{footerAction:true});
await click('button.hmr-footer');await until(`!!document.querySelector('.hmr-overlay #hmr-input')`,10000,'panel overlay');
summary.screenshots.push(await shot('02-panel-open'));step('panel-open',{overlay:true});

const query=process.env.HM_UI_QUERY??'分析这个仓库并修复 bug';
await type('#hmr-input',query);await enter('#hmr-input');
await until(`!!document.querySelector('.hmr-card, .hmr-no-match, .hmr-notice')`,30000,'first result');await pause(500);
const first=await evaluate(`(()=>{const card=document.querySelector('.hmr-card');const notice=document.querySelector('.hmr-notice')?.textContent??null;const noMatch=!!document.querySelector('.hmr-no-match');const mode=document.querySelector('.hmr-mode')?.dataset.mode??null;return card?{name:card.querySelector('h3')?.textContent,match:card.querySelector('.hmr-match strong')?.textContent,reasons:[...card.querySelectorAll('.hmr-reasons li')].map(li=>li.textContent),checks:[...card.querySelectorAll('.hmr-checks span')].map(s=>s.textContent),buttons:[...card.querySelectorAll('.hmr-actions button')].map(b=>b.textContent),noMatch,mode,notice}:{card:null,noMatch,mode,notice};})()`);
summary.screenshots.push(await shot('03-first-recommendation'));step('first-recommendation',{query,...first});

if(first.card!==null||first.noMatch){
  // RC-05 追加「只要本地」→ constraints.localOnly
  await type('#hmr-input','只要本地');await enter('#hmr-input');await pause(300);
  await until(`document.querySelectorAll('.hmr-thread p').length>=4`,30000,'second exchange');await pause(500);
  const second=await evaluate(`(()=>{const card=document.querySelector('.hmr-card');return{name:card?.querySelector('h3')?.textContent??null,noMatch:!!document.querySelector('.hmr-no-match'),notice:document.querySelector('.hmr-notice')?.textContent??null,thread:[...document.querySelectorAll('.hmr-thread p')].map(p=>p.textContent)};})()`);
  summary.screenshots.push(await shot('04-constraint-localonly'));step('constraint-follow-up',second);
  // RC-07 详情（系统浏览器）+ RC-08 安装（复制命令）+ 其他选择 → feedback open/install/dismiss
  const hasCard=await evaluate(`!!document.querySelector('.hmr-card')`);
  if(hasCard){
    await evaluate(`(()=>{navigator.clipboard.writeText=async t=>{window.__hmrCopied=t;};return true;})()`);
    await click('.hmr-card .hmr-actions button.hmr-primary');await pause(800);
    const copied=await evaluate(`({copied:window.__hmrCopied??null,notice:document.querySelector('.hmr-notice')?.textContent??null})`);
    summary.screenshots.push(await shot('05-install-copied-command'));step('install-exit',copied);
    const buttons=await evaluate(`[...document.querySelectorAll('.hmr-card .hmr-actions button')].map(b=>b.textContent)`);
    await evaluate(`(()=>{const b=[...document.querySelectorAll('.hmr-card .hmr-actions button')].find(x=>x.textContent==='详情'||x.textContent==='Details'||x.textContent==='詳細');b.click();return true;})()`);await pause(1500);
    const detailsNotice=await evaluate(`document.querySelector('.hmr-notice')?.textContent??null`);
    step('details-exit',{buttons,notice:detailsNotice});
    await evaluate(`(()=>{const b=[...document.querySelectorAll('.hmr-card .hmr-actions button')].find(x=>x.textContent==='其他选择'||x.textContent==='Other choices'||x.textContent==='ほかの候補');b?.click();return !!b;})()`);await pause(800);
    const alts=await evaluate(`[...document.querySelectorAll('.hmr-alternatives .hmr-card h3')].map(h=>h.textContent)`);
    summary.screenshots.push(await shot('06-alternatives'));step('alternatives',{alternatives:alts});
    if(alts.length){await evaluate(`(()=>{const b=[...document.querySelectorAll('.hmr-alternatives .hmr-card .hmr-actions button')].find(x=>['选择','Select','選択'].includes(x.textContent));b.click();return true;})()`);await pause(800);step('select-alternative',{notice:await evaluate(`document.querySelector('.hmr-notice')?.textContent??null`)});}
  }
}
// RC-06 noMatch negative (mock keyword) — only meaningful on the mock server
if(server==='mock'){await type('#hmr-input','no-match 的任务');await enter('#hmr-input');await until(`!!document.querySelector('.hmr-no-match')`,20000,'noMatch');await pause(500);const nm=await evaluate(`({title:document.querySelector('.hmr-no-match h2')?.textContent,alternatives:[...document.querySelectorAll('.hmr-alternatives .hmr-card h3')].map(h=>h.textContent)})`);summary.screenshots.push(await shot('07-no-match'));step('no-match',nm);
  await type('#hmr-input','触发 429');await enter('#hmr-input');await until(`(document.querySelector('.hmr-notice')?.textContent??'').includes('频繁')||(document.querySelector('.hmr-notice')?.textContent??'').includes('Too many')`,20000,'429 notice');summary.screenshots.push(await shot('08-rate-limited'));step('rate-limited',{notice:await evaluate(`document.querySelector('.hmr-notice')?.textContent`)});}

await pause(1000);
summary.requests=requests.map(r=>({...r,response:responses.get(r.id)??null,id:undefined}));
const history=await evaluate(`fetch('/api/hanamesh/recommender/history').then(r=>r.json())`);summary.history={records:history.records?.length??null,firstKeys:history.records?.[0]?Object.keys(history.records[0]):null};
await writeFile(join(out,'ui-gate-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({done:true,requests:summary.requests.length,screenshots:summary.screenshots.length}));
ws.close();browser.kill('SIGTERM');process.exit(0);
