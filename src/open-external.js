import {spawn} from 'node:child_process';
import {RecommenderError} from './errors.js';

export async function openSystemBrowser(url,{platform=process.platform,spawner=spawn}={}){
  const command=platform==='darwin'?'open':platform==='win32'?'cmd':'xdg-open';
  const args=platform==='win32'?['/d','/s','/c','start','',url]:[url];
  await new Promise((resolve,reject)=>{const child=spawner(command,args,{stdio:'ignore',detached:true,windowsHide:true});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});}).catch(()=>{throw new RecommenderError('RECOMMENDER_BROWSER_UNAVAILABLE',503);});
  return {opened:true};
}
