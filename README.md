# Flutter 镜像源替换工具

一个用于快速替换 Flutter 项目 Gradle 分发源的 VS Code 扩展，支持镜像源和本地 Gradle 文件。

## 功能特性

- ✅ **镜像源替换**：将 Gradle 下载地址替换为可配置的镜像源（默认腾讯云）
- ✅ **本地 Gradle 替换**：使用本地已缓存的 Gradle 文件，无需重复下载
- ✅ **智能版本匹配**：自动选择大于等于项目要求的最新本地版本
- ✅ **可配置路径**：支持自定义镜像源 URL 和本地 Gradle 路径
- ✅ **智能检测**：自动检测 Flutter 项目，避免重复修改
- ✅ **详细反馈**：提供清晰的修改结果提示

## 使用方法

### 替换为镜像源

1. 在 VS Code 中打开你的 Flutter 项目
2. 按 `Ctrl+Shift+P`（Windows/Linux）或 `Cmd+Shift+P`（macOS）打开命令面板
3. 输入并选择 `Flutter Mirror: 替换为腾讯云镜像源`
4. 等待替换完成，查看结果

### 替换为本地 Gradle 文件

1. 在 VS Code 设置中配置本地 Gradle 路径（可选）
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入并选择 `Flutter Mirror: 替换为本地 Gradle 文件`
4. 等待替换完成，查看结果

## 配置项

在 VS Code 设置中搜索 `flutterMirror` 可配置以下选项：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `flutterMirror.gradleMirrorUrl` | string | `mirrors.cloud.tencent.com/gradle` | 镜像源 URL |
| `flutterMirror.localGradlePath` | string | 空 | 本地 Gradle 分发目录路径 |

### 本地 Gradle 路径说明

只需填写 `.gradle` 目录即可，例如：
- Windows: `C:\Users\用户名\.gradle`
- macOS/Linux: `/Users/用户名/.gradle`

扩展会自动拼接后续路径。

## 工作原理

### 镜像源替换

修改 `android/gradle/wrapper/gradle-wrapper.properties` 文件：

**替换前：**
```
distributionUrl=https\://services.gradle.org/distributions/gradle-x.x-all.zip
```

**替换后：**
```
distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-x.x-all.zip
```

### 本地 Gradle 替换

1. 扫描本地 `.gradle/wrapper/dists/` 目录查找所有可用版本
2. 按版本号降序排列
3. 选择第一个大于等于项目要求的版本
4. 将 `distributionUrl` 替换为本地文件路径

**示例：**
- 项目要求: Gradle 7.5
- 本地可用: 7.5, 8.0, 8.1
- 自动选择: **8.1**（最新的满足要求的版本）

## 要求

- VS Code 版本：^1.107.0
- Flutter 项目（包含 `android` 目录）

## 已知问题

- 如果项目没有标准的 Flutter Android 目录结构，可能无法正常工作
- 本地 Gradle 替换需要预先下载好对应的 Gradle 分发包

## 更新日志

详细的更新日志请查看 [CHANGELOG.md](CHANGELOG.md)

### 1.2.0 (2026-04-30)

- ✅ 新增可配置镜像源 URL 功能
- ✅ 新增本地 Gradle 文件替换功能
- ✅ 新增智能版本匹配算法
- ✅ 支持自动选择大于等于要求版本的最新本地版本
- ✅ 新增本地 Gradle 路径配置项
- ✅ 优化错误提示信息，显示可用版本列表

### 0.0.1 (2026-02-07)

- ✅ 初始版本发布
- ✅ 自动替换 `android/gradle/wrapper/gradle-wrapper.properties` 中的 Gradle 分发源
- ✅ 命令面板集成（`Flutter: 替换为国内镜像源`）
- ✅ 智能检测 Flutter 项目
- ✅ 智能跳过已配置的镜像源
- ✅ 提供清晰的修改结果反馈

## 开发

### 安装依赖

```bash
bun install
```

### 编译

```bash
bun run compile
```

### 打包

```bash
bun run package
```

### 运行测试

```bash
bun run test
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 镜像源说明

本扩展默认使用以下镜像源：

- **腾讯云 Gradle 镜像**：https://mirrors.cloud.tencent.com/gradle/

可通过设置 `flutterMirror.gradleMirrorUrl` 自定义为其他镜像源。
