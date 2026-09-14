import fs from 'fs';
import path from 'path';

const pack2Dir = path.resolve('PACK2');
const targetDir = path.resolve('public/assets/models');

fs.mkdirSync(path.join(targetDir, 'characters'), { recursive: true });
fs.mkdirSync(path.join(targetDir, 'scenery'), { recursive: true });
fs.mkdirSync(path.join(targetDir, 'mobs'), { recursive: true });

const copies = [
  ['Animated Wizard by Quaternius - kttbFvCl2C.glb', 'characters/wizard.glb'],
  ['King by Quaternius - I1gTjmuK2m.glb', 'characters/king.glb'],
  ['Simple Green Slime by Garrett LeFever - az-ryr8W44N.glb', 'mobs/slime.glb'],
  ['Castle Kit by Kenney - 2pA966ztJJX.glb', 'scenery/castle_kit.glb'],
  ['Monster & Medieval Kits by Don Carson - 0gdoFXqTyvp.glb', 'scenery/medieval_kit.glb'],
  ['Big arm by Quaternius - KaVJET0WHx.glb', 'mobs/big_arm.glb'],
];

for (const [src, relDest] of copies) {
  const s = path.join(pack2Dir, src);
  const d = path.join(targetDir, relDest);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`Copied ${src} -> ${relDest}`);
  } else {
    console.warn(`Source not found: ${src}`);
  }
}
