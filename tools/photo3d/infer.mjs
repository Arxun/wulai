// 直接用 onnxruntime-node 跑：深度估计（Depth Anything V2）+ 人物抠图（U2Net human seg）
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = '/Users/dongxun/code/my-workspace/mountain-3d/public/reference.jpg';
const OUT = '/tmp/m3d/ml/out';
fs.mkdirSync(OUT, { recursive: true });
const meta = await sharp(SRC).metadata();
const W0 = meta.width, H0 = meta.height;

async function toCHW(w, h, mean, std, scaleMax = false) {
  const { data } = await sharp(SRC).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = new Float32Array(3 * w * h);
  let mx = 1;
  if (scaleMax) { mx = 0; for (const v of data) if (v > mx) mx = v; }
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) {
      const v = data[i * 3 + c] / (scaleMax ? mx : 255);
      out[c * w * h + i] = (v - mean[c]) / std[c];
    }
  }
  return out;
}

// ---------- depth ----------
{
  const w = 784, h = 1400; // 14 的倍数，约 0.56 宽高比
  const input = await toCHW(w, h, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]);
  const sess = await ort.InferenceSession.create('/tmp/m3d/ml/models/depth_vits_dynamic.onnx');
  console.log('depth inputs', sess.inputNames, 'outputs', sess.outputNames);
  const res = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, h, w]) });
  const t = res[sess.outputNames[0]];
  console.log('depth out dims', t.dims);
  const [oh, ow] = t.dims.slice(-2);
  const d = t.data;
  let mn = Infinity, mxv = -Infinity;
  for (const v of d) { if (v < mn) mn = v; if (v > mxv) mxv = v; }
  const u8 = Buffer.alloc(oh * ow);
  for (let i = 0; i < u8.length; i++) u8[i] = Math.round(((d[i] - mn) / (mxv - mn)) * 255);
  await sharp(u8, { raw: { width: ow, height: oh, channels: 1 } }).resize(W0 * 2, H0 * 2).png().toFile(`${OUT}/depth.png`);
  console.log('depth saved');
}

// ---------- person matting ----------
if (!process.env.SEG) process.exit(0);
{
  const s = 320;
  const input = await toCHW(s, s, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225], true);
  const sess = await ort.InferenceSession.create('/tmp/m3d/ml/models/u2net_human_seg.onnx');
  console.log('seg inputs', sess.inputNames, 'outputs', sess.outputNames);
  const res = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, s, s]) });
  const d = res[sess.outputNames[0]].data;
  let mn = Infinity, mxv = -Infinity;
  for (const v of d) { if (v < mn) mn = v; if (v > mxv) mxv = v; }
  const u8 = Buffer.alloc(s * s);
  for (let i = 0; i < u8.length; i++) u8[i] = Math.round(((d[i] - mn) / (mxv - mn)) * 255);
  await sharp(u8, { raw: { width: s, height: s, channels: 1 } }).resize(W0 * 2, H0 * 2, { kernel: 'lanczos3' }).png().toFile(`${OUT}/mask.png`);
  console.log('mask saved');
}
