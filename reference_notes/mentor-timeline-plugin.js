/* life-timeline v3.4：竖版树；r=主观影响；θ=中心性；WWWH preset。
 * 视觉：半径 1:2:4 → 面积 1:4:16（内部）；受试者文案＝影响小→大。
 * 第三幕：树先验 +「后来」与折点融合 + 大触控；中心性必填。 */
var jsPsychLifeTimeline = (function (jspsych) {
  "use strict";
  const info = {
    name: "life-timeline", version: "1.8.0",
    parameters: {
      mode: { type: jspsych.ParameterType.STRING, default: "draw" }, // checklist | draw | tags
      max_age: { type: jspsych.ParameterType.INT, default: 18 },
      options: { type: jspsych.ParameterType.OBJECT, default: {} },
      suggest_min: { type: jspsych.ParameterType.INT, default: 4 },
      suggest_max: { type: jspsych.ParameterType.INT, default: 10 },
      hard_max: { type: jspsych.ParameterType.INT, default: 10 },
      examples_html: { type: jspsych.ParameterType.HTML_STRING, default: "" },
      tip_html: { type: jspsych.ParameterType.HTML_STRING, default: "" },
      selected_items: { type: jspsych.ParameterType.OBJECT, default: [] },
      prior_events: { type: jspsych.ParameterType.OBJECT, default: [] },
      preselected: { type: jspsych.ParameterType.OBJECT, default: [] },
      is_focal_now: { type: jspsych.ParameterType.BOOL, default: true },
      allow_skip: { type: jspsych.ParameterType.BOOL, default: false },
      allow_stage_back: { type: jspsych.ParameterType.BOOL, default: false },
      stage_back_to: { type: jspsych.ParameterType.STRING, default: "" }, // checklist | draw
      stage_back_label: { type: jspsych.ParameterType.STRING, default: "返回上一阶段" },
      on_stage_back: { type: jspsych.ParameterType.FUNCTION, default: null },
      act_banner: { type: jspsych.ParameterType.STRING, default: "" },
    },
    data: {
      events: { type: jspsych.ParameterType.OBJECT },
      checklist_selected: { type: jspsych.ParameterType.OBJECT },
      rt: { type: jspsych.ParameterType.INT },
    },
  };

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

  const labelOcc = (base, occ) => (occ <= 1 ? base : (base + "（第" + occ + "次）"));
  const baseFromKey = (k) => String(k || "").replace(/（第\d+次）$/, "");

  class LifeTimelinePlugin {
    constructor(jsPsych) { this.jsPsych = jsPsych; }

    trial(display_element, trial) {
      const mode = trial.mode || "draw";
      if (mode === "checklist") return this._checklist(display_element, trial);
      if (mode === "tags") return this._tags(display_element, trial);
      return this._draw(display_element, trial);
    }

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

    _checklist(display_element, trial) {
      const t0 = performance.now();
      const OPT = trial.options;
      const selected = new Map(); // uid → item（同一 base 可多条）
      let uidSeq = 0;
      const newUid = () => "u" + (++uidSeq);
      const sideOrder = Array.isArray(OPT.side_order) && OPT.side_order.length
        ? OPT.side_order.slice()
        : ["neg", "pos"];

      display_element.innerHTML = "";
      const root = this._el("div", { className: "lt-root lt-root-wide lt-check-root" });
      const sticky1 = this._el("div", { className: "lt-sticky-head lt-sticky-check" });
      sticky1.appendChild(this._el("div", { className: "lt-act-banner" }, "第一幕"));
      const stickyTask = this._el("p", { className: "lt-sticky-task" },
        `选 ${trial.suggest_min}–${trial.suggest_max} 件（最多 ${trial.hard_max}）· 按发生从早→晚点选`);
      sticky1.appendChild(stickyTask);
      const stickyProg = this._el("div", { className: "lt-sticky-prog" }, `0/${trial.hard_max}`);
      sticky1.appendChild(stickyProg);
      root.appendChild(sticky1);

      // 规则前置：数量 + 时间顺序（未选时也显示）
      const ruleHint = this._el("div", { className: "lt-check-rules" });
      ruleHint.innerHTML =
        `<p><strong>数量：</strong>请选 ${trial.suggest_min}–${trial.suggest_max} 件，最多 ${trial.hard_max} 件；正负两边都要有。</p>` +
        `<p><strong>顺序：</strong>尽量按真实发生从早到晚点；点选顺序＝后面画线顺序。选乱了可在下方<strong>拖动手柄</strong>调整。</p>`;
      root.appendChild(ruleHint);

      const orderBox = this._el("div", { className: "lt-order-box" });
      root.appendChild(orderBox);
      const msg = this._el("p", { className: "lt-msg" });
      root.appendChild(msg);
      const sideHeads = this._el("div", { className: "lt-side-heads" });
      const headNeg = this._el("h3", { className: "lt-section lt-section-neg" }, "不好的事（画左边）· 0");
      const headPos = this._el("h3", { className: "lt-section lt-section-pos" }, "好事（画右边）· 0");
      sideHeads.appendChild(headNeg);
      sideHeads.appendChild(headPos);
      root.appendChild(sideHeads);
      const pairRows = this._el("div", { className: "lt-pair-rows" });
      root.appendChild(pairRows);

      const nextSelectOrder = () => {
        let m = 0;
        selected.forEach((it) => { if ((it.select_order || 0) > m) m = it.select_order; });
        return m + 1;
      };

      const renumberFromList = (uidsInOrder) => {
        uidsInOrder.forEach((uid, i) => {
          const it = selected.get(uid);
          if (it) it.select_order = i + 1;
        });
      };

      const wireOrderDrag = (ol) => {
        let dragLi = null;
        let startY = 0;
        ol.querySelectorAll(".lt-order-item").forEach((li) => {
          const handle = li.querySelector(".lt-order-handle");
          if (!handle) return;
          const onDown = (e) => {
            e.preventDefault();
            dragLi = li;
            startY = e.clientY;
            li.classList.add("is-dragging");
            handle.setPointerCapture(e.pointerId);
          };
          const onMove = (e) => {
            if (!dragLi) return;
            const dy = e.clientY - startY;
            const prev = dragLi.previousElementSibling;
            const next = dragLi.nextElementSibling;
            if (dy < -18 && prev) {
              ol.insertBefore(dragLi, prev);
              startY = e.clientY;
            } else if (dy > 18 && next) {
              ol.insertBefore(next, dragLi);
              startY = e.clientY;
            }
          };
          const onUp = (e) => {
            if (!dragLi) return;
            try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
            dragLi.classList.remove("is-dragging");
            const uids = Array.from(ol.querySelectorAll(".lt-order-item"))
              .map((el) => el.getAttribute("data-uid"))
              .filter(Boolean);
            renumberFromList(uids);
            dragLi = null;
            paintCount();
          };
          handle.addEventListener("pointerdown", onDown);
          handle.addEventListener("pointermove", onMove);
          handle.addEventListener("pointerup", onUp);
          handle.addEventListener("pointercancel", onUp);
        });
      };

      const paintCount = () => {
        let np = 0, nn = 0;
        selected.forEach((v) => { if (v.valence > 0) np++; else nn++; });
        const n = selected.size;
        const needBoth = np < 1 || nn < 1;
        headNeg.textContent = `不好的事（画左边）· ${nn}`;
        headPos.textContent = `好事（画右边）· ${np}`;
        stickyProg.textContent = `${n}/${trial.hard_max}`;
        stickyProg.classList.toggle("is-full", n >= trial.hard_max);
        stickyProg.classList.toggle("is-ok", n >= trial.suggest_min && n <= trial.suggest_max && !needBoth);
        stickyTask.textContent = n >= trial.hard_max
          ? `已满 ${trial.hard_max} 件 · 可取消勾选或拖动改顺序`
          : `选 ${trial.suggest_min}–${trial.suggest_max} 件（最多 ${trial.hard_max}）· 按发生从早→晚点选`;

        const ordered = Array.from(selected.values())
          .slice()
          .sort((a, b) => (a.select_order || 0) - (b.select_order || 0));
        orderBox.innerHTML = "";
        orderBox.appendChild(this._el("div", { className: "lt-label" },
          ordered.length
            ? `已选顺序（早→晚）· ${n} 件 · 拖 ☰ 可改序`
            : "已选顺序（早→晚）· 还没选"));
        if (!ordered.length) {
          orderBox.appendChild(this._el("p", { className: "lt-order-empty" },
            "请从较早发生的事开始勾选；正负都要有。"));
        } else {
          const ol = this._el("ol", { className: "lt-order-list" });
          ordered.forEach((it) => {
            const tone = it.valence > 0 ? "pos" : "neg";
            const li = this._el("li", {
              className: "lt-order-item lt-order-" + tone,
              "data-uid": it.uid,
            });
            const handle = this._el("button", {
              type: "button",
              className: "lt-order-handle",
              "aria-label": "拖动调整顺序",
            }, "☰");
            const txt = this._el("span", { className: "lt-order-txt" },
              (it.valence > 0 ? "＋ " : "－ ") + it.item_key);
            li.appendChild(handle);
            li.appendChild(txt);
            ol.appendChild(li);
          });
          orderBox.appendChild(ol);
          wireOrderDrag(ol);
        }
        if (needBoth && n > 0) {
          msg.textContent = msg.textContent && /最多/.test(msg.textContent)
            ? msg.textContent
            : "提示：好事和不好的事都要至少选 1 件。";
        } else if (msg.textContent && /提示：好事/.test(msg.textContent)) {
          msg.textContent = "";
        }
      };

      const countBase = (valence, base) => {
        let n = 0;
        selected.forEach((it) => {
          if (it.valence === valence && (it.base_item_key || baseFromKey(it.item_key)) === base) n++;
        });
        return n;
      };

      const removeBase = (valence, base) => {
        const kill = [];
        selected.forEach((it, uid) => {
          if (it.valence === valence && (it.base_item_key || baseFromKey(it.item_key)) === base) kill.push(uid);
        });
        kill.forEach((uid) => selected.delete(uid));
      };

      const addOccurrence = (it0, baseKey) => {
        if (selected.size >= trial.hard_max) {
          msg.textContent = `最多 ${trial.hard_max} 件（含重复发生的同一事件）。`;
          return false;
        }
        const occ = countBase(it0.valence, baseKey) + 1;
        const uid = newUid();
        selected.set(uid, Object.assign({}, it0, {
          uid,
          base_item_key: baseKey,
          occurrence: occ,
          item_key: labelOcc(baseKey, occ),
          select_order: nextSelectOrder(),
        }));
        msg.textContent = "";
        paintCount();
        return true;
      };

      const fillDomainCol = (col, block, domain, valence) => {
        const tone = valence < 0 ? "neg" : "pos";
        const items = ((block || {}).items || {})[domain] || [];
        if (!domain || !items.length) {
          col.appendChild(this._el("p", { className: "lt-pair-empty" }, "（本侧无对应条目）"));
          return;
        }
        const box = this._el("div", { className: "lt-matrix-grid" });
        items.forEach((x) => {
          const nw = typeof window.LT_normObj === "function" ? window.LT_normObj(x) : { obj_raw: 90, obj_w: 0.5 };
          const theta = typeof window.LT_thetaFromWeight === "function"
            ? window.LT_thetaFromWeight(valence, nw.obj_w) : valence * nw.obj_w * Math.PI;
          const baseKey = x.t;
          const it0 = {
            domain, valence, aslec_a: x.a || "new",
            obj_raw: nw.obj_raw, obj_w: nw.obj_w, theta, is_custom: false, custom_text: null,
            def_where: x.def_where || null,
            def_who: x.def_who || null,
            def_why: x.def_why || null,
            def_lock: Array.isArray(x.def_lock) ? x.def_lock.slice() : null,
          };
          const id = "ltc_" + (valence + "_" + domain + "_" + baseKey).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_");
          const wrap = this._el("div", { className: "lt-check-wrap" });
          const lab = this._el("label", { className: "lt-check", for: id });
          const cb = this._el("input", { type: "checkbox", id });
          const span = this._el("span", { className: "lt-check-txt" }, x.t);
          const badge = this._el("span", { className: "lt-occ-badge" }, "");
          const again = this._el("button", { type: "button", className: "lt-occ-again" }, "再记一次");
          again.style.display = "none";

          const syncRow = () => {
            const n = countBase(valence, baseKey);
            cb.checked = n > 0;
            badge.textContent = n > 1 ? ("×" + n) : "";
            again.style.display = n > 0 ? "inline-block" : "none";
          };
          wrap._ltSync = syncRow;

          cb.addEventListener("change", () => {
            if (cb.checked) {
              if (!addOccurrence(it0, baseKey)) { cb.checked = false; syncRow(); return; }
            } else {
              removeBase(valence, baseKey);
              paintCount();
            }
            syncRow();
          });
          again.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (!addOccurrence(it0, baseKey)) return;
            syncRow();
          });

          lab.appendChild(cb);
          lab.appendChild(span);
          lab.appendChild(badge);
          wrap.appendChild(lab);
          wrap.appendChild(again);
          box.appendChild(wrap);
        });
        col.appendChild(box);
      };

      // 布局固定：左绿右紫成对一行；side_order 仅记入数据
      const pairs = Array.isArray(OPT.domain_pairs) && OPT.domain_pairs.length
        ? OPT.domain_pairs
        : (window.LT_DOMAIN_PAIRS || []);
      pairs.forEach((pair) => {
        const row = this._el("div", { className: "lt-pair-row" });
        row.appendChild(this._el("div", { className: "lt-pair-title" }, pair.title || ""));
        const cols = this._el("div", { className: "lt-pair-cols" });
        const colN = this._el("div", { className: "lt-pair-col lt-pair-neg" });
        const colP = this._el("div", { className: "lt-pair-col lt-pair-pos" });
        fillDomainCol(colN, OPT.neg, pair.neg, -1);
        fillDomainCol(colP, OPT.pos, pair.pos, 1);
        cols.appendChild(colN);
        cols.appendChild(colP);
        row.appendChild(cols);
        pairRows.appendChild(row);
      });

      // 自己构建：清单外自由填写
      const customSec = this._el("div", { className: "lt-custom-box" });
      customSec.appendChild(this._el("h3", { className: "lt-section" }, "清单上没有的，写在这里"));
      customSec.appendChild(this._el("p", { className: "lt-muted" },
        "选好事或不好的事，用一句话写出即可。"));
      const row = this._el("div", { className: "lt-row lt-custom-row" });
      const seg = this._el("div", { className: "lt-seg" });
      let customValence = -1;
      const btnNeg = this._el("button", { type: "button", className: "lt-segbtn on" }, "不好的事");
      const btnPos = this._el("button", { type: "button", className: "lt-segbtn" }, "好事");
      btnNeg.style.background = "#2D8B4A"; btnNeg.style.color = "#fff";
      const setSeg = (v) => {
        customValence = v;
        btnNeg.className = "lt-segbtn" + (v < 0 ? " on" : "");
        btnPos.className = "lt-segbtn" + (v > 0 ? " on" : "");
        btnNeg.style.background = v < 0 ? "#2D8B4A" : "#fff";
        btnNeg.style.color = v < 0 ? "#fff" : "#1a1a1a";
        btnPos.style.background = v > 0 ? "#7B2D8B" : "#fff";
        btnPos.style.color = v > 0 ? "#fff" : "#1a1a1a";
      };
      btnNeg.addEventListener("click", () => setSeg(-1));
      btnPos.addEventListener("click", () => setSeg(1));
      seg.appendChild(btnNeg);
      seg.appendChild(btnPos);
      const customIn = this._el("input", {
        type: "text", className: "lt-custom-input", maxlength: "40",
        placeholder: "用一句话写出这件事",
      });
      const addCustom = this._el("button", { type: "button", className: "lt-btn" }, "添加");
      const customList = this._el("div", { className: "lt-custom-list" });
      const tryAddCustom = () => {
        const txt = (customIn.value || "").trim();
        if (!txt) { msg.textContent = "请先写出这件事。"; return; }
        if (selected.size >= trial.hard_max) {
          msg.textContent = `最多 ${trial.hard_max} 件。`;
          return;
        }
        const valence = customValence < 0 ? -1 : 1;
        const baseKey = "自填：" + txt;
        const occ = countBase(valence, baseKey) + 1;
        const nw = { obj_raw: 90, obj_w: Math.round((90 / (window.LT_OBJ_MAX || 180)) * 1000) / 1000 };
        const theta = typeof window.LT_thetaFromWeight === "function"
          ? window.LT_thetaFromWeight(valence, nw.obj_w) : valence * nw.obj_w * Math.PI;
        const uid = newUid();
        selected.set(uid, {
          uid, item_key: labelOcc(baseKey, occ), base_item_key: baseKey, occurrence: occ,
          domain: "自填", valence, aslec_a: "custom",
          obj_raw: nw.obj_raw, obj_w: nw.obj_w, theta,
          is_custom: true, custom_text: txt,
          def_where: null, def_who: null, def_why: null, def_lock: null,
          select_order: nextSelectOrder(),
        });
        customIn.value = "";
        msg.textContent = "";
        paintCount();
        paintCustomList();
      };
      addCustom.addEventListener("click", tryAddCustom);
      customIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); tryAddCustom(); }
      });
      const paintCustomList = () => {
        customList.innerHTML = "";
        selected.forEach((it, k) => {
          const isCust = !!(it.is_custom || it.domain === "自填" || /^自填：/.test(String(it.item_key || "")));
          if (!isCust) return;
          const rowEl = this._el("div", { className: "lt-custom-chip" },
            (it.valence > 0 ? "＋ " : "－ ") + String(it.item_key || "").replace(/^自填：/, ""));
          const rm = this._el("button", { type: "button", className: "lt-chip" }, "去掉");
          rm.addEventListener("click", () => {
            selected.delete(k);
            paintCount();
            paintCustomList();
          });
          rowEl.appendChild(rm);
          customList.appendChild(rowEl);
        });
      };
      customSec.appendChild(seg);
      customSec.appendChild(customIn);
      customSec.appendChild(addCustom);
      customSec.appendChild(customList);
      root.appendChild(customSec);

      const done = this._el("button", { className: "lt-btn lt-primary", type: "button" },
        "选完了，继续");
      root.appendChild(done);
      display_element.appendChild(root);

      // 返回本幕：按条恢复（含同一事件多次）；缺 select_order 时按数组次序补
      const pre = Array.isArray(trial.preselected) ? trial.preselected : [];
      pre.forEach((it, i) => {
        if (!it || it.item_key == null || selected.size >= trial.hard_max) return;
        const uid = newUid();
        const base = it.base_item_key || baseFromKey(it.item_key);
        selected.set(uid, Object.assign({}, it, {
          uid,
          base_item_key: base,
          occurrence: it.occurrence || countBase(it.valence, base) + 1,
          item_key: it.item_key,
          select_order: it.select_order != null ? it.select_order : (i + 1),
        }));
      });
      root.querySelectorAll(".lt-check-wrap").forEach((wrap) => {
        if (typeof wrap._ltSync === "function") wrap._ltSync();
      });
      paintCustomList();
      paintCount();

      done.addEventListener("click", () => {
        // 深拷贝：避免共享 def_lock 数组；防 JSON.stringify 碰到循环引用
        const list = Array.from(selected.values())
          .map((it) => ({
            uid: it.uid,
            item_key: it.item_key,
            base_item_key: it.base_item_key || baseFromKey(it.item_key),
            occurrence: it.occurrence || 1,
            domain: it.domain,
            valence: Number(it.valence) < 0 ? -1 : 1,
            aslec_a: it.aslec_a || "new",
            obj_raw: it.obj_raw,
            obj_w: it.obj_w,
            theta: it.theta,
            is_custom: !!(it.is_custom || it.domain === "自填" || /^自填：/.test(String(it.item_key || ""))),
            custom_text: it.custom_text || null,
            def_where: it.def_where || null,
            def_who: it.def_who || null,
            def_why: it.def_why || null,
            def_lock: Array.isArray(it.def_lock) ? it.def_lock.slice() : null,
            select_order: it.select_order,
          }))
          .sort((a, b) => (a.select_order || 0) - (b.select_order || 0));
        // 规范化为 1..n 连续序号
        list.forEach((it, i) => { it.select_order = i + 1; });
        const np = list.filter((x) => x.valence > 0).length;
        const nn = list.filter((x) => x.valence < 0).length;
        if (np < 1 || nn < 1) {
          msg.textContent = "请至少各选一件好事和一件不好的事（人生酸甜苦辣交织）。";
          return;
        }
        if (list.length < trial.suggest_min) {
          msg.textContent = `请至少勾选 ${trial.suggest_min} 件（当前 ${list.length}），以便画出 4–10 条轨迹。`;
          return;
        }
        let checklist_selected_json = "[]";
        try { checklist_selected_json = JSON.stringify(list); } catch (err) {
          checklist_selected_json = JSON.stringify(list.map((it) => Object.assign({}, it, { def_lock: null })));
        }
        const data = {
          mode: "checklist",
          checklist_selected: list,
          checklist_selected_json,
          checklist_neg_n: nn,
          checklist_pos_n: np,
          checklist_side_order: sideOrder,
          checklist_shuffle_seed: OPT.shuffle_seed != null ? OPT.shuffle_seed : null,
          go_back: null,
          rt: Math.round(performance.now() - t0),
        };
        display_element.innerHTML = "";
        this.jsPsych.finishTrial(data);
      });
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
        usedKeys.delete(last.item_key);
        activeItem = null;
        drawing = null;
        drawMsg.textContent = "已撤销：「" + last.item_key + "」。可重新点选再画。";
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
          const label = String(next.item_key || "").replace(/^自填：/, "");
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
              const label = String(it.item_key || "").replace(/^自填：/, "");
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
            const label = String(it.item_key || "").replace(/^自填：/, "");
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
        const rt = svg.getBoundingClientRect();
        const src = e.touches && e.touches[0] ? e.touches[0] : e;
        return {
          x: ((src.clientX - rt.left) / rt.width) * VW,
          y: ((src.clientY - rt.top) / rt.height) * VH,
          t: performance.now(),
        };
      };

      const onDown = (e) => {
        if (!activeItem) return;
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
        drawing = { samples: [p], t0: p.t, item: activeItem, loopHint: false, sideHint: false };
        redraw();
      };
      const onMove = (e) => {
        if (!drawing) return;
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
        if (!drawing) return;
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
      svg.addEventListener("pointercancel", () => { drawing = null; redraw(); });

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

        const undrawnCustom = available().filter((it) => it.is_custom);
        if (!trial.allow_skip) {
          if (n < trial.suggest_min) {
            drawMsg.textContent = `请至少再画到 ${trial.suggest_min} 条（当前 ${n}）。请按勾选顺序继续` +
              (undrawnCustom.length ? "（含自填事件）" : "") + "。";
            return;
          }
          if (nPos < 1 || nNeg < 1) {
            drawMsg.textContent = "轨迹中需要同时包含至少一件好事和一件不好的事。";
            return;
          }
          if (undrawnCustom.length) {
            drawMsg.textContent = `还有 ${undrawnCustom.length} 件自填未画：` +
              undrawnCustom.map((it) => String(it.item_key || "").replace(/^自填：/, "")).join("、") +
              "。请按顺序画完，或返回去掉。";
            return;
          }
        } else if (n < trial.suggest_min) {
          drawMsg.textContent = `合计仍不足 ${trial.suggest_min} 条（当前 ${n}），请再补画或回到上一步多勾选。`;
          return;
        } else if (nPos < 1 || nNeg < 1) {
          drawMsg.textContent = "正负轨迹仍需各至少一条。";
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

    _tags(display_element, trial) {
      const t0 = performance.now();
      const OPT = trial.options;
      // 与勾选 / 画树同一顺序（时间从早→晚）
      const events = (trial.prior_events || []).map((e) => Object.assign({}, e))
        .sort((a, b) => (a.select_order || a.mark_order || 0) - (b.select_order || b.mark_order || 0));
      let idx = 0;

      display_element.innerHTML = "";
      const root = this._el("div", { className: "lt-root lt-tag-compact lt-tone-neg" });
      const head = this._el("div", { className: "lt-tag-head lt-sticky-head" });
      head.appendChild(this._el("div", { className: "lt-act-banner" }, "第三幕"));
      const stickyTask = this._el("p", { className: "lt-sticky-task" });
      head.appendChild(stickyTask);
      root.appendChild(head);
      const body = this._el("div", { className: "lt-tag-body" });
      root.appendChild(body);
      display_element.appendChild(root);

      const setTone = (valence) => {
        root.className = "lt-root lt-tag-compact lt-tone-" + (valence > 0 ? "pos" : "neg");
      };

      const OTHER = window.LT_OTHER_CHIP || "其他（填写）";
      const isOtherVal = (v) => (typeof window.LT_isOtherValue === "function"
        ? window.LT_isOtherValue(v) : /^其他：/.test(String(v || "")));
      const otherText = (v) => (typeof window.LT_otherText === "function"
        ? window.LT_otherText(v) : String(v || "").replace(/^其他：/, ""));

      /** 2 列大触控矩阵；suggest 置顶并标「荐」 */
      const chipGroup = (label, opts, cur, onPick, withOther, suggest) => {
        body.appendChild(this._el("div", { className: "lt-label" }, label));
        const g = this._el("div", { className: "lt-chip-grid" });
        let list = (opts || []).slice();
        if (suggest && list.indexOf(suggest) >= 0) {
          list = [suggest].concat(list.filter((t) => t !== suggest));
        }
        if (withOther && !list.includes(OTHER)) list.push(OTHER);
        const curIsOther = isOtherVal(cur);
        const highlight = curIsOther ? OTHER : cur;
        list.forEach((t) => {
          const isSug = suggest && t === suggest;
          const label = isSug ? ("荐 · " + t) : t;
          const b = this._el("button", {
            type: "button",
            className: "lt-chip lt-chip-cell"
              + (highlight === t ? " on" : "")
              + (isSug ? " lt-chip-suggest" : ""),
          }, label);
          b.addEventListener("click", () => onPick(t));
          g.appendChild(b);
        });
        body.appendChild(g);
        if (withOther && highlight === OTHER) {
          const fill = this._el("input", {
            type: "text", className: "lt-custom-input", maxlength: "40",
            placeholder: "写出具体内容",
            value: otherText(cur),
          });
          fill.addEventListener("input", () => {
            const txt = (fill.value || "").trim();
            onPick(txt ? ("其他：" + txt) : OTHER);
          });
          body.appendChild(fill);
        }
      };

      /** 0–10 滑竿（step 0.1）；无默认，须拖一下；存 0–1 连续值 */
      const scaleGroup = (label, leftHint, rightHint, cur01, onChange) => {
        body.appendChild(this._el("div", { className: "lt-label" }, label));
        const wrap = this._el("div", { className: "lt-slide-wrap" });
        const ends = this._el("div", { className: "lt-slide-ends" });
        ends.appendChild(this._el("span", {}, leftHint));
        let curN = cur01 == null || !Number.isFinite(Number(cur01))
          ? null : Math.round(Number(cur01) * 100) / 10;
        if (curN != null) curN = Math.max(0, Math.min(10, curN));
        const valEl = this._el("span", { className: "lt-slide-val" },
          curN == null ? "—" : String(curN));
        ends.appendChild(valEl);
        ends.appendChild(this._el("span", {}, rightHint));
        wrap.appendChild(ends);
        const midVis = curN != null ? curN : 5;
        const slide = this._el("input", {
          type: "range",
          className: "lt-slide" + (curN == null ? " lt-slide-unset" : ""),
          min: "0", max: "10", step: "0.1",
          value: String(midVis),
        });
        const commit = () => {
          let n = Math.round(Number(slide.value) * 10) / 10;
          n = Math.max(0, Math.min(10, n));
          valEl.textContent = String(n);
          slide.classList.remove("lt-slide-unset");
          onChange(Math.round((n / 10) * 1000) / 1000, true);
        };
        slide.addEventListener("input", commit);
        slide.addEventListener("change", commit);
        wrap.appendChild(slide);
        body.appendChild(wrap);
      };

      const finishAll = () => {
        events.forEach((e) => {
          if (typeof window.LT_refreshEventTheta === "function") window.LT_refreshEventTheta(e);
          if (typeof window.LT_syncFocal === "function") window.LT_syncFocal(e);
        });
        const data = {
          mode: "tags",
          events,
          events_json: JSON.stringify(events),
          n_trajectories: events.length,
          n_focal: events.filter((e) => e.is_focal_now).length,
          mean_now_salience: (() => {
            const xs = events.map((e) => e.now_salience).filter((x) => x != null);
            if (!xs.length) return null;
            return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000;
          })(),
          go_back: null,
          rt: Math.round(performance.now() - t0),
        };
        display_element.innerHTML = "";
        this.jsPsych.finishTrial(data);
      };

      const render = () => {
        if (!events.length) {
          // 补画后无新线可标：直接结束，勿卡在「返回重画」空页
          if (!(trial.allow_stage_back && trial.stage_back_to)) {
            finishAll();
            return;
          }
          body.innerHTML = "";
          body.appendChild(this._el("p", { className: "lt-msg" },
            "没有可标注的轨迹。请点「返回重画」先画线。"));
          const bar = this._el("div", { className: "lt-bar" });
          const stageBack = this._el("button", {
            type: "button", className: "lt-btn lt-stage-back",
          }, trial.stage_back_label || "返回重画");
          stageBack.addEventListener("click", () => {
            if (typeof trial.on_stage_back === "function") trial.on_stage_back(trial.stage_back_to);
            display_element.innerHTML = "";
            this.jsPsych.finishTrial({
              mode: "tags", go_back: trial.stage_back_to,
              events: [], n_trajectories: 0,
              rt: Math.round(performance.now() - t0),
            });
          });
          bar.appendChild(stageBack);
          body.appendChild(bar);
          return;
        }
        if (idx >= events.length) { finishAll(); return; }
        const ev = events[idx];
        setTone(ev.valence);
        if (typeof window.LT_applyItemPresets === "function") {
          window.LT_applyItemPresets(ev, ev);
        }
        if (typeof window.LT_applyTreePriors === "function") {
          window.LT_applyTreePriors(ev);
        }
        const side = ev.valence > 0 ? OPT.pos : OPT.neg;
        const needClose = typeof window.LT_whoNeedsClose === "function"
          ? window.LT_whoNeedsClose(ev.who) : false;
        const needMid = typeof window.LT_syncHowToMid === "function"
          ? window.LT_syncHowToMid(ev)
          : (ev.mid_kind === "有一次变强" || ev.mid_kind === "有一次变弱");
        // Q4 仅轨迹过中线硬选；无「荐 · 自己解决了」软默认
        stickyTask.textContent =
          `当前第 ${ev.select_order != null ? ev.select_order : (idx + 1)} 件：${ev.valence > 0 ? "＋" : "－"} ${ev.item_key}`;
        body.innerHTML = "";

        const pickOrOther = (field, t) => {
          if (t === OTHER) {
            ev[field] = isOtherVal(ev[field]) ? ev[field] : "其他：";
          } else {
            ev[field] = t;
          }
        };
        const filledWwwh = (v) => v && v !== OTHER && v !== "其他：" && !/^其他：$/.test(String(v));

        // 题目全保留；短文案 + 每行 3–4 钮，相近项并排
        chipGroup("主要发生在哪里？", window.LT_WHERE || [], ev.where, (t) => {
          pickOrOther("where", t);
          const w = filledWwwh(ev.where) ? ev.where : null;
          ev.where_eco = (w && typeof window.LT_whereEco === "function") ? window.LT_whereEco(w) : null;
          if (ev.preset_locked) ev.preset_locked = ev.preset_locked.filter((k) => k !== "where");
          render();
        }, true, ev.where);
        chipGroup("主要和谁有关？", window.LT_WHO || [], ev.who, (t) => {
          pickOrOther("who", t);
          const w = filledWwwh(ev.who) ? ev.who : null;
          ev.who_tie = (w && typeof window.LT_whoTie === "function") ? window.LT_whoTie(w) : null;
          if (w && typeof window.LT_whoNeedsClose === "function" && !window.LT_whoNeedsClose(w)) {
            ev.closeness = null;
          }
          if (ev.preset_locked) ev.preset_locked = ev.preset_locked.filter((k) => k !== "who");
          render();
        }, true, ev.who);
        chipGroup("主要因为？", side.causes || [], ev.why, (t) => {
          pickOrOther("why", t);
          const w = filledWwwh(ev.why) ? ev.why : null;
          ev.control_w = (w && typeof window.LT_controlFromWhy === "function")
            ? window.LT_controlFromWhy(w, ev.valence) : null;
          if (ev.preset_locked) ev.preset_locked = ev.preset_locked.filter((k) => k !== "why");
          render();
        }, true, ev.why);
        chipGroup("后来客观上怎么样了？", side.resolutions || [], ev.how, (t) => {
          pickOrOther("how", t);
          ev._how_user_picked = true;
          ev._how_from_path = false;
          const w = filledWwwh(ev.how) ? ev.how : null;
          ev.ongoing = (w && typeof window.LT_ongoingFromHow === "function")
            ? window.LT_ongoingFromHow(w, ev.valence) : null;
          ev.turn_w = (w && typeof window.LT_turnFromHow === "function")
            ? window.LT_turnFromHow(w, ev.valence) : null;
          if (typeof window.LT_syncHowToMid === "function") window.LT_syncHowToMid(ev);
          render();
        }, true, null);

        // 拐点：手选转折类 later，或过中线轨迹已自动勾选
        const showMid = !!needMid && (!!ev._how_user_picked || !!ev._how_from_path);
        // 发生年岁夹在本事件画线起止岁之间；无 age_end（画到「现在」）则上界=当前年龄
        const midAgeBounds = () => {
          const lo0 = Number(ev.age_start);
          const hi0 = ev.age_end != null && Number.isFinite(Number(ev.age_end))
            ? Number(ev.age_end)
            : Number(trial.max_age);
          let lo = Number.isFinite(lo0) ? lo0 : 1;
          let hi = Number.isFinite(hi0) ? hi0 : (Number(trial.max_age) || 18);
          if (hi < lo) { const t = lo; lo = hi; hi = t; }
          if (hi - lo < 0.1) hi = Math.round((lo + 0.1) * 10) / 10;
          lo = Math.round(lo * 10) / 10;
          hi = Math.round(hi * 10) / 10;
          return { lo, hi };
        };
        if (showMid) {
          const { lo: ageLo, hi: ageHi } = midAgeBounds();
          if (ev.age_mid != null && Number.isFinite(Number(ev.age_mid))) {
            const a = Math.round(Number(ev.age_mid) * 10) / 10;
            if (a < ageLo || a > ageHi) ev.age_mid = null;
          }
          // 滑竿：范围=本事件起止岁，step 0.1；无默认，须拖一下才写入
          body.appendChild(this._el("div", { className: "lt-label" }, "拐点大约几岁"));
          const ageWrap = this._el("div", { className: "lt-slide-wrap" });
          const ageEnds = this._el("div", { className: "lt-slide-ends" });
          ageEnds.appendChild(this._el("span", {}, String(ageLo)));
          const ageVal = this._el("span", { className: "lt-slide-val" },
            ev.age_mid != null ? String(ev.age_mid) : "—");
          ageEnds.appendChild(ageVal);
          ageEnds.appendChild(this._el("span", {}, String(ageHi)));
          ageWrap.appendChild(ageEnds);
          const midVis = ev.age_mid != null
            ? ev.age_mid
            : Math.round(((ageLo + ageHi) / 2) * 10) / 10;
          const ageSlide = this._el("input", {
            type: "range", className: "lt-slide" + (ev.age_mid == null ? " lt-slide-unset" : ""),
            min: String(ageLo), max: String(ageHi), step: "0.1",
            value: String(midVis),
            title: "本事件 " + ageLo + "–" + ageHi + " 岁",
          });
          const commitAge = () => {
            let a = Math.round(Number(ageSlide.value) * 10) / 10;
            a = Math.min(ageHi, Math.max(ageLo, a));
            ev.age_mid = a;
            ageVal.textContent = String(a);
            ageSlide.classList.remove("lt-slide-unset");
          };
          ageSlide.addEventListener("input", commitAge);
          ageSlide.addEventListener("change", commitAge);
          ageWrap.appendChild(ageSlide);
          body.appendChild(ageWrap);
          scaleGroup("那时影响", "几乎没有", "非常大", ev.r_mid, (v) => {
            ev.r_mid = v;
          });
        }

        scaleGroup("现在还影响你多少？", "几乎没有", "非常大", ev.now_salience, (v) => {
          ev.now_salience = v;
          ev._prior_now_from_tree = false;
          if (typeof window.LT_syncFocal === "function") window.LT_syncFocal(ev);
        });
        scaleGroup("人生故事里有多像「重要一章」？（中心性）", "几乎不算", "非常核心", ev.centrality, (v) => {
          ev.centrality = v;
          ev._prior_centrality_from_obj = false;
          if (typeof window.LT_refreshEventTheta === "function") window.LT_refreshEventTheta(ev);
        });
        if (needClose) {
          scaleGroup("和这些人当时有多亲近？", "很疏远", "很亲近", ev.closeness, (v) => {
            ev.closeness = v;
          });
        }

        const deltaInfo = typeof window.LT_deltaFromR === "function"
          ? window.LT_deltaFromR(ev.r_then, ev.r_now) : null;
        if (deltaInfo) {
          ev.impact_delta = deltaInfo.impact_delta;
          ev.delta_dir = deltaInfo.delta_dir;
        }

        // 注释：同页附属，不另开一屏
        body.appendChild(this._el("div", { className: "lt-label lt-anno-label" }, "注释（可空）"));
        const noteIn = this._el("input", {
          type: "text", className: "lt-custom-input lt-anno-input", maxlength: "80",
          placeholder: "可选细节…",
          value: ev.wwwh_note || "",
        });
        noteIn.addEventListener("input", () => {
          const t = (noteIn.value || "").trim();
          ev.wwwh_note = t || null;
        });
        body.appendChild(noteIn);

        const msg = this._el("p", { className: "lt-msg" });
        body.appendChild(msg);
        body.appendChild(this._el("p", { className: "lt-foot-count" },
          `${idx + 1} / ${events.length}`));
        const bar = this._el("div", { className: "lt-bar" });
        if (trial.allow_stage_back && trial.stage_back_to) {
          const stageBack = this._el("button", { type: "button", className: "lt-btn lt-stage-back" },
            trial.stage_back_label || "返回上一阶段");
          stageBack.addEventListener("click", () => {
            if (typeof trial.on_stage_back === "function") trial.on_stage_back(trial.stage_back_to);
            display_element.innerHTML = "";
            this.jsPsych.finishTrial({
              mode: "tags",
              go_back: trial.stage_back_to,
              events: [],
              n_trajectories: 0,
              rt: Math.round(performance.now() - t0),
            });
          });
          bar.appendChild(stageBack);
        }
        if (idx > 0) {
          const back = this._el("button", { type: "button", className: "lt-btn" }, "上一条");
          back.addEventListener("click", () => { idx--; render(); });
          bar.appendChild(back);
        }
        const next = this._el("button", { type: "button", className: "lt-btn lt-primary" },
          idx === events.length - 1 ? "完成标签" : "下一条");
        next.addEventListener("click", () => {
          if (![ev.where, ev.who, ev.why, ev.how].every(filledWwwh)) {
            msg.textContent = "请选完情境四题；若选了「其他」，请填写具体内容。";
            return;
          }
          if (ev.now_salience == null) {
            msg.textContent = "请拖动「现在影响」滑竿。";
            return;
          }
          if (ev.centrality == null) {
            msg.textContent = "请拖动「中心性」滑竿。";
            return;
          }
          if (needClose && ev.closeness == null) {
            msg.textContent = "请拖动「亲疏」滑竿。";
            return;
          }
          if (showMid) {
            const { lo, hi } = midAgeBounds();
            if (ev.age_mid == null) {
              msg.textContent = "请拖动「拐点大约几岁」滑竿（" + lo + "–" + hi + "）。";
              return;
            }
            if (ev.age_mid < lo || ev.age_mid > hi) {
              msg.textContent = "拐点年岁须在本事件 " + lo + "–" + hi + " 岁之间。";
              return;
            }
            if (ev.r_mid == null) {
              msg.textContent = "请拖动「那时影响」滑竿。";
              return;
            }
          }
          ev.where_eco = typeof window.LT_whereEco === "function" ? window.LT_whereEco(ev.where) : ev.where_eco;
          ev.who_tie = typeof window.LT_whoTie === "function" ? window.LT_whoTie(ev.who) : ev.who_tie;
          ev.control_w = typeof window.LT_controlFromWhy === "function"
            ? window.LT_controlFromWhy(ev.why, ev.valence) : ev.control_w;
          ev.turn_w = typeof window.LT_turnFromHow === "function"
            ? window.LT_turnFromHow(ev.how, ev.valence) : ev.turn_w;
          ev.ongoing = typeof window.LT_ongoingFromHow === "function"
            ? window.LT_ongoingFromHow(ev.how, ev.valence) : ev.ongoing;
          if (typeof window.LT_refreshEventTheta === "function") window.LT_refreshEventTheta(ev);
          if (typeof window.LT_syncFocal === "function") window.LT_syncFocal(ev);
          idx++;
          render();
        });
        bar.appendChild(next);
        body.appendChild(bar);
      };
      render();
    }
  }

  LifeTimelinePlugin.info = info;
  return LifeTimelinePlugin;
})(jsPsychModule);

