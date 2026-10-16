import { exec } from 'node:child_process'
import {
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'
import readline from 'node:readline'
import { extractReleaseNotes, getLatestChangelogVersion } from './scripts/extract-changelog.mjs'

const require = createRequire(import.meta.url)
const PluginInfo = require('./plugin.json')

const {
  version: currentVersion = '0.0.0',
} = PluginInfo

function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number)
  return {
    major,
    minor,
    patch,
  }
}

function incrementVersion(version, type) {
  let {
    major,
    minor,
    patch,
  } = parseVersion(version)

  switch (type) {
    case 'major':
      major++
      minor = 0
      patch = 0
      break
    case 'minor':
      minor++
      patch = 0
      break
    case 'patch':
      patch++
      break
    default:
      break
  }

  return {
    major,
    minor,
    patch,
    version: `${major}.${minor}.${patch}`,
  }
}

function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close()
    resolve(answer)
  }))
}

const args = process.argv.slice(2)
const mode = args.find((arg) => arg.startsWith('--mode='))?.split('=')[1]

const main = async () => {
  try {
    console.log(`🌟  Current version: \x1B[36m${currentVersion}\x1B[0m\n`)

    let changelogContent = ''
    let latestChangelog = null
    try {
      changelogContent = readFileSync('./CHANGELOG.md', 'utf8')
      latestChangelog = getLatestChangelogVersion(changelogContent)
    } catch (e) {
      // 忽略读取错误，后续有存在性提示
    }

    // Calculate potential new versions for auto-update
    const newPatchVersion = incrementVersion(currentVersion, 'patch')
    const newMinorVersion = incrementVersion(currentVersion, 'minor')
    const newMajorVersion = incrementVersion(currentVersion, 'major')

    let newVersion
    if (mode) {
      switch (mode) {
        case 'changelog':
          if (latestChangelog) {
            newVersion = latestChangelog.version
          } else {
            console.error('\x1B[31m❌ CHANGELOG.md 中未解析到有效版本号\x1B[0m')
            return
          }
          break
        case 'manual':
          newVersion = await promptUser('✍️  Please enter the new version (in a.b.c format): ')
          break
        case 'major':
          newVersion = newMajorVersion.version
          break
        case 'minor':
          newVersion = newMinorVersion.version
          break
        case 'patch':
          newVersion = newPatchVersion.version
          break
      }
    } else {
      // 若检测到 CHANGELOG.md 顶部声明了与当前代码版本不同的新版本
      const hasNewChangelogVersion = latestChangelog && latestChangelog.version !== currentVersion

      if (hasNewChangelogVersion) {
        console.log(`📖  \x1B[32m检测到 CHANGELOG.md 顶部已写好新版本: \x1B[1mv${latestChangelog.version}\x1B[0m\x1B[32m (当前代码版本: v${currentVersion})\x1B[0m`)
        const useChangelog = await promptUser(`👉  是否直接采用 CHANGELOG 中的版本 \x1B[32mv${latestChangelog.version}\x1B[0m 自动同步发版？(\x1B[32mY\x1B[0m/n): `) || 'y'
        if (useChangelog.trim().toLowerCase() === 'y') {
          newVersion = latestChangelog.version
        }
      }

      if (!newVersion) {
        // Prompt the user with formatted options
        console.log('🔄  How would you like to update the version?\n')
        if (latestChangelog) {
          console.log(`  🌟  [CHANGELOG] 使用更新日志中的版本 (\x1B[32mv${latestChangelog.version}\x1B[0m) [c]`)
        }
        console.log(`  1️⃣  Auto update \x1B[33mpatch\x1B[0m version (new: ${newPatchVersion.major}.${newPatchVersion.minor}.\x1B[33m${newPatchVersion.patch}\x1B[0m) [1]`)
        console.log(`  2️⃣  Auto update \x1B[33mminor\x1B[0m version (new: ${newMinorVersion.major}.${newMinorVersion.minor}.${newMinorVersion.patch}\x1B[0m) [2]`)
        console.log(`  3️⃣  Auto update \x1B[33mmajor\x1B[0m version (new: \x1B[33m${newMajorVersion.version}\x1B[0m) [3]`)
        console.log(`  4️⃣  Input version \x1B[33mmanually\x1B[0m [4]`)
        // Press 0 to skip version update
        console.log('  0️⃣  \x1B[33mQuit\x1B[0m without updating [0]\n')

        const defaultChoice = latestChangelog && hasNewChangelogVersion ? 'c' : '1'
        const updateChoice = (await promptUser(`👉  Please choose (\x1B[33m${defaultChoice}\x1B[0m/1/2/3/4/0): `) || defaultChoice).trim().toLowerCase()
        switch (updateChoice) {
          case 'c':
            if (latestChangelog) {
              newVersion = latestChangelog.version
            }
            break
          case '1':
            newVersion = newPatchVersion.version
            break
          case '2':
            newVersion = newMinorVersion.version
            break
          case '3':
            newVersion = newMajorVersion.version
            break
          case '4':
            newVersion = await promptUser('✍️  Please enter the new version (in a.b.c format): ')
            break
          case '0':
            console.log('\n\x1B[90m🛑  Skipping version update.\x1B[0m')
            return
          default:
            console.log('\n\x1B[31m❌  Invalid option, no version update.\x1B[0m')
            return
        }
      }
    }

    console.log(`🚀  Ready to release => v${newVersion}`)

    const isValid = /^\d+\.\d+\.\d+$/.test(newVersion)
    if (!isValid) {
      console.log('\n\x1B[31m❌  Invalid version format.\x1B[0m')
      return
    }

    // 检查 CHANGELOG.md 是否已有当前版本的记录
    try {
      const changelogCheckContent = readFileSync('./CHANGELOG.md', 'utf8')
      const { found, availableVersions } = extractReleaseNotes(changelogCheckContent, `v${newVersion}`)
      if (!found) {
        console.warn(`\n\x1B[33m⚠️  警告: CHANGELOG.md 中未找到 [v${newVersion}] 的更新日志！\x1B[0m`)
        console.warn(`\x1B[90m当前已存在的版本: ${availableVersions.length > 0 ? availableVersions.join(', ') : '无'}\x1B[0m`)
        console.warn(`\x1B[33m提示: GitHub Actions 流水线要求必须包含该版本的 CHANGELOG 记录，否则将自动阻断发版。\x1B[0m\n`)
        const proceed = await promptUser('❓ 是否仍要继续打 Tag 并推送？(y/N): ')
        if (proceed.trim().toLowerCase() !== 'y') {
          console.log('\n\x1B[90m🛑 已取消发版操作，请先完善 CHANGELOG.md。\x1B[0m')
          return
        }
      }
    } catch (e) {
      console.warn('⚠️ 读取 CHANGELOG.md 失败:', e.message)
    }

    console.log('🔄  \x1B[90mUpdating plugin.json...\x1B[0m')
    const content = readFileSync('./plugin.json', 'utf8')
    const updated = content.replace(
      /"version"\s*:\s*"[^"]+"/,
      `"version": "${newVersion}"`,
    )
    writeFileSync('./plugin.json', updated, 'utf8')
    console.log('✅  plugin.json updated')

    console.log('🔄  \x1B[90mUpdating package.json...\x1B[0m')
    const packageContent = readFileSync('./package.json', 'utf8')
    const packageUpdated = packageContent.replace(
      /"version"\s*:\s*"[^"]+"/,
      `"version": "${newVersion}"`,
    )
    writeFileSync('./package.json', packageUpdated, 'utf8')
    console.log('✅  package.json updated')

    console.log('🔄  \x1B[90m Ready to commit new version and create tag...\x1B[0m')
    exec(
      `git add ./plugin.json ./package.json ./CHANGELOG.md && git commit -m "chore(release): 升级版本至 v${newVersion}" && git push && git tag v${newVersion}`,
      (err, stdout) => {
        if (err) {
          console.error('\x1B[31m%s\x1B[0m', '❌  Error for adding and committing:', err)
          process.exit(1)
        }

        console.log('🔄  \x1B[90mTag Created, pushing...\x1B[0m')
        exec(`git push origin v${newVersion}`, (err) => {
          if (err) {
            console.error('\x1B[31m%s\x1B[0m', '❌  Error for pushing tag:', err)
            process.exit(1)
          }
          console.log(`\n🎉  本地版本已成功同步并提交: \x1B[32mv${newVersion}\x1B[0m`)
          console.log(`🏷️   Tag \x1B[36mv${newVersion}\x1B[0m 已推送到远程仓库`)
          console.log('🚀  GitHub Actions 将自动读取 CHANGELOG.md 内容并在云端打包发布 Release！\n')
        })
      },
    )

  } catch (error) {
    console.error('\x1B[31m%s\x1B[0m', '❌  Error:', error)
  }
}
main()
