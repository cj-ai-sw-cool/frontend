"""
GLB 상자를 **몸통과 뚜껑으로 잘라서** 다시 내보내는 Blender 스크립트.

Meshy 같은 생성 도구는 통짜 메시 하나만 내놓는다. 그대로는 뚜껑이 안 열린다 —
여닫으려면 뚜껑이 별도 오브젝트여야 하고, 그 오브젝트의 **원점(origin)이 경첩 자리**에
있어야 한다(원점이 가운데 있으면 뚜껑이 제자리에서 빙글 돈다). 이 스크립트가 그 둘을 한다.

    잘라내기 → 자른 단면 막기 → 뚜껑 원점을 뒤쪽 모서리로 → (선택) 폴리곤 감축 → 내보내기

── 쓰는 법 ─────────────────────────────────────────────────────────────────────
    blender --background --python tools/split-box.py -- <입력.glb> <출력.glb> [옵션]

    예) 위에서 30% 지점을 뚜껑으로 자르고 폴리곤을 5%로 줄이기
    blender --background --python tools/split-box.py -- ^
        public/models/meshy-open-box.glb public/models/meshy-split.glb ^
        --lid-ratio 0.3 --decimate 0.05

옵션
    --lid-ratio  0~1. 상자 높이의 위에서 몇 %를 뚜껑으로 삼을지 (기본 0.3)
    --decimate   0~1. 폴리곤을 몇 배로 줄일지. 1 이면 그대로 (기본 1)
    --keep-open  자른 단면을 막지 않는다 (기본은 막는다)

── ⚠️ 왜 `bpy.ops` 를 거의 안 쓰나 (블렌더가 꺼지던 이유) ──────────────────────
`bpy.ops.mesh.bisect` 는 **3D 뷰포트가 있어야 도는 연산자**다. 마우스로 자르는 도구라
화면(region/area)을 전제로 만들어졌기 때문이다. `--background` 로 돌리면 그 화면이 없어서
컨텍스트가 비고, 버전에 따라 에러가 아니라 **그대로 죽는다.** 처음 판이 그래서 꺼졌다.

그래서 이 판은 화면이 필요 없는 길만 쓴다:
    자르기      `bmesh.ops.bisect_plane`      — 순수 데이터 연산, 화면과 무관
    단면 막기   `bmesh.ops.holes_fill`
    복제        `obj.copy()` + `data.copy()`  — 연산자 대신 데이터 API
    원점 이동   정점을 -P 만큼 옮기고 `obj.location = P` — origin_set 연산자 불필요
    폴리곤 감축 depsgraph 로 모디파이어를 구워 낸다 — modifier_apply 연산자 불필요
연산자는 **불러오기/내보내기 두 개**만 쓴다. 그 둘은 background 에서 정상 동작한다.

⚠️ Blender 3.x / 4.x 에서 동작한다. `bpy` 는 Blender 안에서만 있는 모듈이라 이 파일은
   일반 python 으로는 실행되지 않는다 — 반드시 위 명령 형태로 돌린다.
"""

import sys
import argparse

import bpy  # type: ignore  # Blender 안에서만 존재한다
import bmesh  # type: ignore
from mathutils import Vector  # type: ignore


def parse_args():
    """`--` 뒤의 인자만 우리 것이다. 앞쪽은 Blender 가 먹는다."""
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []

    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="자를 GLB")
    parser.add_argument("output", help="내보낼 GLB")
    parser.add_argument("--lid-ratio", type=float, default=0.3, help="위에서 몇 %를 뚜껑으로")
    parser.add_argument("--decimate", type=float, default=1.0, help="폴리곤 비율(1=그대로)")
    parser.add_argument("--keep-open", action="store_true", help="자른 단면을 막지 않는다")
    return parser.parse_args(argv)


