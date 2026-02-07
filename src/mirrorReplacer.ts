import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// 腾讯云镜像Gradle分发URL
const TENCENT_GRADLE_DISTRIBUTION_URL = '//mirrors.cloud.tencent.com/gradle/';

export async function replaceFlutterMirror(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('请先打开一个Flutter项目文件夹');
        return;
    }

    const projectRoot = workspaceFolders[0].uri.fsPath;

    const isFlutterProject = await checkFlutterProject(projectRoot);
    if (!isFlutterProject) {
        const action = await vscode.window.showWarningMessage(
            '当前项目似乎不是Flutter项目（未找到pubspec.yaml），是否继续？',
            '继续', '取消'
        );
        if (action !== '继续') {
            return;
        }
    }

    try {
        const androidDir = path.join(projectRoot, 'android');
        if (!fs.existsSync(androidDir)) {
            vscode.window.showErrorMessage('未找到Android目录，请确保这是一个Flutter项目');
            return;
        }

        const result = await modifyGradleWrapperProperties(androidDir);

        if (result.includes('✅')) {
            vscode.window.showInformationMessage('Flutter Gradle镜像替换成功！');
        } else if (result.includes('⏭️')) {
            vscode.window.showInformationMessage(result);
        } else {
            vscode.window.showErrorMessage(result);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`替换镜像时出错: ${error}`);
    }
}

async function checkFlutterProject(projectRoot: string): Promise<boolean> {
    const pubspecPath = path.join(projectRoot, 'pubspec.yaml');
    return fs.existsSync(pubspecPath);
}

async function modifyGradleWrapperProperties(androidDir: string): Promise<string> {
    const fileName = 'gradle-wrapper.properties';
    const gradleWrapperDir = path.join(androidDir, 'gradle', 'wrapper');
    const filePath = path.join(gradleWrapperDir, fileName);

    if (!fs.existsSync(filePath)) {
        return `⚠️ ${fileName}: 文件不存在`;
    }

    try {
        let content = fs.readFileSync(filePath, 'utf-8');
        const originalContent = content;

        if (content.includes('mirrors.cloud.tencent.com/gradle')) {
            return `⏭️ ${fileName}: 已使用腾讯云镜像，跳过`;
        }

        const distributionUrlRegex = /distributionUrl=https[:\\\/]+services\.gradle\.org\/distributions\/(gradle-[^\s]+\.zip)/;
        const match = content.match(distributionUrlRegex);

        if (match) {
            const gradleVersion = match[1];
            const newUrl = `distributionUrl=https\\:${TENCENT_GRADLE_DISTRIBUTION_URL}${gradleVersion}`;
            content = content.replace(distributionUrlRegex, newUrl);
        } else {
            const altRegex = /distributionUrl=(https[^\s]*services\.gradle\.org[^\s]*)/;
            const altMatch = content.match(altRegex);
            if (altMatch) {
                const originalUrl = altMatch[1];
                const versionMatch = originalUrl.match(/gradle-([^\/]+)\.zip/);
                if (versionMatch) {
                    const newUrl = `https\\:${TENCENT_GRADLE_DISTRIBUTION_URL}gradle-${versionMatch[1]}.zip`;
                    content = content.replace(altRegex, `distributionUrl=${newUrl}`);
                }
            }
        }

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf-8');
            return `✅ ${fileName}: 已成功替换为腾讯云镜像`;
        }

        return `⏭️ ${fileName}: 无需修改`;
    } catch (error) {
        return `❌ ${fileName}: 修改失败 - ${error}`;
    }
}
