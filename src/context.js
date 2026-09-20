const localeSet=new Set(['zh','en','ja']);
const osMap={darwin:'macos',linux:'linux',win32:'windows'};

export function normalizeLocale(value){
  const prefix=typeof value==='string'?value.toLowerCase().split(/[-_]/u,1)[0]:'en';
  return localeSet.has(prefix)?prefix:'en';
}

/** Loader projection only: current entry ids, never package paths, config or credentials. */
export async function collectContext({loader,locale,platform=process.platform,arch=process.arch,dshVersion='unknown'}){
  if(typeof loader?.entries!=='function')throw new TypeError('Loader projection is unavailable.');
  const ids=new Set();
  for(const entry of loader.entries())if(!entry?.options?.group&&typeof entry?.id==='string'&&entry.id.length>0)ids.add(entry.id);
  /** API-O5 schema caps context.installed at 100 unique ids; keep the sorted prefix so the request stays valid on large profiles. */
  return Object.freeze({runtime:'local',os:osMap[platform]??'linux',arch:String(arch),dshVersion:String(dshVersion),installed:[...ids].sort().slice(0,100),locale:normalizeLocale(locale)});
}
