import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 腾讯云镜像Gradle分发URL
const TENCENT_GRADLE_DISTRIBUTION_URL = '//mirrors.cloud.tencent.com/gradle/';

// Gradle版本正则表达式
const GRADLE_VERSION_REGEX = /gradle-([^\s\/]+)-all\.zip/;
const DISTRIBUTION_URL_REGEX = /distributionUrl=https[:\\\/]+services\.gradle\.org\/distributions\/(gradle-[^\s]+\.zip)/;
const ALT_DISTRIBUTION_URL_REGEX = /distributionUrl=(https[^\s]*services\.gradle\.org[^\s]*)/;
const ANY_DISTRIBUTION_URL_REGEX = /distributionUrl=.*/;

/**
 * 获取默认的Gradle路径
 * 优先级：GRADLE_USER_HOME 环境变量 > 用户主目录/.gradle
 */
function getDefaultGradlePath(): string {
    const gradleUserHome = process.env.GRADLE_USER_HOME;
    const basePath = gradleUserHome || path.join(os.homedir(), '.gradle');
    return path.join(basePath, 'wrapper', 'dists');
}

/**
 * 获取本地Gradle路径配置
 * 优先级：用户配置 > 默认路径
 * 如果用户配置的是 .gradle 目录，自动拼接 wrapper/dists
 */
function getLocalGradlePath(): string {
    const config = vscode.workspace.getConfiguration('flutterMirror');
    const userConfiguredPath = config.get<string>('localGradlePath', '');
    if (!userConfiguredPath) {
        return getDefaultGradlePath();
    }
    // 用户可能只填写了 .gradle 目录，需要自动拼接 wrapper/dists
    const normalizedPath = path.normalize(userConfiguredPath);
    if (normalizedPath.endsWith('wrapper') || normalizedPath.endsWith('wrapper/dists')) {
        return normalizedPath;
    }
    return path.join(normalizedPath, 'wrapper', 'dists');
}

/**
 * 检查是否为Flutter项目
 */
function isFlutterProject(projectRoot: string): boolean {
    const pubspecPath = path.join(projectRoot, 'pubspec.yaml');
    return fs.existsSync(pubspecPath);
}

/**
 * 获取Android目录路径
 */
async function getAndroidDir(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
        vscode.window.showErrorMessage('请先打开一个Flutter项目文件夹');
        return null;
    }

    const projectRoot = workspaceFolders[0].uri.fsPath;

    if (!isFlutterProject(projectRoot)) {
        const action = await vscode.window.showWarningMessage(
            '当前项目似乎不是Flutter项目（未找到pubspec.yaml），是否继续？',
            '继续', '取消'
        );
        if (action !== '继续') {
            return null;
        }
    }

    const androidDir = path.join(projectRoot, 'android');
    if (!fs.existsSync(androidDir)) {
        vscode.window.showErrorMessage('未找到Android目录，请确保这是一个Flutter项目');
        return null;
    }

    return androidDir;
}

/**
 * 获取gradle-wrapper.properties文件路径
 */
function getGradleWrapperPropertiesPath(androidDir: string): string {
    return path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.properties');
}

/**
 * 读取gradle-wrapper.properties文件内容
 */
function readGradleWrapperProperties(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error('读取gradle-wrapper.properties失败:', error);
        return null;
    }
}

/**
 * 写入gradle-wrapper.properties文件
 */
function writeGradleWrapperProperties(filePath: string, content: string): boolean {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return true;
    } catch (error) {
        console.error('写入gradle-wrapper.properties失败:', error);
        return false;
    }
}

/**
 * 提取Gradle版本号
 */
function extractGradleVersion(content: string): string | null {
    const match = content.match(GRADLE_VERSION_REGEX);
    return match?.[1] ?? null;
}

/**
 * 查找本地Gradle zip文件
 */
function findLocalGradleZip(localGradlePath: string, gradleVersion: string): string | null {
    try {
        const distsDir = path.resolve(localGradlePath);
        if (!fs.existsSync(distsDir)) {
            return null;
        }

        const gradleDirName = `gradle-${gradleVersion}-all`;
        const gradleDirPath = path.join(distsDir, gradleDirName);

        if (!fs.existsSync(gradleDirPath)) {
            return null;
        }

        const entries = fs.readdirSync(gradleDirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const zipPath = path.join(gradleDirPath, entry.name, `${gradleDirName}.zip`);
                if (fs.existsSync(zipPath)) {
                    return zipPath;
                }
            }
        }

        return null;
    } catch (error) {
        console.error('查找本地Gradle文件时出错:', error);
        return null;
    }
}

/**
 * 将路径转换为file协议URL
 */
function toFileUrl(filePath: string): string {
    return `file:///${filePath.replace(/\\/g, '/')}`;
}

// ==================== 腾讯云镜像替换 ====================

/**
 * 替换为腾讯云镜像
 */
