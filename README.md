# CECP 投影系统

<div align="center">

![CECP Logo](https://img.shields.io/badge/CECP-投影系统-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge)

**专业的教会圣经投影解决方案**

[下载安装](#-下载安装) •
[功能特性](#-核心特性) •
[使用指南](#-基本使用) •
[开发指南](#-开发指南) •
[技术支持](#-技术支持)

</div>

---

## 📖 项目简介

CECP 投影系统是一个基于 Electron 开发的现代化桌面应用程序，专为教会、团契和宗教聚会设计。提供跨平台的圣经经文投影解决方案，支持实时预览、多屏幕显示和完全自定义的用户体验。

## ✨ 核心特性

### 🎯 核心功能
- **📚 圣经经文管理**: 完整的圣经数据库，支持快速搜索和浏览
- **🖥️ 多屏幕投影**: 分离式控制界面，支持多显示器设置
- **⚡ 实时预览**: 投影内容实时预览，确保完美呈现
- **🎨 样式自定义**: 字体、颜色、背景完全可定制
- **⌨️ 快捷键系统**: 自定义键盘快捷键，操作更高效

### 🛠️ 高级特性
- **🎪 动画效果**: 平滑的文字动画和过渡效果
- **🔧 灵活配置**: 所有设置可保存和恢复
- **🚀 高性能渲染**: 基于 Canvas 的高效文字渲染
- **🔒 安全可靠**: 采用 Electron 安全最佳实践

## 📂 项目结构

```
CECP 投影/
├── 📁 src/                    # 源代码
│   ├── main.js               # Electron 主进程
│   ├── preload.js            # 预加载脚本
│   ├── store.js              # 配置存储
│   └── db.js                 # 数据库操作
├── 📁 renderer/              # 渲染进程文件
│   ├── control.html          # 控制界面
│   ├── control.js            # 控制逻辑
│   ├── projector.html        # 投影界面
│   ├── projector.js          # 投影逻辑
│   └── key-recorder.js       # 按键录制器
├── 📁 data/                  # 数据文件
│   └── bible.db              # 圣经数据库
├── 📁 assets/                # 资源文件
│   ├── icon.ico              # Windows 图标
│   └── icon.png              # Linux 图标
├── 📁 docs/                  # 文档
│   ├── DEVELOPMENT.md        # 开发指南
│   └── LICENSE.txt           # 许可证
└── 📁 .github/               # CI/CD 配置
    └── workflows/            # GitHub Actions 工作流
```

## � 下载安装

### 系统要求

| 操作系统 | 最低版本 | 推荐配置 |
|---------|----------|----------|
| Windows | Windows 10 | Windows 11 |
| macOS | macOS 10.13 | macOS 12+ |
| Linux | Ubuntu 18.04 | Ubuntu 20.04+ |

### 安装步骤

#### 🪟 Windows 用户
1. 下载 `CECP-投影-Setup-*.exe` 安装包
2. 右键选择"以管理员身份运行"
3. 按照安装向导完成安装
4. 从开始菜单启动应用

#### 🍎 macOS 用户
1. 下载对应架构的 `.dmg` 文件
   - Intel 芯片: `-mac-x64.dmg`
   - Apple Silicon: `-mac-arm64.dmg`
   - 通用版本: `-mac-universal.dmg`
2. 双击打开 DMG 文件
3. 将应用拖拽到"应用程序"文件夹
4. 首次运行时允许应用权限

#### 🐧 Linux 用户
选择适合您发行版的安装包：

**AppImage (推荐)**
```bash
chmod +x CECP-投影-*.AppImage
./CECP-投影-*.AppImage
```

**Debian/Ubuntu**
```bash
sudo dpkg -i cecp-投影_*_amd64.deb
sudo apt-get install -f  # 修复依赖
```

**RedHat/CentOS/Fedora**
```bash
sudo rpm -i cecp-投影-*.x86_64.rpm
```

## 🚀 快速开始

### 环境要求
- Node.js 18.x 或更高版本
- npm 或 yarn
- Git

### 安装和运行

```bash
# 安装依赖
npm install

# 开发运行
npm start

# 构建应用
npm run build

# 跨平台构建
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
npm run build:all     # 所有平台
```

## 🎮 基本使用

1. **启动应用**: 双击桌面图标或从应用菜单启动
2. **连接投影仪**: 确保第二个显示器已正确连接
3. **选择经文**: 在控制窗口中搜索或浏览所需经文
4. **开始投影**: 点击投影按钮或使用快捷键

### 默认快捷键

| 功能 | 快捷键 | 说明 |
|------|--------|------|
| 投影开关 | `Shift+Space` | 切换投影状态 |
| 上一节 | `↑` | 显示上一节经文 |
| 下一节 | `↓` | 显示下一节经文 |
| 全屏切换 | `F11` | 全屏显示投影 |

*所有快捷键都可以在设置中自定义*

### 样式自定义

- **字体设置**: 支持系统字体和自定义字体
- **颜色配置**: 文字颜色、背景颜色自由调节
- **布局选项**: 文字对齐、行距、边距设置
- **背景支持**: 纯色背景或自定义图片

## � 开发指南

### 环境准备

```bash
# 克隆项目
git clone [项目地址]
cd CECP-投影

# 安装依赖
npm install

# 启动开发环境
npm start
```

### 构建脚本

```bash
npm run build:win     # 构建 Windows 版本
npm run build:mac     # 构建 macOS 版本
npm run build:linux   # 构建 Linux 版本
npm run build:all     # 构建所有平台版本
```

### 技术栈

- **Electron**: 跨平台桌面应用框架
- **Node.js**: JavaScript 运行时
- **SQLite**: 轻量级数据库
- **Canvas API**: 2D 图形渲染
- **GitHub Actions**: CI/CD 自动化
- **electron-builder**: 跨平台打包工具

### 构建系统

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

详细开发文档请参考 [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md)

## 🤝 技术支持

### 常见问题

<details>
<summary>应用无法启动</summary>

1. 检查系统版本是否满足要求
2. 尝试以管理员权限运行
3. 检查防病毒软件是否误拦截
</details>

<details>
<summary>投影显示异常</summary>

1. 确认第二个显示器正确连接
2. 检查显示器分辨率设置
3. 重启应用程序
</details>

<details>
<summary>快捷键不生效</summary>

1. 检查是否有其他软件占用快捷键
2. 重新设置快捷键组合
3. 重启应用程序
</details>

### 联系我们

如果您在使用过程中遇到问题或有建议：

- 📧 **提交 Issue**: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 **讨论交流**: [GitHub Discussions](https://github.com/your-repo/discussions)
- 📖 **查看文档**: [完整文档](./docs/)

## 🎯 发展路线

- [x] 基础投影功能
- [x] 自定义快捷键
- [x] 跨平台支持
- [x] 自动化构建
- [ ] 插件系统
- [ ] 云端同步
- [ ] 多语言支持
- [ ] 移动端遥控

## � 致谢

感谢所有为这个项目做出贡献的开发者和用户。

## �📄 许可证

本项目采用 MIT 许可证 - 详见 [`docs/LICENSE.txt`](./docs/LICENSE.txt) 文件。

---

<div align="center">

**Made with ❤️ for the Church Community**

[![GitHub stars](https://img.shields.io/github/stars/your-repo/cecp-projection?style=social)](https://github.com/your-repo/cecp-projection)
[![GitHub forks](https://img.shields.io/github/forks/your-repo/cecp-projection?style=social)](https://github.com/your-repo/cecp-projection)

[⬆ 返回顶部](#cecp-投影系统)

</div>
