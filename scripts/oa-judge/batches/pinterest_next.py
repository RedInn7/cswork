"""Author locally validated Pinterest OA candidates; never publish to registry."""
from collections import deque
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"


def encode_run(value):
    return value + "\n"


def oracle_run(value):
    runs = []
    i = 0
    while i < len(value):
        j = i + 1
        while j < len(value) and value[j] == value[i]:
            j += 1
        runs.append((j - i, i, value[i]))
        i = j
    length, _, char = max(runs, key=lambda run: (run[0], run[1]))
    return f"{char}{length}"


def random_run(rng):
    return "".join(rng.choice("abcde") for _ in range(rng.randint(1, 100)))


def encode_pins(value):
    pins, k = value
    return f"{len(pins)} {k}\n" + " ".join(map(str, pins)) + "\n"


def oracle_pins(value):
    pins, k = value
    heights = [0] * k
    assigned = []
    for pin in pins:
        index = min(range(k), key=lambda i: (heights[i], i))
        assigned.append(index)
        heights[index] += pin
    return " ".join(map(str, assigned)) + "\n" + " ".join(map(str, heights))


def random_pins(rng):
    n = rng.randint(1, 14)
    return [rng.randint(1, 30) for _ in range(n)], rng.randint(1, n)


def encode_board(board):
    return f"{len(board)} {len(board[0])}\n" + "\n".join(
        " ".join(map(str, row)) for row in board
    ) + "\n"


def oracle_board(board):
    rows, cols = len(board), len(board[0])
    pop = [[False] * cols for _ in range(rows)]
    dirs = ((-1, 0), (1, 0), (0, -1), (0, 1))
    for r in range(rows):
        for c in range(cols):
            color = board[r][c]
            same = [(r + dr, c + dc) for dr, dc in dirs
                    if 0 <= r + dr < rows and 0 <= c + dc < cols
                    and board[r + dr][c + dc] == color]
            if len(same) >= 2:
                pop[r][c] = True
                for nr, nc in same:
                    pop[nr][nc] = True
    after = [[0 if pop[r][c] else board[r][c] for c in range(cols)]
             for r in range(rows)]
    for c in range(cols):
        survivors = [after[r][c] for r in range(rows) if after[r][c] != 0]
        for r in range(rows):
            after[r][c] = 0
        for offset, color in enumerate(survivors):
            after[rows - len(survivors) + offset][c] = color
    return "\n".join(" ".join(map(str, row)) for row in after)


def random_board(rng):
    rows, cols = rng.randint(1, 7), rng.randint(1, 7)
    return [[rng.randint(1, 4) for _ in range(cols)] for _ in range(rows)]


def encode_scooters(value):
    finish, scooters = value
    return f"{finish} {len(scooters)}\n" + " ".join(map(str, scooters)) + "\n"


def oracle_scooters(value):
    finish, scooters = value
    available = list(scooters)
    position = total = 0
    while position < finish:
        next_positions = [x for x in available if x >= position]
        if not next_positions:
            break
        scooter = min(next_positions)
        available.remove(scooter)
        reached = min(finish, scooter + 10)
        total += reached - scooter
        position = reached
    return str(total)


def random_scooters(rng):
    finish = rng.randint(1, 1000)
    positions = list(range(finish + 1))
    rng.shuffle(positions)
    return finish, positions[:rng.randint(0, min(25, len(positions)))]


