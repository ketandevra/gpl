import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconPath = path.join(root, "public/icons/icon-512.png");
const outDir = path.join(root, "public/splash");

const SCREENS = [
  [1290, 2796],
  [1179, 2556],
  [1170, 2532],
  [1284, 2778],
  [1125, 2436],
  [1242, 2688],
  [828, 1792],
  [750, 1334],
  [2048, 2732],
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function roundedLogo(size, radius) {
  const svg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`,
  );
  return sharp(iconPath)
    .resize(size, size, { fit: "cover" })
    .composite([{ input: svg, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function render(width, height) {
  const scale = width / 1170;
  const logoSize = Math.round(Math.min(width, height) * 0.5);
  const radius = Math.round(logoSize * 0.1);
  const logo = await roundedLogo(logoSize, radius);

  const titleSize = Math.max(28, Math.round(42 * scale));
  const kickerSize = Math.max(16, Math.round(20 * scale));
  const brandSize = Math.max(36, Math.round(48 * scale));
  const lineSize = Math.max(22, Math.round(28 * scale));
  const subSize = Math.max(18, Math.round(22 * scale));
  const cx = width / 2;
  const padTop = Math.round(height * 0.09);
  const padBottom = Math.round(height * 0.1);
  const logoTop = Math.round((height - logoSize) / 2);
  const font = "Helvetica Neue, Helvetica, Arial, sans-serif";

  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#3e2723"/>
      <ellipse cx="${width * 0.82}" cy="${height * -0.02}" rx="${width * 0.55}" ry="${width * 0.55}" fill="#f5b830" opacity="0.16"/>
      <ellipse cx="${width * 0.12}" cy="${height * 1.02}" rx="${width * 0.62}" ry="${width * 0.62}" fill="#2aa7ad" opacity="0.16"/>
      <text x="${cx}" y="${padTop + kickerSize}" text-anchor="middle"
        fill="#f5b830" font-family="${font}" font-size="${kickerSize}" font-weight="700">WELCOME TO</text>
      <text x="${cx}" y="${padTop + kickerSize + titleSize + Math.round(18 * scale)}" text-anchor="middle"
        fill="#fdf6e8" font-family="${font}" font-size="${titleSize}" font-weight="800">${escapeXml("Ghanchi Premier League")}</text>
      <text x="${cx}" y="${height - padBottom - lineSize - subSize - Math.round(28 * scale)}" text-anchor="middle"
        fill="#f5b830" font-family="${font}" font-size="${brandSize}" font-weight="800">GPL</text>
      <text x="${cx}" y="${height - padBottom - subSize - Math.round(8 * scale)}" text-anchor="middle"
        fill="#fdf6e8" font-family="${font}" font-size="${lineSize}" font-weight="600">${escapeXml("Live scores. Rising stars. One trophy.")}</text>
      <text x="${cx}" y="${height - padBottom + Math.round(8 * scale)}" text-anchor="middle"
        fill="#fdf6e8" opacity="0.55" font-family="${font}" font-size="${subSize}" font-weight="500">${escapeXml("The season is on.")}</text>
    </svg>
  `);

  await sharp(svg)
    .composite([
      {
        input: logo,
        left: Math.round((width - logoSize) / 2),
        top: logoTop,
      },
    ])
    .png()
    .toFile(path.join(outDir, `${width}x${height}.png`));
}

for (const [width, height] of SCREENS) {
  await render(width, height);
  console.log(`wrote ${width}x${height}`);
}
