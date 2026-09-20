import test from 'node:test';
import assert from 'node:assert/strict';
import {collectContext, normalizeLocale} from '../src/context.js';

test('context contains exactly the documented whitelist and Loader entry ids', async () => {
  const loader={entries(){return [
    {id:'alpha',options:{name:'pkg-alpha'}},
    {id:'group',options:{group:true}},
    {id:'beta',options:{name:'pkg-beta'}},
    {id:'alpha',options:{name:'pkg-alpha-duplicate'}},
    {id:42,options:{name:'invalid'}},
  ];}};
  const context=await collectContext({loader,locale:'ja-JP',platform:'darwin',arch:'arm64',dshVersion:'0.1.5-alpha.1'});
  assert.deepEqual(context,{runtime:'local',os:'macos',arch:'arm64',dshVersion:'0.1.5-alpha.1',installed:['alpha','beta'],locale:'ja'});
  assert.deepEqual(Object.keys(context).sort(),['arch','dshVersion','installed','locale','os','runtime']);
  assert.equal(JSON.stringify(context).includes('/Users/'),false);
});

test('locale normalization is limited to zh, en and ja', () => {
  assert.equal(normalizeLocale('zh-Hans-CN'),'zh');
  assert.equal(normalizeLocale('ja-JP'),'ja');
  assert.equal(normalizeLocale('fr-FR'),'en');
});
