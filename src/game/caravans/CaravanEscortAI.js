// CaravanEscortAI.js - AI Escort formation, dynamic guarding roles (Tank, Warrior, Archer, Mage)
import * as THREE from 'three'
import { GUARD_CLASSES } from './CaravanConfig.js'

export class CaravanEscortAI {
  constructor(game) {
    this.game = game
  }

  createEscortGuards(caravan, count = 4, baseLevel = 15, isElite = false) {
    const guards = []
    const classPool = [GUARD_CLASSES.TANK, GUARD_CLASSES.WARRIOR, GUARD_CLASSES.ARCHER, GUARD_CLASSES.MAGE]
    
    // Default formation offsets relative to cart center (x: right/left, z: forward/back)
    const offsets = [
      { x: 0, z: 5.5 },    // Vanguard in front of horse
      { x: -3.2, z: 0.5 },  // Left flank (Tank)
      { x: 3.2, z: 0.5 },   // Right flank (Warrior)
      { x: -2.8, z: -4.5 }, // Rear left (Archer)
      { x: 2.8, z: -4.5 },  // Rear right (Mage)
      { x: -3.5, z: -1.8 }, // Additional flank
      { x: 3.5, z: -1.8 },  // Additional flank
      { x: 0, z: -6.2 }     // Rear guard
    ]

    const names = [
      'Gareth', 'Valen', 'Alara', 'Brant', 'Theron', 'Lyanna', 'Kaelen', 'Darian',
      'Orin', 'Sariel', 'Voren', 'Elora', 'Kael', 'Rowan', 'Mira', 'Torin'
    ]

    for (let i = 0; i < count; i++) {
      const cls = classPool[i % classPool.length]
      const guardLevel = Math.max(1, baseLevel + (isElite ? 6 : Math.floor((Math.random() - 0.5) * 4)))
      const offset = offsets[i % offsets.length]
      const name = `${names[(i + Math.floor(Math.random() * 10)) % names.length]}`
      
      const maxHp = Math.round((140 + guardLevel * 10) * cls.hpMult * (isElite ? 1.5 : 1.0))
      const atk = Math.round((14 + guardLevel * 2.2) * cls.atkMult * (isElite ? 1.3 : 1.0))

      const guardMesh = this.buildGuardMesh(cls, isElite)
      this.game.worldRoot.add(guardMesh)

      const guard = {
        id: `guard_${caravan.id}_${i}`,
        name: isElite ? `[ELITE] ${name}` : name,
        cls,
        level: guardLevel,
        isElite,
        hp: maxHp,
        maxHp,
        atk,
        def: 8 + guardLevel * 0.8,
        dead: false,
        offset,
        mesh: guardMesh,
        target: null,
        attackCooldown: 0,
        shootCooldown: 0,
        formationPos: new THREE.Vector3(),
        g: guardMesh,
        isCaravanGuard: true,
        caravan
      }

      // Add overhead health bar / nameplate
      const nameplate = this.buildGuardNameplate(guard)
      guardMesh.add(nameplate)
      guard.nameplate = nameplate

      guards.push(guard)
    }

    return guards
  }

