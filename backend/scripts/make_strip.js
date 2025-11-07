// backend/scripts/make_strip.js
// Genera strip.png y strip@2x.png para Apple Wallet a partir de una imagen fuente.
// Tamaños exactos recomendados: 624x168 (1x) y 1248x336 (2x)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODEL = process.env.MODEL_DIR
  ? path.resolve(ROOT, process.env.MODEL_DIR)
  : path.resolve(ROOT, 'passes', 'alcazaren.pass');

const SRC_DEFAULT = path.resolve(ROOT, 'public', '0S2A8207.png');
const OUT_1X = path.join(MODEL, 'strip.png');
const OUT_2X = path.join(MODEL, 'strip@2x.png');

const sizes = [
  { out: OUT_1X, w: 624, h: 168 },
  { out: OUT_2X, w: 1248, h: 336 },
];

async function run() {
  const src = process.argv[2] ? path.resolve(process.argv[2]) : SRC_DEFAULT;
  if (!fs.existsSync(src)) {
    console.error(`❌ Imagen fuente no encontrada: ${src}`);
    console.error('Pásala como argumento: node scripts/make_strip.js C:/ruta/tu_imagen.png');
    process.exit(1);
  }
  if (!fs.existsSync(MODEL)) {
    console.error(`❌ Carpeta del modelo .pass no existe: ${MODEL}`);
    process.exit(1);
  }

  let sharp = null;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('❌ Falta la dependencia "sharp".');
    console.error('   Instala con:');
    console.error('   cd backend && npm i sharp');
    process.exit(1);
  }

  for (const { out, w, h } of sizes) {
    console.log(`→ Generando ${path.basename(out)} ${w}x${h} desde ${path.basename(src)} ...`);
    await sharp(src)
      .resize({ width: w, height: h, fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(out);
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`   OK ${path.basename(out)} (${kb} KB)`);
  }

  console.log('✅ Listo. Copia generada en:');
  console.log(`   - ${OUT_1X}`);
  console.log(`   - ${OUT_2X}`);
  console.log('   Sube los cambios (recuerda evitar archivos >100MB).');
}

run().catch((e) => {
  console.error('⚠️  Error generando strips:', e?.message || e);
  process.exit(1);
});

