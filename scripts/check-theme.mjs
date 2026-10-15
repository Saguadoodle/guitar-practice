import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const compiled = ts.transpileModule(fs.readFileSync('src/theme.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText
const theme = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const html = fs.readFileSync('index.html', 'utf8')
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1]
assert.ok(html.indexOf('<script>') < html.indexOf('src="/src/main.tsx"'))
assert.match(html, /<title>SaguaNoodle/)
assert.ok(!fs.readFileSync('src/App.tsx', 'utf8').includes('弦间'))
assert.match(fs.readFileSync('README.md', 'utf8'), /^# SaguaNoodle/)

function environment(saved, dark, blocked = false) {
  let value = saved
  const listeners = new Set()
  const media = {
    matches: dark,
    addEventListener(type, listener) { assert.equal(type, 'change'); listeners.add(listener) },
    removeEventListener(type, listener) { assert.equal(type, 'change'); listeners.delete(listener) },
  }
  const storage = {
    getItem() { if (blocked) throw new Error('存储不可用'); return value },
    setItem(key, next) { assert.equal(key, theme.THEME_STORAGE_KEY); if (blocked) throw new Error('存储不可用'); value = next },
  }
  return {
    window: { localStorage: storage, matchMedia: () => media }, localStorage: storage,
    document: { documentElement: { dataset: {} } },
    media, listeners,
  }
}
for (const saved of [undefined, 'invalid', 'system', 'light', 'dark']) {
  for (const dark of [false, true]) {
    const env = environment(saved, dark)
    vm.runInNewContext(bootstrap, env)
    const preference = ['system', 'light', 'dark'].includes(saved) ? saved : 'system'
    const expected = preference === 'system' ? (dark ? 'dark' : 'light') : preference
    assert.equal(env.document.documentElement.dataset.theme, expected)
    assert.equal(env.document.documentElement.dataset.themePreference, preference)
    globalThis.window = env.window
    globalThis.document = env.document
    assert.equal(theme.readThemePreference(), preference)
    theme.applyTheme(preference)
    assert.equal(env.document.documentElement.dataset.theme, expected)
  }
}
const env = environment(undefined, false)
globalThis.window = env.window
globalThis.document = env.document
const cleanup = theme.watchSystemTheme('system')
theme.applyTheme('system')
env.media.matches = true
env.listeners.forEach((listener) => listener())
assert.equal(document.documentElement.dataset.theme, 'dark')
env.media.matches = false
env.listeners.forEach((listener) => listener())
assert.equal(document.documentElement.dataset.theme, 'light')
cleanup()
assert.equal(env.listeners.size, 0)
for (const preference of ['light', 'dark', 'system']) {
  theme.saveThemePreference(preference)
  assert.equal(theme.readThemePreference(), preference)
  const resolved = document.documentElement.dataset.theme
  const nextEnv = environment(preference, env.media.matches)
  vm.runInNewContext(bootstrap, nextEnv)
  assert.equal(nextEnv.document.documentElement.dataset.theme, resolved)
  const stop = theme.watchSystemTheme(preference)
  assert.equal(env.listeners.size, preference === 'system' ? 1 : 0)
  stop()
}
const blocked = environment(undefined, true, true)
vm.runInNewContext(bootstrap, blocked)
assert.equal(blocked.document.documentElement.dataset.theme, 'dark')
globalThis.window = blocked.window
globalThis.document = blocked.document
assert.equal(theme.readThemePreference(), 'system')
theme.saveThemePreference('light')
assert.equal(document.documentElement.dataset.theme, 'light')
console.log('通过：默认跟随系统、明暗变化、监听清理、保存及刷新、无效值、存储不可用、首次加载主题')

const css = fs.readFileSync('src/index.css', 'utf8')
const appCss = fs.readFileSync('src/App.css', 'utf8')
assert.ok(!/#[0-9a-f]{3,8}\b/i.test(appCss))
const declarations = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]]))
const palettes = [declarations(css.match(/:root\s*\{([\s\S]*?)\}/)[1]), declarations(css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/)[1])]
const luminance = (hex) => {
  const channels = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
const ratio = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
for (const [index, palette] of palettes.entries()) {
  for (const [foreground, background] of [['text', 'bg'], ['text', 'surface'], ['text', 'board-bg'], ['on-accent', 'accent'], ['muted', 'surface-soft'], ['accent-text', 'open-bg'], ['error-text', 'error-bg']]) {
    const contrast = ratio(palette[foreground], palette[background])
    assert.ok(contrast >= 4.5, `${index === 0 ? '浅色' : '深色'} ${foreground}/${background} 对比度 ${contrast}`)
  }
  for (const usage of [...appCss.matchAll(/var\(--([\w-]+)\)/g)]) assert.ok(usage[1] in palette, `变量未定义 ${usage[1]}`)
  console.log(`通过：${index === 0 ? '浅色' : '深色'}主题颜色变量、常用文字对比度；按钮 ${ratio(palette['on-accent'], palette.accent).toFixed(2)}:1`)
}
assert.match(palettes[1].font, /^'Times New Roman'/)
assert.match(palettes[1].font, /Songti SC/)
assert.match(appCss, /min-width: 1728px/)
assert.match(appCss, /repeat\(24, minmax\(66px, 1fr\)\)/)
assert.match(appCss, /overflow-x: auto/)
assert.match(appCss, /\.selected \.note[^}]+box-shadow/)
console.log('通过：深色衬线字体回退、保留 24 品按钮宽度与横向滚动、选中圆环；实际字体布局需浏览器验收')
delete globalThis.window
delete globalThis.document
