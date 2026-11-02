/* Generated from the supplied mentor options v2.1. Do not edit by hand. */
(function(root){
  const window={};
/* 生命树选项表 v2.1
 * 负向：ASLEC 改编（a=原题桥）；正向：独立目录。各类内按 obj_raw 降序。
 * 清单不再放「其他」勾选项（底部自填）；WWWH 四题末尾「其他（填写）」。
 *
 * A：obj_raw∈[0,180]，obj_w=obj_raw/180；θ 后备。B/F/now_salience：0–10 滑条。
 * WWWH 点选另挂可量化码；部分条目带 preset（where/who/why）减负，见 README。
 */
window.LT_OBJ_MAX = 180;
window.LT_FOCAL_CUT = 0.7; // now_salience≥此 → is_focal_now 衍生真

/**
 * t=题干, a=ASLEC桥, raw=客观分 0–180
 * preset 可选: { where, who, why, lock: ['where','who','why'] }
 *   lock=强隐含（默认可折叠只确认）；无 lock 仅预填可改
 */
const O = (t, a, raw, preset) => {
  const obj_raw = raw == null ? 90 : Number(raw);
  const o = {
    t,
    a: a || "new",
    obj_raw,
    obj_w: Math.round((obj_raw / window.LT_OBJ_MAX) * 1000) / 1000,
  };
  if (preset && typeof preset === "object") {
    if (preset.where) o.def_where = preset.where;
    if (preset.who) o.def_who = preset.who;
    if (preset.why) o.def_why = preset.why;
    if (Array.isArray(preset.lock)) o.def_lock = preset.lock.slice();
  }
  return o;
};

/** 把清单预设写进事件（仅填空位）；返回实际锁定的字段名 */
window.LT_applyItemPresets = function (ev, item) {
  if (!ev) return [];
  const src = item || ev;
  const locked = [];
  const soft = Array.isArray(ev.preset_soft) ? ev.preset_soft.slice() : [];
  const lockSet = new Set(src.def_lock || ev.def_lock || []);
  const pairs = [
    ["where", "def_where"],
    ["who", "def_who"],
    ["why", "def_why"],
  ];
  pairs.forEach(([field, defKey]) => {
    const def = src[defKey] != null ? src[defKey] : ev[defKey];
    if (def == null) return;
    if (ev[field] == null || ev[field] === "") {
      ev[field] = def;
      if (lockSet.has(field)) locked.push(field);
      else if (soft.indexOf(field) < 0) soft.push(field);
    } else if (lockSet.has(field) && ev[field] === def) {
      locked.push(field);
    }
  });
  if (src.def_lock) ev.def_lock = src.def_lock.slice();
  if (src.def_where) ev.def_where = src.def_where;
  if (src.def_who) ev.def_who = src.def_who;
  if (src.def_why) ev.def_why = src.def_why;
  // 映射码
  if (ev.where && typeof window.LT_whereEco === "function") ev.where_eco = window.LT_whereEco(ev.where);
  if (ev.who && typeof window.LT_whoTie === "function") ev.who_tie = window.LT_whoTie(ev.who);
  if (ev.why && typeof window.LT_controlFromWhy === "function") {
    ev.control_w = window.LT_controlFromWhy(ev.why, ev.valence);
  }
  ev.preset_locked = locked;
  ev.preset_soft = soft;
  return locked;
};

/**
 * 轨迹几何 → Q4 选项（只读推导，不写字段）。
 * 起点已锁在勾选归属侧（坏事左 / 好事右）；仅当终点过中线才推荐。
 * 坏事→右：「后来变好了」；好事→左：「后来失去了」
 * 未过中线：null
 */
window.LT_howFromPath = function (ev) {
  if (!ev || !ev.cross_axis) return null;
  const sideThen = Number(ev.side_then);
  const sideNow = Number(ev.side_now);
  if (!Number.isFinite(sideThen) || !Number.isFinite(sideNow) || sideThen === sideNow) return null;
  const onsetNeg = Number(ev.valence) < 0;
  // 起点应与归属同侧；以终点相对起点方向为准
  if (onsetNeg && sideNow > 0) return "后来变好了";
  if (!onsetNeg && sideNow < 0) return "后来失去了";
  // 兜底：方向相对起点
  if (sideNow > sideThen) return onsetNeg ? "后来变好了" : "成了后来好事的起点";
  if (sideNow < sideThen) return onsetNeg ? "后来变得更糟" : "后来失去了";
  return null;
};

/** @deprecated 兼容旧调用；Q4 不再软推「自己解决了」等 */
window.LT_suggestHow = function (ev) {
  return typeof window.LT_howFromPath === "function" ? window.LT_howFromPath(ev) : null;
};

/**
 * 第三幕：不预填 Q4；仅同步已有 how→mid。
 * how 只由画线过中线时 LT_applyPathHow 写入，或受试者手点。
 */
window.LT_applyTreePriors = function (ev) {
  if (!ev) return;
  const soft = Array.isArray(ev.preset_soft) ? ev.preset_soft.slice() : [];
  if (ev.how && typeof window.LT_syncHowToMid === "function") {
    window.LT_syncHowToMid(ev);
  }
  ev.preset_soft = soft;
};

/**
 * Q1 Where — Bronfenbrenner 生态层（微系统贴近度）
 * 宿舍单独列出：寄宿生日常微系统 ≠「教室/校园」
 */
window.LT_WHERE = ["家里", "宿舍", "学校", "网上", "社区或校外", "多个地方", "说不清"];
/**
 * Q2 Who — 关系纽带（家人/恋人/朋友亲疏高于制度角色「同学」「老师」）
 * 同学≠朋友：同学=同班/同校角色；朋友=自愿亲密纽带
 */
window.LT_WHO = ["家人", "朋友", "同学", "老师", "恋人", "自己", "网上他人", "其他人", "说不清"];
window.LT_WHO_NEEDS_CLOSE = ["家人", "朋友", "同学", "老师", "恋人", "网上他人", "其他人"];

/** Where → 生态层码 0–1（说不清=中性） */
window.LT_WHERE_ECO = {
  "家里": 0.95,
  "宿舍": 0.88,
  "学校": 0.82,
  "网上": 0.70,
  "多个地方": 0.60,
  "社区或校外": 0.55,
  "说不清": 0.50,
};
/** Who → 关系纽带码（分析用；亲疏滑条 closeness 仍独立） */
window.LT_WHO_TIE = {
  "家人": 0.95,
  "恋人": 0.90,
  "朋友": 0.82,
  "同学": 0.60,
  "老师": 0.55,
  "其他人": 0.45,
  "网上他人": 0.40,
  "自己": 0.20,
  "说不清": 0.50,
  "同伴同学": 0.70, // 旧版合并项兼容；新数据勿写
};

/**
 * Q3 Why → control_w：Weiner 归因（内外源 × 可控性）
 * 内源可控高；外源他人/运气/结构低 → H4 低可控坏事更伤
 */
window.LT_CONTROL_W = {
  neg: {
    "自己行为": 0.85,   // 内源·可控
    "别人行为": 0.20,   // 外源·他人
    "意外碰巧": 0.10,   // 外源·不可控
    "环境改变": 0.25,   // 外源·情境
    "家里状况": 0.30,   // 外源·家庭结构
    "网上的事": 0.35,   // 外源·线上情境
    "说不清": 0.50,
  },
  pos: {
    "自己努力": 0.90,   // 内源·可控
    "别人帮助": 0.40,   // 外源·他人支持
    "机会运气": 0.15,   // 外源·不可控
    "环境改变": 0.30,   // 外源·情境
    "网上因缘": 0.45,   // 外源·线上机缘
    "说不清": 0.50,
  },
};

/**
 * Q4 How → turn_w / ongoing：应激–应对结局；兼作「有无明显拐点」筛查
 * （后来更糟 / 成了起点 / 后来失去了 → need_mid，再滑竿 age_mid + r_mid）
 */
window.LT_TURN_W = {
  neg: {
    "自己解决了": 0.45,         // 问题聚焦应对
    "有人帮了我": 0.50,         // 社会支持应对
    "时间久了自然过去": 0.25,   // 自然消退
    "至今没解决": 0.70,         // 持续应激
    "后来变得更糟": 0.90,       // 升级转折
    "后来变好了": 0.85,         // 跨轴：坏事→好事
  },
  pos: {
    "一直保持到现在": 0.55,     // 维持
    "慢慢淡下去了": 0.25,       // 习惯化消退
    "成了后来好事的起点": 0.85, // 增益螺旋 / 转折
    "后来失去了": 0.70,         // 正向丧失 / 跨轴好事→坏事
  },
};

window.LT_OPTIONS = {
  neg: {
    categories: ["人际关系", "学习压力", "被批评 / 冲突 / 管束", "丧失与分离", "健康与生活变化", "家庭状况", "恋爱 / 亲密关系"],
    items: {
      "人际关系": [
        O("私人照片或聊天记录被别人传播", "new", 128, { where: "网上", who: "网上他人", why: "别人行为", lock: ["where", "who"] }),
        O("在网上被人嘲笑、造谣或被人肉", "new", 112, { where: "网上", who: "网上他人", why: "别人行为", lock: ["where", "who"] }),
        O("受人歧视或冷遇", "2", 95), O("被朋友拉黑、删除，或被踢出群聊", "new", 78, { where: "网上", who: "朋友", why: "别人行为" }),
        O("与同学或好友发生纠纷", "4", 68, { where: "学校", why: "别人行为" }),
        O("当众丢面子", "15", 55), O("被人误会或错怪", "1", 42),
      ],
      "学习压力": [
        O("升学压力", "22", 88, { where: "学校", who: "自己", why: "家里状况" }),
        O("家里给你施加学习压力", "25", 78, { where: "家里", who: "家人", why: "家里状况", lock: ["where", "who", "why"] }),
        O("不喜欢上学", "6", 62, { where: "学校", who: "自己" }),
        O("学习负担重", "9", 52, { where: "学校", who: "自己" }),
        O("预期的评选落空", "18", 48, { where: "学校" }),
        O("考试失败或不理想", "3", 38, { where: "学校", who: "自己", why: "自己行为", lock: ["where", "who"] }),
      ],
      "被批评 / 冲突 / 管束": [
        O("遭父母打骂", "24", 135, { where: "家里", who: "家人", why: "家里状况", lock: ["where", "who"] }),
        O("与人打架", "23", 98), O("与老师关系紧张", "10", 72, { where: "学校", who: "老师", lock: ["where", "who"] }),
        O("受批评或处分", "19", 65, { where: "学校" }),
        O("因为玩手机、游戏或刷视频和父母争吵", "new", 45, { where: "家里", who: "家人", why: "自己行为", lock: ["where", "who"] }),
        O("手机被没收或被限制使用", "new", 32, { where: "家里", who: "家人", lock: ["where", "who"] }),
        O("被罚款", "21", 28),
      ],
      "丧失与分离": [
        O("亲友死亡", "13", 175, { who: "家人", why: "意外碰巧" }),
        O("长期远离家人不能团聚", "8", 118, { who: "家人", why: "环境改变", lock: ["who"] }),
        O("转学或休学", "20", 92, { where: "学校", why: "环境改变" }),
        O("和很好的朋友渐渐疏远或不再联系", "new", 82, { who: "朋友" }),
        O("账号被盗，或网上被骗钱", "new", 58, { where: "网上", why: "网上的事", lock: ["where"] }),
        O("被盗或丢失东西", "14", 40),
      ],
      "健康与生活变化": [
        O("本人患急重病", "11", 155, { who: "自己", why: "意外碰巧", lock: ["who"] }),
        O("亲友患急重病", "12", 142, { who: "家人", why: "意外碰巧" }),
        O("意外惊吓或事故", "26", 122, { why: "意外碰巧", lock: ["why"] }),
        O("长期睡不好或经常熬夜", "new", 58, { who: "自己" }),
        O("生活习惯（饮食、休息等）明显变化", "5", 48),
      ],
      "家庭状况": [
        O("父母分居或离异", "new", 160, { where: "家里", who: "家人", why: "家里状况", lock: ["where", "who", "why"] }),
        O("家庭经济困难", "16", 120, { where: "家里", who: "家人", why: "家里状况", lock: ["where", "who", "why"] }),
        O("家庭内部有矛盾", "17", 108, { where: "家里", who: "家人", why: "家里状况", lock: ["where", "who", "why"] }),
      ],
      "恋爱 / 亲密关系": [O("恋爱不顺利或失恋", "7", 90, { who: "恋人", lock: ["who"] })],
    },
    causes: ["自己行为", "别人行为", "意外碰巧", "环境改变", "家里状况", "网上的事", "说不清"],
    // 后来＝轨迹/转折融合题（「后来变得更糟 / 后来变好了」会追问中间折点）
    resolutions: ["自己解决了", "有人帮了我", "时间久了自然过去", "至今没解决", "后来变得更糟", "后来变好了"],
  },
  pos: {
    categories: ["友谊 / 被接纳", "学习 / 成就", "家庭关系", "恋爱 / 亲密关系", "兴趣 / 个人成长", "新环境 / 新体验", "得到支持或帮助"],
    items: {
      "友谊 / 被接纳": [
        O("交到了很好的朋友", "new", 125, { where: "学校", who: "朋友" }),
        O("被一个圈子接纳", "new", 95, { who: "同学" }),
        O("和朋友和好了", "new", 72, { who: "朋友", lock: ["who"] }),
        O("在网上找到了合得来的同好", "new", 58, { where: "网上", who: "网上他人", lock: ["where"] }),
      ],
      "学习 / 成就": [
        O("通过了一次重要的选拔或考试", "new", 115, { where: "学校", who: "自己", why: "自己努力", lock: ["where", "who"] }),
        O("拿到想要的名次、奖项或荣誉", "new", 95, { where: "学校", who: "自己", why: "自己努力" }),
        O("考试进步或考得很好", "new", 48, { where: "学校", who: "自己", why: "自己努力", lock: ["where", "who"] }),
      ],
      "家庭关系": [
        O("和父母的关系变好了", "new", 135, { where: "家里", who: "家人", lock: ["where", "who"] }),
        O("父母对我更理解、更放心了", "new", 122, { where: "家里", who: "家人", lock: ["where", "who"] }),
      ],
      "恋爱 / 亲密关系": [O("喜欢的人也喜欢我 / 恋爱开始了", "new", 118, { who: "恋人", lock: ["who"] })],
      "兴趣 / 个人成长": [
        O("第一次独立完成一件重要的事", "new", 95, { who: "自己", why: "自己努力" }),
        O("自己的作品或内容得到了认可（含网上）", "new", 70),
        O("学会了一项新技能或爱好", "new", 55, { who: "自己", why: "自己努力" }),
      ],
      "新环境 / 新体验": [
        O("升学或转学后适应得很好", "new", 85, { why: "环境改变" }),
        O("第一次去了很想去的地方", "new", 42),
      ],
      "得到支持或帮助": [
        O("在困难时得到了别人的帮助", "new", 105, { why: "别人帮助", lock: ["why"] }),
        O("有人认真听我说话", "new", 92, { why: "别人帮助" }),
      ],
    },
    causes: ["自己努力", "别人帮助", "机会运气", "环境改变", "网上因缘", "说不清"],
    // 后来＝轨迹/转折融合（「成了后来好事的起点」「后来失去了」会追问中间折点）
    resolutions: ["一直保持到现在", "慢慢淡下去了", "成了后来好事的起点", "后来失去了"],
  },
};

/** WWWH 芯片里的「其他」入口文案；选后填空，存成「其他：…」 */
window.LT_OTHER_CHIP = "其他（填写）";
window.LT_isOtherValue = function (v) {
  return v != null && /^其他：/.test(String(v));
};
window.LT_otherText = function (v) {
  if (!window.LT_isOtherValue(v)) return "";
  return String(v).replace(/^其他：/, "");
};

/** w∈[0,1] → 半圆角；主用 centrality，后备 obj_w */
window.LT_thetaFromWeight = function (valence, w) {
  const ww = Math.max(0, Math.min(1, w == null ? 0.5 : Number(w)));
  const sign = valence >= 0 ? 1 : -1;
  return sign * ww * Math.PI;
};

window.LT_normObj = function (x) {
  if (x == null) return { obj_raw: 90, obj_w: 90 / window.LT_OBJ_MAX };
  if (typeof x === "object") {
    const raw = x.obj_raw != null ? Number(x.obj_raw) : (x.obj_w != null ? Number(x.obj_w) * window.LT_OBJ_MAX : 90);
    return { obj_raw: raw, obj_w: Math.round((raw / window.LT_OBJ_MAX) * 1000) / 1000 };
  }
  const n = Number(x);
  // 兼容旧数据：若已是 0–1 小数则视为 obj_w
  if (n >= 0 && n <= 1) return { obj_raw: Math.round(n * window.LT_OBJ_MAX), obj_w: n };
  return { obj_raw: n, obj_w: Math.round((n / window.LT_OBJ_MAX) * 1000) / 1000 };
};

window.LT_refreshEventTheta = function (ev) {
  if (!ev) return;
  const w = ev.centrality != null && ev.centrality !== ""
    ? Number(ev.centrality)
    : (ev.obj_w == null ? 0.5 : Number(ev.obj_w));
  ev.theta = Math.round(window.LT_thetaFromWeight(ev.valence, w) * 1000) / 1000;
};

window.LT_controlFromWhy = function (why, valence) {
  const side = valence < 0 ? "neg" : "pos";
  const m = (window.LT_CONTROL_W || {})[side] || {};
  return why in m ? m[why] : null;
};

window.LT_turnFromHow = function (how, valence) {
  const side = valence < 0 ? "neg" : "pos";
  const m = (window.LT_TURN_W || {})[side] || {};
  return how in m ? m[how] : null;
};

window.LT_whereEco = function (where) {
  const m = window.LT_WHERE_ECO || {};
  return where in m ? m[where] : null;
};

window.LT_whoTie = function (who) {
  const m = window.LT_WHO_TIE || {};
  return who in m ? m[who] : null;
};

window.LT_whoNeedsClose = function (who) {
  if (!who) return false;
  if (/^其他：/.test(String(who))) return true; // 自填关系 → 仍问亲疏
  return (window.LT_WHO_NEEDS_CLOSE || []).indexOf(who) >= 0;
};

/** 标注完成后：连续 now_salience → 衍生 is_focal_now */
window.LT_syncFocal = function (ev) {
  if (!ev || ev.now_salience == null) return;
  const cut = window.LT_FOCAL_CUT == null ? 0.7 : Number(window.LT_FOCAL_CUT);
  ev.is_focal_now = Number(ev.now_salience) >= cut;
};

window.LT_ongoingFromHow = function (how, valence) {
  if (!how) return null;
  if (valence < 0) {
    if (how === "后来变好了") return false;
    return how === "至今没解决" || how === "后来变得更糟";
  }
  return how === "一直保持到现在";
};

/**
 * 「后来怎么样」= 明显拐点存在性验证（与形状折点融合，不再另出 Q8 单选）：
 * how 选定 → 推导 mid_kind；仅「拐过一次」类才展开滑竿 age_mid / r_mid。
 * 返回 { mid_kind, need_mid }
 */
window.LT_midFromHow = function (how, valence) {
  if (!how || /^其他/.test(String(how))) {
    return { mid_kind: "说不清", need_mid: false };
  }
  if (valence < 0) {
    if (how === "后来变得更糟") return { mid_kind: "有一次变强", need_mid: true };
    if (how === "后来变好了") return { mid_kind: "有一次变强", need_mid: true };
    return { mid_kind: "没有", need_mid: false };
  }
  if (how === "成了后来好事的起点") return { mid_kind: "有一次变强", need_mid: true };
  if (how === "后来失去了") return { mid_kind: "有一次变弱", need_mid: true };
  return { mid_kind: "没有", need_mid: false };
};

/**
 * 画线过中线 → 硬写 Q4（按变化方向）+ 预填拐点岁/影响。
 * 未过中线：不写 how（不默认「自己解决了」）。
 */
window.LT_applyPathHow = function (ev) {
  if (!ev) return false;
  const how = typeof window.LT_howFromPath === "function" ? window.LT_howFromPath(ev) : null;
  if (!how) return false;

  ev.how = how;
  ev._how_from_path = true;
  if (typeof window.LT_ongoingFromHow === "function") {
    ev.ongoing = window.LT_ongoingFromHow(how, ev.valence);
  }
  if (typeof window.LT_turnFromHow === "function") {
    ev.turn_w = window.LT_turnFromHow(how, ev.valence);
  }
  if (typeof window.LT_syncHowToMid === "function") window.LT_syncHowToMid(ev);
  if (ev.age_cross != null && Number.isFinite(Number(ev.age_cross))) {
    ev.age_mid = Math.round(Number(ev.age_cross) * 10) / 10;
  }
  if (ev.r_cross != null && Number.isFinite(Number(ev.r_cross))) {
    ev.r_mid = Math.round(Number(ev.r_cross) * 1000) / 1000;
  }
  const soft = Array.isArray(ev.preset_soft) ? ev.preset_soft.slice() : [];
  if (soft.indexOf("how") < 0) soft.push("how");
  ev.preset_soft = soft;
  return true;
};

/** @deprecated 改用 LT_applyPathHow */
window.LT_applyCrossAxisHow = function (ev) {
  return typeof window.LT_applyPathHow === "function"
    ? window.LT_applyPathHow(ev) : false;
};

/** 写入 mid_kind；若不再需要折点则清空 age_mid/r_mid */
window.LT_syncHowToMid = function (ev) {
  if (!ev) return false;
  const info = typeof window.LT_midFromHow === "function"
    ? window.LT_midFromHow(ev.how, ev.valence)
    : { mid_kind: "没有", need_mid: false };
  ev.mid_kind = info.mid_kind;
  if (!info.need_mid) {
    ev.age_mid = null;
    ev.r_mid = null;
  }
  return !!info.need_mid;
};

/** 几何推测（不出题）：仅两端方向，不能发明 mid 年龄/半径 */
window.LT_DELTA_HINT = 0.25; // |Δ|≥此 → 分析上更值得看 Q8
window.LT_deltaFromR = function (r_then, r_now) {
  const a = Number(r_then), b = Number(r_now);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const d = Math.round((b - a) * 1000) / 1000;
  let dir = "flat";
  if (d >= window.LT_DELTA_HINT) dir = "up";
  else if (d <= -window.LT_DELTA_HINT) dir = "down";
  return {
    impact_delta: d,
    delta_dir: dir,
    q8_hint: Math.abs(d) >= window.LT_DELTA_HINT,
  };
};

window.LT_flattenItems = function (opt) {
  const out = [];
  ["neg", "pos"].forEach((side) => {
    const block = opt[side];
    const valence = side === "pos" ? 1 : -1;
    (block.categories || []).forEach((domain) => {
      ((block.items || {})[domain] || []).forEach((x) => {
        const nw = window.LT_normObj(x);
        out.push({
          item_key: x.t, domain, valence, aslec_a: x.a || "new",
          obj_raw: nw.obj_raw, obj_w: nw.obj_w,
          theta: window.LT_thetaFromWeight(valence, nw.obj_w),
        });
      });
    });
  });
  return out;
};

window.LT_EXAMPLES_HTML =
  "<p><strong>操作性定义：</strong>「人生事件」指一段时间内发生的、需要适应或调整的<strong>具体经历</strong>" +
  "（可好可坏），不是日常琐碎心情或抽象性格评价。这一口径来自生活事件量表传统" +
  "（Holmes &amp; Rahe, 1967, SRRS；青少年修订见刘贤臣等, 1997, ASLEC）。</p>" +
  "<p><strong>例如：</strong>转学、和朋友闹翻或和好、家人生病、一次想要的名次、第一次独自做成一件事。</p>" +
  "<p class=\"lt-muted\">清单对不上的，可在页底自己写一件；没发生过的不要勾。</p>";

window.LT_ETHICS_HTML = "";

/** Mulberry32：被试间清单乱序用；seed 写入数据便于复现 */
window.LT_rng = function (seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

window.LT_shuffleInPlace = function (arr, rng) {
  const a = arr;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
};

/**
 * 左右对照行：同一主题一行看，方便对照勾选。
 * title=行标题；neg/pos=各自 domain 键（写入数据仍用原 domain 名）。
 */
window.LT_DOMAIN_PAIRS = [
  { title: "人际关系", neg: "人际关系", pos: "友谊 / 被接纳" },
  { title: "学习", neg: "学习压力", pos: "学习 / 成就" },
  { title: "冲突与支持", neg: "被批评 / 冲突 / 管束", pos: "得到支持或帮助" },
  { title: "分离与新体验", neg: "丧失与分离", pos: "新环境 / 新体验" },
  { title: "健康与成长", neg: "健康与生活变化", pos: "兴趣 / 个人成长" },
  { title: "家庭", neg: "家庭状况", pos: "家庭关系" },
  { title: "恋爱 / 亲密关系", neg: "恋爱 / 亲密关系", pos: "恋爱 / 亲密关系" },
];

/**
 * 被试间平衡：打乱对照行顺序 + 类内条目顺序；side_order 仅记入数据。
 * 返回新对象，不改动原 LT_OPTIONS。
 */
window.LT_shuffleChecklistOptions = function (opt, seed) {
  const rng = window.LT_rng(seed);
  const pairs = (window.LT_DOMAIN_PAIRS || []).map((p) => Object.assign({}, p));
  window.LT_shuffleInPlace(pairs, rng);

  const usedNeg = new Set();
  const usedPos = new Set();
  const negItems = {};
  const posItems = {};
  const negCats = [];
  const posCats = [];

  const take = (sideKey, cat, bag, cats, used) => {
    if (!cat || used.has(cat)) return;
    used.add(cat);
    cats.push(cat);
    const list = ((((opt[sideKey] || {}).items) || {})[cat] || []).slice();
    window.LT_shuffleInPlace(list, rng);
    bag[cat] = list;
  };

  pairs.forEach((p) => {
    take("neg", p.neg, negItems, negCats, usedNeg);
    take("pos", p.pos, posItems, posCats, usedPos);
  });
  // 未进对照表的类别：追加在后，避免丢题
  ((opt.neg || {}).categories || []).forEach((c) => take("neg", c, negItems, negCats, usedNeg));
  ((opt.pos || {}).categories || []).forEach((c) => take("pos", c, posItems, posCats, usedPos));

  const side_order = rng() < 0.5 ? ["neg", "pos"] : ["pos", "neg"];
  return {
    neg: Object.assign({}, opt.neg || {}, { categories: negCats, items: negItems }),
    pos: Object.assign({}, opt.pos || {}, { categories: posCats, items: posItems }),
    side_order,
    shuffle_seed: seed,
    domain_pairs: pairs,
  };
};


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
