import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DungeonRewards } from '../src/game/dungeons/DungeonRewards.js'
import { guildRankRequirement, updateGuildRank } from '../src/game/rpgSystems.js'

const rewardE = DungeonRewards.calculateCompletionReward({ rank: 'E', level: 1, kills: 6, elites: 0, bosses: 1 })
const rewardD = DungeonRewards.calculateCompletionReward({ rank: 'D', level: 12, kills: 12, elites: 2, bosses: 1 })
assert.ok(rewardE.guildXp > 0, 'Dungeon completion must grant guild XP')
assert.ok(rewardD.xp > rewardE.xp && rewardD.gold > rewardE.gold && rewardD.guildXp > rewardE.guildXp, 'Higher ranks must reward more')

const guild = { level: 8, guildRankIndex: 0, guildPoints: guildRankRequirement(1) }
assert.equal(updateGuildRank(guild), true, 'Guild XP and player level must advance rank D')
assert.equal(guild.guildRank, 'D')

const gateManager = await readFile(new URL('../src/game/dungeons/GateManager.js', import.meta.url), 'utf8')
assert.match(gateManager, /this\.removeGate\(inst\.gateId\)/, 'Completed dungeon must consume its gate')
assert.match(gateManager, /dungeon\.transition = true/, 'Modern completion must block the legacy dungeon loop')

console.log('Dungeon progression checks passed.')
