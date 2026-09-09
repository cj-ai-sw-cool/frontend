"""
팀원이 블렌더로 잘라 준 OBJ(`박스_몸체` / `박스_뚜껑`)를 **웹에서 바로 쓸 수 있는 GLB** 로 바꾼다.

    python tools/obj-to-glb.py <입력.obj> <출력.glb> [--texture-from <원본.glb>]

── 왜 변환이 필요한가 ──────────────────────────────────────────────────────────
① **OBJ 는 웹에 무겁다.** 좌표를 전부 사람이 읽는 글자로 적어 두는 형식이라 34MB 다.
   같은 내용을 GLB 로 담으면 숫자를 이진수로 그대로 넣어 1/5 이하가 된다.
② **OBJ 에는 원점(origin)이 없다.** 오브젝트마다 정점 좌표만 있고 "이 물체의 회전 중심이
   어디인가"를 담는 자리가 없다. 그대로 불러오면 뚜껑이 **자기 한가운데를 축으로 빙글 돈다.**
   그래서 여기서 **경첩 자리를 계산해 뚜껑의 원점으로 박아 넣는다** — 이 스크립트의 핵심이다.
③ **OBJ 의 MTL 에는 그림이 없다.** 팀원이 준 파일의 재질은 회색 하나뿐이라 그대로 쓰면
   민무늬 상자가 된다. 다행히 UV 는 살아 있으므로, `--texture-from` 으로 준 원본 GLB 에서
   색 텍스처를 꺼내 그대로 물려 준다.

── 경첩을 어디에 두는가 ────────────────────────────────────────────────────────
마인크래프트 상자의 뚜껑은 **뒤쪽 위 모서리**를 축으로 열린다. 그래서
    경첩 = (몸체 가로 중앙, 몸체 최고 높이, 몸체 최소 z)
로 잡는다. 뚜껑 정점을 전부 -경첩 만큼 옮기고 노드 위치를 +경첩 으로 두면, 겉보기 자리는
그대로인데 회전 중심만 그 모서리로 간다.

⚠️ 이 스크립트는 순수 파이썬이다(블렌더 불필요). numpy 만 쓴다.
"""

import argparse
import io
import json
import struct
import sys

import numpy as np


# Windows 콘솔이 cp949 라 한글·기호 출력이 깨진다. 출력만 UTF-8 로 고정한다(파일 처리와 무관).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="변환할 OBJ")
    parser.add_argument("output", help="내보낼 GLB")
    parser.add_argument(
        "--texture-from",
        default=None,
        help="색 텍스처를 꺼내 올 원본 GLB (OBJ 의 MTL 에는 그림이 없다)",
    )
    parser.add_argument(
        "--anim-from",
        default=None,
        help="여닫는 애니메이션을 그대로 가져올 원본 GLB (없으면 클립 없이 내보낸다)",
    )
    parser.add_argument(
        "--align-lid-to",
        default=None,
        help="뚜껑 자세를 맞출 원본 GLB. 블렌더에서 뚜껑을 옮겨 놨을 때 제자리로 되돌린다",
    )
    parser.add_argument(
        "--hinge-object",
        default="뚜껑",
        help="경첩을 박을 오브젝트 이름에 들어가는 말 (기본: 뚜껑)",
    )
    return parser.parse_args()


