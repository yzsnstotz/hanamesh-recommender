const chineseNumbers=new Map([['一',1],['二',2],['两',2],['三',3],['四',4],['五',5],['六',6],['七',7],['八',8],['九',9],['十',10]]);

function parseCount(value){
  const normalized=String(value).trim();
  const count=/^\d+$/.test(normalized)?Number(normalized):chineseNumbers.get(normalized);
  return Number.isSafeInteger(count)&&count>=1&&count<=20?count:undefined;
}

function consume(input,pattern,onMatch){
  return input.replace(pattern,(match,...parts)=>onMatch(match,parts)===true?' ':match);
}

/** Map only the four frozen constraint forms; unmatched text stays user query text. */
export function applyConstraintInput(baseQuery,previousConstraints,followUp){
  if(typeof baseQuery!=='string'||typeof followUp!=='string'||!previousConstraints||typeof previousConstraints!=='object'||Array.isArray(previousConstraints))throw new TypeError('Invalid constraint input.');
  const constraints={...previousConstraints},mapped=[];let more;let remainder=followUp;
  remainder=consume(remainder,/必须免费|只要免费|free\s+only|\bfree\b|無料(?:のみ)?/giu,()=>{constraints.free=true;if(!mapped.includes('free'))mapped.push('free');return true;});
  remainder=consume(remainder,/只要本地(?:运行)?|local\s+only|ローカルのみ/giu,()=>{constraints.localOnly=true;if(!mapped.includes('localOnly'))mapped.push('localOnly');return true;});
  remainder=consume(remainder,/不要\s*shell\s*权限(?:的)?|no\s+shell(?:\s+permissions?)?|シェル権限なし/giu,()=>{constraints.noShell=true;if(!mapped.includes('noShell'))mapped.push('noShell');return true;});
  remainder=consume(remainder,/(?:再给|给我另外)\s*([0-9一二两三四五六七八九十]+)\s*个|([0-9]+)\s*more|あと\s*([0-9]+)\s*件/giu,(_match,parts)=>{
    const count=parseCount(parts.find(Boolean));if(count===undefined)return false;more=count;mapped.push(`more:${count}`);return true;
  });
  remainder=remainder.replace(/[，,。.!！、]+/gu,' ').replace(/\s+/gu,' ').trim();
  return {query:remainder?`${baseQuery.trim()}\n${remainder}`:baseQuery.trim(),constraints,more,mapped};
}