def clear_scene():
    """기본 큐브·카메라·조명을 지운다. 데이터 API 만 쓴다(연산자는 컨텍스트를 탄다)."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def import_glb(path):
    """GLB 를 읽어 메시 하나로 합쳐 돌려준다."""
    bpy.ops.import_scene.gltf(filepath=path)

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        raise SystemExit("메시가 없다: " + path)

    print(f"[split-box] 메시 조각 {len(meshes)}개")

    # 여러 조각이면 bmesh 로 합친다 — join 연산자는 컨텍스트를 타므로 쓰지 않는다.
    # ⚠️ 각 조각의 **월드 변환을 먹여서** 합쳐야 한다. 부모 회전이 남아 있으면 자르는 평면이
    #    기울어져서 뚜껑이 비스듬히 잘린다.
    merged = bmesh.new()
    for obj in meshes:
        temp = bmesh.new()
        temp.from_mesh(obj.data)
        temp.transform(obj.matrix_world)
        temp.to_mesh(obj.data)
        temp.free()
        merged.from_mesh(obj.data)

    base = meshes[0]
    for extra in meshes[1:]:
        bpy.data.objects.remove(extra, do_unlink=True)

    merged.to_mesh(base.data)
    merged.free()

    base.matrix_world.identity()
    base.name = "box"
    return base


def bounds(obj):
    """로컬 좌표 기준 (최소, 최대). 위에서 월드 변환을 이미 먹였으므로 로컬 = 월드다.
    Blender 는 **Z 가 위쪽**이다(glTF 는 Y 가 위쪽)."""
    verts = obj.data.vertices
    lo = [min(v.co[i] for v in verts) for i in range(3)]
    hi = [max(v.co[i] for v in verts) for i in range(3)]
    return lo, hi


def cut(obj, cut_z, keep_above, fill):
    """
    평면으로 자르고 한쪽만 남긴다.

    `bmesh.ops.bisect_plane` 은 순수 계산이라 화면이 없어도 돈다 — 이 스크립트의 핵심이다.
    `clear_inner` 는 평면의 **법선 반대쪽**(여기서는 아래), `clear_outer` 는 법선 쪽(위)을 지운다.
    """
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)

    geom = mesh.verts[:] + mesh.edges[:] + mesh.faces[:]
    result = bmesh.ops.bisect_plane(
        mesh,
        geom=geom,
        dist=1e-6,
        plane_co=Vector((0.0, 0.0, cut_z)),
        plane_no=Vector((0.0, 0.0, 1.0)),
        clear_inner=keep_above,      # 위를 남기려면 아래를 지운다
        clear_outer=not keep_above,
    )

    if fill:
        # 자른 테두리를 면으로 막는다 — 안 막으면 그 구멍이 화면에서 "크랙"으로 보인다
        cut_edges = [e for e in result.get("geom_cut", []) if isinstance(e, bmesh.types.BMEdge)]
        if cut_edges:
            bmesh.ops.holes_fill(mesh, edges=cut_edges, sides=0)

    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def duplicate(obj, name):
    """연산자 없이 복제한다 — `bpy.ops.object.duplicate()` 는 컨텍스트를 탄다."""
    copy = obj.copy()
    copy.data = obj.data.copy()
    copy.name = name
    bpy.context.scene.collection.objects.link(copy)
    return copy


def move_origin(obj, point):
    """
    오브젝트의 원점을 `point` 로 옮긴다 = **경첩을 박는다.**

    정점을 전부 -point 만큼 옮기고, 오브젝트를 +point 로 이동시킨다. 겉보기 위치는 그대로인데
    회전 중심만 그 자리로 간다. `origin_set` 연산자와 결과가 같고 컨텍스트를 안 탄다.

    ⚠️ 이걸 안 하면 뚜껑이 자기 한가운데를 축으로 빙글 돈다 — 여닫히는 게 아니라 헬리콥터다.
    """
    offset = Vector(point)
    for vertex in obj.data.vertices:
        vertex.co -= offset
    obj.data.update()
    obj.location = offset


def decimate(obj, ratio):
    """
    폴리곤 감축. 42만 삼각형은 웹에 너무 무겁다.

    모디파이어를 걸고 **depsgraph 로 구워 낸다** — `modifier_apply` 연산자는 활성 오브젝트
    컨텍스트를 요구해서 background 에서 불안정하다.

    ⚠️ 너무 줄이면 표면이 뜯어져 구멍(크랙)이 생긴다. 0.05 부터 시작해 결과를 보고 올린다.
    """
    if ratio >= 1.0:
        return

    modifier = obj.modifiers.new(name="decimate", type="DECIMATE")
    modifier.ratio = ratio

    depsgraph = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    obj.modifiers.clear()
    old = obj.data
    obj.data = baked
    bpy.data.meshes.remove(old)


def main():
    args = parse_args()

    clear_scene()
    obj = import_glb(args.input)

    lo, hi = bounds(obj)
    height = hi[2] - lo[2]
    cut_z = hi[2] - height * args.lid_ratio
    print(f"[split-box] 높이 {height:.3f} · 자르는 높이 z={cut_z:.3f} (위에서 {args.lid_ratio:.0%})")

    lid = duplicate(obj, "box_lid")
    obj.name = "box_body"

    cut(obj, cut_z, keep_above=False, fill=not args.keep_open)
    cut(lid, cut_z, keep_above=True, fill=not args.keep_open)

    # 경첩 = 뚜껑의 **뒤쪽 아래 모서리**.
    # ⚠️ glTF(Y-up) → Blender(Z-up) 변환에서 glTF 의 뒤쪽(-Z)이 Blender 의 +Y 가 된다.
    lid_lo, lid_hi = bounds(lid)
    move_origin(lid, ((lid_lo[0] + lid_hi[0]) / 2.0, lid_hi[1], cut_z))

    for part in (obj, lid):
        decimate(part, args.decimate)
        print(f"[split-box] {part.name}: 면 {len(part.data.polygons)}개")

    for part in (obj, lid):
        part.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format="GLB",
        use_selection=False,
    )
    print(f"[split-box] 저장 완료 → {args.output}")


if __name__ == "__main__":
    main()
