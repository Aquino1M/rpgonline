import fs from 'fs';
import path from 'path';

const baseDir = path.resolve('public/assets/models');
const weaponsSrc = path.join(baseDir, 'weapons/PP_FreeFantasyRPGWeapons_FBX_files');
const weaponsDest = path.join(baseDir, 'weapons');

const weaponCopies = [
  ['PP_Theme_02_Bow_001.fbx', 'bow.fbx'],
  ['PP_Theme_01_Arrow_001.fbx', 'arrow.fbx'],
  ['PP_Theme_01_Quiver_001.fbx', 'quiver.fbx'],
  ['PP_Theme_11_Sword_One-Handed_003.fbx', 'sword_1h.fbx'],
  ['PP_Theme_06_Sword_Two-Handed_001.fbx', 'sword_2h.fbx'],
  ['PP_Theme_04_Spellbook_003.fbx', 'spellbook.fbx'],
  ['PP_Theme_10_Dagger_002.fbx', 'dagger.fbx'],
  ['PP_Theme_01_Shield_005.fbx', 'shield.fbx'],
  ['PP_Theme_07_Spear_002.fbx', 'spear.fbx'],
  ['PP_Theme_08_Wand_001.fbx', 'wand.fbx'],
];

for (const [src, dest] of weaponCopies) {
  const s = path.join(weaponsSrc, src);
  const d = path.join(weaponsDest, dest);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`Copied ${src} -> ${dest}`);
  }
}
console.log('Done preparing weapon assets.');
