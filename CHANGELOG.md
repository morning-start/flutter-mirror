# 更新日志

本文件记录 "flutter-mirror" 扩展的所有重要变更。

参考 [Keep a Changelog](http://keepachangelog.com/) 了解如何构建此文件。

## [Unreleased]

### 新增

- 初始版本发布
- 支持替换 Gradle 分发源为腾讯云镜像
- 自动检测 Flutter 项目
- 智能避免重复修改
- 提供清晰的修改结果反馈

## [0.0.1] - 2026-02-07

### 新增

- ✅ 自动替换 `android/gradle/wrapper/gradle-wrapper.properties` 中的 Gradle 分发源
  - 将官方源替换为腾讯云镜像源
- ✅ 命令面板集成
  - 添加 `Flutter: 替换为国内镜像源` 命令
- ✅ 项目检测
  - 自动检测是否为 Flutter 项目（检查 pubspec.yaml）
  - 检查 Android 目录是否存在
- ✅ 智能跳过
  - 检测已配置的镜像源，避免重复添加
- ✅ 结果反馈
  - 显示修改结果摘要

### 使用的镜像源

- 腾讯云 Gradle 镜像：
  - https://mirrors.cloud.tencent.com/gradle/

### 技术栈

- TypeScript
- VS Code Extension API
- Node.js 文件系统操作

### 已知限制

- 需要标准的 Flutter Android 目录结构
