const cases=[
  {file:'src/constraints.js',from:'constraints.free=true',to:'constraints.free=false',test:'test/constraints.test.mjs',name:'free constraint is not applied'},
  {file:'src/history.js',from:'slice(-20)',to:'slice(-21)',test:'test/history.test.mjs',name:'history exceeds 20 records'},
  {file:'src/remote.js',from:'origin:originHeader',to:"origin:'http://127.0.0.1:1'",test:'test/mock-remote.test.mjs',name:'forwarded Origin is replaced'},
  {file:'src/routes.js',from:"if(state.installed&&input.kind==='plugin')",to:"if(input.kind==='plugin')",test:'test/routes.test.mjs',name:'invoke claims an uninstalled plugin is enabled'},
  {file:'src/market.js',from:'!packageName)return undefined;',to:'!packageName)return false;',test:'test/routes.test.mjs',name:'a seat without isInstalled answers false instead of deferring to the Loader'},
  {file:'src/routes.js',from:"if(market.has('open')&&Object.keys",to:'if(false&&Object.keys',test:'test/routes.test.mjs',name:'details ignores the market seat'},
];
export default cases;
