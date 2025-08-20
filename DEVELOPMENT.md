# CECP 投影系统开发指南

## 项目概述

CECP 投影系统是一个基于 Electron 的桌面应用程序，专为教会和宗教聚会设计，用于在大屏幕上投影圣经经文。

## 开发环境设置

### 环境要求

- Node.js 18.x 或更高版本
- npm 或 yarn
- Git

### 安装依赖

```bash
npm install
```

### 开发运行

```bash
npm start
```

## 项目结构

```
CECP 投影/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本
├── store.js             # 配置存储
├── db.js                # 数据库操作
├── package.json         # 项目配置
├── data/
│   └── bible.db         # 圣经数据库
├── renderer/
│   ├── control.html     # 控制界面
│   ├── control.js       # 控制逻辑
│   ├── projector.html   # 投影界面
│   ├── projector.js     # 投影逻辑
│   └── key-recorder.js  # 按键录制器
└── .github/
    └── workflows/       # GitHub Actions 工作流
        ├── build.yml    # CI 构建
        └── release.yml  # 发布构建
```

## 核心功能

### 1. 经文显示
- 从 SQLite 数据库读取圣经经文
- 支持搜索和浏览功能
- 实时预览和投影显示

### 2. 自定义快捷键
- 使用 `KeyRecorder` 类录制键盘组合
- 支持修饰键（Ctrl、Shift、Alt、Meta）
- 可自定义导航和控制快捷键

### 3. 多屏幕支持
- 分离控制窗口和投影窗口
- 支持多显示器设置
- 实时同步显示内容

### 4. 样式自定义
- 可调整字体、大小、颜色
- 支持背景图片和颜色
- 响应式布局设计

## 构建和发布

### 本地构建

#### Windows
```bash
npm run build:win
```

#### macOS
```bash
npm run build:mac
```

#### Linux
```bash
npm run build:linux
```

### 自动化构建

项目配置了 GitHub Actions 自动化构建：

- **CI 构建** (`.github/workflows/build.yml`)
  - 在每次推送到主分支时触发
  - 运行基本测试和 Linux 构建
  - 适用于日常开发验证

- **发布构建** (`.github/workflows/release.yml`)
  - 在推送版本标签时触发（如 `v1.0.0`）
  - 构建所有平台的安装包
  - 自动创建 GitHub Release
  - 上传构建产物到发布页面

### 发布新版本

1. 更新 `package.json` 中的版本号
2. 提交更改到 Git
3. 创建并推送版本标签：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. GitHub Actions 将自动构建和发布

## 技术栈

- **Electron**: 跨平台桌面应用框架
- **Node.js**: JavaScript 运行时
- **SQLite**: 轻量级数据库
- **Canvas API**: 2D 图形渲染
- **GitHub Actions**: CI/CD 自动化
- **electron-builder**: 跨平台打包工具

## 关键代码模块

### KeyRecorder 类 (`renderer/key-recorder.js`)

```javascript
class KeyRecorder {
    constructor() {
        this.recording = false;
        this.keys = [];
    }
    
    startRecording() {
        // 开始录制键盘输入
    }
    
    stopRecording() {
        // 停止录制并返回结果
    }
    
    formatCombination(keys) {
        // 格式化按键组合字符串
    }
}
```

### 渲染优化 (`control.js` / `projector.js`)

```javascript
function renderBlendedHighlight(ctx, text, x, y, width, height, baseOpacity) {
    // 优化的文字渲染，支持动画效果
    // 特殊处理固定标题区域
}
```

## 开发注意事项

1. **IPC 通信**: 主进程和渲染进程之间使用 IPC 进行安全通信
2. **安全策略**: 启用了 `nodeIntegration: false` 和 `contextIsolation: true`
3. **数据库操作**: 所有数据库操作在主进程中执行
4. **配置管理**: 使用 `electron-store` 进行持久化配置存储
5. **跨平台兼容**: 注意不同操作系统的路径和行为差异

## 调试和测试

### 开发者工具
```bash
# 打开开发者工具
npm run dev
```

### 日志输出
- 主进程日志：控制台输出
- 渲染进程日志：开发者工具控制台

### 常见问题

1. **数据库路径问题**: 确保 `bible.db` 在正确的位置
2. **权限问题**: macOS 可能需要额外的权限设置
3. **字体渲染**: 不同系统的字体渲染可能有差异

## 贡献指南

1. Fork 本项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

此项目使用 MIT 许可证。详见 `LICENSE.txt` 文件。
