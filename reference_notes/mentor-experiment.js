/* 生命树 v3.6.3：三幕剧 timeline → 问卷星 onWjxEndPsychopy（知情同意/评估在问卷星页）。 */
(() => {
  const qs = new URLSearchParams(location.search);
  const SUGGEST_MIN = parseInt(qs.get("min") || "4", 10);
  const SUGGEST_MAX = parseInt(qs.get("max") || "10", 10);
  const HARD_MAX = parseInt(qs.get("hard_max") || "10", 10);
  const NEG = "#2D8B4A", POS = "#7B2D8B";
  const TOOL_VERSION = "life-tree-3.6.3";

  function handoffToWjx(jsPsych) {
    if (typeof onWjxEndPsychopy !== "function") {
      console.warn("[LT] onWjxEndPsychopy not found (local preview)");
      return false;
    }
    onWjxEndPsychopy(jsPsych.data.get());
    return true;
  }

  function lastOk(jsPsych, phase) {
    const rows = jsPsych.data.get().filter({ phase }).values()
      .filter((r) => !r.go_back);
    return rows.length ? rows[rows.length - 1] : {};
  }

  function lastAny(jsPsych, phase) {
    const rows = jsPsych.data.get().filter({ phase }).values();
    return rows.length ? rows[rows.length - 1] : {};
  }

  function run(age) {
    const shell = document.getElementById("phone-shell");
    if (shell) shell.remove();
    else {
      const gate = document.getElementById("gate");
      if (gate) gate.remove();
    }
    const inWjx = typeof onWjxEndPsychopy === "function";
    const tSession = performance.now();
    const jsPsych = initJsPsych({ show_progress_bar: false, on_finish: () => {} });

    const shuffleSeed = qs.get("seed")
      ? (parseInt(qs.get("seed"), 10) || 1)
      : ((Date.now() ^ ((Math.random() * 1e9) | 0)) >>> 0) || 1;
    const shuffled = typeof window.LT_shuffleChecklistOptions === "function"
      ? window.LT_shuffleChecklistOptions(window.LT_OPTIONS, shuffleSeed)
      : Object.assign({}, window.LT_OPTIONS, { side_order: ["neg", "pos"], shuffle_seed: shuffleSeed });

    /**
     * 阶段返回：
     * - 画树「返回修改勾选」→ 必须跳过本轮剩余的 act3，再 loop 回 act1
     *   （否则 finishTrial 后仍会接着跑第三幕填详情）
     * - 详情「返回重画」→ ltResume=draw，下一轮跳过 act1
     */
    let ltResume = "checklist"; // checklist | draw
    let coreLoopAgain = false;
    let skipAct3ThisPass = false;
    const onStageBack = (to) => {
      ltResume = to === "draw" ? "draw" : "checklist";
      coreLoopAgain = true;
      if (to === "checklist") skipAct3ThisPass = true;
    };

    jsPsych.data.addProperties({
      session_id: "LT_jspsych_wjx",
      age_now: age,
      tool_version: TOOL_VERSION,
      suggest_min: SUGGEST_MIN,
      suggest_max: SUGGEST_MAX,
      hard_max: HARD_MAX,
      checklist_shuffle_seed: shuffleSeed,
      checklist_side_order: shuffled.side_order || ["neg", "pos"],
    });

    /**
     * 解谜（无纯文字页）：示范动画 + 自画；禁回退打圈（y 不可增大）。
     */
    const tutorPuzzle = {
      type: jsPsychHtmlButtonResponse,
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
          const onDrawDown = (e) => {
            if (stage === "guide") { enterDraw(); return; }
            if (stage !== "draw" || passed) return;
            e.preventDefault();
            if (stats.t_first_down == null) stats.t_first_down = performance.now();
            const p = ptSvg(e);
            drawing = { samples: [p], cells: [], loopHint: false };
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
            if (!drawing || passed || stage !== "draw") return;
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
            if (!drawing || passed || stage !== "draw") return;
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
              paintUser(pathD(samples), "bad");
              setFeedback("再试：一笔从下往上连中→大→小", "bad");
              setTimeout(() => { if (!passed) clearDrawMarks(); }, 700);
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
          };

          svg.addEventListener("pointerdown", onDrawDown, { passive: false });
          svg.addEventListener("pointermove", onDrawMove, { passive: false });
          svg.addEventListener("pointerup", onDrawUp, { passive: false });
          svg.addEventListener("pointercancel", () => {
            if (passed) return;
            drawing = null;
            if (stage === "draw") clearDrawMarks();
          });
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

    const teachLoop = {
      timeline: [tutorPuzzle],
    };

    const act1 = {
      type: jsPsychLifeTimeline,
      mode: "checklist",
      max_age: age,
      options: shuffled,
      examples_html: window.LT_EXAMPLES_HTML,
      suggest_min: SUGGEST_MIN,
      suggest_max: SUGGEST_MAX,
      hard_max: HARD_MAX,
      preselected: () => lastOk(jsPsych, "act1_checklist").checklist_selected
        || lastAny(jsPsych, "act1_checklist").checklist_selected
        || [],
      data: { phase: "act1_checklist" },
    };

    const act2 = {
      type: jsPsychLifeTimeline,
      mode: "draw",
      max_age: age,
      options: shuffled,
      suggest_min: SUGGEST_MIN,
      suggest_max: SUGGEST_MAX,
      hard_max: HARD_MAX,
      is_focal_now: true,
      allow_skip: false,
      allow_stage_back: true,
      stage_back_to: "checklist",
      stage_back_label: "返回修改勾选",
      on_stage_back: onStageBack,
      selected_items: () => lastOk(jsPsych, "act1_checklist").checklist_selected || [],
      // 从第三幕「返回重画」时带回已画轨迹，避免第三幕因 events=[] 被直接跳过
      prior_events: () => (ltResume === "draw"
        ? (lastOk(jsPsych, "act2_draw_focal").events || [])
        : []),
      data: { phase: "act2_draw_focal" },
    };

    const act3 = {
      type: jsPsychLifeTimeline,
      mode: "tags",
      max_age: age,
      options: shuffled,
      act_banner: "第三幕 · 补几句",
      allow_stage_back: true,
      stage_back_to: "draw",
      stage_back_label: "返回重画",
      on_stage_back: onStageBack,
      prior_events: () => lastOk(jsPsych, "act2_draw_focal").events || [],
      data: { phase: "act3_tags" },
    };

    const act1Gate = {
      timeline: [act1],
      conditional_function: () => ltResume === "checklist",
    };

    // 画树若点「返回修改勾选」，本轮不再进第三幕
    const act3Gate = {
      timeline: [act3],
      conditional_function: () => {
        if (skipAct3ThisPass) {
          skipAct3ThisPass = false;
          return false;
        }
        return true;
      },
    };

    const coreLoop = {
      timeline: [act1Gate, act2, act3Gate],
      loop_function: () => {
        if (!coreLoopAgain) {
          ltResume = "checklist";
          skipAct3ThisPass = false;
          return false;
        }
        coreLoopAgain = false;
        // ltResume：draw → 跳过勾选；checklist → 重开勾选（第一幕）
        return true;
      },
    };

    const act4 = {
      type: jsPsychLifeTimeline,
      mode: "draw",
      max_age: age,
      options: shuffled,
      suggest_min: 0,
      suggest_max: SUGGEST_MAX,
      hard_max: HARD_MAX,
      is_focal_now: false,
      allow_skip: true,
      allow_stage_back: false,
      selected_items: () => lastOk(jsPsych, "act1_checklist").checklist_selected || [],
      prior_events: () => lastOk(jsPsych, "act3_tags").events || [],
      data: { phase: "act4_draw_supplement" },
    };

    // 仅当补画幕新增了「未填 where/who/why/how」的线才进入；否则直接进交卷
    const needsNewTags = () => {
      const all = lastOk(jsPsych, "act4_draw_supplement").events || [];
      return all.some((e) => !e.where || !e.who || !e.why || !e.how);
    };
    const act4b = {
      type: jsPsychLifeTimeline,
      mode: "tags",
      max_age: age,
      options: shuffled,
      act_banner: "补标 · 新画的轨迹",
      allow_stage_back: false,
      prior_events: () => {
        const all = lastOk(jsPsych, "act4_draw_supplement").events || [];
        return all.filter((e) => !e.where || !e.who || !e.why || !e.how);
      },
      data: { phase: "act4b_tags_new" },
    };
    const act4bGate = {
      timeline: [act4b],
      conditional_function: needsNewTags,
    };

    const end = {
      type: jsPsychHtmlButtonResponse,
      choices: ["交回问卷并继续"],
      data: { phase: "end" },
      stimulus: () => {
        const a1 = lastOk(jsPsych, "act1_checklist");
        const a4 = lastOk(jsPsych, "act4_draw_supplement");
        const a4b = lastOk(jsPsych, "act4b_tags_new");
        const events = (a4b.events && a4b.events.length)
          ? mergeTagged(a4.events || [], a4b.events)
          : (a4.events || lastOk(jsPsych, "act3_tags").events || []);
        const payload = buildPayload(a1, events, Math.round(performance.now() - tSession));
        jsPsych.data.addProperties({
          life_tree_payload: payload,
          life_tree_payload_json: JSON.stringify(payload),
        });
        const dbg = inWjx ? "" : `<p class="hint">本地预览：上传问卷星后才会交回答卷。汇总：</p><pre class="lt-out">${
          JSON.stringify(payload, null, 1).replace(/&/g, "&amp;").replace(/</g, "&lt;")
        }</pre>`;
        return `<div class="instr">
          <p><strong>完成了</strong>。勾选 ${payload.checklist_neg_n + payload.checklist_pos_n} 件，轨迹 ${payload.n_trajectories} 条。</p>
          <p class="lt-tip lt-tip-strong" style="margin-top:.85rem">提交后需要一点时间加载，请耐心等待，不要反复点击。</p>
          ${dbg}
        </div>`;
      },
      on_finish: () => { handoffToWjx(jsPsych); },
    };

    function mergeTagged(all, taggedSubset) {
      const map = new Map(taggedSubset.map((e) => [e.event_id, e]));
      return all.map((e) => map.get(e.event_id) || e);
    }

    function tutorSummary() {
      const t = lastOk(jsPsych, "tutor_practice");
      return {
        mode: "tree_puzzle",
        page_rt_ms: t.rt != null ? t.rt : (t.page_rt_ms != null ? t.page_rt_ms : null),
        guide_ms: t.tutor_guide_ms != null ? t.tutor_guide_ms : null,
        draw_stroke_ms: t.tutor_draw_ms != null ? t.tutor_draw_ms : null,
        success: !!t.tutor_success,
        n_attempt: t.tutor_n_attempt || 0,
        n_fail: t.tutor_n_fail || 0,
        fail_codes: t.tutor_fail_codes || [],
        path_cells: t.tutor_path_cells || null,
        path_n: t.tutor_path_n || 0,
        path_xy: t.tutor_path_xy || null,
      };
    }

    function buildPayload(a1, events, rtTotal) {
      const checklist = a1.checklist_selected || [];
      return {
        checklist_selected: checklist,
        checklist_neg_n: a1.checklist_neg_n || checklist.filter((x) => x.valence < 0).length,
        checklist_pos_n: a1.checklist_pos_n || checklist.filter((x) => x.valence > 0).length,
        checklist_shuffle_seed: shuffleSeed,
        checklist_side_order: shuffled.side_order || ["neg", "pos"],
        events,
        n_trajectories: events.length,
        n_focal: events.filter((e) => e.is_focal_now).length,
        tutor: tutorSummary(),
        rt_total_ms: rtTotal,
        timed_out: false,
        age_now: age,
        tool_version: TOOL_VERSION,
      };
    }

    // 练习 → 正式作答 → 交卷（知情同意 / App 评估在问卷星页设计）
    jsPsych.run([teachLoop, coreLoop, act4, act4bGate, end]);
  }

  window.ltRun = run;
})();

