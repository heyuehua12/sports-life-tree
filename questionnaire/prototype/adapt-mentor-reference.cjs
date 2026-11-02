// Isolate the supplied options/converters so they cannot overwrite app globals.
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../reference_notes/mentor-options.js'),'utf8').replace(/\r\n/g,'\n');
const output=`/* Generated from the supplied mentor options v2.1. Do not edit by hand. */
(function(root){
  const window={};
${source}
  const items={};
  for(const side of ['neg','pos']){
    let index=0;
    window.LT_OPTIONS[side].categories.forEach(category=>window.LT_OPTIONS[side].items[category].forEach(item=>{
      items['mentor_'+side+'_'+String(++index).padStart(2,'0')]={...item,category};
    }));
  }
  const api={VERSION:'mentor-options-v2.1',items,where:window.LT_WHERE,who:window.LT_WHO,
    options:window.LT_OPTIONS,whereEco:window.LT_whereEco,whoTie:window.LT_whoTie,
    controlFromWhy:window.LT_controlFromWhy,turnFromHow:window.LT_turnFromHow,
    ongoingFromHow:window.LT_ongoingFromHow,midFromHow:window.LT_midFromHow,
    howFromPath:window.LT_howFromPath,thetaFromWeight:window.LT_thetaFromWeight,deltaFromR:window.LT_deltaFromR};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MentorReference=api;
})(typeof window!=='undefined'?window:globalThis);
`;
fs.writeFileSync(path.join(__dirname,'mentor-reference.js'),output);
console.log('Isolated original mentor reference tables and converters.');
