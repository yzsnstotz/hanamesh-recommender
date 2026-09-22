import {RecommenderError} from './errors.js';

/**
 * Duck-typed HanaMesh market (app-host) seat.
 * The seat is read lazily through `ctx.get('hanameshMarket')` on the DSH host side, never imported:
 * this plugin must load and degrade on an official DSH that has no app-host installed.
 */
export const MARKET_SEAT='hanameshMarket';
const METHODS=Object.freeze(['open','install','isInstalled','openApp']);

function seatOf(resolve){
  let value;try{value=resolve();}catch{return undefined;}
  return value!==null&&(typeof value==='object'||typeof value==='function')?value:undefined;
}

export function createMarketBridge(resolve){
  if(typeof resolve!=='function')throw new TypeError('Market resolver is required.');
  const method=name=>{const seat=seatOf(resolve);const fn=seat?.[name];return typeof fn==='function'?fn.bind(seat):undefined;};
  const call=async(name,argument)=>{
    const fn=method(name);
    if(!fn)throw new RecommenderError(seatOf(resolve)===undefined?'RECOMMENDER_MARKET_UNAVAILABLE':'RECOMMENDER_MARKET_ACTION_UNAVAILABLE',503,`Market seat cannot ${name}.`);
    let value;try{value=await fn(argument);}catch(error){throw new RecommenderError('RECOMMENDER_MARKET_FAILED',502,String(error?.message??error));}
    return value!==null&&typeof value==='object'?value:{};
  };
  return {
    available:()=>seatOf(resolve)!==undefined,
    has:name=>method(name)!==undefined,
    methods:()=>{const seat=seatOf(resolve);return seat?METHODS.filter(name=>typeof seat[name]==='function'):[];},
    open:target=>call('open',target),
    install:target=>call('install',target),
    openApp:target=>call('openApp',target),
    /** `undefined` means the seat cannot answer; the caller then falls back to the Loader projection. */
    isInstalled:async packageName=>{
      const fn=method('isInstalled');if(!fn||typeof packageName!=='string'||!packageName)return undefined;
      try{return Boolean(await fn(packageName));}catch{return undefined;}
    },
  };
}
