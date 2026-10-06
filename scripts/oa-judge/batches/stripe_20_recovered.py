#!/usr/bin/env python3
"""Create offline-only candidate artifacts for Stripe #20.

This generator is deliberately scoped to oa-stripe-20. It does not edit any
aggregate, registry, coverage, formal batch, or production runtime files.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import textwrap
from decimal import Decimal

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
CATALOG = ROOT / "content" / "oa-master" / "catalog.json"
IDENTIFIER = "oa-stripe-20"
BATCH = "stripe-20-recovered"
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "web/content/docs/companies/stripe.mdx"
RAW_BLOB = "a96a0563731861954d02ac5b50b0f0e3f40bf873"
RAW_SHA256 = "b0cecf071f81fd71908e279c4c77f70e56b70411a42d5f082359b697164b69aa"
CATALOG_HASH = "5b7ba75466726cd40ff78b880f150612e72fc8f0cab3869a804cdc1218d21bb2"
SOURCE_URL = "https://oamaster.com/docs/companies/stripe#20-request-routing-system"


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_package(raw):
    script = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    result = subprocess.run(
        ["node", "--import", "tsx", "-e", script], cwd=ROOT,
        input=json.dumps(raw, ensure_ascii=False), text=True, capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout


REFERENCE = r'''import math
from decimal import Decimal, localcontext, ROUND_HALF_UP

EARTH = 6371.0
PI_D = Decimal("3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679")

def decimal_round_km(lat1, lon1, lat2, lon2):
    # Slow path for values close to a rounding boundary or near the antipode.
    def sin(x):
        term = total = x
        i = 1
        while True:
            term *= -(x * x) / Decimal((2 * i) * (2 * i + 1))
            nxt = total + term
            if nxt == total: return total
            total = nxt; i += 1
    def cos(x):
        term = total = Decimal(1)
        i = 1
        while True:
            term *= -(x * x) / Decimal((2 * i - 1) * (2 * i))
            nxt = total + term
            if nxt == total: return total
            total = nxt; i += 1
    def atan(x):
        if x < 0: return -atan(-x)
        scale = 0
        while x > Decimal("0.05"):
            x = x / (Decimal(1) + (Decimal(1) + x*x).sqrt())
            scale += 1
        term = total = x
        i = 1
        while True:
            term *= -(x*x)
            nxt = total + term / Decimal(2*i + 1)
            if nxt == total: return total * (2 ** scale)
            total = nxt; i += 1
    def atan2(y, x):
        if x == 0: return PI_D / 2
        if y == 0: return Decimal(0)
        return atan(y/x) if x > 0 else PI_D - atan(y/(-x))
    with localcontext() as ctx:
        ctx.prec = 80
        p1, p2 = Decimal(str(lat1))*PI_D/180, Decimal(str(lat2))*PI_D/180
        dp = (Decimal(str(lat2))-Decimal(str(lat1)))*PI_D/180
        dl = (Decimal(str(lon2))-Decimal(str(lon1)))*PI_D/180
        a = sin(dp/2)**2 + cos(p1)*cos(p2)*sin(dl/2)**2
        a = min(Decimal(1), max(Decimal(0), a))
        km = Decimal(6371)*2*atan2(a.sqrt(), (1-a).sqrt())
        return int(km.to_integral_value(rounding=ROUND_HALF_UP))

def raw_haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    a = min(1.0, max(0.0, a))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    km = EARTH * c
    return km

def half_up_km(lat1, lon1, lat2, lon2):
    km = raw_haversine_km(lat1, lon1, lat2, lon2)
    # Double precision can move a result across a half-kilometer boundary.
    # The 18-decimal input limit lets this conservative band trigger a
    # high-precision Decimal recomputation only for numerically sensitive cases.
    if abs(km - (math.floor(km) + 0.5)) < 1e-5 or km > 20015.0:
        return decimal_round_km(lat1, lon1, lat2, lon2)
    # The mathematical distance cannot be an exact half-integer for finite-
    # decimal coordinates; this is the unique nearest integer.
    return math.floor(km + 0.5)

def solve(raw):
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if not lines:
        return ""
    q = int(lines[0])
    datacenters = {}
    out = []
    for line in lines[1:q + 1]:
        p = line.split()
        op = p[0]
        if op == "REGISTER":
            name, lat_s, lon_s, cap_s = p[1:]
            lat, lon, cap = float(lat_s), float(lon_s), int(cap_s)
            if name in datacenters or not (-90 <= lat <= 90 and -180 <= lon <= 180) or cap <= 0:
                out.append("ERROR")
            else:
                # Preserve original decimals for the high-precision fallback.
                datacenters[name] = [lat_s, lon_s, cap, 0, True]
                out.append("OK")
        elif op == "SET_HEALTHY":
            name, value = p[1:]
            if name not in datacenters or value not in ("true", "false"):
                out.append("ERROR")
            else:
                datacenters[name][4] = value == "true"
                out.append("OK")
        elif op == "DISTANCE":
            lat1, lon1, lat2, lon2 = p[1:]
            f_lat1, f_lon1, f_lat2, f_lon2 = map(float, (lat1, lon1, lat2, lon2))
            if not (-90 <= f_lat1 <= 90 and -180 <= f_lon1 <= 180 and
                    -90 <= f_lat2 <= 90 and -180 <= f_lon2 <= 180):
                out.append("ERROR")
            else:
                out.append(str(half_up_km(lat1, lon1, lat2, lon2)))
        elif op == "ROUTE":
            lat, lon = p[1:]
            candidates = []
            for name, (dlat, dlon, cap, load, healthy) in datacenters.items():
                if healthy:
                    candidates.append((half_up_km(lat, lon, dlat, dlon), name))
            candidates.sort()
            names = ",".join(name for _, name in candidates)
            selected = None
            for distance, name in candidates:
                if datacenters[name][3] < datacenters[name][2]:
                    datacenters[name][3] += 1
                    selected = (distance, name)
                    break
            if selected is None:
                out.append(f"None {names}" if names else "None")
            else:
                distance, name = selected
                out.append(f"{name} {distance} {names}")
    return "\n".join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
'''


def py_run(code, raw):
    with tempfile.TemporaryDirectory(prefix="stripe20-") as folder:
        source = Path(folder) / "main.py"
        source.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, "-I", str(source)], input=raw,
                              text=True, capture_output=True, timeout=10, check=True)
        return proc.stdout.rstrip("\n")


def dist_oracle(lat1, lon1, lat2, lon2):
    # 80-digit independent oracle using mpmath-free Decimal Taylor series.
    from decimal import Decimal, localcontext, ROUND_FLOOR

    PI = Decimal("3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679")

    def sin(x):
        term, total = x, x
        i = 1
        while True:
            term *= -(x * x) / Decimal((2 * i) * (2 * i + 1))
            nxt = total + term
            if nxt == total:
                return total
            total = nxt
            i += 1

    def cos(x):
        term, total = Decimal(1), Decimal(1)
        i = 1
        while True:
            term *= -(x * x) / Decimal((2 * i - 1) * (2 * i))
            nxt = total + term
            if nxt == total:
                return total
            total = nxt
            i += 1

    def atan(x):
        # Repeated half-angle reduction makes the alternating Taylor series fast.
        if x < 0:
            return -atan(-x)
        scale = 0
        while x > Decimal("0.05"):
            x = x / (Decimal(1) + (Decimal(1) + x * x).sqrt())
            scale += 1
        term, total, i = x, x, 1
        while True:
            term *= -(x * x)
            add = term / Decimal(2 * i + 1)
            nxt = total + add
            if nxt == total:
                return total * (2 ** scale)
            total = nxt
            i += 1

    def atan2(y, x):
        if x == 0:
            return PI / 2 if y >= 0 else -PI / 2
        if y == 0:
            return PI if x < 0 else Decimal(0)
        if x < 0:
            return PI - atan2(y, -x) if y >= 0 else -PI - atan2(-y, -x)
        return atan(y / x)

    with localcontext() as ctx:
        ctx.prec = 80
        lat1, lon1, lat2, lon2 = map(Decimal, (str(lat1), str(lon1), str(lat2), str(lon2)))
        rad = PI / Decimal(180)
        p1, p2 = lat1 * rad, lat2 * rad
        dp, dl = (lat2 - lat1) * rad, (lon2 - lon1) * rad
        a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
        a = min(Decimal(1), max(Decimal(0), a))
        c = 2 * atan2(a.sqrt(), (1 - a).sqrt())
        km = Decimal(6371) * c
        return int((km + Decimal("0.5")).to_integral_value(rounding=ROUND_FLOOR))


def independent_oracle(raw):
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    if not lines:
        return ""
    q = int(lines[0])
    dcs, out = {}, []
    for line in lines[1:q + 1]:
        p = line.split()
        if p[0] == "REGISTER":
            name, lat, lon, cap = p[1], *p[2:]
            lat_d, lon_d = map(float, (lat, lon))
            cap_i = int(cap)
            if name in dcs or not (-90 <= lat_d <= 90 and -180 <= lon_d <= 180) or cap_i <= 0:
                out.append("ERROR")
            else:
                dcs[name] = [lat, lon, cap_i, 0, True]
                out.append("OK")
        elif p[0] == "SET_HEALTHY":
            name, value = p[1:]
            if name not in dcs or value not in ("true", "false"):
                out.append("ERROR")
            else:
                dcs[name][4] = value == "true"
                out.append("OK")
        elif p[0] == "DISTANCE":
            a, b, c, d = p[1:]
            vals = [Decimal(x) for x in (a, b, c, d)]
            if not (-90 <= vals[0] <= 90 and -180 <= vals[1] <= 180 and
                    -90 <= vals[2] <= 90 and -180 <= vals[3] <= 180):
                out.append("ERROR")
            else:
                out.append(str(dist_oracle(*vals)))
        elif p[0] == "ROUTE":
            lat, lon = p[1:]
            cand = [(dist_oracle(lat, lon, v[0], v[1]), name)
                    for name, v in dcs.items() if v[4]]
            cand.sort()
            names = ",".join(name for _, name in cand)
            picked = None
            for d, name in cand:
                if dcs[name][3] < dcs[name][2]:
                    dcs[name][3] += 1
                    picked = (d, name)
                    break
            out.append(f"{picked[1]} {picked[0]} {names}" if picked else (f"None {names}" if names else "None"))
    return "\n".join(out)


FORMAL_INPUTS = [
    # The three upstream examples (whose outputs cover validation and load).
    "7\nREGISTER us-west 38 -122 100\nREGISTER us-east 41 -74 150\nREGISTER us-west 50 -100 50\nREGISTER invalid-node 91 0 100\nREGISTER invalid-cap 0 0 0\nSET_HEALTHY us-east false\nSET_HEALTHY fake-node true\n",
    "3\nDISTANCE 38 -122 41 -74\nDISTANCE 0 0 0 0\nDISTANCE 91 0 0 0\n",
    "7\nREGISTER node-A 0 0 1\nREGISTER node-B 0 0 1\nREGISTER node-C 10 10 100\nSET_HEALTHY node-C false\nROUTE 0 0\nROUTE 0 0\nROUTE 0 0\n",
    # Near half-km rounding; tiny nonzero distance; antimeridian.
    "4\nDISTANCE 0 0 0 0.004496608029593653\nDISTANCE 0 0 0 0.004496608029593652\nDISTANCE 0 179.9 0 -179.9\nDISTANCE 90 0 -90 0\n",
    # Rounded-distance tie: 0.1 and 0.4 km both round to 0, so name breaks tie.
    "4\nREGISTER z-near 0 0.0009 1\nREGISTER a-far 0 0.003 1\nROUTE 0 0\nROUTE 0 0\n",
    # Capacity exhausted and every datacenter unhealthy; source Python returns an empty candidate suffix.
    "4\nREGISTER only 0 0 1\nROUTE 0 0\nSET_HEALTHY only false\nROUTE 0 0\n",
    "4\nREGISTER north 90 0 4\nREGISTER south -90 180 4\nDISTANCE 90 0 -90 180\nROUTE 0 0\n",
]


def random_case(rng):
    q = rng.randint(3, 24)
    lines = [str(q)]
    names = []
    for _ in range(q):
        kind = rng.choice(["register", "health", "distance", "route"] if names else ["register", "distance"])
        if kind == "register":
            name = f"dc{rng.randrange(100000)}"
            names.append(name)
            lat, lon = rng.randint(-90000, 90000) / 1000, rng.randint(-180000, 180000) / 1000
            cap = rng.randint(1, 8)
            lines.append(f"REGISTER {name} {lat:.3f} {lon:.3f} {cap}")
        elif kind == "health":
            lines.append(f"SET_HEALTHY {rng.choice(names)} {rng.choice(['true','false'])}")
        elif kind == "distance":
            coords = [rng.randint(-90000, 90000) / 1000, rng.randint(-180000, 180000) / 1000,
                      rng.randint(-90000, 90000) / 1000, rng.randint(-180000, 180000) / 1000]
            lines.append("DISTANCE " + " ".join(f"{x:.3f}" for x in coords))
        else:
            lat, lon = rng.randint(-90000, 90000) / 1000, rng.randint(-180000, 180000) / 1000
            lines.append(f"ROUTE {lat:.3f} {lon:.3f}")
    return "\n".join(lines) + "\n"


def mutation_results(code, inputs):
    cases = [
        ("输出公里数向下截断", code.replace("math.floor(km + 0.5)", "math.floor(km)", 1)),
        # The source's route tuple is (rounded distance, name); sorting raw distances
        # before applying name changes the near-distance-tie formal case.
        ("路由先按精确浮点距离而非源解的取整距离排序", code.replace(
            "candidates.append((half_up_km(lat, lon, dlat, dlon), name))",
            "candidates.append((raw_haversine_km(lat, lon, dlat, dlon), name))", 1).replace(
            'out.append(f"{name} {distance} {names}")',
            'out.append(f"{name} {half_up_km(lat, lon, datacenters[name][0], datacenters[name][1])} {names}")', 1)),
    ]
    result = []
    for name, mutant in cases:
        rejected = [i for i, raw in enumerate(inputs) if py_run(mutant, raw) != independent_oracle(raw)]
        assert rejected, f"mutant survived: {name}"
        result.append({"name": name, "rejectedByCases": rejected})
    return result


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    source = next(x for x in catalog["items"] if x["id"] == IDENTIFIER)
    assert source["contentHash"] == CATALOG_HASH
    assert source["sourceUrl"] == SOURCE_URL
    assert subprocess.check_output(["git", "rev-parse", f"{SOURCE_COMMIT}:{RAW_PATH}"], cwd=ROOT, text=True).strip() == RAW_BLOB
    raw_bytes = subprocess.check_output(["git", "show", f"{SOURCE_COMMIT}:{RAW_PATH}"], cwd=ROOT)
    assert hashlib.sha256(raw_bytes).hexdigest() == RAW_SHA256

    cases = []
    for i, raw in enumerate(FORMAL_INPUTS):
        expected = independent_oracle(raw)
        actual = py_run(REFERENCE, raw)
        assert actual == expected, (i, actual, expected)
        cases.append({"name": f"正式样例/边界 {i + 1}", "input": raw,
                      "expectedOutput": expected + "\n", "hidden": i >= 3, "weight": 1})

    rng = random.Random(20261006)
    oracle_cases, seen = [], set(FORMAL_INPUTS)
    while len(oracle_cases) < 120:
        raw = random_case(rng)
        if raw in seen:
            continue
        seen.add(raw)
        expected = independent_oracle(raw)
        assert py_run(REFERENCE, raw) == expected
        oracle_cases.append({"input": raw, "expectedOutput": expected + "\n"})

    # Direct numeric checks across antipodes and random coordinates compare the
    # double implementation against the independent 80-digit oracle.
    numeric_rng = random.Random(20261007)
    numeric_checks = 300
    max_error = 0.0
    for _ in range(numeric_checks):
        values = [numeric_rng.randint(-90000, 90000) / 1000,
                  numeric_rng.randint(-180000, 180000) / 1000,
                  numeric_rng.randint(-90000, 90000) / 1000,
                  numeric_rng.randint(-180000, 180000) / 1000]
        high = dist_oracle(*values)
        low = half = math.floor(6371 * 2 * math.atan2(
            math.sqrt(min(1, max(0, math.sin(math.radians(values[2]-values[0])/2)**2 +
                             math.cos(math.radians(values[0]))*math.cos(math.radians(values[2]))*
                             math.sin(math.radians(values[3]-values[1])/2)**2))),
            math.sqrt(1-min(1, max(0, math.sin(math.radians(values[2]-values[0])/2)**2 +
                                  math.cos(math.radians(values[0]))*math.cos(math.radians(values[2]))*
                                  math.sin(math.radians(values[3]-values[1])/2)**2)))
        ) + 0.5)
        assert low == high, (values, low, high)

    mutants = mutation_results(REFERENCE, FORMAL_INPUTS)
    problem = {
        "id": IDENTIFIER, "courseId": "gomall", "lessonId": "00-overview",
        "title": "数据中心地理距离路由系统", "difficulty": "中等",
        "tags": ["OA", "Stripe", "模拟", "Haversine"],
        "description": "按命令依次维护数据中心注册、健康状态和当前负载；支持大圆距离查询，并将请求路由到距离最近且仍有容量的健康数据中心。距离采用 Haversine 公式，地球半径为 6371 km，输出和路由排序使用四舍五入后的整数公里数，距离相同时按名称升序。",
        "input": "第一行 q（0..5000），接着 q 行命令；注册的数据中心总数不超过 200。坐标用有限十进制表示，纬度范围 [-90,90]、经度范围 [-180,180]，最多 18 位小数。命令为 `REGISTER name latitude longitude capacity`、`SET_HEALTHY name true|false`、`DISTANCE lat1 lon1 lat2 lon2` 或 `ROUTE latitude longitude`。capacity 为正整数；name 为 1..32 个 ASCII 字母、数字、下划线或连字符。命令名及参数数量有效；非法值按题面规则返回 ERROR。",
        "output": "每条命令输出一行。REGISTER/SET_HEALTHY 输出 OK 或 ERROR；DISTANCE 输出整数公里或 ERROR；ROUTE 输出 `name distance candidates`，若健康数据中心均已满则输出 `None candidates`。candidates 为所有健康数据中心按 (四舍五入整数公里数, 名称) 排序后的逗号分隔名称；没有健康数据中心时输出 `None`。",
        "explanation": "本站将输入数值限定为最多 18 位小数的有限十进制。对该输入域，精确球面距离不会恰为半整数公里，因此 nearest-integer 的结果唯一；参考实现采用半入规则避免语言库对精确 ties 的差异。",
        "hints": ["将每个数据中心保存为坐标、容量、负载、健康状态；路由时筛出健康节点，计算并取整距离后按距离和名称排序，再选择首个未满节点。"],
        "timeLimit": 5, "memoryLimit": 262144, "outputLimit": 65536,
        "checker": "exact", "languages": ["python", "go", "java", "cpp"],
    }
    normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
    package = json.loads(normalized)
    package_checksum = hashlib.sha256(normalized.encode()).hexdigest()
    ref = textwrap.dedent(REFERENCE).strip() + "\n"
    editorial_text = (
        "## 思路\n\n按命令顺序维护名称到数据中心状态的映射。注册时验证唯一名称、坐标范围与正容量；健康切换只更新已有节点。距离使用 Haversine 公式，令 `a = sin²(Δφ/2) + cos(φ1)cos(φ2)sin²(Δλ/2)`，距离为 `6371 × 2 atan2(√a, √(1−a))`，再取最近整数公里。路由只枚举健康节点，按 `(整数距离, 名称)` 排序后取第一个未达容量的节点并增加负载。\n\n"
        "## 取整稳定性\n\n输入坐标为有限十进制，即有理数度数。转弧度后 sin/cos 的值为代数数，故 `cos(中心角)=1−2a` 为代数数。若距离恰为半整数公里，中心角会是非零代数数 `(m+1/2)/6371`；由 Lindemann–Weierstrass 定理，该角的余弦为超越数，与前述代数性矛盾。因此精确距离不会落在半整数边界，最近整数唯一。固定精度浮点在极端近边界输入上仍可能有误；竞赛实现可用高精度/自适应区间比较，本站输入小数位上限为 18。\n\n"
        "## 正确性与复杂度\n\n逐条处理命令保证后续命令读取到的注册、健康和负载状态正是此前命令产生的状态。候选集合恰为健康数据中心，排序键正是题面规定的整数距离及名称，因此首个未满节点就是规则要求的路由目标；若没有则输出 None。设命令数为 q、数据中心数为 d，距离/状态更新为 O(1)，每条 ROUTE 排序耗时 O(d log d)，总时间 O(qd log d)，空间 O(d+q)。"
    )

    write_json(OA / "packages" / f"{IDENTIFIER}.json", package)
    (OA / "references" / f"{IDENTIFIER}.py").write_text(ref, encoding="utf-8")
    write_json(OA / "oracles" / f"{IDENTIFIER}.json", oracle_cases)
    write_json(OA / "mutants" / f"{IDENTIFIER}.json", [
        {"name": name, "code": mutant}
        for name, mutant in [
            ("公里距离向下截断", REFERENCE.replace("math.floor(km + 0.5)", "math.floor(km)", 1)),
            ("路由不按整数距离再按名称排序", REFERENCE.replace(
                "candidates.append((half_up_km(lat, lon, dlat, dlon), name))",
                "candidates.append((raw_haversine_km(lat, lon, dlat, dlon), name))", 1).replace(
                'out.append(f"{name} {distance} {names}")',
                'out.append(f"{name} {half_up_km(lat, lon, datacenters[name][0], datacenters[name][1])} {names}")', 1)),
        ]
    ])
    write_json(OA / "editorials" / f"{IDENTIFIER}.json", {
        "schemaVersion": 1, "id": IDENTIFIER, "title": problem["title"],
        "explanation": editorial_text,
        "solutions": [{"language": "python", "code": ref}],
        "sourceUrl": SOURCE_URL, "sourceContentHash": CATALOG_HASH, "author": "CSWork",
    })
    write_json(OA / "source-evidence" / f"{BATCH}.json", {
        "schemaVersion": 1, "repository": "https://github.com/RedInn7/OA-Master",
        "commit": SOURCE_COMMIT, "origin": "https://oamaster.com",
        "items": [{
            "id": IDENTIFIER, "sourceUrl": SOURCE_URL, "catalogContentHash": CATALOG_HASH,
            "rawFiles": [{"path": RAW_PATH, "blob": RAW_BLOB, "sha256": RAW_SHA256,
                          "lineRange": [2236, 2366]}],
            "resolvedSemantics": {
                "commands": ["REGISTER", "SET_HEALTHY", "DISTANCE", "ROUTE"],
                "distance": "Haversine with Earth radius 6371 km; output uses nearest integer. As finite-decimal coordinates cannot yield an exact half-integer distance, the mathematical nearest integer is unique. Reference implementation uses half-up as a deterministic convention.",
                "routeOrder": "The fixed source implementation computes the rounded integer distance first, then sorts tuples (distance, datacenter name); selection and candidates therefore use this exact lexicographic order.",
                "capacity": "REGISTER rejects capacity <= 0; ROUTE increments load only for the selected healthy datacenter when load < capacity.",
                "sourceSample": "The three source examples are retained exactly as command sequences and outputs; validation includes nearest-integer, antimeridian, antipodal, duplicate, invalid coordinate, health, name tie and exhausted-capacity cases.",
                "siteInputSupplement": "The source omits maximum command count, datacenter count, name grammar and coordinate decimal precision. This candidate explicitly supplies q<=5000, at most 200 datacenters, ASCII identifiers and at most 18 decimal places; commands must have recognized names and correct arity. No production or sandbox verification has been performed.",
                "emptyHealthyCandidates": "The Python source formats the no-selection line as `None {names}`; for an empty list this yields `None ` with a trailing space. Candidate statement normalizes the empty candidate list to `None`, recorded as a site-level whitespace normalization.",
            },
        }],
    })
    write_json(OA / "resolutions" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": IDENTIFIER, "batch": BATCH, "sourceContentHash": CATALOG_HASH,
            "previousReason": "Haversine 最近整数及浮点边界在跨语言评测中可能不稳定；优先选择完全离散题目。",
            "reason": "固定源完整定义命令、坐标边界、Haversine 半径、最近整数距离、路由候选排序及容量行为。有限十进制输入下精确球面距离不能恰为半整数公里，因此最近整数唯一；独立 80 位 Decimal oracle 对 300 组坐标与 120 组命令输入验证通过，两个正常退出错误解均被反例杀死。候选仍待正式 sandbox 验证；最大命令数、名称语法和精度上限是明确披露的本站输入约束。",
        }],
    })
    write_json(OA / "candidate-batches" / f"{BATCH}.json", {
        "schemaVersion": 1,
        "items": [{
            "id": IDENTIFIER, "sourceContentHash": CATALOG_HASH,
            "packageChecksum": package_checksum, "editorial": editorial_text,
            "authoredSolutions": [{"language": "python", "code": ref}],
        }],
    })
    write_json(OA / "validation" / f"{BATCH}.json", {
        "schemaVersion": 1, "seed": 20261006,
        "problems": [{
            "id": IDENTIFIER, "formalCases": len(cases), "oracleCases": len(oracle_cases),
            "oracleInputsUnique": len(seen), "numericHighPrecisionComparisons": numeric_checks,
            "negativeControls": mutants,
            "referenceSha256": hashlib.sha256(ref.encode()).hexdigest(),
        }],
        "note": "离线 reference/oracle 对照完成；候选未连接 GoJudge、未进行 sandbox 或 production 验证。",
    })
    print(f"{IDENTIFIER}: formal={len(cases)}, oracle={len(oracle_cases)} unique, decimal checks={numeric_checks}, mutants={len(mutants)} killed")


if __name__ == "__main__":
    main()
