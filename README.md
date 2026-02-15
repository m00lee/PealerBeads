# PealerBeads - 拼豆设计工具 | Bead Art Pattern Designer

<p align="center">
  <strong>🎨 专业级拼豆图案设计工具，支持图片导入、像素编辑、3D 预览与多格式导出</strong>
  <br/>
  <em>A professional perler/fuse bead pattern designer with image import, pixel editing, 3D preview & multi-format export.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue" alt="version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
  <img src="https://img.shields.io/badge/platform-Desktop-orange" alt="platform" />
  <img src="https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri" alt="tauri" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="react" />
  <img src="https://img.shields.io/badge/Three.js-0.182-black?logo=threedotjs" alt="three.js" />
</p>

---

## 目录 | Table of Contents

- [功能特性 | Features](#功能特性--features)
- [截图 | Screenshots](#截图--screenshots)
- [技术栈 | Tech Stack](#技术栈--tech-stack)
- [快速开始 | Getting Started](#快速开始--getting-started)
- [项目结构 | Project Structure](#项目结构--project-structure)
- [使用指南 | Usage Guide](#使用指南--usage-guide)
- [键盘快捷键 | Keyboard Shortcuts](#键盘快捷键--keyboard-shortcuts)
- [色号系统 | Color Systems](#色号系统--color-systems)
- [导出格式 | Export Formats](#导出格式--export-formats)
- [开发 | Development](#开发--development)
- [许可证 | License](#许可证--license)

---

## 功能特性 | Features

### 🖼️ 图片导入与处理 | Image Import & Processing

- **拖拽/选择导入** — 支持 JPG、PNG、WebP、GIF 格式
  <br/>*Drag & drop or file picker — supports JPG, PNG, WebP, GIF*
- **图片变换** — 旋转 (90°/180°/270°)、水平/垂直翻转
  <br/>*Image transforms — rotation, horizontal/vertical flip*
- **裁剪工具** — 可视化裁剪框，支持四角拖拽、三分法辅助线
  <br/>*Visual crop tool with draggable corners and rule-of-thirds overlay*
- **色彩调节** — 亮度、对比度、饱和度、色相旋转、灰度
  <br/>*Color adjustments — brightness, contrast, saturation, hue rotation, grayscale*
- **智能像素化** — 主色模式 (Dominant) / 均值模式 (Average)
  <br/>*Smart pixelation — dominant color or average color sampling*
- **抖动算法** — Floyd-Steinberg 误差扩散 / Bayer 有序抖动，可调强度
  <br/>*Dithering — Floyd-Steinberg error diffusion / Bayer ordered dithering with adjustable strength*
- **O(1) 色彩查找表** — 预构建 32³ 色彩查找表 (CLT)，实现近似最近色 O(1) 查询
  <br/>*O(1) Color Lookup Table — pre-built 32³ CLT for instant nearest-color matching*
- **感知色差算法** — 使用 Redmean 加权感知距离替代简单欧氏距离
  <br/>*Perceptual distance — uses weighted Redmean formula instead of naive Euclidean RGB distance*

### 🎨 像素编辑 | Pixel Editing

- **9 种绘图工具** — 画笔、橡皮擦、油漆桶 (洪水填充)、取色器、选择、移动、线条、矩形、圆形
  <br/>*9 drawing tools — Pencil, Eraser, Fill (flood fill), Eyedropper, Select, Move, Line, Rectangle, Circle*
- **可调笔刷** — 1–5 像素笔刷大小
  <br/>*Adjustable brush — 1–5 pixel brush sizes*
- **对称绘制** — 水平对称 / 垂直对称 / 双向对称
  <br/>*Symmetry drawing — horizontal, vertical, or both axis mirroring*
- **形状绘制** — Bresenham 直线算法、矩形框、中点圆算法
  <br/>*Shape tools — Bresenham's line, rectangle outline, midpoint circle algorithm*
- **洪水填充** — 四方向连通区域填充 / 擦除
  <br/>*Flood fill — 4-directional connected region fill & erase*
- **颜色替换** — 全局替换指定颜色，结构共享优化
  <br/>*Color replace — global color substitution with structural sharing optimization*

### 🔄 撤销/重做 | Undo/Redo

- 基于 **Zundo** (Zustand middleware) 的时间旅行状态管理，最多 100 步历史记录
  <br/>*Time-travel state management via Zundo (Zustand middleware), up to 100 history steps*

### 🖥️ 画布与视口 | Canvas & Viewport

- **双层 Canvas 架构** — 静态网格层 + 交互层 (悬停、选区、形状预览)
  <br/>*Dual-layer Canvas — static grid layer + interaction layer (hover, selection, shape preview)*
- **方格 / 六角网格** — 支持正方形和六角形两种网格布局
  <br/>*Square / Hexagonal grid — two grid layout modes*
- **5 种预览模式** — 像素图、拼豆珠视图、色块视图、纯网格、原图叠加
  <br/>*5 preview modes — Pixelated, Bead View, Color Block, Grid Only, Original Overlay*
- **拟真拼豆渲染** — 带有高光、暗部、中心小孔的 3D 风格珠子渲染
  <br/>*Realistic bead rendering — 3D-styled beads with highlights, shadows, and center hole*
- **鼠标滚轮缩放** — 朝鼠标位置缩放 (0.1x–20x)，中键拖拽平移
  <br/>*Mouse wheel zoom — zoom towards cursor (0.1x–20x), middle-click pan*
- **粗网格线** — 每 N 格加粗 (可配置，默认每 5 格)
  <br/>*Bold grid lines — configurable interval (default: every 5 cells)*
- **HiDPI 支持** — 自动适配高分屏 (devicePixelRatio)
  <br/>*HiDPI support — automatic devicePixelRatio scaling*
- **ResizeObserver** — 自动响应容器尺寸变化重绘
  <br/>*Responsive — auto-redraw via ResizeObserver*

### 🧊 3D 预览 | 3D Preview

- 基于 **Three.js + React Three Fiber** 的实时 3D 拼豆预览
  <br/>*Real-time 3D bead preview powered by Three.js + React Three Fiber*
- **Lathe 几何体** — 逼真地模拟拼豆中空圆柱外形 (倒角边缘)
  <br/>*Lathe geometry — realistic hollow cylinder bead shape with beveled edges*
- **底板 + 插针** — 3D 底板与插针渲染
  <br/>*Pegboard + pegs — 3D pegboard base with peg rendering*
- **Instanced Mesh** — 按颜色分组使用实例化网格，大幅提升渲染性能
  <br/>*Instanced Mesh — grouped by color for high-performance rendering*
- **轨道控制** — 鼠标拖拽旋转、缩放、平移 3D 场景
  <br/>*Orbit Controls — rotate, zoom, and pan the 3D scene*
- **懒加载** — Three.js 按需加载，不影响首屏性能
  <br/>*Lazy loading — Three.js is code-split and loaded on demand*

### 🎨 调色板 | Color Palette

- **5 大拼豆色号系统** — MARD、COCO、漫漫、盼盼、咪小窝
  <br/>*5 bead color systems — MARD, COCO, 漫漫 (ManMan), 盼盼 (PanPan), 咪小窝 (MiXiaoWo)*
- **统一色号映射表** — 基于 JSON 的跨系统 HEX → 色号映射
  <br/>*Unified color mapping — JSON-based cross-system HEX → color code mapping*
- **色相排序** — 按 HSL 色相值智能排序，视觉更直观
  <br/>*Hue sorting — intelligent HSL-based hue sorting for visual browsing*
- **搜索过滤** — 按色号或 HEX 值搜索
  <br/>*Search & filter — search by color code or HEX value*
- **颜色锁定** — 右键锁定/解锁颜色，防止被优化合并
  <br/>*Color locking — right-click to lock/unlock colors from optimization*

### ⚡ 颜色优化 | Color Optimization

- **相近色自动合并** — 基于感知色差的贪心合并算法
  <br/>*Auto color merging — greedy merge algorithm based on perceptual color distance*
- **4 档预设** — 轻度 (85%)、中度 (65%)、重度 (45%)、极简 (25%)
  <br/>*4 presets — Light (85%), Medium (65%), Heavy (45%), Minimal (25%)*
- **合并预览** — 预览每对合并的颜色、珠数、色差值
  <br/>*Merge preview — preview each merge pair with bead count and distance value*
- **滑块精细控制** — 目标颜色数量滑块，实时计算合并方案
  <br/>*Slider control — target color count slider with real-time merge plan calculation*

### 📁 多格式导出 | Multi-Format Export

- **PNG 图片** — 带网格线 / 符号编号 / 拼豆珠样式的高清底稿
  <br/>*PNG image — high-res pattern with optional grid lines, symbols, and bead style rendering*
- **PDF 文档** — 分页打印 (A4/A3/Letter)，带行列标号、颜色图例、符号图例
  <br/>*PDF document — paginated print (A4/A3/Letter) with row/column labels, color legend, and symbol legend*
  - CJK 中文文字通过 Canvas→Image 方式渲染，避免 jsPDF 字体问题
    <br/>*CJK text rendered via Canvas→Image to avoid jsPDF font issues*
  - Excel 风格列标号 (A, B, ... Z, AA, AB, ...)
    <br/>*Excel-style column labels (A, B, ... Z, AA, AB, ...)*
- **CSV 表格** — 颜色统计 / 采购清单 (色号、HEX、数量、占比)
  <br/>*CSV spreadsheet — color statistics / purchase list (code, HEX, count, percentage)*
- **JSON 数据** — 完整网格数据，可用于程序化处理或项目恢复
  <br/>*JSON data — full grid data for programmatic processing or project recovery*

### 📐 板型分割导出 | Board Split Export

- **7 种标准板型预设** — 8×8 迷你板 ~ 58×29 长板
  <br/>*7 standard board presets — 8×8 mini to 58×29 long board*
- **3 种堆叠方式** — 标准排列、六密堆叠、砖砌堆叠
  <br/>*3 stacking modes — Standard grid, hex-dense offset, brick offset*
- **全局预览** — 所有板块位置一览
  <br/>*Global overview — see all board positions at a glance*
- **批量下载** — 每块板独立导出为带标记的 PNG
  <br/>*Batch download — export each board as individually labeled PNG*

### 📊 颜色统计 | Color Statistics

- 实时颜色使用统计 — 色号、HEX、使用数量、占比百分比
  <br/>*Real-time color usage statistics — code, HEX, count, percentage*
- **缓存优化** — 引用相等性检测，避免无变化时重复计算
  <br/>*Cached computation — reference equality check to skip redundant recalculations*

### ⌨️ 工作流 | Workflow

- **完整快捷键体系** — 工具切换、撤销重做、缩放、导入导出
  <br/>*Full keyboard shortcut system — tool switching, undo/redo, zoom, import/export*
- **项目命名** — 自定义项目名称，导出文件自动使用项目名
  <br/>*Project naming — custom name reflected in exported filenames*
- **状态栏** — 实时显示网格尺寸、当前工具、缩放比例、选中颜色
  <br/>*Status bar — live display of grid size, current tool, zoom level, selected color*

---

## 技术栈 | Tech Stack

| 层级 Layer | 技术 Technology | 说明 Description |
|---|---|---|
| **框架 Framework** | React 19 | 前沿 React 版本 / Cutting-edge React |
| **桌面壳 Desktop Shell** | Tauri 2 | 轻量原生桌面应用 / Lightweight native desktop app |
| **语言 Language** | TypeScript + Rust | 前端 TS，后端 Rust / Frontend TS, Backend Rust |
| **构建 Build** | Vite 6 | 极速 HMR 开发体验 / Blazing fast HMR |
| **状态管理 State** | Zustand 5 + Zundo 2 | 极简状态 + 时间旅行 / Minimal state + time travel |
| **3D 渲染 3D** | Three.js 0.182 + R3F 9 + Drei 10 | 实时 3D 预览 / Real-time 3D preview |
| **样式 Styling** | Tailwind CSS 3 | 实用优先 CSS / Utility-first CSS |
| **PDF 导出 PDF** | jsPDF + jspdf-autotable | PDF 生成与表格 / PDF generation with auto tables |
| **图标 Icons** | Lucide React | 一致的 SVG 图标 / Consistent SVG icons |
| **打包 Bundle** | AppImage / DEB | Linux 桌面打包 / Linux desktop packaging |

---

## 快速开始 | Getting Started

### 前提条件 | Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri desktop build)
- System dependencies for Tauri — see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### 安装 | Install

```bash
# 克隆仓库 / Clone the repo
git clone https://github.com/your-username/PealerBeads.git
cd PealerBeads

# 安装依赖 / Install dependencies
npm install
```

### 开发 | Development

```bash
# 纯 Web 开发模式 (浏览器) / Web-only dev mode (browser)
npm run dev

# Tauri 桌面开发模式 / Tauri desktop dev mode
npm run tauri:dev
```

### 构建 | Build

```bash
# 构建 Web 前端 / Build web frontend
npm run build

# 构建 Tauri 桌面应用 (AppImage / DEB) / Build Tauri desktop app
npm run tauri:build
```

---

## 项目结构 | Project Structure

```
PealerBeads/
├── src/
│   ├── App.tsx                          # 主应用布局 / Main app layout
│   ├── main.tsx                         # 入口 / Entry point
│   ├── index.css                        # 全局样式 (Tailwind) / Global styles
│   ├── components/
│   │   ├── Toolbar.tsx                  # 顶部工具栏 / Top toolbar
│   │   ├── StatusBar.tsx                # 底部状态栏 / Bottom status bar
│   │   ├── Canvas/
│   │   │   └── EditorCanvas.tsx         # 双层画布编辑器 / Dual-layer canvas editor
│   │   ├── Export/
│   │   │   ├── ExportPanel.tsx          # 导出面板 (PNG/PDF/CSV/JSON) / Export panel
│   │   │   └── BoardExportPanel.tsx     # 板型分割导出 / Board split export
│   │   ├── ImageImport/
│   │   │   └── ImageImportModal.tsx     # 图片导入 (裁剪/调色/变换) / Image import modal
│   │   ├── Palette/
│   │   │   ├── ColorPalette.tsx         # 调色板面板 / Color palette panel
│   │   │   └── ColorOptimizePanel.tsx   # 颜色优化 (合并相近色) / Color optimization
│   │   ├── Preview3D/
│   │   │   └── Preview3D.tsx            # 3D 拼豆预览 / 3D bead preview
│   │   └── Sidebar/
│   │       ├── LeftSidebar.tsx          # 左侧工具栏 / Left tool sidebar
│   │       └── RightSidebar.tsx         # 右侧面板 (调色板/统计/设置) / Right panel
│   ├── data/
│   │   └── colorSystemMapping.json      # 色号映射表 / Color system mapping data
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts      # 全局快捷键 / Global keyboard shortcuts
│   ├── lib/
│   │   ├── pixelation.ts               # 像素化引擎 (CLT, 感知色差) / Pixelation engine
│   │   ├── dithering.ts                # 抖动算法 (F-S, Bayer) / Dithering algorithms
│   │   ├── colorSystem.ts              # 色号系统 (5系统) / Color system utilities
│   │   ├── colorOptimize.ts            # 颜色优化 (贪心合并) / Color optimization
│   │   ├── pixelEditing.ts             # 像素编辑 (填充/形状/替换) / Pixel editing ops
│   │   ├── floodFill.ts                # 洪水填充 / Flood fill algorithm
│   │   ├── canvasUtils.ts              # Canvas 工具 (坐标/六角/珠渲染) / Canvas utilities
│   │   ├── exportUtils.ts              # 导出工具 (PNG/CSV/JSON) / Export utilities
│   │   ├── pdfExport.ts                # PDF 导出 (分页/CJK) / PDF export
│   │   └── boardExport.ts              # 板型分割导出 / Board split export
│   ├── store/
│   │   └── useStore.ts                  # Zustand 全局状态 / Global Zustand store
│   └── types/
│       └── index.ts                     # TypeScript 类型定义 / Type definitions
├── src-tauri/
│   ├── tauri.conf.json                  # Tauri 应用配置 / Tauri app config
│   ├── Cargo.toml                       # Rust 依赖 / Rust dependencies
│   └── src/
│       └── main.rs                      # Tauri 入口 / Tauri entry point
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 使用指南 | Usage Guide

### 1. 创建或导入 | Create or Import

- **空白画布** — 在右侧设置面板修改网格尺寸 (N×M)，点击应用创建空白网格
  <br/>*Blank canvas — set grid dimensions (N×M) in the right panel settings*
- **导入图片** — 点击顶部工具栏「导入图片」或按 `Ctrl+I`，拖拽/选择图片进入导入面板
  <br/>*Import image — click the import button or press `Ctrl+I`*

### 2. 编辑 | Edit

- 从左侧工具栏选择工具进行绘制
  <br/>*Select a tool from the left sidebar to draw*
- 从右侧调色板选择颜色
  <br/>*Pick a color from the right-side palette*
- 使用鼠标滚轮缩放，中键拖拽平移
  <br/>*Scroll to zoom, middle-click to pan*

### 3. 预览 | Preview

- 在顶部工具栏切换 5 种预览模式
  <br/>*Switch between 5 preview modes from the top toolbar*
- 点击「3D 预览」按钮查看拟真 3D 效果
  <br/>*Click "3D Preview" for a realistic 3D view*

### 4. 优化 | Optimize

- 点击「颜色优化」按钮，调整目标颜色数量，预览并应用合并
  <br/>*Click "Color Optimize" to reduce color count by merging similar colors*

### 5. 导出 | Export

- 按 `Ctrl+E` 或点击「导出」按钮选择导出格式
  <br/>*Press `Ctrl+E` or click "Export" to choose an export format*
- 使用「板型分割」导出大型作品的分板底稿
  <br/>*Use "Board Split" export for large designs that span multiple boards*

---

## 键盘快捷键 | Keyboard Shortcuts

| 快捷键 Shortcut | 功能 Action |
|---|---|
| `B` | 画笔 Pencil |
| `E` | 橡皮擦 Eraser |
| `G` | 油漆桶 Fill |
| `I` | 取色器 Eyedropper |
| `V` | 选择 Select |
| `H` | 移动 Move |
| `L` | 线条 Line |
| `R` | 矩形 Rectangle |
| `C` | 圆形 Circle |
| `Ctrl+Z` | 撤销 Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | 重做 Redo |
| `Ctrl+I` | 导入图片 Import Image |
| `Ctrl+E` | 导出 Export |
| `Ctrl+=` | 放大 Zoom In |
| `Ctrl+-` | 缩小 Zoom Out |
| `Ctrl+0` | 重置缩放 Reset Zoom |

---

## 色号系统 | Color Systems

PealerBeads 内置 5 种中国主流拼豆色号系统的完整映射：

*PealerBeads includes full color mappings for 5 major Chinese perler bead color systems:*

| 系统 System | 英文 English |
|---|---|
| MARD | MARD |
| COCO | COCO |
| 漫漫 | ManMan |
| 盼盼 | PanPan |
| 咪小窝 | MiXiaoWo |

所有系统共享统一的 HEX 颜色映射表 (`colorSystemMapping.json`)，可在任意系统间自由切换，色号自动转换。

*All systems share a unified HEX color mapping table, allowing seamless switching between systems with automatic code translation.*

---

## 导出格式 | Export Formats

| 格式 Format | 说明 Description |
|---|---|
| **PNG** | 彩色底稿 / 符号底稿 / 拼豆珠样式，可选网格线与编号 |
| | *Color pattern / symbol pattern / bead style, with optional grid lines and labels* |
| **PDF** | 分页打印文档，支持 A4/A3/Letter，含行列标号与颜色图例 |
| | *Paginated print document, A4/A3/Letter, with row/column labels and color legend* |
| **CSV** | 颜色统计表 / 采购清单 (含 BOM UTF-8) |
| | *Color statistics / purchase list (BOM UTF-8 encoded)* |
| **JSON** | 完整网格数据与颜色统计，可编程处理 |
| | *Full grid data and color stats for programmatic use* |
| **Board Split** | 按标准板型分割大图，每板独立 PNG |
| | *Split large designs into standard board-sized PNGs* |

---

## 开发 | Development

### 依赖 | Dependencies

**运行时 Runtime:**

| 包 Package | 版本 Version | 用途 Purpose |
|---|---|---|
| react | ^19.0.0 | UI 框架 / UI Framework |
| react-dom | ^19.0.0 | DOM 渲染 / DOM Renderer |
| zustand | ^5.0.3 | 状态管理 / State Management |
| zundo | ^2.3.0 | 撤销/重做中间件 / Undo/Redo Middleware |
| three | ^0.182.0 | 3D 渲染引擎 / 3D Rendering Engine |
| @react-three/fiber | ^9.5.0 | React Three.js 绑定 / React Three.js Bindings |
| @react-three/drei | ^10.7.7 | R3F 工具库 / R3F Helpers |
| jspdf | ^2.5.2 | PDF 生成 / PDF Generation |
| jspdf-autotable | ^3.8.4 | PDF 表格 / PDF Auto Tables |
| lucide-react | ^0.474.0 | SVG 图标 / SVG Icons |
| tailwind-merge | ^3.0.2 | 类名合并 / Class Merging |
| clsx | ^2.1.1 | 条件类名 / Conditional Classes |

**开发 Dev:**

| 包 Package | 版本 Version |
|---|---|
| @tauri-apps/cli | ^2.0.0 |
| vite | ^6.1.0 |
| typescript | ~5.7.3 |
| tailwindcss | ^3.4.17 |
| @vitejs/plugin-react | ^4.3.4 |

**Rust (Tauri):**

| Crate | Version |
|---|---|
| tauri | 2 |
| serde / serde_json | 1 |

---

## 许可证 | License

MIT License

---

<p align="center">
  <sub>Built with ❤️ for the perler bead community | 为拼豆爱好者们用心打造</sub>
</p>
