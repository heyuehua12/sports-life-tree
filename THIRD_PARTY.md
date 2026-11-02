# 来源与第三方组件

本仓库是体育经历研究的独立交互原型。保留原作者来源，不代表原作者背书本研究。

- 二维绘图核心来自用户提供的博导生命树 life-timeline v3.6.3；只读源快照为 `reference_notes/mentor-timeline-plugin.js`，适配脚本为 `questionnaire/prototype/adapt-mentor-draw.cjs`。[原版公开说明](https://zhenghui.fun/tools/life-tree)。
- 一般生活事件题干与分类来自用户提供的 `js_options.js`（选项表 v2.1），只读快照为 `reference_notes/mentor-options.js`；原版九宫格示范与练习来自 `js_lt-experiment.js`（v3.6.3），只读快照为 `reference_notes/mentor-experiment.js`。对应重建脚本为 `adapt-mentor-catalog.cjs`、`adapt-mentor-tutor.cjs`。教学适配加入本地保存、离开时清理计时器、键盘操作与减少动画。体育扩展条目独立标记，原版参考权重不作为体育研究常模。
- 三维查看器来自 [NRLab 生命树三维结果 v3.5](https://zhenghui.fun/tools/life-tree-viz)。原始 HTML 为 `reference_notes/mentor-3d-reference.html`；`questionnaire/prototype/mentor-3d/SOURCE.json` 记录原始 SHA-256 和适配点。
- Three.js 0.160.0、OrbitControls、SVGRenderer、Projector 来自 Three.js 官方发行版，遵循 MIT 许可，全文见 `questionnaire/prototype/vendor/three/LICENSE`。

原版生命树代码的权利归原权利人；本仓库未对其另行声明开源许可证。示例轨迹和截图均为交互演示或模拟数据，不是研究参与者作答。原版几何外推不构成本研究的预测模型。