SPECS = [
    {
        "id": "oa-pinterest-1", "title": "Longest Contiguous Substring of Single Character",
        "raw_path": "OA LIST/Pinterest_OA/001_image.txt",
        "raw_blob": "ae727aa618191eecf2522d7ed30da2b1a7c9b9e7",
        "additional": [{"rawPath": "OA LIST/Pinterest_OA/002_image.txt", "rawGitBlob": "143675d685f2c371fb40523ca9d23243231c4139"}],
        "tags": ["字符串", "扫描"], "encode": encode_run, "oracle": oracle_run,
        "random": random_run, "samples": ["bbaacaa", "bbbeed", "ccc"],
        "edges": ["a", "z" * 100, "a" * 50 + "b" * 50],
        "description": "给定只含小写英文字母的字符串。找最长的连续相同字符子串；若长度并列，选最靠右的一段。输出该字符与子串长度拼接成的字符串。",
        "input": "输入一行字符串 source，1≤|source|≤100，且仅含 a-z（来源约束）。",
        "output": "输出一个字符后接该最长连续段的长度；并列时取最靠右的段。",
        "idea": "从左向右分段扫描相同字符的连续游程，比较游程长度；相同长度时更新为起点更靠右的一段。",
        "proof": "每个合法答案恰为字符串中的一个最大连续同字符游程。扫描覆盖所有游程，按 (长度, 起点) 字典序最大化，正好先最大化长度，再选择最右位置。",
        "complexity": "时间 O(n)，额外空间 O(1)。",
        "code": '''import sys\ndef solve(raw):\n s=raw.strip(); best_char=''; best_len=0; best_start=-1; i=0\n while i<len(s):\n  j=i+1\n  while j<len(s) and s[j]==s[i]: j+=1\n  if j-i>best_len or (j-i==best_len and i>best_start):\n   best_len=j-i; best_char=s[i]; best_start=i\n  i=j\n return f\"{best_char}{best_len}\"\n''',
        "mutants": [
            ("并列时保留最左段", '''import sys\ndef solve(raw):\n s=raw.strip(); best=''; n=0; i=0\n while i<len(s):\n  j=i+1\n  while j<len(s) and s[j]==s[i]: j+=1\n  if j-i>n: best=s[i]+str(j-i); n=j-i\n  i=j\n return best\n'''),
            ("只统计字符总频次", '''import sys\nfrom collections import Counter\ndef solve(raw):\n s=raw.strip(); c=Counter(s); x=max(c,key=lambda ch:c[ch]); return x+str(c[x])\n'''),
        ],
        "note": "来源为原始 OA LIST 文本；#001 给出正式题意，#002 是同题补充约束。#001 的 OCR 样例 `bbacecdbbab → c3` 与字符串内容矛盾，故本站不复用该错误输出，改用题面规则可直接验证的样例；catalog 指纹保持不变。",
    },
    {
        "id": "oa-pinterest-4", "title": "Assign Pins to the Shortest Column",
        "raw_path": "fastprep/Pinterest/pinterest-assign-pins-to-shortest-column.md",
        "raw_blob": "c7c0eb4ac975fb85a3d74e3b6304730943a0cfcb", "additional": [],
        "tags": ["数组", "优先队列", "模拟"], "encode": encode_pins, "oracle": oracle_pins,
        "random": random_pins,
        "samples": [([1, 2, 3, 4, 5], 2), ([10, 20, 30], 3), ([5, 5, 5, 5, 5, 5], 2)],
        "edges": [([9, 1, 2, 7], 3), ([10**9] * 200000, 1), ([1, 1, 1], 3)],
        "description": "有 k 根起始高度为 0 的柱子。按原顺序处理 pins[i]：将每个 pin 放到当前总高度最低的柱子；高度并列时选下标最小的柱子。返回每个 pin 的柱子下标及所有柱子的最终高度。",
        "input": "第一行 n k；第二行 n 个正整数 pins[i]。来源约束：1≤k≤n≤200000，1≤pins[i]≤10⁹。",
        "output": "第一行输出 n 个分配下标，第二行输出 k 根柱子的最终高度。柱子下标从 0 开始；总高度使用 64 位整数。",
        "idea": "用按 (当前高度, 柱子下标) 排序的最小堆。每个 pin 取堆顶、记录下标、增加该柱高度并放回堆。",
        "proof": "堆序以高度和下标为完整排序键，堆顶因此总是题目要求的最低且下标最小柱子。取出后只改变这一柱高度并重新入堆，其他柱子状态不变；逐个处理即可与规则完全一致。",
        "complexity": "n 为 pin 数、k 为柱数。时间 O(n log k)，空间 O(k+n)（含分配结果）。",
        "code": '''import heapq\nimport sys\ndef solve(raw):\n z=list(map(int,raw.split())); n,k=z[:2]; pins=z[2:2+n]\n heap=[(0,i) for i in range(k)]; heapq.heapify(heap); heights=[0]*k; assigned=[]\n for pin in pins:\n  h,i=heapq.heappop(heap); assigned.append(i); heights[i]=h+pin; heapq.heappush(heap,(heights[i],i))\n return \" \\".join(map(str,assigned))+\"\\n\"+\" \\".join(map(str,heights))\n''',
        "mutants": [
            ("高度并列时选下标较大者", '''import heapq\nimport sys\ndef solve(raw):\n z=list(map(int,raw.split())); n,k=z[:2]; h=[0]*k; q=[(0,-i) for i in range(k)]; heapq.heapify(q); a=[]\n for x in z[2:2+n]:\n  v,ni=heapq.heappop(q); i=-ni; a.append(i); h[i]=v+x; heapq.heappush(q,(h[i],ni))\n return \" \\".join(map(str,a))+\"\\n\"+\" \\".join(map(str,h))\n'''),
            ("始终轮流放置而不比较高度", '''import sys\ndef solve(raw):\n z=list(map(int,raw.split())); n,k=z[:2]; h=[0]*k; a=[]\n for j,x in enumerate(z[2:2+n]): i=j%k; a.append(i); h[i]+=x\n return \" \\".join(map(str,a))+\"\\n\"+\" \\".join(map(str,h))\n'''),
        ],
        "note": "来源为 FastPrep 原始 Markdown，包含题意、所有边界和三组样例；大和需 64 位，本站输入输出协议明示。",
    },
    {
        "id": "oa-pinterest-5", "title": "Bubble Explosion",
        "raw_path": "fastprep/Pinterest/pinterest-bubble-explosion.md",
        "raw_blob": "5d71338f56836bc47acc5c296c7a7dda5ed00968", "additional": [],
        "tags": ["矩阵", "广度优先搜索", "模拟"], "encode": encode_board, "oracle": oracle_board,
        "random": random_board,
        "samples": [
            [[3, 1, 2, 1], [1, 1, 1, 4], [3, 1, 2, 2], [3, 3, 3, 4]],
            [[1, 2, 2], [1, 1, 2]],
            [[1]],
        ],
        "edges": [[[4, 5, 4]], [[7], [7], [7]], [[1, 2], [3, 4]]],
        "description": "棋盘中同色且上下左右相邻的泡泡组成连通块。若泡泡有至少两个同色邻居，则它有资格爆炸；所有合格泡泡及其同色邻居同时爆炸。最后每列剩余泡泡向下落，空位以 0 表示。一次爆炸后即结束。",
        "input": "第一行 rows cols；随后 rows 行各 cols 个颜色整数。来源约束：1≤rows,cols≤100，1≤color≤10⁴。",
        "output": "输出爆炸并下落后的 rows×cols 矩阵；每行以空格分隔。",
        "idea": "在原棋盘上找同色四邻连通块：大小至少 3 的块整体标记爆炸。所有标记基于原始棋盘同时确定，再逐列稳定压缩剩余泡泡至底部。",
        "proof": "同色连通块内，每个非叶节点至少有两个同色邻居，因而合格；每个叶节点与某个非叶节点相邻，因而会作为合格泡泡的同色邻居一并标记。故大小至少 3 的整块且仅整块被标记；大小 1 或 2 没有合格泡泡。题目要求同时爆炸，所以连通块标记阶段不修改棋盘；随后列压缩保持未爆泡泡的相对顺序并使其紧贴底边。",
        "complexity": "R=rows、C=cols。时间 O(RC)，空间 O(RC)。",
        "code": '''from collections import deque\nimport sys\ndef solve(raw):\n z=list(map(int,raw.split())); rows,cols=z[:2]; a=[z[2+r*cols:2+(r+1)*cols] for r in range(rows)]; seen=[[False]*cols for _ in range(rows)]; pop=[[False]*cols for _ in range(rows)]; dirs=((-1,0),(1,0),(0,-1),(0,1))\n for r in range(rows):\n  for c in range(cols):\n   if seen[r][c]: continue\n   color=a[r][c]; q=deque([(r,c)]); seen[r][c]=True; comp=[]\n   while q:\n    x,y=q.popleft(); comp.append((x,y))\n    for dx,dy in dirs:\n     nx,ny=x+dx,y+dy\n     if 0<=nx<rows and 0<=ny<cols and not seen[nx][ny] and a[nx][ny]==color: seen[nx][ny]=True; q.append((nx,ny))\n   if len(comp)>=3:\n    for x,y in comp: pop[x][y]=True\n for r in range(rows):\n  for c in range(cols):\n   if pop[r][c]: a[r][c]=0\n for c in range(cols):\n  keep=[a[r][c] for r in range(rows) if a[r][c]!=0]\n  for r in range(rows): a[r][c]=0\n  for i,v in enumerate(keep): a[rows-len(keep)+i][c]=v\n return \\"\\n\".join(\" \\".join(map(str,row)) for row in a)\n''',
        "mutants": [
            ("需要三个同色邻居才爆炸", '''import sys\ndef solve(raw):\n z=list(map(int,raw.split())); R,C=z[:2]; a=[z[2+r*C:2+(r+1)*C] for r in range(R)]; p=[[False]*C for _ in range(R)]; d=((-1,0),(1,0),(0,-1),(0,1))\n for r in range(R):\n  for c in range(C):\n   if sum(0<=r+dx<R and 0<=c+dy<C and a[r+dx][c+dy]==a[r][c] for dx,dy in d)>=3: p[r][c]=True\n for r in range(R):\n  for c in range(C):\n   if p[r][c]:\n    for dx,dy in d:\n     x,y=r+dx,c+dy\n     if 0<=x<R and 0<=y<C and a[x][y]==a[r][c]: p[x][y]=True\n for r in range(R):\n  for c in range(C):\n   if p[r][c]: a[r][c]=0\n for c in range(C):\n  keep=[a[r][c] for r in range(R) if a[r][c]]\n  for r in range(R): a[r][c]=0\n  for i,v in enumerate(keep): a[R-len(keep)+i][c]=v\n return \\"\\n\".join(\" \\".join(map(str,row)) for row in a)\n'''),
            ("爆炸后不执行下落", '''import sys\ndef solve(raw):\n z=list(map(int,raw.split())); R,C=z[:2]; a=[z[2+r*C:2+(r+1)*C] for r in range(R)]; seen=[[False]*C for _ in range(R)]; p=[[False]*C for _ in range(R)]; d=((-1,0),(1,0),(0,-1),(0,1))\n for r in range(R):\n  for c in range(C):\n   if seen[r][c]: continue\n   q=[(r,c)]; seen[r][c]=True; comp=[]\n   for x,y in q:\n    comp.append((x,y))\n    for dx,dy in d:\n     u,v=x+dx,y+dy\n     if 0<=u<R and 0<=v<C and not seen[u][v] and a[u][v]==a[r][c]: seen[u][v]=True; q.append((u,v))\n   if len(comp)>=3:\n    for x,y in comp: p[x][y]=True\n for r in range(R):\n  for c in range(C):\n   if p[r][c]: a[r][c]=0\n return \\"\\n\".join(\" \\".join(map(str,row)) for row in a)\n'''),
        ],
        "note": "FastPrep 原始规则明确一次性标记并同时爆炸。资格泡泡+同色邻居等价于爆炸所有大小≥3 的同色四邻连通块；该等价由独立邻接扫描 oracle 和 reference 交叉验证。",
    },
    {
        "id": "oa-pinterest-7", "title": "Travel Distance on Scooters",
        "raw_path": "fastprep/Pinterest/pinterest-travel-distance-on-scooters.md",
        "raw_blob": "8bd218d1c152ab2226b2feba23043ab4ceded70f", "additional": [],
        "tags": ["数组", "贪心", "模拟"], "encode": encode_scooters, "oracle": oracle_scooters,
        "random": random_scooters,
        "samples": [(23, [7, 4, 14]), (27, [15, 7, 3, 10]), (10, [])],
        "edges": [(10, [0]), (25, [5, 15, 24]), (1, [1])],
        "description": "街道从 0 延伸到 finish。当前在位置 p 时，步行到位置不小于 p 的最近滑板车；若没有，就步行到终点。骑到该车电量所能到达的最远位置（最多向右 10 个单位），还未到终点则重复。返回骑行距离总和。",
        "input": "第一行 finish 与 n；第二行 n 个互不相同的整数位置。来源约束 finish≤1000、位置为街道上的不同整数；本站将街道范围明确定义为 [0,finish]，故 n≤finish+1。",
        "output": "输出一个整数，为所有滑板车行驶距离之和；步行距离不计入。",
        "idea": "排序滑板车位置，从当前位置开始找第一个 x≥当前位置的车；累加 min(finish,x+10)−x，并把当前位置更新到该位置。没有可用车辆时结束。",
        "proof": "规则每轮唯一指定当前点右侧最近的车辆；升序数组的 lower_bound 正是该车。它可骑行至 x+10 或 finish 中较早者，因此本轮距离为 min(finish,x+10)−x。算法逐轮依规则模拟，未骑行的步行距离未计入，且每轮位置严格增加或到达 finish，必终止。",
        "complexity": "n 为滑板车数。排序 O(n log n)，之后每辆车至多处理一次，空间 O(n)。",
        "code": '''import sys\ndef solve(raw):\n z=list(map(int,raw.split())); finish,n=z[:2]; scooters=sorted(z[2:2+n]); pos=total=0; i=0\n while pos<finish:\n  while i<n and scooters[i]<pos: i+=1\n  if i==n: break\n  x=scooters[i]; i+=1; reached=min(finish,x+10); total+=reached-x; pos=reached\n return str(total)\n''',
        "mutants": [
            ("跳过当前位置的滑板车", '''import sys\ndef solve(raw):\n z=list(map(int,raw.split())); f,n=z[:2]; a=sorted(z[2:2+n]); p=t=0\n while p<f:\n  q=next((x for x in a if x>p),None)\n  if q is None: break\n  v=min(f,q+10); t+=v-q; p=v\n return str(t)\n'''),
            ("把步行距离也计入骑行距离", '''import sys\ndef solve(raw):\n z=list(map(int,raw.split())); f,n=z[:2]; a=sorted(z[2:2+n]); p=t=0; i=0\n while p<f:\n  while i<n and a[i]<p: i+=1\n  if i==n: break\n  x=a[i]; i+=1; t+=x-p; v=min(f,x+10); t+=v-x; p=v\n return str(t)\n'''),
        ],
        "note": "FastPrep 原始 statement 有三组样例及 finish 范围；补充了 street-location 的闭区间解释，lower_bound 用包含当前位置的 x≥p，因为来源样例在到达 14 后再次使用位置 14 的另一辆车。",
    },
]


