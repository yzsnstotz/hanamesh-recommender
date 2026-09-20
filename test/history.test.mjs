import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistory} from '../src/history.js';

test('history serializes concurrent writes, keeps 20 summaries, and stores no query or context', async () => {
  let snapshot={schema:1,revision:0,records:[]};
  const domain={global:{get:()=>structuredClone(snapshot),set:async value=>{await new Promise(resolve=>setTimeout(resolve,1));snapshot=structuredClone(value);}}};
  const history=createHistory(domain,{now:()=>new Date('2026-09-20T00:00:00.000Z')});
  await Promise.all(Array.from({length:25},(_,index)=>history.append({
    requestId:`r-${index}`,constraints:{localOnly:index%2===0},recommendation:{primary:{objectId:`o-${index}`,hanaId:`h-${index}`,name:`N${index}`,matchPercent:80,reasons:['x'],checks:[],install:{kind:'none'},detailsUrl:`https://market.hanamesh.com/hana/h-${index}`},alternatives:[],noMatch:false,confidence:.8},
    query:'must not persist',context:{runtime:'local'},
  })));
  assert.equal(snapshot.records.length,20);
  assert.equal(snapshot.revision,25);
  assert.equal(snapshot.records[0].requestId,'r-5');
  assert.equal(JSON.stringify(snapshot).includes('must not persist'),false);
  assert.equal(JSON.stringify(snapshot).includes('runtime'),false);
});
