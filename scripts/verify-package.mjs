import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import AdmZip from 'jszip'

/**
 * 校验 package.zip 与 dist 产物规范
 * 思源集市规范要求：不能包含以 '.' 开头的文件或目录（数据同步会忽略此类条目导致异常）
 */
async function verifyPackage() {
  const zipPath = path.resolve(process.cwd(), 'package.zip')
  const distPath = path.resolve(process.cwd(), 'dist')

  let hasError = false

  console.log('\x1B[36m🔍 开始校验插件构建产物与 package.zip...\x1B[0m')

  // 1. 检查 dist 目录
  if (!fs.existsSync(distPath)) {
    console.error('\x1B[31m❌ 错误: dist 目录不存在，请先执行构建\x1B[0m')
    process.exit(1)
  }

  // 检查 dist 内部所有文件
  function checkDirForDotFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const dotEntries = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        dotEntries.push(path.join(dir, entry.name))
      }
      if (entry.isDirectory()) {
        dotEntries.push(...checkDirForDotFiles(path.join(dir, entry.name)))
      }
    }
    return dotEntries
  }

  const distDotFiles = checkDirForDotFiles(distPath)
  if (distDotFiles.length > 0) {
    hasError = true
    console.error('\x1B[31m❌ 错误: dist 目录中包含以点开头的文件或目录:\x1B[0m')
    for (const file of distDotFiles) {
      console.error(`   - ${path.relative(distPath, file)}`)
    }
  }

  // 2. 检查 package.zip 文件
  if (!fs.existsSync(zipPath)) {
    console.error('\x1B[31m❌ 错误: package.zip 不存在\x1B[0m')
    process.exit(1)
  }

  const zipData = fs.readFileSync(zipPath)
  const zip = await AdmZip.loadAsync(zipData)
  const zipEntries = Object.keys(zip.files)

  const zipDotEntries = []
  for (const entry of zipEntries) {
    const parts = entry.split('/').filter(Boolean)
    if (parts.some((part) => part.startsWith('.') && part !== '.' && part !== '..')) {
      zipDotEntries.push(entry)
    }
  }

  if (zipDotEntries.length > 0) {
    hasError = true
    console.error('\x1B[31m❌ 错误: package.zip 中检测到以点开头的条目 (思源集市规范禁止):\x1B[0m')
    for (const entry of zipDotEntries) {
      console.error(`   - ${entry}`)
    }
  }

  // 3. 检查必要基础文件
  const requiredFiles = ['plugin.json', 'index.js']
  const missingFiles = requiredFiles.filter((req) => !zipEntries.includes(req))
  if (missingFiles.length > 0) {
    hasError = true
    console.error('\x1B[31m❌ 错误: package.zip 缺少必要文件:\x1B[0m')
    for (const missing of missingFiles) {
      console.error(`   - ${missing}`)
    }
  }

  if (hasError) {
    console.error('\n\x1B[31m💥 构建产物校验失败，请检查并移除违规文件后再发布！\x1B[0m')
    process.exit(1)
  }

  console.log(`\x1B[32m✅ 产物校验通过: package.zip 共 ${zipEntries.length} 个条目，无任何隐藏点文件，符合思源集市规范！\x1B[0m\n`)
}

verifyPackage().catch((err) => {
  console.error('\x1B[31m❌ 校验过程发生异常:\x1B[0m', err)
  process.exit(1)
})
