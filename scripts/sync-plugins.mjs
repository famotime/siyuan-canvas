import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
if (!existsSync(distDir)) {
  console.log('[sync-plugins] dist folder not found, skipping sync.')
  process.exit(0)
}

const targetDirs = [
  'D:/siyuan-plugin-test/data/plugins/siyuan-canvas',
  'D:/SiYuan_data/data/plugins/siyuan-canvas',
]

for (const dir of targetDirs) {
  if (existsSync(dir)) {
    try {
      cpSync(distDir, dir, { recursive: true, force: true })
      console.log(`[sync-plugins] Successfully synced dist to: ${dir}`)
    } catch (err) {
      console.warn(`[sync-plugins] Failed to sync to ${dir}:`, err)
    }
  }
}
