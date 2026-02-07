# Flutter 镜像源替换工具

一个用于快速替换 Flutter 项目 Gradle 分发源为国内镜像源的 VS Code 扩展。

## 功能特性

本扩展可以一键将 Flutter 项目的 Gradle 分发源替换为腾讯云镜像，大幅提升 Gradle 下载速度：

- ✅ **替换 Gradle 分发源**：将 Gradle 下载地址替换为腾讯云镜像
- ✅ **智能检测**：自动检测 Flutter 项目，避免重复修改
- ✅ **详细反馈**：提供清晰的修改结果提示

## 使用方法

1. 在 VS Code 中打开你的 Flutter 项目
2. 按 `Ctrl+Shift+P`（Windows/Linux）或 `Cmd+Shift+P`（macOS）打开命令面板
3. 输入并选择 `Flutter: 替换为国内镜像源`
4. 等待替换完成，查看结果

## 工作原理

本扩展会自动修改以下文件：

### `android/gradle/wrapper/gradle-wrapper.properties`

将 Gradle 分发 URL 从：

```
distributionUrl=https\://services.gradle.org/distributions/gradle-x.x-all.zip
```

替换为：

```
distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-x.x-all.zip
```

## 要求

- VS Code 版本：^1.107.0
- Flutter 项目（包含 `android` 目录）

## 已知问题

- 如果项目没有标准的 Flutter Android 目录结构，可能无法正常工作

## 更新日志

详细的更新日志请查看 [CHANGELOG.md](CHANGELOG.md)

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
pnpm install
```

### 编译

```bash
pnpm run compile
```

### 打包

```bash
pnpm run package
```

### 运行测试

```bash
pnpm run test
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 镜像源说明

本扩展使用的镜像源：

- **腾讯云 Gradle 镜像**：https://mirrors.cloud.tencent.com/gradle/
