function recSummary(rec){
  if(rec===null)return null;
  return {objectId:rec.objectId,hanaId:rec.hanaId,name:rec.name,matchPercent:rec.matchPercent,install:{kind:rec.install?.kind??'none'}};
}

export function createHistory(domain,{now=()=>new Date()}={}){
  if(typeof domain?.global?.get!=='function'||typeof domain.global.set!=='function')throw new TypeError('History domain is required.');
  let tail=Promise.resolve();
  const append=input=>{
    const run=tail.then(async()=>{
      const current=domain.global.get();
      const record={requestId:input.requestId,at:now().toISOString(),constraints:{...(input.constraints??{})},recommendation:{
        primary:recSummary(input.recommendation.primary),alternatives:(input.recommendation.alternatives??[]).map(recSummary),
        noMatch:Boolean(input.recommendation.noMatch),confidence:Number(input.recommendation.confidence??0),
      }};
      const next={schema:1,revision:current.revision+1,records:[...current.records,record].slice(-20)};
      await domain.global.set(next);return record;
    });
    tail=run.then(()=>{},()=>{});return run;
  };
  return {append,list:()=>domain.global.get().records,drain:()=>tail};
}
