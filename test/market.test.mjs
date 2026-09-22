import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketBridge,MARKET_SEAT} from '../src/market.js';

test('bridge is duck-typed: every method is probed before use and a missing seat degrades', async () => {
  assert.equal(MARKET_SEAT,'hanameshMarket');
  const absent=createMarketBridge(()=>undefined);
  assert.equal(absent.available(),false);
  assert.deepEqual(absent.methods(),[]);
  assert.equal(absent.has('open'),false);
  assert.equal(await absent.isInstalled('repo-master'),undefined);
  await assert.rejects(()=>absent.install({itemId:'x'}),error=>error.code==='RECOMMENDER_MARKET_UNAVAILABLE'&&error.status===503);
});

test('a seat that implements only some methods answers for those and refuses the rest', async () => {
  const calls=[];
  const bridge=createMarketBridge(()=>({open:target=>{calls.push(['open',target]);return {ok:true};}}));
  assert.equal(bridge.available(),true);
  assert.deepEqual(bridge.methods(),['open']);
  assert.deepEqual(await bridge.open({itemId:'repo-master'}),{ok:true});
  assert.deepEqual(calls,[['open',{itemId:'repo-master'}]]);
  await assert.rejects(()=>bridge.openApp({appId:'a'}),error=>error.code==='RECOMMENDER_MARKET_ACTION_UNAVAILABLE'&&error.status===503);
  assert.equal(await bridge.isInstalled('repo-master'),undefined);
});

test('seat methods keep their receiver, are read late, and their failures stay opaque', async () => {
  let seat;const bridge=createMarketBridge(()=>seat);
  assert.equal(bridge.available(),false);
  seat={id:'market',async install(target){assert.equal(this.id,'market');return {status:'restart-required',itemId:target.itemId};},async isInstalled(name){return name==='installed-pkg';},openApp(){throw new Error('seat exploded with /Users/secret');}};
  assert.equal(bridge.available(),true);
  assert.deepEqual(await bridge.install({itemId:'repo-master'}),{status:'restart-required',itemId:'repo-master'});
  assert.equal(await bridge.isInstalled('installed-pkg'),true);
  assert.equal(await bridge.isInstalled('other-pkg'),false);
  await assert.rejects(()=>bridge.openApp({appId:'a'}),error=>error.code==='RECOMMENDER_MARKET_FAILED'&&error.status===502);
});

test('a throwing or non-object resolver never crashes the plugin', async () => {
  const thrown=createMarketBridge(()=>{throw new Error('cannot get property without inject');});
  assert.equal(thrown.available(),false);
  assert.equal(createMarketBridge(()=>'market').available(),false);
  assert.equal(createMarketBridge(()=>null).available(),false);
  assert.throws(()=>createMarketBridge(undefined),/Market resolver/);
  assert.deepEqual(await createMarketBridge(()=>({install:()=>'not-an-object'})).install({itemId:'x'}),{});
});