def execute(path, stdin):
    result = subprocess.run([sys.executable, "-I", str(path)], input=stdin,
                            text=True, capture_output=True, timeout=10, check=True)
    return result.stdout.rstrip("\n")


def normalize_package(raw):
    js = "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    result = subprocess.run(["node", "--import", "tsx", "-e", js], cwd=ROOT,
                            input=json.dumps(raw, ensure_ascii=False), text=True,
                            capture_output=True, check=True)
    return result.stdout


def executable_source(source, ident):
    source = textwrap.dedent(source).strip()
    if ident == "oa-pinterest-4":
        if "assigned" in source:
            replacement = "return ' '.join(map(str,assigned))+chr(10)+' '.join(map(str,heights))"
        else:
            replacement = "return ' '.join(map(str,a))+chr(10)+' '.join(map(str,h))"
    elif ident == "oa-pinterest-5":
        replacement = "return chr(10).join(' '.join(map(str,row)) for row in a)"
    else:
        return source
    lines = source.splitlines()
    matches = [i for i, line in enumerate(lines) if line.lstrip().startswith("return ")]
    assert len(matches) == 1, (ident, "expected one result formatter", matches)
    index = matches[0]
    indentation = lines[index][:len(lines[index]) - len(lines[index].lstrip())]
    lines[index] = indentation + replacement
    return "\n".join(lines)


