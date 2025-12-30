
# 像素猴 (Pixel Monkey) 鸿蒙原生移植详细指南

本指南旨在帮助开发者将本项目最快速度移植到 **HarmonyOS ArkTS + ArkUI** 环境，并保持 1:1 的视觉一致性。

## 1. 核心映射表 (Web to ArkUI)

### 1.1 基础布局
- **HTML Container** -> `Column` / `Row`
- **Flex-1** -> `layoutWeight(1)`
- **Overflow-Hidden** -> `clip(true)`
- **Z-Index** -> `zIndex()`

### 1.2 材质与阴影 (UI 核心)
像素猴的复古感来源于“硬阴影”和“内阴影”。
- **外阴影 (Box Shadow)**: 使用 `.shadow({ radius: 0, color: '#1a1a1a', offsetX: 4, offsetY: 4 })`。注意 `radius` 设为 0 以模拟像素风格。
- **内阴影 (Inset Shadow)**: ArkUI 无直接 `inset shadow`，需使用 `Stack` 叠加。
  - 底层：背景色。
  - 中层：白色半透明渐变（左上）或黑色半透明（右下）。
  - 顶层：内容。

## 2. UI 资源处理 (图片化移植方案)
为了保证移植后的 UI 高度一致且减少代码实现复杂度，建议将以下 CSS 模拟的 UI 资源直接转为图片使用：

1. **CRT 扫描线纹理**: 
   - 建议在 ArkUI 中使用一张 256x256 的重复平铺 PNG 图片作为全屏 OverLay。
2. **按钮材质 (cassette-button)**: 
   - 将按钮的常态、按下态分别截图导出为 9-Patch (点九图)，在鸿蒙中使用 `backgroundImage` 配合 `backgroundImageResizable`。
3. **硬件外壳杂色 (Hardware Grain)**: 
   - 导出 `hardware-beige` 颜色的噪点纹理图，作为各面板背景，比纯色更具质感。
4. **图标 (Icons)**: 
   - 建议统一导出为 SVG 或使用鸿蒙内置图标库，确保在不同分辨率下清晰。

## 3. 布局逻辑优化
在最新版本中，我们优化了 `Gallery` 页面的布局：
- **标题区**: 移除了绝对定位的版本号标签，避免与标题文本发生重叠冲突。
- **底部操作区**: 版本号标签（storageLabel）现在以较低的不透明度（30%）垂直居中显示在“初始化新单元”按钮的上方，既起到装饰作用又不干扰主操作流。

## 4. 关键组件移植实现

### 4.1 画布 (Canvas)
- **ArkTS 核心**:
  ```typescript
  Canvas(this.context)
    .width('100%')
    .aspectRatio(1)
    .onReady(() => {
       // 实现像素绘制逻辑：循环 data 数组调用 context.fillRect()
    })
    .imageSmoothingEnabled(false) // 关键：关闭图像平滑，保持像素感
  ```

### 4.2 手势交互 (Zoom & Pan)
- 使用 `GestureGroup(GestureMode.Parallel)`。
- `PinchGesture`: 控制 `scaleX` 和 `scaleY`。
- `PanGesture`: 控制 `offsetX` 和 `offsetY`。

## 5. 存储迁移
- **Web**: `localStorage.getItem`
- **HarmonyOS**: `preferences.getPreferences` (用户首选项)
- 序列化方式一致：均使用 JSON 字符串存储。

## 6. 开发者快速 CheckList
- [ ] 将 CSS 样式中的 `box-shadow` 转换为 ArkUI 的 `.shadow` 属性。
- [ ] 在 `resources/base/media` 中放入导出的按钮九宫格图。
- [ ] 确保 `Canvas` 组件的渲染逻辑在 `onReady` 生命周期内执行。
- [ ] 适配鸿蒙的底部安全区（SafeArea）。
