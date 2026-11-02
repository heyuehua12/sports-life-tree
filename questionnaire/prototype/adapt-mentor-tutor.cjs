// Extract the mentor's actual nine-cell demonstration and practice task.
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../../reference_notes/mentor-experiment.js'),'utf8').replace(/\r\n/g,'\n');
const start = source.indexOf('    const tutorPuzzle = {');
const end = source.indexOf('    const teachLoop = {', start);
if (start < 0 || end < 0) throw new Error('Mentor tutorial source not found');
let puzzle = source.slice(start,end).replace('      type: jsPsychHtmlButtonResponse,\n','');
// Save actual attempts; incomplete or cancelled strokes never become success.
puzzle = puzzle.replace('              paintUser(pathD(samples), "bad");', '              reportProgress();\n              paintUser(pathD(samples), "bad");');
puzzle = puzzle.replace('            unlock();', '            unlock();\n            reportProgress();');
puzzle = puzzle.replace('          const onDrawDown = (e) => {', '          let retryTimer = null;\n          const onDrawDown = (e) => {');
puzzle = puzzle.replace('            if (stats.t_first_down == null)', '            if (retryTimer != null) { clearTimeout(retryTimer); retryTimer = null; }\n            if (stats.t_first_down == null)');
puzzle = puzzle.replace('              setTimeout(() => { if (!passed) clearDrawMarks(); }, 700);', '              retryTimer = setTimeout(() => { if (!passed) clearDrawMarks(); retryTimer = null; }, 700);');
// Reduced motion keeps the same demonstration path and target sequence static.
puzzle = puzzle.replace('            guideTimer = setInterval(() => {', `            if (reducedMotion) {
              TARGET.forEach(t => markCell(t.id, 'is-ok'));
              return;
            }
            guideTimer = setInterval(() => {`);
// Pointer ownership, cancellation and keyboard operation use the same grader.
puzzle = puzzle.replace('            drawing = { samples: [p], cells: [], loopHint: false };', '            drawing = { pointerId: e.pointerId, samples: [p], cells: [], loopHint: false };');
puzzle = puzzle.replace('            if (stage === "guide") { enterDraw(); return; }\n            if (stage !== "draw" || passed) return;', '            if (e.isPrimary === false || (e.pointerType === "mouse" && e.button !== 0)) return;\n            if (stage === "guide") { enterDraw(); return; }\n            if (stage !== "draw" || passed || drawing) return;');
puzzle = puzzle.replaceAll('            if (!drawing || passed || stage !== "draw") return;', '            if (!drawing || drawing.pointerId !== e.pointerId || passed || stage !== "draw") return;');
puzzle = puzzle.replace('          svg.addEventListener("pointercancel", () => {', '          svg.addEventListener("pointercancel", (e) => {\n            if (drawing && drawing.pointerId !== e.pointerId) return;');
puzzle = puzzle.replace('          startGuide();', `          svg.setAttribute('tabindex','0');
          svg.setAttribute('aria-label','不好的事练习区。可用鼠标或触屏画线。键盘：空格进入练习并落笔，方向键移动，回车结束。');
          let keyboardPoint = {x:156,y:210}, keyboardDrawing = false;
          const cursor = mk('circle',{cx:156,cy:210,r:7,fill:'none',stroke:'#344e43','stroke-width':2,visibility:'hidden','pointer-events':'none'});
          svg.appendChild(cursor);
          const keyboardEvent = () => {
            const bounds = svg.getBoundingClientRect();
            return {clientX:bounds.left+keyboardPoint.x/VW*bounds.width,clientY:bounds.top+keyboardPoint.y/VH*bounds.height,pointerId:42,preventDefault(){}};
          };
          svg.addEventListener('keydown',e=>{
            if(passed)return;
            if(![' ','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.key))return;
            e.preventDefault();cursor.setAttribute('visibility','visible');
            if(e.key==='Escape'){drawing=null;keyboardDrawing=false;clearDrawMarks();return;}
            if(e.key===' '){
              if(stage==='guide'){enterDraw();return;}
              if(stage==='draw'&&!keyboardDrawing){keyboardPoint={x:156,y:210};onDrawDown(keyboardEvent());keyboardDrawing=true;}
            }else if(e.key==='Enter'){
              if(keyboardDrawing)onDrawUp(keyboardEvent());keyboardDrawing=false;
            }else{
              const step= e.shiftKey ? 7 : 14;
              keyboardPoint.x=Math.max(40,Math.min(270,keyboardPoint.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)));
              keyboardPoint.y=Math.max(34,Math.min(246,keyboardPoint.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)));
              if(keyboardDrawing)onDrawMove(keyboardEvent());
            }
            cursor.setAttribute('cx',keyboardPoint.x);cursor.setAttribute('cy',keyboardPoint.y);
          });
          svg.addEventListener('lostpointercapture',()=>{if(drawing){drawing=null;keyboardDrawing=false;clearDrawMarks();}});
          startGuide();`);
const output = `/* Generated from mentor-experiment.js, life-tree v3.6.3.
 * Nine-cell geometry, demo path and sequence grading are retained.
 * Adapter adds lifecycle cleanup, saved attempts, reduced motion and keyboard input.
 */
(function(root){
  const VERSION='mentor-tree-puzzle-v3.6.3';
  let stop=()=>{};
  function dispose(){stop();stop=()=>{};}
  function render({host,onProgress=()=>{},onComplete}){
    dispose();
    const NEG='#2D8B4A';
    const sessionId='tutor-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
    const reducedMotion=typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers=new Set();
    const setTimeout=(fn,ms)=>{const id=root.setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
    const clearTimeout=id=>{root.clearTimeout(id);timers.delete(id);};
    const setInterval=(fn,ms)=>{const id=root.setInterval(fn,ms);timers.add(id);return id;};
    const clearInterval=id=>{root.clearInterval(id);timers.delete(id);};
    stop=()=>{timers.forEach(id=>{root.clearTimeout(id);root.clearInterval(id);});timers.clear();};
    const snapshot=()=>{
      const data={};tutorPuzzle.on_finish(data);
      return {version:VERSION,session_id:sessionId,success:data.tutor_success,attempts:data.tutor_n_attempt,failures:data.tutor_n_fail,
        fail_codes:data.tutor_fail_codes,path_cells:data.tutor_path_cells,path_n:data.tutor_path_n,
        path_xy:data.tutor_path_xy,guide_ms:data.tutor_guide_ms,draw_ms:data.tutor_draw_ms,dwell_ms:data.tutor_page_dwell_ms};
    };
    const reportProgress=()=>onProgress(snapshot());
${puzzle}
    host.innerHTML=tutorPuzzle.stimulus+'<div class="practice-controls"><button type="button" class="secondary-button" id="tutorReplay">重新看示范</button><button type="button" class="primary-button lt-tutor-done" disabled aria-disabled="true">练习通过后，开始画树</button></div>';
    host.querySelector('#tutorReplay').addEventListener('click',()=>{onProgress(snapshot());render({host,onProgress,onComplete});});
    host.querySelector('.lt-tutor-done').addEventListener('click',()=>{
      const data=snapshot();if(!data.success)return;onProgress(data);dispose();onComplete(data);
    });
    tutorPuzzle.on_load();
  }
  root.LifeTreeTutor={VERSION,render,dispose};
})(typeof window!=='undefined'?window:globalThis);
`;
fs.writeFileSync(path.join(__dirname,'mentor-tutor.js'),output);
console.log('Mentor demonstration and nine-cell practice rebuilt.');