export async function replaceWithTencentMirror(): Promise<void> {
    const androidDir = await getAndroidDir();
    if (!androidDir) {
        return;
    }

    const result = await modifyGradleWrapperPropertiesForTencent(androidDir);
    showResultMessage(result, 'Flutter Gradle镜像替换成功！');
}

/**
 * 修改gradle-wrapper.properties为腾讯云镜像
 */
async function modifyGradleWrapperPropertiesForTencent(androidDir: string): Promise<string> {
    const filePath = getGradleWrapperPropertiesPath(androidDir);

    if (!fs.existsSync(filePath)) {
        return `⚠️ gradle-wrapper.properties: 文件不存在`;
    }

    const content = readGradleWrapperProperties(filePath);
    if (content === null) {
        return `❌ gradle-wrapper.properties: 读取失败`;
    }

    if (content.includes('mirrors.cloud.tencent.com/gradle')) {
        return `⏭️ gradle-wrapper.properties: 已使用腾讯云镜像，跳过`;
    }

    const newContent = replaceWithTencentUrl(content);
    
    if (newContent === content) {
        return `⏭️ gradle-wrapper.properties: 无需修改`;
    }

    if (!writeGradleWrapperProperties(filePath, newContent)) {
        return `❌ gradle-wrapper.properties: 写入失败`;
    }

    return `✅ gradle-wrapper.properties: 已成功替换为腾讯云镜像`;
}

/**
 * 将distributionUrl替换为腾讯云镜像URL
 */
function replaceWithTencentUrl(content: string): string {
    // 尝试匹配标准格式
    const match = content.match(DISTRIBUTION_URL_REGEX);
    if (match) {
        const gradleVersion = match[1];
        return content.replace(DISTRIBUTION_URL_REGEX, `distributionUrl=https\\:${TENCENT_GRADLE_DISTRIBUTION_URL}${gradleVersion}`);
    }

    // 尝试匹配其他格式
    const altMatch = content.match(ALT_DISTRIBUTION_URL_REGEX);
    if (altMatch) {
        const originalUrl = altMatch[1];
        const versionMatch = originalUrl.match(/gradle-([^\/]+)\.zip/);
        if (versionMatch) {
            const newUrl = `https\\:${TENCENT_GRADLE_DISTRIBUTION_URL}gradle-${versionMatch[1]}.zip`;
            return content.replace(ALT_DISTRIBUTION_URL_REGEX, `distributionUrl=${newUrl}`);
        }
    }

    return content;
}

// ==================== 本地Gradle替换 ====================

/**
 * 替换为本地Gradle文件
 */
export async function replaceWithLocalGradle(): Promise<void> {
    const androidDir = await getAndroidDir();
    if (!androidDir) {
        return;
    }

    const result = await modifyGradleWrapperPropertiesForLocal(androidDir);
    showResultMessage(result, '已替换为本地Gradle文件！');
}

/**
 * 修改gradle-wrapper.properties为本地Gradle文件
 */
async function modifyGradleWrapperPropertiesForLocal(androidDir: string): Promise<string> {
    const filePath = getGradleWrapperPropertiesPath(androidDir);

    if (!fs.existsSync(filePath)) {
        return `⚠️ gradle-wrapper.properties: 文件不存在`;
    }

    const content = readGradleWrapperProperties(filePath);
    if (content === null) {
        return `❌ gradle-wrapper.properties: 读取失败`;
    }

    const gradleVersion = extractGradleVersion(content);
    if (!gradleVersion) {
        return `⚠️ gradle-wrapper.properties: 无法解析Gradle版本`;
    }

    const localGradlePath = getLocalGradlePath();
    const localZipPath = findLocalGradleZip(localGradlePath, gradleVersion);

    if (!localZipPath) {
        return `❌ gradle-wrapper.properties: 未找到本地Gradle ${gradleVersion}版本，请检查配置路径: ${localGradlePath}`;
    }

    const fileUrl = toFileUrl(localZipPath);
    const newContent = content.replace(ANY_DISTRIBUTION_URL_REGEX, `distributionUrl=${fileUrl}`);

    if (newContent === content) {
        return `⏭️ gradle-wrapper.properties: 无需修改`;
    }

    if (!writeGradleWrapperProperties(filePath, newContent)) {
        return `❌ gradle-wrapper.properties: 写入失败`;
    }

    return `✅ gradle-wrapper.properties: 已替换为本地Gradle文件 (${localZipPath})`;
}

// ==================== 工具函数 ====================

/**
 * 显示结果消息
 */
function showResultMessage(result: string, successMessage: string): void {
    if (result.includes('✅')) {
        vscode.window.showInformationMessage(successMessage);
    } else if (result.includes('⏭️')) {
        vscode.window.showInformationMessage(result);
    } else {
        vscode.window.showErrorMessage(result);
    }
}
