import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function parseArgs() {
  const args = process.argv.slice(2)
  let targetTag = ''
  let outFile = ''
  let changelogPath = path.join(rootDir, 'CHANGELOG.md')

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--out' || arg === '-o') {
      outFile = args[++i]
    } else if (arg === '--file' || arg === '-f') {
      changelogPath = path.resolve(process.cwd(), args[++i])
    } else if (!arg.startsWith('-') && !targetTag) {
      targetTag = arg
    }
  }

  if (!targetTag && process.env.GITHUB_REF_NAME) {
    targetTag = process.env.GITHUB_REF_NAME
  }

  return { targetTag, outFile, changelogPath }
}

export function getLatestChangelogVersion(content) {
  const lines = content.split(/\r?\n/)
  const versionHeaderRegex = /^##\s+(?:\[(.*?)\]|([^\s-]+))(.*)$/

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const match = line.match(versionHeaderRegex)
      if (match) {
        const rawVersion = (match[1] || match[2]).trim()
        const cleanVersion = rawVersion.replace(/^v/, '')
        if (/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(cleanVersion)) {
          return {
            raw: rawVersion,
            version: cleanVersion,
            tag: `v${cleanVersion}`,
            lineText: line,
          }
        }
      }
    }
  }
  return null
}

export function extractReleaseNotes(content, targetVersion) {
  // 提取版本核心，如 v0.9.0 -> 0.9.0，refs/tags/v0.9.0 -> 0.9.0
  const normalizedInput = targetVersion.replace(/^refs\/tags\//, '')
  const cleanVersion = normalizedInput.replace(/^v/, '')

  const lines = content.split(/\r?\n/)
  const versionHeaderRegex = /^##\s+(?:\[(.*?)\]|([^\s-]+))(.*)$/

  let isCapturing = false
  const capturedLines = []
  const availableVersions = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      const match = line.match(versionHeaderRegex)
      const versionText = (match ? (match[1] || match[2]) : line.replace(/^##\s+/, '')).trim()
      const currentVersion = versionText.replace(/^v/, '')
      availableVersions.push(versionText)

      if (isCapturing) {
        // 已经捕获过，遇到下一个版本标题，结束捕获
        break
      }

      if (
        currentVersion === cleanVersion ||
        versionText === normalizedInput ||
        versionText.startsWith(`v${cleanVersion}`) ||
        versionText.startsWith(cleanVersion)
      ) {
        isCapturing = true
        continue
      }
    } else if (isCapturing) {
      capturedLines.push(line)
    }
  }

  const result = capturedLines.join('\n').trim()

  return {
    notes: result,
    found: isCapturing && result.length > 0,
    availableVersions,
  }
}

function main() {
  const { targetTag, outFile, changelogPath } = parseArgs()

  if (!targetTag) {
    console.error('❌ 错误: 未指定目标版本 Tag！')
    console.error('用法: node scripts/extract-changelog.mjs <tag> [--out <output-file>]')
    console.error('示例: node scripts/extract-changelog.mjs v0.0.1 --out RELEASE_NOTES.md')
    process.exit(1)
  }

  if (!fs.existsSync(changelogPath)) {
    console.error(`❌ 错误: CHANGELOG 文件未找到: ${changelogPath}`)
    process.exit(1)
  }

  const changelogContent = fs.readFileSync(changelogPath, 'utf8')
  const { notes, found, availableVersions } = extractReleaseNotes(changelogContent, targetTag)

  if (!found) {
    console.error(`❌ 错误: 在 CHANGELOG.md 中未找到版本 [${targetTag}] 的更新日志或内容为空！`)
    console.error(`💡 CHANGELOG.md 中已存在的版本标题: ${availableVersions.length > 0 ? availableVersions.join(', ') : '无'}`)
    console.error('📌 请确认 CHANGELOG.md 符合规范，例如包含: ## [v0.0.1] - 2026-08-02')
    process.exit(1)
  }

  if (outFile) {
    const fullOutPath = path.resolve(process.cwd(), outFile)
    fs.writeFileSync(fullOutPath, `${notes}\n`, 'utf8')
    console.log(`✅ 成功提取 [${targetTag}] 更新日志至文件: ${fullOutPath}`)
  } else {
    console.log(notes)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
}
