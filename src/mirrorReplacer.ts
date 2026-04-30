import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 获取配置的Gradle镜像URL
 * 优先级：用户配置 > 默认腾讯云镜像
 * 返回格式: //mirrors.cloud.tencent.com/gradle/
 */
function getGradleMirrorUrl(): string {
    const config = vscode.workspace.getConfiguration('flutterMirror');
    let userUrl = config.get<string>('gradleMirrorUrl', '');
    // 如果配置为空，使用默认的腾讯云镜像
    if (!userUrl) {
        userUrl = 'mirrors.cloud.tencent.com/gradle';
    }
    // 确保 URL 格式为 //host/path/
    let normalizedUrl = userUrl;
    if (!normalizedUrl.startsWith('//')) {
        normalizedUrl = '//' + normalizedUrl;
    }
    if (!normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl + '/';
    }
    return normalizedUrl;
}

// Gradle版本正则表达式
const DISTRIBUTION_URL_REGEX = /distributionUrl=https[:\\\/]+services\.gradle\.org\/distributions\/(gradle-[^\s]+\.zip)/;
const ALT_DISTRIBUTION_URL_REGEX = /distributionUrl=(https[^\s]*services\.gradle\.org[^\s]*)/;
const ANY_DISTRIBUTION_URL_REGEX = /distributionUrl=.*/;
const GRADLE_DIR_REGEX = /gradle-([\d.]+)-(all|bin)/;

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
    const match = content.match(/gradle-([\d.]+)/);
    return match?.[1] ?? null;
}

/**
 * 比较两个版本号
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLen = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLen; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

/**
 * 扫描本地所有可用的Gradle版本
 * @returns 版本号数组，按版本号降序排列
 */
function scanLocalGradleVersions(localGradlePath: string): string[] {
    try {
        const distsDir = path.resolve(localGradlePath);
        if (!fs.existsSync(distsDir)) {
            return [];
        }

        const versions: string[] = [];
        const entries = fs.readdirSync(distsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const match = entry.name.match(GRADLE_DIR_REGEX);
                if (match) {
                    const version = match[1];
                    // 验证该版本是否有完整的zip文件
                    const zipPath = findGradleZipPath(distsDir, entry.name);
                    if (zipPath) {
                        versions.push(version);
                    }
                }
            }
        }

        // 按版本号降序排列
        return versions.sort((a, b) => compareVersions(b, a));
    } catch (error) {
        console.error('扫描本地Gradle版本时出错:', error);
        return [];
    }
}

/**
 * 查找指定Gradle目录下的zip文件路径
 */
function findGradleZipPath(distsDir: string, gradleDirName: string): string | null {
    try {
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
        console.error('查找Gradle zip文件时出错:', error);
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

    const mirrorUrl = getGradleMirrorUrl();
    if (content.includes(mirrorUrl)) {
        return `⏭️ gradle-wrapper.properties: 已使用配置的镜像，跳过`;
    }

    const newContent = replaceWithMirrorUrl(content);
    
    if (newContent === content) {
        return `⏭️ gradle-wrapper.properties: 无需修改`;
    }

    if (!writeGradleWrapperProperties(filePath, newContent)) {
        return `❌ gradle-wrapper.properties: 写入失败`;
    }

    return `✅ gradle-wrapper.properties: 已成功替换为镜像 (${mirrorUrl})`;
}

/**
 * 将distributionUrl替换为配置的镜像URL
 */
function replaceWithMirrorUrl(content: string): string {
    const mirrorUrl = getGradleMirrorUrl();

    // 尝试匹配标准格式
    const match = content.match(DISTRIBUTION_URL_REGEX);
    if (match) {
        const gradleVersion = match[1];
        return content.replace(DISTRIBUTION_URL_REGEX, `distributionUrl=https\\:${mirrorUrl}${gradleVersion}`);
    }

    // 尝试匹配其他格式
    const altMatch = content.match(ALT_DISTRIBUTION_URL_REGEX);
    if (altMatch) {
        const originalUrl = altMatch[1];
        const versionMatch = originalUrl.match(/gradle-([^\/]+)\.zip/);
        if (versionMatch) {
            const newUrl = `https\\:${mirrorUrl}gradle-${versionMatch[1]}.zip`;
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

    const requiredVersion = extractGradleVersion(content);
    if (!requiredVersion) {
        return `⚠️ gradle-wrapper.properties: 无法解析Gradle版本`;
    }

    const localGradlePath = getLocalGradlePath();
    
    // 扫描本地所有可用版本
    const availableVersions = scanLocalGradleVersions(localGradlePath);
    
    if (availableVersions.length === 0) {
        return `❌ gradle-wrapper.properties: 在 ${localGradlePath} 中未找到任何可用的Gradle版本`;
    }

    // 查找大于等于要求版本的最新版本
    let selectedVersion: string | null = null;
    for (const version of availableVersions) {
        if (compareVersions(version, requiredVersion) >= 0) {
            selectedVersion = version;
            break;
        }
    }

    if (!selectedVersion) {
        const availableList = availableVersions.join(', ');
        return `❌ gradle-wrapper.properties: 未找到满足要求的Gradle版本。项目要求: ${requiredVersion}，本地可用: ${availableList}`;
    }

    // 查找选定版本的zip文件路径
    const gradleDirName = `gradle-${selectedVersion}-all`;
    const localZipPath = findGradleZipPath(localGradlePath, gradleDirName);

    if (!localZipPath) {
        return `❌ gradle-wrapper.properties: 找到版本 ${selectedVersion} 但无法定位zip文件`;
    }

    const fileUrl = toFileUrl(localZipPath);
    const newContent = content.replace(ANY_DISTRIBUTION_URL_REGEX, `distributionUrl=${fileUrl}`);

    if (newContent === content) {
        return `⏭️ gradle-wrapper.properties: 无需修改`;
    }

    if (!writeGradleWrapperProperties(filePath, newContent)) {
        return `❌ gradle-wrapper.properties: 写入失败`;
    }

    const versionInfo = selectedVersion === requiredVersion 
        ? selectedVersion 
        : `${requiredVersion} → ${selectedVersion}`;
    return `✅ gradle-wrapper.properties: 已替换为本地Gradle文件 (版本: ${versionInfo}, 路径: ${localZipPath})`;
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
