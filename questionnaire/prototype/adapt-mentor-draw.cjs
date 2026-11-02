/* Rebuild the local drawing adapter from the mentor's supplied source.
 * Run from this directory: node adapt-mentor-draw.cjs
 * Read the retained source snapshot; no mentor repository is edited.
 */
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../reference_notes/mentor-timeline-plugin.js'), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const constants = between('  const POS =', '  const labelOcc');
const element = between('    _el(tag, attrs, text)', '    _checklist(');
let draw = between('    _draw(display_element, trial)', '    _tags(');
// Local adaptations: save after every stroke/undo, permit zero or one-sided
// sports histories, and require every selected sports item to be drawn.
draw = draw.replaceAll('String(next.item_key || "")', 'String(next.display_label || next.item_key || "")');
draw = draw.replaceAll('String(it.item_key || "")', 'String(it.display_label || it.item_key || "")');
draw = draw.replace('last.item_key + "」。可重新点选再画。"', '(last.display_label || pool.find((it) => it.item_key === last.item_key)?.display_label || last.item_key) + "」。请重新画。"');
draw = draw.replace('        const last = events.pop();', '        const last = events.pop();\n        if (trial.on_change) trial.on_change(events);');
draw = draw.replace('        events.push(ev);', '        events.push(ev);\n        if (trial.on_change) trial.on_change(events);');
const checksStart = draw.indexOf('        const undrawnCustom =');
const checksEnd = draw.indexOf('        if (n > trial.hard_max)', checksStart);
draw = draw.slice(0, checksStart) + `        if (available().length) {
          drawMsg.textContent = '还有 ' + available().length + ' 件经历未画，请按顺序画完，或返回修改勾选。';
          return;
        }

` + draw.slice(checksEnd);
// Preserve pointer placement when max-height creates SVG letterboxing.
const pointStart = draw.indexOf('        const rt = svg.getBoundingClientRect();');
const pointEnd = draw.indexOf('\n      };', pointStart);
draw = draw.slice(0, pointStart) + `        const src = e.touches && e.touches[0] ? e.touches[0] : e;
        const matrix = svg.getScreenCTM();
        const point = new DOMPoint(src.clientX, src.clientY).matrixTransform(matrix.inverse());
        return { x: Math.max(0, Math.min(VW, point.x)),
          y: Math.max(Y_NOW, Math.min(TY0, point.y)), t: performance.now() };` + draw.slice(pointEnd);
draw = draw.replace('      svg.style.touchAction = "none";', `      svg.style.touchAction = "none";
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', '生命树：纵向为年龄，左绿为负向，右紫为正向，离树干越远影响越大');
      drawMsg.id = 'drawStatus';
      drawMsg.setAttribute('role', 'status');`);
draw = draw.replace('        if (!activeItem) return;', '        if (!activeItem || drawing || e.isPrimary === false || (e.pointerType === "mouse" && e.button !== 0)) return;');
draw = draw.replace('drawing = { samples: [p], t0:', 'drawing = { pointerId: e.pointerId, samples: [p], t0:');
draw = draw.replaceAll('        if (!drawing) return;', '        if (!drawing || drawing.pointerId !== e.pointerId) return;');
draw = draw.replace('      svg.addEventListener("pointercancel", () => { drawing = null; redraw(); });', `      svg.addEventListener("pointercancel", (e) => {
        if (drawing && drawing.pointerId === e.pointerId) { drawing = null; redraw(); }
      });
      svg.addEventListener("lostpointercapture", () => { if (drawing) { drawing = null; redraw(); } });`);
const output = `/* Drawing core extracted from supplied life-timeline plugin (hosted v3.6.3).
 * Visuals, logarithmic impact mapping and sequential strokes are retained.
 * Local changes are documented in README.md and adapt-mentor-draw.cjs.
 */
(function () {
  "use strict";
${constants}
  window.MentorLifeTree = class {
    constructor(jsPsych) { this.jsPsych = jsPsych; }
${element}
${draw}
  };
})();
`;
fs.writeFileSync(path.join(__dirname, 'mentor-draw.js'), output);
const css = fs.readFileSync(path.join(__dirname, 'mentor-lt.css'), 'utf8');
const variables = css.slice(css.indexOf(':root'), css.indexOf('html, body')).replace(':root', '.mentor-tree-host');
const scoped = css.slice(css.indexOf('.lt-root {'));
fs.writeFileSync(path.join(__dirname, 'mentor-draw.css'), '/* Scoped from mentor lt.css v3.6.3; original retained in mentor-lt.css. */\n' + variables + '\n@scope (.mentor-tree-host) {\n' + scoped + '\n}\n');