  buildGuardMesh(cls, isElite) {
    const g = new THREE.Group()
    const col = cls.color || 0x3b82f6

    // Torso
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isElite ? 0x1e1b4b : col,
      roughness: 0.5,
      metalness: 0.4
    })
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.68, 4, 8), bodyMat)
    body.position.y = 1.02
    body.castShadow = true
    g.add(body)

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe0a980, roughness: 0.8 })
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), headMat)
    head.position.y = 1.78
    g.add(head)

    // Helmet / Cap
    const helmMat = new THREE.MeshStandardMaterial({ color: isElite ? 0xf59e0b : 0x334155, metalness: 0.7, roughness: 0.3 })
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.2, 8), helmMat)
    helm.position.y = 1.9
    g.add(helm)

    // Weapon / Shield according to class
    const weaponMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.2 })
    if (cls.id === 'tank') {
      // Shield
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.12), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 }))
      shield.position.set(-0.38, 1.05, 0.2)
      g.add(shield)
      // Sword
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.05), weaponMat)
      sword.position.set(0.38, 1.05, 0.15)
      sword.rotation.z = -0.2
      g.add(sword)
    } else if (cls.id === 'archer') {
      // Bow
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x78350f }))
      bow.position.set(0.36, 1.05, 0.1)
      bow.rotation.y = Math.PI / 2
      g.add(bow)
    } else if (cls.id === 'mage') {
      // Staff with glowing crystal
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x581c87 }))
      staff.position.set(0.38, 1.0, 0.1)
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xa855f7 }))
      crystal.position.set(0.38, 1.85, 0.1)
      g.add(staff, crystal)
    } else {
      // Warrior Greatsword
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.06), weaponMat)
      sword.position.set(0.4, 1.1, 0.15)
      sword.rotation.z = -0.15
      g.add(sword)
    }

    return g
  }

  buildGuardNameplate(guard) {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 70
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = 'rgba(7, 15, 27, 0.85)'
    ctx.strokeStyle = guard.isElite ? '#f59e0b' : '#38bdf8'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect?.(4, 4, 312, 62, 12)
    if (!ctx.roundRect) ctx.rect(4, 4, 312, 62)
    ctx.fill()
    ctx.stroke()

    ctx.font = 'bold 20px Inter, Arial'
    ctx.fillStyle = guard.isElite ? '#facc15' : '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(`${guard.name} (Nv.${guard.level})`, 160, 28)

    // HP Bar background & fill
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(20, 38, 280, 14)
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(20, 38, 280, 14)

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
    sprite.position.y = 2.4
    sprite.scale.set(3.2, 0.7, 1)
    sprite.renderOrder = 25
    return sprite
  }

  updateGuardHPBar(guard) {
    if (!guard.nameplate || !guard.nameplate.material?.map?.image) return
    const canvas = guard.nameplate.material.map.image
    const ctx = canvas.getContext('2d')
    const pct = Math.max(0, Math.min(1, guard.hp / guard.maxHp))

    ctx.fillStyle = 'rgba(7, 15, 27, 0.85)'
    ctx.strokeStyle = guard.isElite ? '#f59e0b' : '#38bdf8'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect?.(4, 4, 312, 62, 12)
    if (!ctx.roundRect) ctx.rect(4, 4, 312, 62)
    ctx.fill()
    ctx.stroke()

    ctx.font = 'bold 20px Inter, Arial'
    ctx.fillStyle = guard.isElite ? '#facc15' : '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(`${guard.name} (Nv.${guard.level})`, 160, 28)

    ctx.fillStyle = '#1e293b'
    ctx.fillRect(20, 38, 280, 14)
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444'
    ctx.fillRect(20, 38, 280 * pct, 14)

    guard.nameplate.material.map.needsUpdate = true
  }

  updateGuards(caravan, dt) {
    const cartPos = caravan.position
    const cartHeading = caravan.heading || 0
    const cosY = Math.cos(cartHeading)
    const sinY = Math.sin(cartHeading)

    for (const guard of caravan.guards) {
      if (guard.dead || !guard.mesh) continue

      guard.attackCooldown = Math.max(0, guard.attackCooldown - dt)
      guard.shootCooldown = Math.max(0, guard.shootCooldown - dt)

      // Calculate desired formation anchor
      const ox = guard.offset.x
      const oz = guard.offset.z
      const worldFormX = cartPos.x + (ox * cosY + oz * sinY)
      const worldFormZ = cartPos.z + (-ox * sinY + oz * cosY)
      guard.formationPos.set(worldFormX, 0, worldFormZ)

      // AI Decision: Threat response vs marching in formation
      let threat = guard.target
      if (threat && (threat.dead || threat.hp <= 0)) {
        threat = null
        guard.target = null
      }

      // Check threats targeting caravan or guards (Player if crime committed, or aggressive mobs)
      if (!threat) {
        if (caravan.attackedByPlayer && this.game.player) {
          const dToPlayer = guard.mesh.position.distanceTo(this.game.player.position)
          if (dToPlayer < 24) threat = this.game.player
        }
        if (!threat && this.game.enemies) {
          let bestDist = 20
          for (const mob of this.game.enemies) {
            if (mob.dead) continue
            const d = guard.mesh.position.distanceTo(mob.g.position)
            if (d < bestDist) {
              threat = mob
              bestDist = d
            }
          }
        }
        guard.target = threat
      }

      if (threat) {
        // Combat behavior by class
        const targetPos = threat.position || threat.g?.position
        if (!targetPos) continue

        const dToThreat = guard.mesh.position.distanceTo(targetPos)
        const dToCart = guard.mesh.position.distanceTo(cartPos)

        if (guard.cls.id === 'tank') {
          // Tank stays within 6m of cart and shields it
          if (dToCart > 6.5) {
            this.moveTowards(guard, guard.formationPos, 5.2, dt)
          } else {
            this.moveTowards(guard, targetPos, 4.2, dt)
            if (dToThreat < 2.5 && guard.attackCooldown <= 0) {
              this.executeGuardAttack(guard, threat, 1.2)
            }
          }
        } else if (guard.cls.id === 'archer' || guard.cls.id === 'mage') {
          // Ranged maintains 7-10m distance
          if (dToThreat < 5.0) {
            // Kite backwards
            const awayDir = new THREE.Vector3().subVectors(guard.mesh.position, targetPos).normalize()
            const kiteTarget = guard.mesh.position.clone().addScaledVector(awayDir, 3.0)
            this.moveTowards(guard, kiteTarget, 4.8, dt)
          } else if (dToThreat > 14.0) {
            this.moveTowards(guard, guard.formationPos, 5.0, dt)
          } else if (guard.shootCooldown <= 0) {
            this.executeGuardRangedAttack(guard, threat)
          }
        } else {
          // Warrior charges and attacks
          if (dToCart > 16.0) {
            this.moveTowards(guard, guard.formationPos, 5.5, dt)
          } else {
            this.moveTowards(guard, targetPos, 5.2, dt)
            if (dToThreat < 2.6 && guard.attackCooldown <= 0) {
              this.executeGuardAttack(guard, threat, 1.0)
            }
          }
        }
      } else {
        // Peaceful march in formation
        this.moveTowards(guard, guard.formationPos, 4.8, dt)
        // Match cart orientation smoothly
        guard.mesh.rotation.y = THREE.MathUtils.lerp(guard.mesh.rotation.y, cartHeading, 0.08)
      }
    }
  }

  moveTowards(guard, targetPos, speed, dt) {
    const dx = targetPos.x - guard.mesh.position.x
    const dz = targetPos.z - guard.mesh.position.z
    const dist = Math.hypot(dx, dz)
    if (dist > 0.3) {
      const step = Math.min(dist, speed * dt)
      guard.mesh.position.x += (dx / dist) * step
      guard.mesh.position.z += (dz / dist) * step
      guard.mesh.rotation.y = Math.atan2(dx, dz)
    }
  }

  executeGuardAttack(guard, threat, speedMult = 1.0) {
    guard.attackCooldown = 1.1 * speedMult

    if (threat === this.game.player) {
      // Hit player
      this.game.state.hp = Math.max(0, (this.game.state.hp || 120) - guard.atk)
      this.game.toast?.(`⚔️ ${guard.name} atingiu você por ${guard.atk} de dano!`)
      this.game.spawnAbilityRing?.(0xef4444, 1.6, 0.3)
      if (this.game.state.hp <= 0) {
        this.game.respawnPlayerAt?.(caravan.originCityId)
        this.game.toast?.('Você foi derrotado pela escolta da caravana!')
      }
    } else if (threat.damage || threat.hp !== undefined) {
      // Hit monster
      threat.hp -= guard.atk
      if (threat.hp <= 0) {
        if (this.game.killByBot) this.game.killByBot(threat, guard)
        else this.game.kill?.(threat)
      }
    }
  }

  executeGuardRangedAttack(guard, threat) {
    guard.shootCooldown = 1.8
    const targetPos = threat.position || threat.g?.position
    if (!targetPos) return

    // Spawn simple arrow or arcane projectile visual
    if (this.game.spawnProjectile) {
      this.game.spawnProjectile(guard.mesh.position, targetPos, guard.cls.id === 'mage' ? 'arcane' : 'arrow')
    }

    if (threat === this.game.player) {
      this.game.state.hp = Math.max(0, (this.game.state.hp || 120) - guard.atk)
      this.game.toast?.(`🏹 ${guard.name} disparou contra você: -${guard.atk} HP!`)
    } else if (threat.hp !== undefined) {
      threat.hp -= guard.atk
      if (threat.hp <= 0) {
        if (this.game.killByBot) this.game.killByBot(threat, guard)
        else this.game.kill?.(threat)
      }
    }
  }
}
