# Maestro のソリューション（uip solution pack の出力）を publish できる形に直す（knowledge/maestro.md の「デプロイして確かめたこと」）。
#   python -I tools/maestro/fix-entry-points.py <in.zip> <out.zip>
# 定期実行のトリガーの Flow は entry point の uniqueId が "start"（GUID でない）になり、solution publish が
# 1205「No entry points defined for project」で拒む。nupkg の entry-points.json と process の resource の両方を同じ GUID に直す。
# ビジネスルール（files/<id>/<名前>-<版>.uirule）は pack が zip（entry-points.json と .dmn）で作るが、評価する側は
# .dmn そのものとして読み、「Data at the root level is invalid. Line 1, position 1.」で失敗する。中の .dmn に置き換える。
import zipfile, json, uuid, io, sys
src, dst = sys.argv[1], sys.argv[2]
ids = {}
def fix_ep(j):
    for e in j["entryPoints"]:
        if e["uniqueId"] == "start": e["uniqueId"] = ids.setdefault("x", str(uuid.uuid4()))
    return j
def fix_nupkg(data):
    zin = zipfile.ZipFile(io.BytesIO(data)); buf = io.BytesIO(); zout = zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED)
    for it in zin.infolist():
        b = zin.read(it.filename)
        if it.filename == "content/entry-points.json": b = json.dumps(fix_ep(json.loads(b)), indent=2).encode()
        zout.writestr(it, b)
    zout.close(); return buf.getvalue()
zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    b = zin.read(it.filename)
    if it.filename.endswith(".uirule") and b[:2] == b"PK":
        rz = zipfile.ZipFile(io.BytesIO(b)); dmn = [n for n in rz.namelist() if n.endswith(".dmn")]
        if len(dmn) == 1: b = rz.read(dmn[0]); globals().setdefault("rules", []).append(it.filename)
    if ".Flow." in it.filename and it.filename.endswith(".nupkg"):
        ids.clear(); b = fix_nupkg(b); name = it.filename.split(".Flow.")[1].split(".")[0]; ids_by = dict(ids); globals().setdefault("map", {})[name] = ids_by.get("x")
    zout.writestr(it, b)
zout.close()
# process の resource も同じ GUID に
zin = zipfile.ZipFile(dst); out = io.BytesIO(); zout = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    b = zin.read(it.filename)
    for name, g in globals().get("map", {}).items():
        if g and it.filename.endswith("process/flow/%s.json" % name):
            j = json.loads(b); s = j["resource"]["spec"]
            if s.get("entryPointUniqueId") == "start": s["entryPointUniqueId"] = g
            if isinstance(s.get("entryPoints"), str): s["entryPoints"] = s["entryPoints"].replace('"uniqueId": "start"', '"uniqueId": "%s"' % g)
            b = json.dumps(j, indent=2).encode()
    zout.writestr(it, b)
zout.close(); open(dst, "wb").write(out.getvalue()); print("fixed", globals().get("map", {}), "rules:", globals().get("rules", []))
