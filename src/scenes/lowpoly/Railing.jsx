import Log from './Log';

/**
 * 景区常见的原木栏杆：几根歪扭的立柱 + 上下两道横梁。
 * 栏杆在人物身后 z=-0.3，对应照片里腰部和膝盖高度的两道横木。
 */
const Z = -0.3;
const BARK = '#5f4b3a';
const BARK_LIGHT = '#7a6a5a';

// [x, 柱顶偏移 dx, 柱高]
const POSTS = [
  { x: -2.3, lean: -0.05, h: 0.98, seed: 11 },
  { x: -1.35, lean: 0.03, h: 0.95, seed: 12 },
  { x: -0.55, lean: -0.02, h: 0.97, seed: 13 },
  { x: 0.46, lean: 0.14, h: 1.0, seed: 14 },
  { x: 1.4, lean: 0.05, h: 0.96, seed: 15 },
  { x: 2.4, lean: 0.02, h: 0.98, seed: 16 },
];

export default function Railing() {
  return (
    <group>
      {/* 立柱 */}
      {POSTS.map((p) => (
        <Log
          key={p.seed}
          from={[p.x, -0.45, Z]}
          to={[p.x + p.lean, p.h, Z]}
          radius={0.09}
          taper={0.82}
          wobble={0.02}
          seed={p.seed}
          color={p.seed % 2 ? BARK : BARK_LIGHT}
        />
      ))}
      {/* 人物两腿之间露出的一截矮桩（照片里腿后面有一截树桩） */}
      <Log from={[-0.12, -0.3, Z - 0.08]} to={[-0.1, 0.46, Z - 0.08]} radius={0.06} taper={0.8} wobble={0.012} seed={17} color={BARK_LIGHT} />
      {/* 横梁：相邻两柱之间一段，略有下垂 / 起伏 */}
      {POSTS.slice(0, -1).map((p, i) => {
        const q = POSTS[i + 1];
        const sag = (i % 2 ? 1 : -1) * 0.025;
        return (
          <group key={`rail-${i}`}>
            <Log
              from={[p.x + p.lean * 0.9, 0.9 + sag, Z + 0.02]}
              to={[q.x + q.lean * 0.9, 0.93 - sag, Z + 0.02]}
              radius={0.052}
              taper={0.95}
              wobble={0.018}
              seed={30 + i}
              color={BARK}
            />
            <Log
              from={[p.x + p.lean * 0.4, 0.42 + sag, Z + 0.02]}
              to={[q.x + q.lean * 0.4, 0.4 - sag, Z + 0.02]}
              radius={0.048}
              taper={0.95}
              wobble={0.018}
              seed={50 + i}
              color={BARK_LIGHT}
            />
          </group>
        );
      })}
    </group>
  );
}
