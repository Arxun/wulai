/**
 * 低多边形网格：平面着色 + 顶点色。
 * geometry 需要带 color 属性（见 lib/geometry/vertexColor.js）；
 * 没有顶点色时传 color / vertexColors={false} 即可当普通单色网格用；
 * 有顶点色时 tint 会整体乘一个颜色（用来整体压暗 / 偏色，比如远山）。
 *
 * texture：{ map, bump }（见 lib/textures/procedural.js），几何体需要带 uv。
 * 贴图与顶点色相乘，所以顶点色决定“色块”，贴图只负责织物 / 皮肤的细节。
 *
 * smooth：改用几何体自带的平滑法线（皮肤 / 五官），需要几何体用 smoothNormals 处理过。
 */
export default function FacetMesh({
  geometry,
  color = '#ffffff',
  tint = '#ffffff',
  vertexColors = true,
  roughness = 0.85,
  metalness = 0,
  side,
  texture,
  bumpScale = 1,
  smooth = false,
  castShadow = true,
  receiveShadow = true,
  children,
  ...props
}) {
  return (
    <mesh geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow} {...props}>
      <meshStandardMaterial
        flatShading={!smooth}
        vertexColors={vertexColors}
        color={vertexColors ? tint : color}
        roughness={roughness}
        metalness={metalness}
        side={side}
        map={texture?.map}
        bumpMap={texture?.bump}
        bumpScale={bumpScale}
      />
      {children}
    </mesh>
  );
}
