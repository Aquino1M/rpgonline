const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// Standard CRC32 table for PNG chunks
const crcTable = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1)
    else c = c >>> 1
  }
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makePng(width, height, getPixel) {
  // 8-byte PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk: width(4), height(4), bitDepth(1)=8, colorType(1)=6(RGBA), comp(1)=0, filter(1)=0, interlace(1)=0
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // 8-bit
  ihdrData[9] = 6 // RGBA
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0

  function makeChunk(typeStr, dataBuf) {
    const len = dataBuf.length
    const typeBuf = Buffer.from(typeStr, 'ascii')
    const toCrc = Buffer.concat([typeBuf, dataBuf])
    const crcVal = crc32(toCrc)

    const chunk = Buffer.alloc(4 + 4 + len + 4)
    chunk.writeUInt32BE(len, 0)
    typeBuf.copy(chunk, 4)
    dataBuf.copy(chunk, 8)
    chunk.writeUInt32BE(crcVal, 8 + len)
    return chunk
  }

  const ihdrChunk = makeChunk('IHDR', ihdrData)

  // Scanlines: each row has 1 filter byte (0) + width * 4 bytes RGBA
  const rawRowLen = 1 + width * 4
  const rawData = Buffer.alloc(height * rawRowLen)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rawRowLen
    rawData[rowOffset] = 0 // Filter type None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4
      const [r, g, b, a] = getPixel(x, y, width, height)
      rawData[pxOffset] = r
      rawData[pxOffset + 1] = g
      rawData[pxOffset + 2] = b
      rawData[pxOffset + 3] = a
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 })
  const idatChunk = makeChunk('IDAT', compressed)
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk])
}

function rpgShader(x, y, size) {
  const cx = size / 2
  const cy = size / 2
  const dx = (x - cx) / cx
  const dy = (y - cy) / cy
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Rounded square mask
  const cornerR = 0.42
  const qx = Math.max(0, Math.abs(dx) - (1 - cornerR))
  const qy = Math.max(0, Math.abs(dy) - (1 - cornerR))
  const cornerDist = Math.sqrt(qx * qx + qy * qy)
  if (cornerDist > cornerR) return [0, 0, 0, 0]

  // Deep RPG radial background
  let r = 7 + Math.floor(18 * (1 - dist))
  let g = 17 + Math.floor(32 * (1 - dist))
  let b = 29 + Math.floor(58 * (1 - dist))
  let a = 255

  // Golden / Cyan Magic Ring
  const ringDist = Math.abs(dist - 0.68)
  if (ringDist < 0.045) {
    const intensity = 1 - ringDist / 0.045
    r = Math.min(255, r + Math.floor(234 * intensity))
    g = Math.min(255, g + Math.floor(179 * intensity))
    b = Math.min(255, b + Math.floor(8 * intensity))
  }

  // Cyan Inner Ring
  const innerRing = Math.abs(dist - 0.56)
  if (innerRing < 0.02) {
    const intensity = 1 - innerRing / 0.02
    r = Math.min(255, r + Math.floor(56 * intensity))
    g = Math.min(255, g + Math.floor(189 * intensity))
    b = Math.min(255, b + Math.floor(248 * intensity))
  }

  // Sword Blade vertical line
  const bladeX = Math.abs(dx)
  if (bladeX < 0.075 && dy > -0.65 && dy < 0.25) {
    const bladeT = 1 - bladeX / 0.075
    // Gradient light blue to cyan
    r = Math.min(255, Math.floor(224 * bladeT + 56 * (1 - bladeT)))
    g = Math.min(255, Math.floor(242 * bladeT + 189 * (1 - bladeT)))
    b = Math.min(255, 255)
  }

  // Sword Crossguard
  if (Math.abs(dy - 0.26) < 0.045 && Math.abs(dx) < 0.32) {
    r = 234
    g = 179
    b = 8
  }

  // Sword Handle & Pommel
  if (bladeX < 0.035 && dy >= 0.28 && dy < 0.52) {
    r = 51
    g = 65
    b = 85
  }
  const pommelDist = Math.sqrt(dx * dx + (dy - 0.55) * (dy - 0.55))
  if (pommelDist < 0.055) {
    r = 234
    g = 179
    b = 8
  }

  return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)), a]
}

const pubDir = path.resolve(__dirname, '..', 'public')
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true })

const png192 = makePng(192, 192, (x, y) => rpgShader(x, y, 192))
fs.writeFileSync(path.join(pubDir, 'icon-192.png'), png192)
console.log('Criado: icon-192.png (' + png192.length + ' bytes)')

const png512 = makePng(512, 512, (x, y) => rpgShader(x, y, 512))
fs.writeFileSync(path.join(pubDir, 'icon-512.png'), png512)
console.log('Criado: icon-512.png (' + png512.length + ' bytes)')