def parse_obj(path):
    """OBJ 를 읽어 오브젝트별 {positions, uvs, normals, indices} 로 만든다.

    ⚠️ OBJ 의 면은 `v/vt/vn` **세 인덱스의 조합**을 가리킨다. glTF 는 그런 조합을 모르고
       정점 하나에 좌표·UV·법선이 한 벌씩 붙는다. 그래서 조합마다 새 정점을 만들어
       번호를 다시 매긴다(같은 조합은 재사용한다).
    """
    v, vt, vn = [], [], []
    objects = {}
    current = None

    with io.open(path, encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if line.startswith("v "):
                v.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                vt.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("vn "):
                vn.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("o "):
                current = line[2:].strip()
                objects[current] = {"lookup": {}, "pos": [], "uv": [], "nrm": [], "idx": []}
            elif line.startswith("f ") and current is not None:
                target = objects[current]
                corners = line.split()[1:]
                built = []
                for corner in corners:
                    key = corner
                    found = target["lookup"].get(key)
                    if found is None:
                        parts = (corner.split("/") + ["", ""])[:3]
                        pi = int(parts[0]) - 1
                        ti = int(parts[1]) - 1 if parts[1] else None
                        ni = int(parts[2]) - 1 if parts[2] else None
                        found = len(target["pos"])
                        target["lookup"][key] = found
                        target["pos"].append(v[pi])
                        target["uv"].append(vt[ti] if ti is not None and ti < len(vt) else [0.0, 0.0])
                        target["nrm"].append(vn[ni] if ni is not None and ni < len(vn) else [0.0, 1.0, 0.0])
                    built.append(found)
                # 사각형 이상이면 부채꼴로 삼각형을 만든다
                for k in range(1, len(built) - 1):
                    target["idx"].extend([built[0], built[k], built[k + 1]])

    for name, data in objects.items():
        data["pos"] = np.array(data["pos"], dtype=np.float32)
        uv = np.array(data["uv"], dtype=np.float32)
        # ⚠️ **V 축을 뒤집는다.** OBJ 의 UV 원점은 좌하단, glTF 는 좌상단이라 그대로 넘기면
        #    텍스처가 위아래로 뒤집혀 붙는다(무늬가 뒤죽박죽으로 보이는 원인이었다).
        if len(uv):
            uv[:, 1] = 1.0 - uv[:, 1]
        data["uv"] = uv
        data["nrm"] = np.array(data["nrm"], dtype=np.float32)
        data["idx"] = np.array(data["idx"], dtype=np.uint32)
        del data["lookup"]
    return objects


def read_glb_chunks(path):
    data = open(path, "rb").read()
    offset = 12
    js, binary = None, b""
    while offset < len(data):
        length, kind = struct.unpack("<I4s", data[offset : offset + 8])
        chunk = data[offset + 8 : offset + 8 + length]
        if kind == b"JSON":
            js = json.loads(chunk.decode("utf-8"))
        elif kind == b"BIN\x00":
            binary = chunk
        offset += 8 + length
    return js, binary


def extract_base_color(path):
    """원본 GLB 에서 baseColor 이미지 바이트와 mime 을 꺼낸다."""
    js, binary = read_glb_chunks(path)
    material = js["materials"][0]
    index = material["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    image_index = js["textures"][index]["source"]
    image = js["images"][image_index]
    view = js["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    return binary[start : start + view["byteLength"]], image.get("mimeType", "image/jpeg")


def read_lid_reference(path):
    """
    원본 GLB 의 뚜껑이 **어디에 어떤 자세로** 있었는지 읽는다 — 경첩 위치와 월드 중심.

    ★ 왜 필요한가: 팀원이 블렌더에서 자를 때 뚜껑을 **옮겨 놨다**(보기 편하려고 빼 둔 것으로
      보인다). 회전만 다른 게 아니라 위치 자체가 (0, -0.272, +0.768) 만큼 어긋나 있었다.
      그래서 원본 클립의 92° 를 그대로 적용해도 뚜껑이 엉뚱한 데로 간다.
      원본의 자세를 기준으로 되돌려 놓으면 클립이 **그대로** 맞는다 — 각도를 새로 추측할
      필요가 없다.
    """
    js, binary = read_glb_chunks(path)
    node = next(
        (n for n in js["nodes"] if "lid" in n.get("name", "").lower() or "뚜껑" in n.get("name", "")),
        None,
    )
    if node is None or "mesh" not in node:
        return None

    accessor_index = js["meshes"][node["mesh"]]["primitives"][0]["attributes"]["POSITION"]
    accessor = js["accessors"][accessor_index]
    view = js["bufferViews"][accessor["bufferView"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    points = np.frombuffer(
        binary, dtype=np.float32, count=accessor["count"] * 3, offset=start
    ).reshape(-1, 3)

    translation = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
    world = points.astype(np.float64) + translation
    center = (world.min(axis=0) + world.max(axis=0)) / 2.0
    return {"hinge": translation, "center": center}


def extract_lid_clip(path):
    """
    원본 GLB 에서 뚜껑 여닫는 클립의 **시각·회전값**을 그대로 꺼낸다.

    ★ 왜 이게 필요한가: 닫힌 자세를 우리가 **추측하면 안 된다.** 처음에는 뚜껑이 벌어진
      각도를 정점에서 재서 그만큼 되돌렸는데, 재는 방식이 뚜껑의 두께·모양에 휘둘려
      129° 가 나왔다. 실제 정답은 원본 클립에 적힌 **92°** 였다 — 만든 사람이 정해 둔 값이
      파일 안에 이미 있는데 그걸 두고 재고 있었던 것이다.
    """
    js, binary = read_glb_chunks(path)
    animations = js.get("animations")
    if not animations:
        return None

    sampler = animations[0]["samplers"][0]

    def raw(accessor_index):
        accessor = js["accessors"][accessor_index]
        view = js["bufferViews"][accessor["bufferView"]]
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        count = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[accessor["type"]] * accessor["count"]
        return binary[start : start + count * 4], accessor["count"], accessor["type"]

    return {
        "name": animations[0].get("name", "lid_close"),
        "input": raw(sampler["input"]),
        "output": raw(sampler["output"]),
        "interpolation": sampler.get("interpolation", "LINEAR"),
    }


def pad4(buffer):
    """glTF 는 각 덩어리가 4바이트 경계에서 시작해야 한다"""
    while len(buffer) % 4:
        buffer += b"\x00"
    return buffer


def main():
    args = parse_args()

    print(f"[obj-to-glb] 읽는 중: {args.input}")
    objects = parse_obj(args.input)
    for name, data in objects.items():
        print(f"           {name}: 정점 {len(data['pos'])} · 삼각형 {len(data['idx']) // 3}")

    if not objects:
        sys.exit("오브젝트가 없다")

    names = list(objects)
    lid_name = next((n for n in names if args.hinge_object in n), None)
    body_name = next((n for n in names if n != lid_name), names[0])

    body = objects[body_name]
    hinge = None
    if lid_name is not None:
        lid = objects[lid_name]
        reference = read_lid_reference(args.align_lid_to) if args.align_lid_to else None

        if reference is not None:
            # ★ 원본이 정해 둔 경첩을 그대로 쓴다 — 클립의 회전이 이 점을 기준으로 만들어졌다
            hinge = reference["hinge"].astype(np.float32)

            # ★ 뚜껑을 원본 자세로 되돌린다 (블렌더에서 옮겨 놓은 만큼 빼 준다)
            current = (lid["pos"].min(axis=0) + lid["pos"].max(axis=0)) / 2.0
            delta = reference["center"] - current
            lid["pos"] = (lid["pos"] + delta).astype(np.float32)
            print(
                "[obj-to-glb] 뚜껑 자세 보정 = "
                f"({delta[0]:+.3f}, {delta[1]:+.3f}, {delta[2]:+.3f}) — 원본 위치로 되돌림"
            )
        else:
            # 참고할 원본이 없으면 몸체의 뒤쪽 위 모서리를 경첩으로 삼는다
            lo = body["pos"].min(axis=0)
            hi = body["pos"].max(axis=0)
            hinge = np.array([(lo[0] + hi[0]) / 2.0, hi[1], lo[2]], dtype=np.float32)

        print(f"[obj-to-glb] 경첩 = ({hinge[0]:.4f}, {hinge[1]:.4f}, {hinge[2]:.4f})")

        # 정점을 경첩 기준으로 옮긴다 → 노드 translation 이 경첩이 된다
        lid["pos"] = lid["pos"] - hinge

    # ── GLB 조립 ──────────────────────────────────────────────────────────
    buffer = b""
    views, accessors, meshes, nodes = [], [], [], []

    def add_view(payload, target=None):
        nonlocal buffer
        buffer = pad4(buffer)
        offset = len(buffer)
        buffer += payload
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(payload)}
        if target is not None:
            view["target"] = target
        views.append(view)
        return len(views) - 1

    def add_accessor(view, component, kind, count, mins=None, maxs=None):
        accessor = {"bufferView": view, "componentType": component, "count": count, "type": kind}
        if mins is not None:
            accessor["min"] = mins
            accessor["max"] = maxs
        accessors.append(accessor)
        return len(accessors) - 1

    for name in names:
        data = objects[name]
        pos_view = add_view(data["pos"].tobytes(), 34962)
        pos_acc = add_accessor(
            pos_view, 5126, "VEC3", len(data["pos"]),
            data["pos"].min(axis=0).tolist(), data["pos"].max(axis=0).tolist(),
        )
        nrm_acc = add_accessor(add_view(data["nrm"].tobytes(), 34962), 5126, "VEC3", len(data["nrm"]))
        uv_acc = add_accessor(add_view(data["uv"].tobytes(), 34962), 5126, "VEC2", len(data["uv"]))
        idx_acc = add_accessor(add_view(data["idx"].tobytes(), 34963), 5125, "SCALAR", len(data["idx"]))

        meshes.append(
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": pos_acc, "NORMAL": nrm_acc, "TEXCOORD_0": uv_acc},
                        "indices": idx_acc,
                        "material": 0,
                    }
                ]
            }
        )

        # 이름을 앱이 알아보는 영문으로 바꾼다 — 뷰어가 `lid` 를 이름으로 찾는다
        node = {"mesh": len(meshes) - 1, "name": "box_lid" if name == lid_name else "box_body"}
        if name == lid_name and hinge is not None:
            node["translation"] = [float(hinge[0]), float(hinge[1]), float(hinge[2])]
        nodes.append(node)

    gltf = {
        "asset": {"version": "2.0", "generator": "obj-to-glb.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": views,
        "materials": [
            {
                "name": "chest",
                "pbrMetallicRoughness": {"metallicFactor": 0.0, "roughnessFactor": 1.0},
            }
        ],
    }

    if args.texture_from:
        image_bytes, mime = extract_base_color(args.texture_from)
        image_view = add_view(image_bytes)
        gltf["images"] = [{"bufferView": image_view, "mimeType": mime}]
        gltf["samplers"] = [{"magFilter": 9728, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
        gltf["textures"] = [{"sampler": 0, "source": 0}]
        gltf["materials"][0]["pbrMetallicRoughness"]["baseColorTexture"] = {"index": 0}
        print(f"[obj-to-glb] 텍스처 이식: {len(image_bytes)} bytes ({mime})")

    clip = extract_lid_clip(args.anim_from) if args.anim_from else None
    if clip is not None and lid_name is not None:
        lid_node = next(i for i, n in enumerate(nodes) if n["name"] == "box_lid")

        input_bytes, input_count, _ = clip["input"]
        output_bytes, output_count, _ = clip["output"]

        input_acc = add_accessor(add_view(input_bytes), 5126, "SCALAR", input_count)
        # 시각 accessor 에는 min/max 가 필수다 (glTF 규격)
        times = np.frombuffer(input_bytes, dtype=np.float32)
        accessors[input_acc]["min"] = [float(times.min())]
        accessors[input_acc]["max"] = [float(times.max())]
        output_acc = add_accessor(add_view(output_bytes), 5126, "VEC4", output_count)

        gltf["animations"] = [
            {
                "name": clip["name"],
                "samplers": [
                    {"input": input_acc, "output": output_acc, "interpolation": clip["interpolation"]}
                ],
                "channels": [{"sampler": 0, "target": {"node": lid_node, "path": "rotation"}}],
            }
        ]
        print(f"[obj-to-glb] 애니메이션 이식: {clip['name']} (키프레임 {input_count}개)")

    buffer = pad4(buffer)
    gltf["buffers"] = [{"byteLength": len(buffer)}]

    # ⚠️ JSON 덩어리는 **공백(0x20)으로** 채워야 한다. 널 바이트로 채우면 파서가
    #    JSON 끝에서 "Extra data" 로 죽는다 — glTF 규격이 청크 종류별로 채움 바이트를
    #    다르게 정해 뒀기 때문이다(JSON=공백, BIN=0). 여기서 pad4 를 쓰면 안 되는 이유다.
    json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(json_chunk) % 4:
        json_chunk += b" "

    glb = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(json_chunk) + 8 + len(buffer))
    glb += struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk
    glb += struct.pack("<I4s", len(buffer), b"BIN\x00") + buffer

    open(args.output, "wb").write(glb)
    print(f"[obj-to-glb] 저장 완료 → {args.output} ({len(glb):,} bytes)")


if __name__ == "__main__":
    main()
