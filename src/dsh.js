import {historyDomainSpec} from './domain.js';
import {createHistory} from './history.js';
import {collectContext} from './context.js';
import {createSemanticClient} from './remote.js';
import {createRouteHandler,ROUTES} from './routes.js';
import {openSystemBrowser} from './open-external.js';
import {createMarketBridge,MARKET_SEAT} from './market.js';

export const name='hanamesh-recommender';
/** `hanameshMarket` is NOT injected: this cordis has no optional inject, and the plugin must still load on an official DSH without app-host. */
export const inject=['connection','storageDomain','loader','webServer'];
export const DSH_TARGET='0.1.5-alpha.1';
export {historyDomainSpec,MARKET_SEAT};

function options(config,webServer){
  const serverOrigin=config?.serverOrigin??'https://api.hanamesh.com',timeoutMs=config?.timeoutMs??10_000,dshVersion=config?.dshVersion??DSH_TARGET;
  if(typeof serverOrigin!=='string'||!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>60_000||typeof dshVersion!=='string')throw new TypeError('Invalid recommender config.');
  return {serverOrigin,timeoutMs,dshVersion,/* Host contract (hanamesh-server allowedOrigins, same as hanamesh-usage): desktop plugins present the server origin itself as Origin. */originHeader:serverOrigin,allowSystemBrowser:config?.allowSystemBrowser!==false};
}

/** Read the market seat lazily and without the inject requirement, so app-host may arrive after this plugin. */
export function marketResolver(ctx){
  return ()=>{try{return typeof ctx?.get==='function'?ctx.get(MARKET_SEAT):undefined;}catch{return undefined;}};
}

export async function mountRecommender(ctx,config={},deps={}){
  if(!ctx?.connection?.fetch?.register||!ctx?.storageDomain?.open||!ctx?.loader?.entries||!Number.isSafeInteger(ctx?.webServer?.port))throw new TypeError('Required DSH services are unavailable.');
  const resolved=options(config,ctx.webServer),domain=await ctx.storageDomain.open(historyDomainSpec),history=createHistory(domain),remote=createSemanticClient({serverOrigin:resolved.serverOrigin,originHeader:resolved.originHeader,timeoutMs:resolved.timeoutMs,fetcher:deps.fetcher??globalThis.fetch});
  const openExternal=deps.openExternal??(resolved.allowSystemBrowser?openSystemBrowser:async()=>{throw Object.assign(new Error('RECOMMENDER_BROWSER_DISABLED'),{code:'RECOMMENDER_BROWSER_DISABLED',status:503});});
  const market=createMarketBridge(deps.resolveMarket??marketResolver(ctx));
  const context=locale=>collectContext({loader:ctx.loader,locale,dshVersion:resolved.dshVersion});
  const handler=createRouteHandler({remote,history,context,openExternal,market,localInstalled:async()=>(await context('en')).installed});
  const disposers=[];
  try{
    for(const [key,path] of Object.entries(ROUTES))disposers.push(ctx.connection.fetch.register({path,methods:[key==='history'?'GET':'POST'],requestBody:'buffered',fetch:handler}));
    ctx.effect(()=>async()=>{for(const dispose of disposers.splice(0).reverse())dispose();await history.drain();await domain.close();},'hanamesh-recommender:dispose');
    return {routes:Object.values(ROUTES),history,market};
  }catch(error){for(const dispose of disposers.reverse())dispose();await domain.close();throw error;}
}

export async function apply(ctx,config){await mountRecommender(ctx,config);}
