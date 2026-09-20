import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function loadClient(){
  const source=await readFile(new URL('../src/client-ui.js',import.meta.url),'utf8');let exported;
  const React={createElement:(...args)=>({args}),useState:initial=>[initial,()=>{}],useEffect:()=>{},useCallback:value=>value};
  const window={__ModuleLoader__:{load({factory}){exported=factory(name=>{assert.equal(name,'react');return React;});}}};
  vm.runInNewContext(source,{window,globalThis:{fetch:()=>{}},document:{},navigator:{language:'en'},URL,console,setTimeout,clearTimeout});
  return {source,exported};
}

test('client module exposes three locales and registers settings entry plus independent panel', async () => {
  const {source,exported}=await loadClient();
  assert.deepEqual(Object.keys(exported.messages).sort(),['en','ja','zh']);
  assert.match(source,/settings\.section/);assert.match(source,/shell\.overlay/);assert.match(source,/sidebar\.footer\.action/);
  for(const locale of ['zh','en','ja'])for(const key of ['install','details','alternatives','noMatch'])assert.equal(typeof exported.messages[locale][key],'string');
});

test('client follow-up mapper implements the same four whitelist constraints', async () => {
  const {exported}=await loadClient();
  const value=exported.applyConstraintInput('task',{},'必须免费 只要本地 不要 shell 权限 再给 2 个');
  assert.deepEqual(JSON.parse(JSON.stringify(value)),{query:'task',constraints:{free:true,localOnly:true,noShell:true},more:2,mapped:['free','localOnly','noShell','more:2']});
});

test('recommendation card source includes required content and all four feedback actions', async () => {
  const {source}=await loadClient();
  for(const token of ['matchPercent','reasons','checks','install','details','alternatives'])assert.match(source,new RegExp(token));
  for(const action of ['select','install','open','dismiss'])assert.match(source,new RegExp(`['\"]${action}['\"]`));
  assert.match(source,/navigator\.clipboard\.writeText/);
});
