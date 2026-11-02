/* Generated from mentor-experiment.js, life-tree v3.6.3.
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
    const tutorPuzzle = {
      choices: ["继续"],
      button_html: () =>
        `<button type="button" class="jspsych-btn lt-tutor-done" disabled aria-disabled="true">继续</button>`,
      data: { phase: "tutor_practice", tutor_page: "tree_puzzle" },
      stimulus: `
        <div class="instr lt-tutor lt-tutor-puzzle" id="lt-tutor-root">
          <div class="lt-sticky-head lt-sticky-tutor">
            <div class="lt-act-banner" id="lt-tutor-badge">解谜</div>
            <p class="lt-sticky-task" id="lt-tutor-status">假设失恋的影响是先中等，再大，最后变小。那么如何用一根轨迹描绘这个过程？</p>
          </div>
          <p class="lt-tutor-feedback" id="lt-tutor-feedback" aria-live="polite">看示范 · 点一下后自己画</p>
          <ol class="lt-ex-strip" id="lt-ex-strip" aria-label="例子提示">
            <li id="lt-ex-1" data-step="1">① 当时·中</li>
            <li id="lt-ex-2" data-step="2">② 后来·大</li>
            <li id="lt-ex-3" data-step="3">③ 现在·小</li>
          </ol>
          <div class="lt-puzzle-board" id="lt-tutor-hit">
            <svg id="lt-tutor-svg" class="lt-svg lt-puzzle-svg" viewBox="0 0 300 260" width="100%" aria-label="不好的事练习区"></svg>
          </div>
        </div>`,
      on_load: () => {
        const wire = () => {
          const root = document.getElementById("lt-tutor-root");
          const board = document.getElementById("lt-tutor-hit");
          const svg = document.getElementById("lt-tutor-svg");
          const badge = document.getElementById("lt-tutor-badge");
          const feedback = document.getElementById("lt-tutor-feedback");
          const doneBtn = document.querySelector(".lt-tutor-done");
          if (!root || !board || !svg || !doneBtn) return false;
          if (root.dataset.ltWired === "1") return true;
          root.dataset.ltWired = "1";

          // 等距九宫；标签经 bbox 重叠检查后再落位（禁止标题与「大」撞车）
          const VW = 300, VH = 260, TX = 286;
          const CELL_R = 22;
          const COL_X = [86, 156, 226]; // 大 中 小
          const ROWS = [
            { key: "now", y: 62, row: 0, label: "现在" },
            { key: "mid", y: 136, row: 1, label: "后来" },
            { key: "then", y: 210, row: 2, label: "当时" },
          ];
          const magLabs = ["大", "中", "小"];
          const xOf = (ci) => COL_X[ci];
          const TARGET = [
            { id: "r2c1", ci: 1, y: ROWS[2].y, step: 1, label: "当时·中" },
            { id: "r1c0", ci: 0, y: ROWS[1].y, step: 2, label: "后来·大" },
            { id: "r0c2", ci: 2, y: ROWS[0].y, step: 3, label: "现在·小" },
          ];
          const ns = "http://www.w3.org/2000/svg";
          const mk = (tag, attrs, text) => {
            const e = document.createElementNS(ns, tag);
            Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
            if (text != null) e.textContent = text;
            return e;
          };
          /** 粗估文字框；CJK ≈ fontSize 宽 */
          const textBox = (t, x, y, fs, anchor) => {
            const w = String(t).length * fs * 0.95;
            const h = fs * 1.15;
            let x0 = x;
            if (anchor === "middle") x0 = x - w / 2;
            if (anchor === "end") x0 = x - w;
            return { x0, y0: y - fs * 0.85, x1: x0 + w, y1: y + h * 0.25, t, x, y, fs, anchor };
          };
          const overlaps = (a, b, pad) =>
            !(a.x1 + pad < b.x0 || b.x1 + pad < a.x0 || a.y1 + pad < b.y0 || b.y1 + pad < a.y0);
          const placeNoOverlap = (cand, placed, pad) => {
            let box = textBox(cand.t, cand.x, cand.y, cand.fs, cand.anchor || "start");
            let guard = 0;
            while (placed.some((p) => overlaps(box, p, pad)) && guard < 12) {
              box = textBox(cand.t, box.x, box.y - (cand.fs * 0.9), cand.fs, cand.anchor || "start");
              guard += 1;
            }
            if (placed.some((p) => overlaps(box, p, pad))) {
              console.warn("[LT puzzle] label overlap unresolved:", cand.t);
            }
            placed.push(box);
            return box;
          };

          let stage = "guide"; // guide | draw | done — 无点选，只画轨迹
          let drawing = null;
          let passed = false;
          const stats = {
            t0: performance.now(),
            t_pick_done: null,
            t_guide_end: null,
            t_first_down: null,
            t_success: null,
            n_attempt: 0,
            n_fail: 0,
            n_pick_fail: 0,
            fail_codes: [],
            success: false,
            path_cells: null,
            path_n: 0,
            path_xy: null,
          };
          root._ltTutorStats = stats;

          const setFeedback = (text, tone) => {
            if (!feedback) return;
            feedback.textContent = text || "";
            feedback.classList.remove("lt-tutor-ok", "lt-tutor-bad");
            if (text && tone === "ok") feedback.classList.add("lt-tutor-ok");
            if (text && tone === "bad") feedback.classList.add("lt-tutor-bad");
          };
          const shakeEx = (step) => {
            const el = document.getElementById("lt-ex-" + step);
            if (!el) return;
            el.classList.remove("is-shake", "is-solved");
            void el.offsetWidth;
            el.classList.add("is-shake", "is-solved");
          };
          const unlock = () => {
            doneBtn.disabled = false;
            doneBtn.removeAttribute("aria-disabled");
            doneBtn.classList.add("lt-tutor-ready");
          };
          const ptSvg = (e) => {
            const rt = svg.getBoundingClientRect();
            const src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
            return {
              x: ((src.clientX - rt.left) / Math.max(1, rt.width)) * VW,
              y: ((src.clientY - rt.top) / Math.max(1, rt.height)) * VH,
            };
          };
          const cellAt = (p) => {
            const g = svg.querySelector("#lt-puzzle-cells");
            if (!g) return null;
            const nodes = g.querySelectorAll("[data-id]");
            for (const n of nodes) {
              const cx = +n.getAttribute("data-cx");
              const cy = +n.getAttribute("data-cy");
              if (Math.hypot(p.x - cx, p.y - cy) <= CELL_R + 6) return n;
            }
            return null;
          };
          const pathD = (samples) => {
            if (!samples.length) return "";
            return samples.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
          };
          const paintUser = (d, tone) => {
            const line = svg.querySelector("#lt-user-line");
            if (!line) return;
            line.setAttribute("d", d || "");
            line.setAttribute("stroke", tone === "bad" ? "#9a3b2f" : NEG);
            line.setAttribute("opacity", d ? "1" : "0");
          };
          const markCell = (id, cls) => {
            const n = svg.querySelector(`[data-id="${id}"]`);
            if (!n) return;
            n.classList.add(cls);
            if (cls === "is-ok") {
              n.setAttribute("fill", NEG);
              n.setAttribute("fill-opacity", "0.35");
              n.setAttribute("stroke", NEG);
            }
            if (cls === "is-bad") {
              n.setAttribute("fill", "#9a3b2f");
              n.setAttribute("fill-opacity", "0.22");
              n.setAttribute("stroke", "#9a3b2f");
            }
          };
          const clearDrawMarks = () => {
            svg.querySelectorAll("#lt-puzzle-cells [data-id]").forEach((n) => {
              n.classList.remove("is-hit", "is-bad", "is-ok");
              n.setAttribute("fill", "#fff");
              n.setAttribute("fill-opacity", "0.75");
              n.setAttribute("stroke", NEG);
            });
            paintUser("");
          };

          // —— 画板：标题不进 SVG 与「大」抢位；列标经重叠检查 ——
          const GRID_L = 40, Y0 = 34, Y1 = 246;
          const placed = [];
          svg.appendChild(mk("rect", { x: 0, y: 0, width: VW, height: VH, fill: "#f4faf6" }));
          ROWS.forEach((tm, k) => {
            const bandH = 68;
            svg.appendChild(mk("rect", {
              x: GRID_L, y: tm.y - bandH / 2, width: TX - GRID_L - 8, height: bandH,
              fill: k % 2 ? "#e8f3ec" : "#f2f8f4", opacity: "0.95",
            }));
            const rowLab = placeNoOverlap(
              { t: tm.label, x: GRID_L - 5, y: tm.y + 4, fs: 11, anchor: "end" },
              placed, 2
            );
            svg.appendChild(mk("text", {
              x: rowLab.x, y: rowLab.y, "font-size": 11, fill: "#3d5c48",
              "font-weight": 750, "text-anchor": "end",
            }, tm.label));
          });
          svg.appendChild(mk("line", {
            x1: TX, y1: Y1, x2: TX, y2: Y0, stroke: "#8a6d4b",
            "stroke-width": 12, "stroke-linecap": "round",
          }));
          // 列标「大中小」优先占位；副标题只放在左上且不得侵入第一列
          magLabs.forEach((lab, ci) => {
            const x = xOf(ci);
            svg.appendChild(mk("line", {
              x1: x, y1: Y0, x2: x, y2: Y1,
              stroke: NEG, "stroke-dasharray": "3 4", "stroke-width": "1.1", opacity: "0.4",
            }));
            const box = placeNoOverlap(
              { t: lab, x, y: 18, fs: 14, anchor: "middle" },
              placed, 3
            );
            svg.appendChild(mk("text", {
              x: box.x, y: box.y, "font-size": 14, fill: NEG, "text-anchor": "middle",
              "font-weight": 800,
            }, lab));
          });
          {
            const cap = "不好的事";
            const maxRight = COL_X[0] - CELL_R - 8;
            let box = placeNoOverlap(
              { t: cap, x: 8, y: 16, fs: 10, anchor: "start" },
              placed, 4
            );
            if (box.x1 > maxRight) {
              // 放不下就不画副标题，避免与「大」重叠（检查失败则省略）
              console.warn("[LT puzzle] skip caption to avoid overlap with 大");
            } else {
              svg.appendChild(mk("text", {
                x: box.x, y: box.y, "font-size": 10, fill: NEG, "font-weight": 700,
              }, cap));
            }
          }

          const cellsG = mk("g", { id: "lt-puzzle-cells" });
          ROWS.forEach((tm) => {
            magLabs.forEach((lab, ci) => {
              const id = `r${tm.row}c${ci}`;
              const cx = xOf(ci);
              const cy = tm.y;
              cellsG.appendChild(mk("circle", {
                "data-id": id,
                "data-cx": String(cx),
                "data-cy": String(cy),
                "data-mag": lab,
                "data-time": tm.key,
                cx, cy, r: CELL_R,
                fill: "#fff", "fill-opacity": "0.75",
                stroke: NEG, "stroke-width": 1.8, "stroke-dasharray": "4 3",
                class: "lt-puzzle-cell",
              }));
              cellsG.appendChild(mk("text", {
                x: cx, y: cy + 4, "font-size": 13, fill: NEG, "text-anchor": "middle",
                "font-weight": 800, "pointer-events": "none",
              }, lab));
            });
          });
          svg.appendChild(cellsG);

          svg.appendChild(mk("path", {
            id: "lt-user-line", d: "", fill: "none", stroke: NEG, "stroke-width": 6,
            "stroke-linecap": "round", "stroke-linejoin": "round", opacity: "0",
          }));
          const guideG = mk("g", { id: "lt-guide-layer", opacity: "0", "pointer-events": "none" });
          const guidePts = TARGET.map((t) => ({ x: xOf(t.ci), y: t.y }));
          const guidePath = mk("path", {
            id: "lt-guide-path", d: pathD(guidePts), fill: "none", stroke: NEG, "stroke-width": 5.5,
            "stroke-linecap": "round", "stroke-linejoin": "round",
            "stroke-dasharray": "10 8", opacity: "0.9",
          });
          guideG.appendChild(guidePath);
          const finger = mk("circle", {
            id: "lt-guide-finger", cx: guidePts[0].x, cy: guidePts[0].y, r: 10,
            fill: NEG, "fill-opacity": "0.9", stroke: "#fff", "stroke-width": 2.5,
          });
          guideG.appendChild(finger);
          svg.appendChild(guideG);

          let guideTimer = null;
          const stopGuideAnim = () => {
            if (guideTimer) { clearInterval(guideTimer); guideTimer = null; }
          };
          const startGuide = () => {
            stage = "guide";
            stats.t_pick_done = performance.now();
            if (badge) badge.textContent = "示范";
            setFeedback("看示范 · 点一下后自己画", "ok");
            guideG.setAttribute("opacity", "1");
            [1, 2, 3].forEach((s) => {
              const el = document.getElementById("lt-ex-" + s);
              if (el) el.classList.remove("is-shake", "is-solved");
            });
            let off = 0;
            const len = guidePath.getTotalLength ? guidePath.getTotalLength() : 200;
            guidePath.style.strokeDasharray = "12 10";
            let t = 0;
            let lastStep = 0;
            stopGuideAnim();
            if (reducedMotion) {
              TARGET.forEach(t => markCell(t.id, 'is-ok'));
              return;
            }
            guideTimer = setInterval(() => {
              t += 0.018;
              if (t > 1) {
                t = 0;
                lastStep = 0;
                [1, 2, 3].forEach((s) => {
                  const el = document.getElementById("lt-ex-" + s);
                  if (el) el.classList.remove("is-shake", "is-solved");
                });
              }
              const p = guidePath.getPointAtLength
                ? guidePath.getPointAtLength(t * len)
                : {
                  x: guidePts[0].x + (guidePts[2].x - guidePts[0].x) * t,
                  y: guidePts[0].y + (guidePts[2].y - guidePts[0].y) * t,
                };
              finger.setAttribute("cx", p.x);
              finger.setAttribute("cy", p.y);
              off = (off + 2) % 22;
              guidePath.style.strokeDashoffset = String(-off);
              // 路过目标格时抖动对应提示（用动画教，不用文字页）
              const stepIdx = Math.min(2, Math.floor(t * 3));
              if (stepIdx + 1 > lastStep) {
                lastStep = stepIdx + 1;
                shakeEx(lastStep);
                markCell(TARGET[stepIdx].id, "is-ok");
              }
            }, 40);
          };
          const enterDraw = () => {
            if (stage !== "guide") return;
            stopGuideAnim();
            guideG.setAttribute("opacity", "0");
            clearDrawMarks();
            [1, 2, 3].forEach((s) => {
              const el = document.getElementById("lt-ex-" + s);
              if (el) el.classList.remove("is-shake", "is-solved");
            });
            stats.t_guide_end = performance.now();
            stage = "draw";
            if (badge) badge.textContent = "画线";
            setFeedback("一笔画上去（不能往回打圈）", "");
          };

          const sameSeq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
          let retryTimer = null;
          const onDrawDown = (e) => {
            if (e.isPrimary === false || (e.pointerType === "mouse" && e.button !== 0)) return;
            if (stage === "guide") { enterDraw(); return; }
            if (stage !== "draw" || passed || drawing) return;
            e.preventDefault();
            if (retryTimer != null) { clearTimeout(retryTimer); retryTimer = null; }
            if (stats.t_first_down == null) stats.t_first_down = performance.now();
            const p = ptSvg(e);
            drawing = { pointerId: e.pointerId, samples: [p], cells: [], loopHint: false };
            clearDrawMarks();
            setFeedback("");
            paintUser(pathD(drawing.samples));
            const cell = cellAt(p);
            if (cell) {
              drawing.cells.push(cell.getAttribute("data-id"));
              cell.classList.add("is-hit");
            }
            try { svg.setPointerCapture(e.pointerId); } catch (err) { /* */ }
          };
          const onDrawMove = (e) => {
            if (!drawing || drawing.pointerId !== e.pointerId || passed || stage !== "draw") return;
            e.preventDefault();
            const p = ptSvg(e);
            const last = drawing.samples[drawing.samples.length - 1];
            // 与正式画树一致：y 增大=往更早折回 → 禁打圈，钳住
            if (p.y > last.y + 0.5) {
              if (!drawing.loopHint) {
                drawing.loopHint = true;
                setFeedback("不能往回画，请往「现在」方向", "bad");
              }
              p.y = last.y;
            }
            if (Math.hypot(p.x - last.x, p.y - last.y) >= 2) {
              drawing.samples.push(p);
              paintUser(pathD(drawing.samples));
            }
            const cell = cellAt(p);
            if (cell) {
              const id = cell.getAttribute("data-id");
              if (drawing.cells[drawing.cells.length - 1] !== id) {
                drawing.cells.push(id);
                cell.classList.add("is-hit");
              }
            }
          };
          const onDrawUp = (e) => {
            if (stage === "guide") { enterDraw(); return; }
            if (!drawing || drawing.pointerId !== e.pointerId || passed || stage !== "draw") return;
            e.preventDefault();
            const seq = drawing.cells.slice();
            const samples = drawing.samples.slice();
            drawing = null;
            stats.n_attempt += 1;
            stats.path_cells = seq.slice();
            const want = TARGET.map((t) => t.id);
            const filtered = seq.filter((id) => want.includes(id));
            const compact = filtered.filter((id, i) => i === 0 || id !== filtered[i - 1]);
            if (!sameSeq(compact, want)) {
              stats.n_fail += 1;
              stats.fail_codes.push(compact.length < 3 ? "too_few" : "wrong_path");
              reportProgress();
              paintUser(pathD(samples), "bad");
              setFeedback("再试：一笔从下往上连中→大→小", "bad");
              retryTimer = setTimeout(() => { if (!passed) clearDrawMarks(); retryTimer = null; }, 700);
              return;
            }
            passed = true;
            stage = "done";
            stats.success = true;
            stats.t_success = performance.now();
            stats.path_n = samples.length;
            const stepN = Math.max(1, Math.ceil(samples.length / 24));
            stats.path_xy = samples
              .filter((_, i) => i % stepN === 0 || i === samples.length - 1)
              .map((pt) => [Math.round(pt.x), Math.round(pt.y)]);
            paintUser(pathD(guidePts), "ok");
            TARGET.forEach((t) => { markCell(t.id, "is-ok"); shakeEx(t.step); });
            if (badge) badge.textContent = "完成";
            setFeedback("对了，可以继续", "ok");
            unlock();
            reportProgress();
          };

          svg.addEventListener("pointerdown", onDrawDown, { passive: false });
          svg.addEventListener("pointermove", onDrawMove, { passive: false });
          svg.addEventListener("pointerup", onDrawUp, { passive: false });
          svg.addEventListener("pointercancel", (e) => {
            if (drawing && drawing.pointerId !== e.pointerId) return;
            if (passed) return;
            drawing = null;
            if (stage === "draw") clearDrawMarks();
          });
          svg.setAttribute('tabindex','0');
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
          startGuide();
          return true;
        };
        if (!wire()) setTimeout(wire, 50);
        setTimeout(wire, 120);
      },
      on_finish: (data) => {
        const root = document.getElementById("lt-tutor-root");
        const stats = (root && root._ltTutorStats) || {};
        data.tutor_ok = true;
        data.tutor_mode = "tree_puzzle";
        data.tutor_success = !!stats.success;
        data.tutor_n_attempt = stats.n_attempt || 0;
        data.tutor_n_fail = stats.n_fail || 0;
        data.tutor_n_pick_fail = stats.n_pick_fail || 0;
        data.tutor_fail_codes = (stats.fail_codes || []).slice();
        data.tutor_path_cells = stats.path_cells || null;
        data.tutor_path_n = stats.path_n || 0;
        data.tutor_path_xy = stats.path_xy || null;
        data.tutor_pick_ms = (stats.t_pick_done != null && stats.t0 != null)
          ? Math.round(stats.t_pick_done - stats.t0) : null;
        data.tutor_guide_ms = (stats.t_guide_end != null && stats.t_pick_done != null)
          ? Math.round(stats.t_guide_end - stats.t_pick_done) : null;
        data.tutor_draw_ms = (stats.t_first_down != null && stats.t_success != null)
          ? Math.round(stats.t_success - stats.t_first_down) : null;
        data.tutor_page_dwell_ms = stats.t0 != null
          ? Math.round(performance.now() - stats.t0) : null;
        data.page_rt_ms = data.rt != null ? data.rt : data.tutor_page_dwell_ms;
      },
    };


    host.innerHTML=tutorPuzzle.stimulus+'<div class="practice-controls"><button type="button" class="secondary-button" id="tutorReplay">重新看示范</button><button type="button" class="primary-button lt-tutor-done" disabled aria-disabled="true">练习通过后，开始画树</button></div>';
    host.querySelector('#tutorReplay').addEventListener('click',()=>{onProgress(snapshot());render({host,onProgress,onComplete});});
    host.querySelector('.lt-tutor-done').addEventListener('click',()=>{
      const data=snapshot();if(!data.success)return;onProgress(data);dispose();onComplete(data);
    });
    tutorPuzzle.on_load();
  }
  root.LifeTreeTutor={VERSION,render,dispose};
})(typeof window!=='undefined'?window:globalThis);
