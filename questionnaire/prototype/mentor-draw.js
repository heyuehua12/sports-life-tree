/* Drawing core extracted from supplied life-timeline plugin (hosted v3.6.3).
 * Visuals, logarithmic impact mapping and sequential strokes are retained.
 * Local changes are documented in README.md and adapt-mentor-draw.cjs.
 */
(function () {
  "use strict";
  const POS = "#7B2D8B", NEG = "#2D8B4A";
  const VW = 360, VH = 540, TX = 204, TY0 = 500, TY1 = 46;
  /**
   * 半径像素 = R0 · 2^(2s)，s=0/0.5/1 → 半径 1:2:4 → 面积 1:4:16（分析用）。
   * 存储 r∈[0,1]；受试者只说「影响小 / 中 / 大」，不说「面」。
   */
  const R0 = 30;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const pixFromR = (r) => R0 * Math.pow(2, 2 * clamp01(r));
  const rFromPix = (pix) => {
    const p = Math.max(R0 * 0.85, Math.abs(pix));
    return clamp01(Math.log2(p / R0) / 2);
  };
  const strokeFromR = (r) => 1.2 + 7.5 * clamp01(r);
  const nodeFromR = (r) => 2.8 + 7.0 * clamp01(r);


  window.MentorLifeTree = class {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    _el(tag, attrs, text) {
      const e = document.createElement(tag);
      Object.entries(attrs || {}).forEach(([k, v]) => {
        if (k === "className") e.className = v;
        else if (k === "html") e.innerHTML = v;
        else e.setAttribute(k, v);
      });
      if (text != null) e.textContent = text;
      return e;
    }


    _draw(display_element, trial) {
      const t0 = performance.now();
      const maxAge = trial.max_age;
      const isFocal = !!trial.is_focal_now;
      // 按勾选顺序（时间从早到晚）；兼容 selected_items 被序列化成 JSON 字符串
      let rawSel = trial.selected_items;
      if (typeof rawSel === "string") {
        try { rawSel = JSON.parse(rawSel); } catch (err) { rawSel = []; }
      }
      if (!Array.isArray(rawSel)) rawSel = [];
      const pool = rawSel.map((it, i) => {
        const valence = Number(it && it.valence) < 0 ? -1 : 1;
        const item_key = it && it.item_key != null ? String(it.item_key) : ("事件" + (i + 1));
        const is_custom = !!(it && (it.is_custom || it.domain === "自填" || /^自填：/.test(item_key)));
        return Object.assign({}, it, {
          item_key,
          valence,
          domain: (it && it.domain) || (is_custom ? "自填" : "未分类"),
          is_custom,
          custom_text: (it && it.custom_text) || (is_custom ? item_key.replace(/^自填：/, "") : null),
          select_order: it && it.select_order != null ? Number(it.select_order) : (i + 1),
        });
      }).sort((a, b) => (a.select_order || 0) - (b.select_order || 0));
      pool.forEach((it, i) => {
        if (it.select_order == null || !Number.isFinite(it.select_order)) it.select_order = i + 1;
      });
      const prior = (trial.prior_events || []).slice();
      const usedKeys = new Set(prior.map((e) => e.item_key));
      const events = prior.slice();
      let nextId = events.reduce((m, e) => Math.max(m, e.event_id || 0), 0) + 1;
      let activeItem = null;
      let drawing = null; // { samples, start }

      // 现在岁映射略低于树梢，端点圆不压「现在」字；树干仍画到 TY1
      const Y_NOW = TY1 + 18;
      // path_ar：无 smooth。指针原始采样（≥2px）→ [age,r]；仅 >32 点时按弧长均匀抽稀（线性插值）
      const PATH_AR_MAX = 32;
      const yAge = (a) => TY0 - (a / maxAge) * (TY0 - Y_NOW);
      const ageFromY = (y) => Math.max(0, Math.min(maxAge, Math.round(((TY0 - y) / (TY0 - Y_NOW)) * maxAge)));
      const ageFromYCont = (y) => {
        const a = ((TY0 - y) / (TY0 - Y_NOW)) * maxAge;
        return Math.max(0, Math.min(maxAge, Math.round(a * 10) / 10));
      };
      const xFromR = (r, valence) => TX + valence * pixFromR(r);
      const rFromX = (x) => {
        const pix = Math.abs(x - TX);
        if (pix < R0 * 0.9) return Math.max(0.02, (pix / R0) * 0.12);
        return Math.max(0.05, rFromPix(pix));
      };
      /** 左(坏事)=-1，右(好事)=+1；树干上归入右侧 */
      const sideFromX = (x) => (x < TX ? -1 : 1);
      /** 起点必须落在勾选归属侧：坏事左、好事右；过近树干时略推开 */
      const clampOnsetX = (x, valence) => {
        const gap = Math.max(2, R0 * 0.55);
        if (valence < 0) return Math.min(x, TX - gap);
        if (valence > 0) return Math.max(x, TX + gap);
        return x;
      };
      /** 从采样推侧别与第一次跨干点（年龄 / |r|） */
      const crossMetaFromSamples = (samples) => {
        if (!samples || samples.length < 2) {
          return {
            side_then: null, side_now: null, cross_axis: false,
            age_cross: null, r_cross: null,
          };
        }
        const side_then = sideFromX(samples[0].x);
        const side_now = sideFromX(samples[samples.length - 1].x);
        let age_cross = null;
        let r_cross = null;
        if (side_then !== side_now) {
          let prev = side_then;
          for (let i = 1; i < samples.length; i++) {
            const s = sideFromX(samples[i].x);
            if (s !== prev) {
              age_cross = ageFromYCont(samples[i].y);
              r_cross = Math.round(rFromX(samples[i].x) * 1000) / 1000;
              break;
            }
            prev = s;
          }
        }
        return {
          side_then,
          side_now,
          cross_axis: side_then !== side_now,
          age_cross,
          r_cross,
        };
      };
      /** 像素采样 → [[age, r_signed], …]；r_signed=side×|r|；年龄强制非降；≤PATH_AR_MAX */
      const packPathAR = (samples) => {
        if (!samples || samples.length < 2) return null;
        const raw = [];
        let ageFloor = 0;
        for (let i = 0; i < samples.length; i++) {
          const p = samples[i];
          let age = ageFromYCont(p.y);
          if (age < ageFloor) age = ageFloor;
          ageFloor = age;
          const rAbs = clamp01(rFromX(p.x));
          const r = Math.round(sideFromX(p.x) * rAbs * 1000) / 1000;
          const prev = raw[raw.length - 1];
          if (prev && prev[0] === age && prev[1] === r) continue;
          raw.push([age, r, p.x, p.y]);
        }
        if (raw.length < 2) return null;
        if (raw.length <= PATH_AR_MAX) {
          return raw.map((q) => [q[0], q[1]]);
        }
        let total = 0;
        const cum = [0];
        for (let i = 1; i < raw.length; i++) {
          total += Math.hypot(raw[i][2] - raw[i - 1][2], raw[i][3] - raw[i - 1][3]);
          cum.push(total);
        }
        if (total < 1e-6) return [[raw[0][0], raw[0][1]], [raw[raw.length - 1][0], raw[raw.length - 1][1]]];
        const out = [];
        for (let k = 0; k < PATH_AR_MAX; k++) {
          const target = (k / (PATH_AR_MAX - 1)) * total;
          let j = 1;
          while (j < cum.length && cum[j] < target) j++;
          const i0 = Math.max(1, j) - 1;
          const i1 = Math.min(raw.length - 1, j);
          const span = cum[i1] - cum[i0] || 1;
          const t = (target - cum[i0]) / span;
          const age = Math.round((raw[i0][0] + (raw[i1][0] - raw[i0][0]) * t) * 10) / 10;
          const r = Math.round((raw[i0][1] + (raw[i1][1] - raw[i0][1]) * t) * 1000) / 1000;
          const last = out[out.length - 1];
          if (!last || last[0] !== age || last[1] !== r) out.push([age, r]);
        }
        const lastRaw = raw[raw.length - 1];
        const lastOut = out[out.length - 1];
        if (!lastOut || lastOut[0] !== lastRaw[0] || lastOut[1] !== lastRaw[1]) {
          out.push([lastRaw[0], lastRaw[1]]);
        }
        return out;
      };
      const STAGES = [["学前", 0, 5], ["小学", 6, 11], ["初中", 12, 14], ["高中", 15, 17], ["大学及以后", 18, 99]];

      display_element.innerHTML = "";
      display_element.classList.add("lt-draw-host");
      const root = this._el("div", { className: "lt-root lt-draw-root lt-tone-neg" });
      // 顶栏 sticky：幕 + 当前事件 + 撤销（手机窄屏：控件上移，把高度留给树）
      const sticky = this._el("div", { className: "lt-sticky-head lt-sticky-draw" });
      sticky.appendChild(this._el("div", { className: "lt-act-banner" },
        isFocal ? "第二幕" : "补画"));
      const stickyTask = this._el("p", { className: "lt-sticky-task" });
      sticky.appendChild(stickyTask);
      const undoBtn = this._el("button", {
        type: "button",
        className: "lt-btn lt-sticky-undo",
        title: "撤销上一条轨迹",
      }, "撤销");
      sticky.appendChild(undoBtn);
      root.appendChild(sticky);
      const drawMsg = this._el("p", { className: "lt-msg lt-draw-msg" });
      root.appendChild(drawMsg);

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
      svg.setAttribute("class", "lt-svg");
      svg.style.touchAction = "none";
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', '生命树：纵向为年龄，左绿为负向，右紫为正向，离树干越远影响越大');
      drawMsg.id = 'drawStatus';
      drawMsg.setAttribute('role', 'status');
      const mk = (tag, attrs, text) => {
        const e = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        if (text != null) e.textContent = text;
        return e;
      };
      root.appendChild(svg);

      // 主画幕：不铺整表芯片（与 sticky 重复），只预告后面几件；补画幕仍用点选
      const pick = this._el("div", { className: "lt-pick lt-pick-draw" });
      root.appendChild(pick);

      const fireStageBack = (to) => {
        if (typeof trial.on_stage_back === "function") trial.on_stage_back(to);
      };

      const undoBar = this._el("div", { className: "lt-bar lt-draw-foot" });
      if (trial.allow_stage_back && trial.stage_back_to) {
        const stageBack = this._el("button", { type: "button", className: "lt-btn lt-stage-back" },
          trial.stage_back_label || "返回上一阶段");
        stageBack.addEventListener("click", () => {
          display_element.classList.remove("lt-draw-host");
          fireStageBack(trial.stage_back_to);
          display_element.innerHTML = "";
          this.jsPsych.finishTrial({
            mode: "draw",
            go_back: trial.stage_back_to,
            events: [],
            n_trajectories: 0,
            rt: Math.round(performance.now() - t0),
          });
        });
        undoBar.appendChild(stageBack);
      }
      const done = this._el("button", { className: "lt-btn lt-primary", type: "button" },
        trial.allow_skip ? "画完了 / 结束补画" : "这些画完了，继续");
      undoBar.appendChild(done);
      root.appendChild(undoBar);
      display_element.appendChild(root);

      undoBtn.addEventListener("click", () => {
        if (!events.length) {
          drawMsg.textContent = "还没有可撤销的线。";
          return;
        }
        const last = events.pop();
        if (trial.on_change) trial.on_change(events);
        usedKeys.delete(last.item_key);
        activeItem = null;
        drawing = null;
        drawMsg.textContent = "已撤销：「" + (last.display_label || pool.find((it) => it.item_key === last.item_key)?.display_label || last.item_key) + "」。请重新画。";
        refreshPick();
        redraw();
      });

      const available = () => pool.filter((it) => !usedKeys.has(it.item_key));
      const nextInOrder = () => {
        const avail = available();
        if (!avail.length) return null;
        return avail.slice().sort((a, b) => (a.select_order || 0) - (b.select_order || 0))[0];
      };

      const refreshPick = () => {
        pick.innerHTML = "";
        const next = nextInOrder();
        // 主画幕强制按勾选顺序；补画幕也优先下一件
        if (!activeItem || (activeItem && usedKeys.has(activeItem.item_key))) {
          activeItem = next;
        } else if (isFocal && next && activeItem.item_key !== next.item_key) {
          activeItem = next;
        }
        const toneIt = activeItem || next;
        root.className = "lt-root lt-draw-root lt-tone-" +
          (toneIt && toneIt.valence > 0 ? "pos" : "neg");
        // 顶栏：本页任务 = 当前事件
        if (next) {
          const sideHint = next.valence > 0 ? "从右边起笔，按住拖到「现在」" : "从左边起笔，按住拖到「现在」";
          const label = String(next.display_label || next.item_key || "").replace(/^自填：/, "");
          const tag = next.is_custom ? "自填 · " : "";
          stickyTask.textContent =
            `当前第 ${next.select_order || "?"} 件：${next.valence > 0 ? "＋" : "－"} ${tag}${label}（${sideHint}）`;
        } else {
          stickyTask.textContent = "本轮已画完 · 可继续或返回加勾";
        }
        const avail = available()
          .slice()
          .sort((a, b) => (a.select_order || 0) - (b.select_order || 0));
        const nAll = events.length;
        const nTarget = trial.suggest_max || trial.suggest_min || avail.length + nAll;

        if (isFocal) {
          // 主画幕：当前件已在 sticky；下面只预告后面最多 3 件 + 进度
          const rest = next
            ? avail.filter((it) => it.item_key !== next.item_key).slice(0, 3)
            : [];
          const queue = this._el("div", { className: "lt-draw-queue" });
          const prog = this._el("span", { className: "lt-draw-prog" },
            `已画 ${nAll}/${nTarget}`);
          queue.appendChild(prog);
          if (!avail.length) {
            queue.appendChild(this._el("span", { className: "lt-muted" },
              nAll >= trial.suggest_min
                ? " · 本轮已画完，可点下方继续"
                : " · 条数不够，请返回加勾"));
          } else if (rest.length) {
            const bits = rest.map((it) => {
              const label = String(it.display_label || it.item_key || "").replace(/^自填：/, "");
              return `${it.select_order || "·"}${it.valence > 0 ? "＋" : "－"}${label}`;
            });
            queue.appendChild(this._el("span", { className: "lt-muted" },
              " · 后面：" + bits.join(" · ")));
          }
          pick.appendChild(queue);
        } else {
          const chips = this._el("div", { className: "lt-chips" });
          if (!avail.length) {
            chips.appendChild(this._el("span", { className: "lt-muted" },
              events.length >= trial.suggest_min
                ? "已画完。可返回加勾，或点下方继续。"
                : "条数不够，请返回加勾。"));
          }
          avail.forEach((it) => {
            const isNext = next && it.item_key === next.item_key;
            const label = String(it.display_label || it.item_key || "").replace(/^自填：/, "");
            const tag = it.is_custom ? "自填·" : "";
            const b = this._el("button", {
              type: "button",
              className: "lt-chip" + (activeItem && activeItem.item_key === it.item_key ? " on" : "")
                + (isNext ? " lt-chip-next" : ""),
            }, `${it.select_order || "·"}. ${it.valence > 0 ? "＋" : "－"} ${tag}${label}`);
            b.style.borderColor = it.valence > 0 ? POS : NEG;
            b.addEventListener("click", () => {
              activeItem = it;
              drawMsg.textContent = "";
              refreshPick();
            });
            chips.appendChild(b);
          });
          pick.appendChild(chips);
        }
      };

      const redraw = () => {
        svg.innerHTML = "";
        // 顶栏两行：①不好｜影响量｜好事 ②小/中/大（1:2:4），避免「大」压「好事」
        const HDR = 62;
        const Y_TOP = 20; // 与「不好／好事／影响量」共用基线
        // 底图分层（纯色，手机可靠）
        svg.appendChild(mk("rect", { x: 0, y: 0, width: VW, height: HDR, fill: "#e8f0ea" }));
        svg.appendChild(mk("rect", { x: 0, y: HDR, width: VW, height: TY0 - HDR, fill: "#f6faf7" }));
        // 学段交替浅带；学段名逆时针 90°，避免「大学及以后」横着压年龄刻度
        STAGES.forEach(([name, a0, a1], k) => {
          if (a0 > maxAge) return;
          const yTop = Math.max(TY1 - 10, yAge(Math.min(a1, maxAge) + 0.5));
          const yBot = Math.min(TY0, yAge(a0 - 0.5));
          svg.appendChild(mk("rect", {
            x: 0, y: yTop, width: VW, height: Math.max(1, yBot - yTop),
            fill: k % 2 ? "#e4efe8" : "#f3f8f4",
          }));
          const sx = 12;
          const sy = (yTop + yBot) / 2;
          const st = mk("text", {
            x: sx, y: sy, "font-size": 10, fill: "#6a736c", "font-weight": 600,
            "text-anchor": "middle", "dominant-baseline": "middle",
            transform: `rotate(-90 ${sx} ${sy})`,
          }, name);
          svg.appendChild(st);
        });
        // 左右语义薄色
        svg.appendChild(mk("rect", {
          x: 0, y: HDR, width: TX - 8, height: TY0 - HDR - 6, fill: "#2D8B4A", opacity: 0.06,
        }));
        svg.appendChild(mk("rect", {
          x: TX + 8, y: HDR, width: VW - TX - 8, height: TY0 - HDR - 6, fill: "#7B2D8B", opacity: 0.06,
        }));
        // 大地
        svg.appendChild(mk("rect", {
          x: 0, y: TY0 - 6, width: VW, height: VH - (TY0 - 6), fill: "#d2c3a8",
        }));
        svg.appendChild(mk("rect", {
          x: 0, y: TY0 - 6, width: VW, height: 8, fill: "#a89068", opacity: 0.5,
        }));

        // 顶行：不好｜影响量｜好事（同一基线；影响量黑字、与「中」同号 20）
        svg.appendChild(mk("circle", { cx: 14, cy: Y_TOP - 4, r: 5.5, fill: NEG }));
        svg.appendChild(mk("text", {
          x: 22, y: Y_TOP, "font-size": 12, fill: NEG, "font-weight": 700,
        }, "不好"));
        svg.appendChild(mk("text", {
          x: TX, y: Y_TOP, "font-size": 20, fill: "#111", "text-anchor": "middle",
          "font-weight": 700,
        }, "影响量"));
        svg.appendChild(mk("circle", { cx: VW - 14, cy: Y_TOP - 4, r: 5.5, fill: POS }));
        svg.appendChild(mk("text", {
          x: VW - 22, y: Y_TOP, "font-size": 12, fill: POS, "font-weight": 700, "text-anchor": "end",
        }, "好事"));

        // 竖线从「小中大」行起，不穿过顶行标题
        [0, 0.5, 1].forEach((rr) => {
          [-1, 1].forEach((s) => {
            const x = TX + s * pixFromR(rr);
            const col = s < 0 ? NEG : POS;
            svg.appendChild(mk("line", {
              x1: x, y1: 28, x2: x, y2: TY0,
              stroke: col,
              "stroke-dasharray": rr >= 0.99 ? "1 0" : "3 5",
              "stroke-width": rr >= 0.99 ? 1.5 : 1.1,
              opacity: rr >= 0.99 ? 0.45 : 0.55,
            }));
          });
        });
        // 第二行：左绿／右紫 小→中→大（10/20/40），与好事分行，不重叠
        [["小", 0, 10], ["中", 0.5, 20], ["大", 1, 40]].forEach(([lab, rr, fs]) => {
          const dx = pixFromR(rr);
          [[-1, NEG], [1, POS]].forEach(([side, col]) => {
            svg.appendChild(mk("text", {
              x: TX + side * dx, y: HDR - 4,
              "font-size": fs, fill: col, "text-anchor": "middle",
              "font-weight": 700, opacity: 0.92,
            }, lab));
          });
        });
        svg.appendChild(mk("text", {
          x: 12, y: TY0 + 26, "font-size": 11, fill: "#5c4a32", "font-weight": 650,
        }, "出生"));

        // 年龄轴（现N 在左侧，不压端点）
        const step = maxAge <= 14 ? 1 : maxAge <= 26 ? 2 : 5;
        for (let a = 0; a < maxAge; a += step) {
          svg.appendChild(mk("line", {
            x1: 58, y1: yAge(a), x2: VW, y2: yAge(a), stroke: "#e3e3e8", "stroke-width": 1,
          }));
          svg.appendChild(mk("text", {
            x: 54, y: yAge(a) + 3, "font-size": 9, fill: "#777", "text-anchor": "end",
          }, String(a)));
        }
        svg.appendChild(mk("line", {
          x1: 58, y1: Y_NOW, x2: VW, y2: Y_NOW, stroke: "#c5d0c8", "stroke-width": 1,
        }));
        svg.appendChild(mk("text", {
          x: 54, y: Y_NOW + 3, "font-size": 10, fill: "#3d4740",
          "text-anchor": "end", "font-weight": 700,
        }, `现${maxAge}`));

        // 树干 + 根
        svg.appendChild(mk("line", {
          x1: TX, y1: TY0, x2: TX, y2: TY1,
          stroke: "#8a6d4b", "stroke-width": 11, "stroke-linecap": "round",
        }));
        svg.appendChild(mk("line", {
          x1: TX, y1: TY0, x2: TX - 20, y2: TY0 + 22,
          stroke: "#6e5533", "stroke-width": 3.5, "stroke-linecap": "round",
        }));
        svg.appendChild(mk("line", {
          x1: TX, y1: TY0, x2: TX + 20, y2: TY0 + 22,
          stroke: "#6e5533", "stroke-width": 3.5, "stroke-linecap": "round",
        }));

        events.forEach((ev) => {
          const col = ev.valence > 0 ? POS : NEG;
          const sideThen = ev.side_then != null ? Number(ev.side_then) : ev.valence;
          const sideNow = ev.side_now != null ? Number(ev.side_now) : ev.valence;
          const x0 = xFromR(Math.abs(Number(ev.r_then)), sideThen);
          const x1 = xFromR(Math.abs(Number(ev.r_now)), sideNow);
          const y0 = yAge(ev.age_start);
          const y1 = ev.age_end != null ? yAge(ev.age_end) : Math.max(Y_NOW, y0 - 28);
          const sw = strokeFromR((Math.abs(Number(ev.r_then)) + Math.abs(Number(ev.r_now))) / 2);
          const n0 = nodeFromR(Math.abs(Number(ev.r_then)));
          const n1 = nodeFromR(Math.abs(Number(ev.r_now)));
          const pathAR = Array.isArray(ev.path_ar) ? ev.path_ar : null;
          if (pathAR && pathAR.length > 1) {
            const d = pathAR.map((pr, i) => {
              const rs = Number(pr[1]);
              const side = Math.sign(rs) || ev.valence;
              const xx = xFromR(Math.abs(rs), side);
              const yy = yAge(pr[0]);
              return (i ? "L" : "M") + xx + " " + yy;
            }).join(" ");
            svg.appendChild(mk("path", {
              d, fill: "none", stroke: col,
              "stroke-width": sw, "stroke-linecap": "round", "stroke-linejoin": "round",
            }));
          } else {
            svg.appendChild(mk("line", {
              x1: x0, y1: y0, x2: x1, y2: y1, stroke: col,
              "stroke-width": sw, "stroke-linecap": "round",
            }));
          }
          svg.appendChild(mk("circle", {
            cx: x0, cy: y0, r: n0, fill: col, stroke: "#fff", "stroke-width": 1.4,
          }));
          svg.appendChild(mk("circle", {
            cx: x1, cy: y1, r: n1, fill: col, stroke: "#fff", "stroke-width": 1.4,
          }));
          svg.appendChild(mk("circle", {
            cx: x1, cy: y1, r: Math.max(1.6, n1 * 0.35), fill: "#fff",
          }));
        });
        if (drawing && drawing.samples.length > 1) {
          const last = drawing.samples[drawing.samples.length - 1];
          const swLive = strokeFromR(rFromX(last.x));
          const d = drawing.samples.map((p, i) => (i ? "L" : "M") + p.x + " " + p.y).join(" ");
          svg.appendChild(mk("path", {
            d, fill: "none", stroke: "#333", "stroke-width": swLive,
            "stroke-dasharray": "5 4", opacity: 0.75, "stroke-linecap": "round",
          }));
        }
      };

      const svgPoint = (e) => {
        const src = e.touches && e.touches[0] ? e.touches[0] : e;
        const matrix = svg.getScreenCTM();
        const point = new DOMPoint(src.clientX, src.clientY).matrixTransform(matrix.inverse());
        return { x: Math.max(0, Math.min(VW, point.x)),
          y: Math.max(Y_NOW, Math.min(TY0, point.y)), t: performance.now() };
      };

      const onDown = (e) => {
        if (!activeItem || drawing || e.isPrimary === false || (e.pointerType === "mouse" && e.button !== 0)) return;
        if (events.filter((ev) => ev._session).length >= trial.hard_max) return;
        e.preventDefault();
        if (svg.setPointerCapture && e.pointerId != null) {
          try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        const p = svgPoint(e);
        // 归属标签是真的：坏事不能从右边（好影响）起笔，好事不能从左边起笔
        const x0 = p.x;
        p.x = clampOnsetX(p.x, activeItem.valence);
        if (Math.abs(p.x - x0) > 1) {
          drawMsg.textContent = activeItem.valence < 0
            ? "不好的事从左边开始画"
            : "好事从右边开始画";
        }
        drawing = { pointerId: e.pointerId, samples: [p], t0: p.t, item: activeItem, loopHint: false, sideHint: false };
        redraw();
      };
      const onMove = (e) => {
        if (!drawing || drawing.pointerId !== e.pointerId) return;
        e.preventDefault();
        const p = svgPoint(e);
        const last = drawing.samples[drawing.samples.length - 1];
        // 禁打圈＝年龄先高再往低折回（y 增大=岁变小）。起点已锁归属侧；之后可跨干。
        if (p.y > last.y + 0.5) {
          if (!drawing.loopHint) {
            drawing.loopHint = true;
            drawMsg.textContent = "";
          }
          p.y = last.y;
        }
        if (Math.hypot(p.x - last.x, p.y - last.y) >= 2) drawing.samples.push(p);
        redraw();
      };
      const onUp = (e) => {
        if (!drawing || drawing.pointerId !== e.pointerId) return;
        e.preventDefault();
        const samples = drawing.samples;
        if (samples.length < 2) {
          drawing = null;
          redraw();
          drawMsg.textContent = "请按住拖出一条线（不要只点一下），自填事件同样要画。";
          return;
        }
        const item = drawing.item;
        // onset valence 来自第一幕勾选；起点强制归属侧，之后可跨干
        const valence = Number(item.valence) < 0 ? -1 : 1;
        samples[0].x = clampOnsetX(samples[0].x, valence);
        const s0 = samples[0], s1 = samples[samples.length - 1];
        const cross = crossMetaFromSamples(samples);
        const r_then = rFromX(s0.x);
        const r_now = rFromX(s1.x);
        const age_start = ageFromY(s0.y);
        let age_end = ageFromY(s1.y);
        if (age_end <= age_start) age_end = null; // tip toward "now" without later age → ongoing span visual only
        let path_len = 0;
        for (let i = 1; i < samples.length; i++) path_len += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
        const press_ms = Math.round(samples[samples.length - 1].t - s0.t);
        let path_ar = packPathAR(samples);
        // 退化笔画：仍用端点落 path_ar，避免自填等事件「看起来画了但无轨迹」
        if (!path_ar || path_ar.length < 2) {
          const a1 = age_end != null ? age_end : maxAge;
          path_ar = [
            [age_start, Math.round(valence * r_then * 1000) / 1000],
            [a1, Math.round(sideFromX(s1.x) * r_now * 1000) / 1000],
          ];
        }

        const nw = typeof window.LT_normObj === "function"
          ? window.LT_normObj(item)
          : { obj_raw: item.obj_raw != null ? item.obj_raw : 90, obj_w: item.obj_w == null ? 0.5 : item.obj_w };
        const thetaObj = typeof window.LT_thetaFromWeight === "function"
          ? window.LT_thetaFromWeight(valence, nw.obj_w)
          : valence * nw.obj_w * Math.PI;
        const ev = {
          event_id: nextId++,
          is_focal_now: isFocal,
          mark_order: events.length + 1,
          select_order: item.select_order != null ? item.select_order : (events.length + 1),
          item_key: item.item_key,
          domain: item.domain,
          valence,
          aslec_a: item.aslec_a || "new",
          obj_raw: nw.obj_raw,
          obj_w: nw.obj_w,
          age_start,
          age_end,
          r_then: Math.round(r_then * 1000) / 1000,
          r_now: Math.round(r_now * 1000) / 1000,
          side_then: cross.side_then,
          side_now: cross.side_now,
          cross_axis: !!cross.cross_axis,
          age_cross: cross.age_cross,
          r_cross: cross.r_cross,
          /** 完整轨迹（年岁, 有符号r）；≤32 点；端点幅度仍以 r_then/r_now 为准 */
          path_ar: path_ar,
          path_ar_n: path_ar ? path_ar.length : 0,
          theta: Math.round(thetaObj * 1000) / 1000,
          drawn_first: isFocal, // Act2 先画波次（流程标记，非分析主变量）
          where: null, who: null, why: null, how: null, ongoing: null,
          where_eco: null, who_tie: null,
          now_salience: null, // 0–1；「现在仍影响大」连续量（主观）
          centrality: null, closeness: null, control_w: null, turn_w: null,
          mid_kind: null, age_mid: null, r_mid: null, // 可选中间转折（第三幕补充）
          is_focal_now: isFocal, // 标注后由 now_salience≥cut 覆盖
          is_custom: !!item.is_custom,
          custom_text: item.custom_text || null,
          def_where: item.def_where || null,
          def_who: item.def_who || null,
          def_why: item.def_why || null,
          def_lock: Array.isArray(item.def_lock) ? item.def_lock.slice() : null,
          press_ms,
          draw_ms: press_ms,
          path_len: Math.round(path_len * 10) / 10,
          path_n: samples.length,
          _session: true,
        };
        if (typeof window.LT_applyItemPresets === "function") {
          window.LT_applyItemPresets(ev, item);
        }
        if (typeof window.LT_applyPathHow === "function") {
          window.LT_applyPathHow(ev);
        } else if (typeof window.LT_applyCrossAxisHow === "function") {
          window.LT_applyCrossAxisHow(ev);
        }
        if (events.length >= trial.hard_max) {
          drawMsg.textContent = `最多 ${trial.hard_max} 条轨迹。`;
          drawing = null;
          redraw();
          return;
        }
        events.push(ev);
        if (trial.on_change) trial.on_change(events);
        usedKeys.add(item.item_key);
        activeItem = null;
        drawing = null;
        drawMsg.textContent = "";
        refreshPick();
        redraw();
      };

      svg.addEventListener("pointerdown", onDown);
      svg.addEventListener("pointermove", onMove);
      svg.addEventListener("pointerup", onUp);
      svg.addEventListener("pointercancel", (e) => {
        if (drawing && drawing.pointerId === e.pointerId) { drawing = null; redraw(); }
      });
      svg.addEventListener("lostpointercapture", () => { if (drawing) { drawing = null; redraw(); } });

      done.addEventListener("click", () => {
        const cleanedAll = events.map((e) => {
          const o = Object.assign({}, e);
          delete o._session;
          return o;
        });
        // 按现在影响 r_now 降序标记 rank（Top）
        const ranked = cleanedAll.slice().sort((a, b) => (b.r_now || 0) - (a.r_now || 0));
        ranked.forEach((e, i) => { e.rank_now = i + 1; });
        const byId = new Map(ranked.map((e) => [e.event_id, e]));
        const cleaned = cleanedAll.map((e) => byId.get(e.event_id) || e);

        const n = cleaned.length;
        const nPos = cleaned.filter((e) => e.valence > 0).length;
        const nNeg = cleaned.filter((e) => e.valence < 0).length;

        if (available().length) {
          drawMsg.textContent = '还有 ' + available().length + ' 件经历未画，请按顺序画完，或返回修改勾选。';
          return;
        }

        if (n > trial.hard_max) {
          drawMsg.textContent = `请控制在 ${trial.hard_max} 条以内。`;
          return;
        }

        display_element.classList.remove("lt-draw-host");
        const data = {
          mode: "draw",
          is_focal_now: isFocal,
          events: cleaned,
          events_json: JSON.stringify(cleaned),
          n_trajectories: cleaned.length,
          n_focal: cleaned.filter((e) => e.is_focal_now).length,
          n_session: events.filter((e) => e._session).length,
          go_back: null,
          rt: Math.round(performance.now() - t0),
        };
        display_element.innerHTML = "";
        this.jsPsych.finishTrial(data);
      });

      refreshPick();
      redraw();
    }


  };
})();
