import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/mobileTabletV2.css', import.meta.url), 'utf8')

assert.match(app, /function Inventory\([\s\S]*?const activeClass=.*?[\s\S]*?const activeTier=/, 'inventory must scope its active class data')
assert.match(app, /useState\('character'\)/, 'inventory must open on the equipped-character view')
assert.doesNotMatch(app, /E-mail da Conta/, 'the account portal must not request an e-mail')
assert.match(app, /auth-server-fixed">● Asterra Global/, 'the account portal must lock to the global server')
for (const panel of ['inventory','grimoire','quests','guild','travel','trade','attributes','map','settings']) assert.match(app, new RegExp(`closeAnd\\('${panel}'\\)`), `touch menu must open ${panel}`)
assert.match(app, /mobile-dash" onPointerDown=\{press\('dash'\)\}/, 'dodge must invoke the engine immediately')
assert.match(app, /mobile-run[^\n]*onPointerDown=\{startHold\('setMobileRun'\)\}/, 'run must use hold-to-run')
assert.match(css, /\.app\.touch-ui \.window-inventory \.inventory-rpg/, 'tablet inventory layout override must be loaded last')
console.log('ui contract: ok')
