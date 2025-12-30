# 像素猴 (Pixel Monkey) 鸿蒙系统移植指南

本文档旨在指导如何将基于 React + Tailwind 的 Web 应用迁移至鸿蒙 **ArkTS + ArkUI** 原生环境。

## 1. 核心架构映射

| Web 概念 | 鸿蒙 (HarmonyOS) 概念 | 说明 |
| :--- | :--- | :--- |
| HTML5 Canvas | `Canvas` 组件 + `CanvasRenderingContext2D` | 像素绘制逻辑基本一致，需注意离屏渲染以优化性能。 |
| LocalStorage | `Preferences` (用户首选项) | 存储作品元数据与用户设置。 |
| CSS Variables | `AppStorage` 或自定义 `ThemeModel` | 全局状态管理主题颜色。 |
| Lucide Icons | 鸿蒙矢量图标库 或 `Image` 组件 | 建议将 SVG 转换为鸿蒙矢量图标或使用资源图片。 |

## 2. UI 移植深度解析 (关键)

像素猴的 UI 充满了阴影、边框和特定材质感，在 ArkUI 中应按以下方式复刻：

### A. 硬件边框与阴影 (Cassette Button)
Web 中使用了 `box-shadow: inset ...`。在 ArkUI 中，推荐使用多层边框叠加或 `shadow` 属性。
- **ArkUI 实现**:
  ```typescript
  Button()
    .backgroundColor($r('app.color.hardware_beige'))
    .border({ width: 2, color: $r('app.color.border_dark') })
    .shadow({ radius: 0, color: '#7a7a6d', offsetX: 3, offsetY: 3 }) // 模拟硬阴影
  ```

### B. 响应式布局 (Flex to Column/Row)
像素猴的布局在 Web 中大量依赖 Tailwind 的 `flex-col`。
- **移植策略**:
  - 顶层使用 `Stack` 模拟 CRT 滤镜层叠。
  - 内容区使用 `Column` 嵌套 `Row`。
  - 针对折叠屏（华为 Mate X 系列），需使用 `Grid` 或 `Flex` 的动态权重实现画布自适应。

### C. 画布手势控制 (Pan & Zoom)
Web 使用了 `onWheel` 和 `onTouchStart` 手动计算。
- **鸿蒙原生增强**:
  - 使用 `PinchGesture` 处理双指缩放。
  - 使用 `PanGesture` 处理单指平移（当工具为 Pan 时）。
  - **注意**: 必须设置 `hitTestBehavior(HitTestMode.Block)` 来确保手势不与绘图冲突。

### D. AI 功能调用
鸿蒙应用无法直接访问 `process.env`。
- 请使用鸿蒙的 `http` 模块重新封装 `gemini.ts` 中的调用逻辑。
- 确保护照权限已配置（网络访问权限 `ohos.permission.INTERNET`）。

## 3. 性能优化建议

1. **像素点渲染**: 对于 64x64 及以上的画布，避免使用 `ForEach` 渲染成千上万个小方块组件（鸿蒙 Component 树过深会导致卡顿）。**必须使用单 `Canvas` 进行绘图。**
2. **主题切换**: 利用鸿蒙系统的 `Configuration` 变化监听，实现一键切换全局颜色方案，避免 UI 闪烁。
3. **离屏绘制**: 在图层合并或导出图片时，使用 `OffscreenCanvas` 进行后台处理。

## 4. 权限配置 (metadata.json)
需要在鸿蒙工程的 `module.json5` 中声明：
- `ohos.permission.INTERNET`: 调用 Gemini API。
- `ohos.permission.WRITE_IMAGE_VIDEO`: 保存作品到相册。
