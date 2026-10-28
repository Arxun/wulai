// 预处理：高清化照片、平滑深度、用深度阈值得到人物遮罩，并对“人物身后”的背景颜色/深度做补洞
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = '/Users/dongxun/code/my-workspace/mountain-3d/public/reference.jpg';
const OUT = '/Users/dongxun/code/my-workspace/mountain-3d/public/photo3d';
fs.mkdirSync(OUT, { recursive: true });

const W = 1152, H = 2048;

// 1) 照片 2x 放大 + 轻微锐化
await sharp(SRC).resize(W, H, { kernel: 'lanczos3' }).sharpen({ sigma: 1.1, m1: 1.2, m2: 2 }).jpeg({ quality: 92 }).toFile(`${OUT}/color.jpg`);

// 2) 深度：读入并轻微模糊（去 8bit 台阶感）
const dRaw = await sharp('/tmp/m3d/ml/out/depth.png').resize(W, H).greyscale().raw().toBuffer();
await sharp(dRaw, { raw: { width: W, height: H, channels: 1 } }).blur(1.6).png().toFile(`${OUT}/depth.png`);

// ---------- 补洞用的小图 ----------
const w = 288, h = 512;
const color = await sharp(SRC).resize(w, h).removeAlpha().raw().toBuffer(); // RGB u8
const depth = await sharp(dRaw, { raw: { width: W, height: H, channels: 1 } }).resize(w, h).extractChannel(0).raw().toBuffer();

// 人物遮罩：深度 > T，然后膨胀一圈（盖住边缘混色）
const T = Number(process.env.T || 145);
let mask = new Uint8Array(w * h);
const seg = await sharp('/tmp/m3d/ml/out/mask.png').resize(w, h).extractChannel(0).raw().toBuffer();
for (let i = 0; i < w * h; i++) mask[i] = depth[i] > T && seg[i] > 110 ? 1 : 0;
function dilate(m, r) {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let dy = -r; dy <= r && !v; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) { v = 1; break; }
        }
      out[y * w + x] = v;
    }
  return out;
}
mask = dilate(mask, 3);

// 额外输出一张 576×1024 的人物遮罩（不膨胀），给 tools/image-to-3d 做单图转 3D 用
{
  const fw = 576, fh = 1024;
  const dFull = await sharp(dRaw, { raw: { width: W, height: H, channels: 1 } }).resize(fw, fh).extractChannel(0).raw().toBuffer();
  const sFull = await sharp('/tmp/m3d/ml/out/mask.png').resize(fw, fh).extractChannel(0).raw().toBuffer();
  const m = Buffer.alloc(fw * fh);
  for (let i = 0; i < m.length; i++) m[i] = dFull[i] > T && sFull[i] > 110 ? 255 : 0;
  await sharp(m, { raw: { width: fw, height: fh, channels: 1 } }).blur(1.2).threshold(128).png().toFile(`${OUT}/person-mask.png`);
}

// 保存遮罩预览
await sharp(Buffer.from(mask.map((v) => v * 255)), { raw: { width: w, height: h, channels: 1 } }).png().toFile('/tmp/m3d/ml/out/mask_depth.png');

// push-pull 补洞：channels 个通道，known=!mask
function pushPull(data, channels) {
  // 构建金字塔
  const levels = [];
  let cw = w, ch = h;
  let val = new Float32Array(cw * ch * channels);
  let wt = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) {
    if (!mask[i]) {
      wt[i] = 1;
      for (let c = 0; c < channels; c++) val[i * channels + c] = data[i * channels + c];
    }
  }
  levels.push({ cw, ch, val, wt });
  while (cw > 2 && ch > 2) {
    const nw = Math.ceil(cw / 2), nh = Math.ceil(ch / 2);
    const nv = new Float32Array(nw * nh * channels);
    const nwt = new Float32Array(nw * nh);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        const i = y * cw + x;
        const j = (y >> 1) * nw + (x >> 1);
        const wi = val === null ? 0 : levels[levels.length - 1].wt[i];
        if (wi > 0) {
          nwt[j] += wi;
          for (let c = 0; c < channels; c++) nv[j * channels + c] += levels[levels.length - 1].val[i * channels + c] * wi;
        }
      }
    for (let j = 0; j < nw * nh; j++) if (nwt[j] > 0) for (let c = 0; c < channels; c++) nv[j * channels + c] /= nwt[j];
    for (let j = 0; j < nw * nh; j++) nwt[j] = Math.min(1, nwt[j]);
    levels.push({ cw: nw, ch: nh, val: nv, wt: nwt });
    cw = nw; ch = nh;
  }
  // pull：从粗到细，用粗层填细层空洞
  for (let l = levels.length - 2; l >= 0; l--) {
    const f = levels[l], g = levels[l + 1];
    for (let y = 0; y < f.ch; y++)
      for (let x = 0; x < f.cw; x++) {
        const i = y * f.cw + x;
        const wi = f.wt[i];
        if (wi >= 1) continue;
        const j = (y >> 1) * g.cw + (x >> 1);
        for (let c = 0; c < channels; c++)
          f.val[i * channels + c] = f.val[i * channels + c] * wi + g.val[j * channels + c] * (1 - wi);
        f.wt[i] = 1;
      }
  }
  return levels[0].val;
}

const colF = pushPull(color, 3);
const depF = pushPull(depth, 1);

// 补洞结果再整体柔化，避免块状痕迹，并用原图在“已知区域”覆盖
const bgColor = Buffer.alloc(w * h * 3);
for (let i = 0; i < w * h * 3; i++) bgColor[i] = Math.max(0, Math.min(255, Math.round(colF[i])));
const bgDepth = Buffer.alloc(w * h);
for (let i = 0; i < w * h; i++) bgDepth[i] = Math.max(0, Math.min(255, Math.round(depF[i])));

// 洞区域的颜色模糊；已知区域保持清晰
const blurredColor = await sharp(bgColor, { raw: { width: w, height: h, channels: 3 } }).blur(14).raw().toBuffer();
const mixed = Buffer.alloc(w * h * 3);
for (let i = 0; i < w * h; i++) {
  for (let c = 0; c < 3; c++) mixed[i * 3 + c] = mask[i] ? blurredColor[i * 3 + c] : color[i * 3 + c];
}
await sharp(mixed, { raw: { width: w, height: h, channels: 3 } }).resize(W / 2, H / 2).jpeg({ quality: 90 }).toFile(`${OUT}/bg-color.jpg`);
await sharp(bgDepth, { raw: { width: w, height: h, channels: 1 } }).blur(10).resize(W / 2, H / 2).png().toFile(`${OUT}/bg-depth.png`);
console.log('prep done');