def main():
    for folder in ("packages", "editorials", "references", "oracles", "mutants",
                   "negative-controls", "reviews", "candidate-batches", "validation"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    batch_items, reports, reviews = [], [], []
    for spec in SPECS:
        ident = spec["id"]
        source = SOURCES[ident]
        rng = random.Random(20261005 + int(ident.rsplit("-", 1)[1]))
        reference_code = executable_source(spec["code"], ident) + "\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
        reference = OUT / "references" / f"{ident}.py"
        reference.write_text(reference_code)
        oracle_values = list(spec["samples"])
        seen_inputs = {spec["encode"](value) for value in oracle_values}
        while len(oracle_values) < 163:
            value = spec["random"](rng)
            encoded = spec["encode"](value)
            if encoded not in seen_inputs:
                seen_inputs.add(encoded)
                oracle_values.append(value)
        oracle_cases = []
        for value in oracle_values:
            expected = spec["oracle"](value)
            stdin = spec["encode"](value)
            actual = execute(reference, stdin)
            assert actual == expected, (ident, "oracle mismatch", value, expected, actual)
            oracle_cases.append({"input": stdin, "expectedOutput": expected + "\n"})
        edge_cases = []
        for value in spec["edges"]:
            stdin = spec["encode"](value)
            expected = spec["oracle"](value)
            actual = execute(reference, stdin)
            assert actual == expected, (ident, "edge mismatch", value, expected, actual)
            edge_cases.append({"input": stdin, "expectedOutput": expected + "\n"})
        selected = oracle_cases[:3] + edge_cases + oracle_cases[3:29]
        cases = [{"name": f"公开样例 {i+1}" if i < 3 else f"隐藏验证 {i-2}",
                  **case, "hidden": i >= 3, "weight": 1}
                 for i, case in enumerate(selected)]
        mutant_docs, killed = [], []
        for label, mutant_source in spec["mutants"]:
            mutant_code = executable_source(mutant_source, ident) + "\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
            mutant_path = OUT / "negative-controls" / f"{ident}-{len(mutant_docs)+1}.py"
            mutant_path.write_text(mutant_code)
            rejected = [i for i, case in enumerate(cases)
                        if execute(mutant_path, case["input"]) != case["expectedOutput"].rstrip("\n")]
            assert rejected, (ident, "mutant survived", label)
            mutant_docs.append({"name": label, "code": mutant_code})
            killed.append({"name": label, "rejectedByCases": rejected})
        problem = {
            "id": ident, "courseId": "gomall", "lessonId": "00-overview",
            "title": spec["title"], "difficulty": "中等",
            "tags": ["OA", "Pinterest"] + spec["tags"],
            "description": spec["description"] + "\n\n输入格式与本题所列的本站补充限制由 CSWork 整理，不表示原题来源另有该协议。",
            "input": spec["input"], "output": spec["output"],
            "explanation": "按题面规则处理输入；思路、证明和复杂度见配套讲义。",
            "hints": [spec["idea"]], "timeLimit": 3, "memoryLimit": 262144,
            "outputLimit": 4096, "checker": "tokens",
            "languages": ["python", "go", "java", "cpp"],
        }
        normalized = normalize_package({"schemaVersion": 1, "problem": problem, "cases": cases})
        package = json.loads(normalized)
        editorial_text = f"## 思路\n\n{spec['idea']}\n\n## 正确性\n\n{spec['proof']}\n\n## 复杂度\n\n{spec['complexity']}"
        authored = [{"language": "python", "code": reference_code}]
        editorial = {"schemaVersion": 1, "id": ident, "title": spec["title"],
                     "explanation": editorial_text, "solutions": authored,
                     "sourceUrl": source["sourceUrl"],
                     "sourceContentHash": source["contentHash"], "author": "CSWork"}
        for folder, document in (("packages", package), ("oracles", oracle_cases),
                                 ("mutants", mutant_docs), ("editorials", editorial)):
            (OUT / folder / f"{ident}.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        batch_items.append({"id": ident, "sourceContentHash": source["contentHash"],
                            "packageChecksum": hashlib.sha256(normalized.encode()).hexdigest(),
                            "editorial": editorial_text, "authoredSolutions": authored})
        reports.append({"id": ident, "oracleCases": len(oracle_cases),
                        "uniqueOracleInputs": len({c["input"] for c in oracle_cases}),
                        "publicCases": 3, "hiddenCases": len(cases) - 3,
                        "negativeControls": killed,
                        "referenceSha256": hashlib.sha256(reference_code.encode()).hexdigest()})
        reviews.append({"id": ident, "status": "authored",
                        "reason": spec["note"] + " 输入输出协议明确；163 个独立 oracle 输入、参考程序、边界样例及两个正常退出错误程序均通过本地验证。",
                        "sourceCommit": COMMIT, "rawPath": spec["raw_path"],
                        "rawGitBlob": spec["raw_blob"],
                        "additionalRawEvidence": spec["additional"],
                        "catalogContentHash": source["contentHash"]})
        print(f"{ident}: 163 oracle inputs; {len(cases)} judge cases; 2 mutants killed", flush=True)

    blocked = [
        ("oa-pinterest-2", "原始例子 #004 中 x_train 各行特征数有 4 和 5，违反 #007 明确的 x_test[i].length == x_train[j].length；#004 的该例输出最后一项为 1，而 #006 补全同例输出最后一项为 0。题目还依赖 sklearn.tree.DecisionTreeClassifier，本站评测容器未承诺安装 sklearn。样例互相矛盾且可执行依赖不确定，不猜规则。", [
            ("OA LIST/Pinterest_OA/003_image.txt", "2c4e9f4f527a81ad33ac4b84b93497720c4a348b"),
            ("OA LIST/Pinterest_OA/004_image.txt", "b2dda40208288002d3e66ad2adf36749ede7c2dd"),
            ("OA LIST/Pinterest_OA/005_image.txt", "4ae5a0fd182cb9b690cd3a0840d825f26d2366f5"),
            ("OA LIST/Pinterest_OA/006_image.txt", "d44a297002d324738fc74b7cd7bc23b1959f4033"),
            ("OA LIST/Pinterest_OA/007_image.txt", "fe4bcd30ffe2e99de61bf55c11cace5664fd9f90"),
            ("OA LIST/Pinterest_OA/008_image.txt", "231631af5e87337f27436a0e94b298a940062cd4"),
            ("OA LIST/Pinterest_OA/009_image.txt", "41c7a45dcff0c628fa9e216a8339cdb4be10b8ca"),
        ]),
        ("oa-pinterest-3", "源代码快照 #014 指定 scipy cosine 距离，catalog 所附实现则使用 Euclidean；规则正文未指定度量。题目还明确允许聚类标签任意置换，本站 tokens checker 无法接受所有等价标签排列。两处均影响判定，未擅自选一种。", [
            ("OA LIST/Pinterest_OA/010_image.txt", "788f0c123aa8f2881a7d90281b52e9ee67b7df94"),
            ("OA LIST/Pinterest_OA/011_image.txt", "c41465fdc245d3dd44f2a0d811775922a93b478a"),
            ("OA LIST/Pinterest_OA/012_image.txt", "3e6f94ecdc6bdeac724864275943aae7fcd3385a"),
            ("OA LIST/Pinterest_OA/013_image.txt", "aece09dedec8c0c5801b36ed66f6723faf741917"),
            ("OA LIST/Pinterest_OA/014_image.txt", "e8f8e58a5be49c046212cd2b5b06747a75d72801"),
            ("OA LIST/Pinterest_OA/015_image.txt", "78f114dc9880085b5b744b3abdbd29112f2a8337"),
        ]),
        ("oa-pinterest-6", "在源快照中题干在 ‘You are given a string expression</’ 处截断；没有可核实的表达式语法、可加括号范围或运算符集合。唯一样例不足以唯一确定答案规则，因此暂不构造输入限制与 oracle。", [
            ("fastprep/Pinterest/pinterest-minimize-expression-with-parentheses.md", "622268066c89293eb905c1922fa1bc6fdd8d10d0"),
        ]),
    ]
    for ident, reason, evidence in blocked:
        reviews.append({"id": ident, "status": "blocked", "reason": reason,
                        "sourceCommit": COMMIT, "rawPath": evidence[0][0],
                        "rawGitBlob": evidence[0][1],
                        "additionalRawEvidence": [{"rawPath": path, "rawGitBlob": blob}
                                                   for path, blob in evidence[1:]],
                        "catalogContentHash": SOURCES[ident]["contentHash"]})
    batch_name = "pinterest-next"
    (OUT / "candidate-batches" / f"{batch_name}.json").write_text(
        json.dumps({"schemaVersion": 1, "items": batch_items}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "validation" / f"{batch_name}.json").write_text(
        json.dumps({"schemaVersion": 1, "seed": 20261005, "sourceCommit": COMMIT,
                    "note": "仅为离线作者化参考程序、独立 oracle 与错误变异程序验证；不代表 GoJudge 沙箱验证或已发布。",
                    "problems": reports}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "reviews" / f"{batch_name}.json").write_text(
        json.dumps({"schemaVersion": 1, "items": reviews}, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
