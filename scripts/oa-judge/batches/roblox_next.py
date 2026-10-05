"""Author and locally verify unpromoted Roblox OA candidates.

Only authored reference/oracle/mutant code is executed. Upstream files are read-only
evidence; imported solution code is never run and nothing is sent to GoJudge.
"""
from pathlib import Path
import hashlib
import json
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SEED = 20261005


def run(path, data):
    proc = subprocess.run([sys.executable, "-I", str(path)], input=data, text=True,
                          capture_output=True, timeout=8, check=True)
    return proc.stdout.rstrip("\n")


def pairs_encode(value):
    nums, k = value
    return f"{len(nums)} {k}\n" + " ".join(map(str, nums)) + "\n"


def pairs_oracle(value):
    nums, k = value
    answer = 0
    for left in range(len(nums)):
        counts = {}
        disjoint_pairs = 0
        for right in range(left, len(nums)):
            old = counts.get(nums[right], 0)
            counts[nums[right]] = old + 1
            disjoint_pairs += 1 if old % 2 else 0
            if disjoint_pairs >= k:
                answer += 1
    return str(answer)


def random_pairs(rng):
    return ([rng.randint(-3, 3) for _ in range(rng.randint(1, 12))],
            rng.randint(1, 5))


def rhombus_encode(value):
    matrix, radius = value
    return f"{len(matrix)} {len(matrix[0])} {radius}\n" + "\n".join(
        " ".join(map(str, row)) for row in matrix) + "\n"


def rhombus_oracle(value):
    matrix, radius = value
    rows, cols = len(matrix), len(matrix[0])
    best = None
    for cr in range(radius - 1, rows - radius + 1):
        for cc in range(radius - 1, cols - radius + 1):
            total = 0
            for r in range(rows):
                for c in range(cols):
                    if abs(cr-r) + abs(cc-c) < radius:
                        total += matrix[r][c]
            if best is None or total > best:
                best = total
    return str(best if best is not None else 0)


def random_rhombus(rng):
    rows, cols = rng.randint(1, 8), rng.randint(1, 8)
    return ([[rng.randint(-9, 9) for _ in range(cols)] for _ in range(rows)],
            rng.randint(1, max(rows, cols) + 2))


def houses_encode(value):
    houses, queries = value
    return (f"{len(houses)} {len(queries)}\n" + " ".join(map(str, houses)) + "\n" +
            " ".join(map(str, queries)) + "\n")


def houses_oracle(value):
    houses, queries = value
    live = set(houses)
    output = []
    for x in queries:
        live.remove(x)
        output.append(str(sum(1 for v in live if v-1 not in live)))
    return " ".join(output)


def random_houses(rng):
    n = rng.randint(1, 24)
    houses = rng.sample(range(-40, 41), n)
    queries = houses[:]
    rng.shuffle(queries)
    return houses, queries


def limiter_encode(value):
    window, limit, requests = value
    return f"{window} {limit} {len(requests)}\n" + "".join(
        f"{timestamp} {key}\n" for timestamp, key in requests)


def limiter_oracle(value):
    window, limit, requests = value
    counts = {}
    answer = []
    for timestamp, key in requests:
        bucket = timestamp // window
        identity = (key, bucket)
        if counts.get(identity, 0) < limit:
            counts[identity] = counts.get(identity, 0) + 1
            answer.append("ALLOW")
        else:
            answer.append("REJECT")
    return " ".join(answer)


def random_limiter(rng):
    window, limit = rng.randint(1, 8), rng.randint(1, 4)
    timestamp = 0
    requests = []
    for _ in range(rng.randint(1, 30)):
        timestamp += rng.randint(0, 4)
        requests.append((timestamp, rng.choice(["u1", "u2", "ipA"])))
    return window, limit, requests


def usage_encode(data):
    return f"{len(data)}\n" + "".join(f"{key} {value:04d}\n" for key, value in data)


def usage_oracle(data):
    return max(data, key=lambda item: item[1])[0]


def random_usage(rng):
    n = rng.randint(1, 20)
    values = rng.sample(range(1, 1401), n)
    def key_for(value):
        out = ""
        for _ in range(5):
            out = chr(ord("a") + value % 26) + out
            value //= 26
        return out
    keys = [key_for(i) for i in rng.sample(range(26**5), n)]
    return list(zip(keys, values))


def multi_encode(value):
    rules, requests = value
    lines = [f"{len(rules)} {len(requests)}"]
    lines.extend(f"{name} {window} {limit}" for name, window, limit in rules)
    lines.extend(f"{timestamp} " + " ".join(fields)
                 for timestamp, fields in requests)
    return "\n".join(lines) + "\n"


def multi_oracle(value):
    rules, requests = value
    history = [{} for _ in rules]
    output = []
    for timestamp, fields in requests:
        for i, ((_, window, limit), key) in enumerate(zip(rules, fields)):
            queue = history[i].setdefault(key, [])
            while queue and queue[0] <= timestamp - window:
                queue.pop(0)
        allowed = all(len(history[i][key]) < rule[2]
                      for i, (rule, key) in enumerate(zip(rules, fields)))
        output.append("ALLOW" if allowed else "REJECT")
        if allowed:
            for i, key in enumerate(fields):
                history[i][key].append(timestamp)
    return " ".join(output)


def random_multi(rng):
    dims = rng.randint(1, 4)
    rules = [(f"f{i}", rng.randint(1, 9), rng.randint(1, 4)) for i in range(dims)]
    timestamp, requests = 0, []
    for _ in range(rng.randint(1, 32)):
        timestamp += rng.randint(0, 3)
        requests.append((timestamp, [rng.choice(["a", "b", "c"])
                                    for _ in range(dims)]))
    return rules, requests


def meeting_encode(value):
    schedules, length = value
    lines = [f"{len(schedules)} {length}"]
    for schedule in schedules:
        lines.append(str(len(schedule)))
        lines.extend(f"{start} {finish}" for start, finish in schedule)
    return "\n".join(lines) + "\n"


def meeting_oracle(value):
    schedules, length = value
    for start in range(1441 - length):
        if all(not any(max(start, a) < min(start + length, b)
                       for a, b in schedule) for schedule in schedules):
            return str(start)
    return "-1"


def random_meeting(rng):
    schedules = []
    for _ in range(rng.randint(1, 5)):
        items = []
        for _ in range(rng.randint(0, 7)):
            start = rng.randint(0, 1398)
            items.append((start, rng.randint(start + 1, min(1400, start + 10))))
        schedules.append(items)
    return schedules, rng.randint(1, 45)


SPECS = [
    {
        "id": "oa-roblox-2", "title": "Subarrays with at Least K Disjoint Duplicate Pairs",
        "tags": ["数组", "滑动窗口"],
        "description": ("给定整数数组 numbers 与正整数 k，统计包含至少 k 对相同值元素的连续子数组。"
                        "每一对使用两个下标，且不同对之间的下标必须两两不同；一个元素不能同时属于两对。"),
        "input": "第一行 n k；第二行 n 个整数。本站补充范围：1≤n≤200000，1≤k≤10^9，|numbers[i]|≤10^9。k 大于数组可提供的配对数时答案为 0。",
        "output": "输出满足条件的连续子数组数量。",
        "encode": pairs_encode, "oracle": pairs_oracle, "random": random_pairs,
        "samples": [([0, 1, 0, 1, 0], 2), ([2, 2, 2, 2, 2, 2], 3),
                    ([1, 3, 3, 1], 1)], "public": ["3", "1", "4"],
        "reference": '''import sys
def solve(raw):
 t=list(map(int,raw.split())); n,k=t[0],t[1]; a=t[2:2+n]
 freq={}; left=pairs=answer=0
 for right,x in enumerate(a):
  old=freq.get(x,0); freq[x]=old+1
  if old%2: pairs+=1
  while pairs>=k:
   y=a[left]; old=freq[y]
   if old%2==0: pairs-=1
   freq[y]=old-1; left+=1
  answer+=left
 return str(answer)
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("达到 k 对时没有收缩窗口", "while pairs>=k:", "while pairs>k:"),
            ("合法左端点数量误用右端点位置", "answer+=left", "answer+=right"),
        ],
        "editorial": "## 思路\n\n对每个值维护当前窗口出现次数。新增一个元素时，只有旧次数为奇数才会让该值的可配对数增加一；移除时，只有旧次数为偶数才会减少一。双指针维护窗口内最大不相交重复对数小于 k 的最短后缀。每个右端点对应的合法左端点恰为 0 到 left−1，共 left 个。\n\n## 正确性\n\n对某值出现 c 次，最多可组成 floor(c/2) 对且所有下标互异；不同值的下标集合天然互斥，因此窗口最大不相交配对数为各值 floor(c/2) 之和。该量随右端点单调不减、随左端点右移单调不增，双指针恰好越过所有合法左端点，累计 left 不重不漏。\n\n## 复杂度\n\n每个下标最多进出窗口一次，时间 O(n)，空间 O(n)。",
    },
    {
        "id": "oa-roblox-3", "title": "Maximum Sum of Rhombic Area",
        "tags": ["矩阵", "前缀和"],
        "description": ("定义半径 r 的菱形区域为到中心的曼哈顿距离加一不超过 r 的格子集合，"
                        "也就是 |行差|+|列差|<r。只考虑整个菱形都在矩阵内的中心，求这些区域和的最大值。"),
        "input": "第一行 rows cols radius；随后 rows 行矩阵。本站补充范围：1≤rows,cols≤200，1≤radius≤200，|cell|≤10^6。若不存在完整菱形，输出 0。",
        "output": "输出最大区域和；半径大到没有完整区域时输出 0。",
        "encode": rhombus_encode, "oracle": rhombus_oracle, "random": random_rhombus,
        "samples": [([[0,2,4,1,6,4],[5,1,3,4,1,5],[0,1,2,1,2,1],
                       [1,3,2,1,1,2],[4,1,3,6,5,5],[6,7,5,3,1,2]], 3),
                    ([[5]], 1), ([[1,2],[3,4]], 3)], "public": ["35", "5", "0"],
        "reference": '''import sys
def solve(raw):
 t=list(map(int,raw.split())); rows,cols,r=t[:3]; a=[t[3+i*cols:3+(i+1)*cols] for i in range(rows)]
 pref=[[0]*(cols+1) for _ in range(rows)]
 for i in range(rows):
  for j in range(cols): pref[i][j+1]=pref[i][j]+a[i][j]
 best=None
 for cr in range(r-1,rows-r+1):
  for cc in range(r-1,cols-r+1):
   total=0
   for dr in range(-(r-1),r):
    rr=cr+dr
    if 0<=rr<rows:
     span=r-1-abs(dr); lo=max(0,cc-span); hi=min(cols-1,cc+span)
     total+=pref[rr][hi+1]-pref[rr][lo]
   if best is None or total>best: best=total
 return str(best if best is not None else 0)
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("把半径误当成包含距离 r 的格子", "span=r-1-abs(dr)", "span=r-abs(dr)"),
            ("把每行菱形宽度少算一格", "span=r-1-abs(dr)", "span=r-2-abs(dr)"),
        ],
        "editorial": "## 思路\n\n固定每个中心，按行差 dr 枚举菱形覆盖的行；该行可包含的列差不超过 radius−1−|dr|。将范围裁切到矩阵边界后累加。扫描所有中心并取最大值。若半径 footprint 不能容纳在任何中心周围，按本站明确补充返回 0。\n\n## 正确性\n\n原题定义的距离是曼哈顿距离加一，因此包含条件等价于 |dr|+|dc|<radius。对固定 dr，所有满足条件的列恰是连续区间 |dc|≤radius−1−|dr|；逐行求和覆盖且仅覆盖菱形单元。遍历全部中心就得到所有允许区域的和并取最大。\n\n## 复杂度\n\n设矩阵为 R×C、半径为 K，时间 O(RCK)，空间 O(RC)。",
    },
    {
        "id": "oa-roblox-5", "title": "House Destruction — Count Segments After Each Removal",
        "tags": ["集合", "模拟"],
        "description": "给定初始互异房屋坐标和互异拆除查询；每次拆除一栋当前存在的房屋，输出拆除后剩余连续房屋段数。",
        "input": "第一行 n q；第二行 n 个初始坐标；第三行 q 个拆除坐标。1≤n≤200000，1≤q≤n；坐标范围 −10^9..10^9，查询均属于初始房屋且不重复。",
        "output": "按顺序输出每次拆除后的连续段数，以空格分隔。",
        "encode": houses_encode, "oracle": houses_oracle, "random": random_houses,
        "samples": [([1,2,3,6,7,9],[6,3,7,2,9,1]), ([0],[0]),
                    ([-3,-2,4,5],[-2,4])], "public": ["3 3 2 2 1 0", "0", "2 2"],
        "reference": '''import sys
def solve(raw):
 t=list(map(int,raw.split())); n,q=t[:2]; live=set(t[2:2+n]); out=[]
 segments=sum(1 for x in live if x-1 not in live)
 for x in t[2+n:2+n+q]:
  left=x-1 in live; right=x+1 in live
  if left and right: segments+=1
  elif not left and not right: segments-=1
  live.remove(x); out.append(str(segments))
 return ' '.join(out)
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("忽略删除后左右两段合并", "if left and right: segments+=1", "if left and right: segments-=1"),
            ("相邻房屋差一时误判为不连续", "left=x-1 in live; right=x+1 in live", "left=x-2 in live; right=x+2 in live"),
        ],
        "editorial": "## 思路\n\n维护尚未拆除的坐标集合以及当前连续段数量。删除 x 前检查 x−1 与 x+1 是否仍存在：两侧都有时，原来一个段被拆成两个，段数加一；两侧都没有时，孤立段消失，减一；仅一侧存在时段数不变。\n\n## 正确性\n\n整数线上连续段恰由没有左邻居的存活房屋作为起点计数。删除一个点只会影响其所在段：若点是段内部则分裂为两段；若该段长度为一则整段消失；若在端点则剩余房屋仍构成一个段。上述邻居分类正好对应这三种情况。\n\n## 复杂度\n\n每次查询平均 O(1)，空间 O(n)。",
    },
    {
        "id": "oa-roblox-9", "title": "Implement a Rate Limiter",
        "tags": ["哈希表", "模拟"],
        "description": ("按请求 key 限流。原题允许 fixed-window 或 sliding-window，只要求与样例一致；"
                        "本站明确选用固定窗口：窗口编号为 floor(timestamp/window)，每个 key 在一个窗口编号内最多允许 limit 条请求。被拒请求不占额度。"),
        "input": "第一行 window limit q；随后 q 行 timestamp key。本站补充：timestamp 为非负整数且非递减，key 不含空格；1≤q≤200000，1≤window≤10^9，1≤limit≤10^5。",
        "output": "每条请求输出 ALLOW 或 REJECT，以空格分隔。",
        "encode": limiter_encode, "oracle": limiter_oracle, "random": random_limiter,
        "samples": [(10,2,[(1,"alice"),(2,"alice"),(3,"alice"),(11,"alice"),(12,"alice"),(12,"bob")]),
                    (5,1,[(1,"u"),(1,"u"),(2,"u"),(6,"u"),(6,"u")]),
                    (3,2,[(0,"x"),(1,"x"),(2,"x"),(3,"x")])],
        "public": ["ALLOW ALLOW REJECT ALLOW ALLOW ALLOW", "ALLOW REJECT REJECT ALLOW REJECT",
                   "ALLOW ALLOW REJECT ALLOW"],
        "reference": '''import sys
def solve(raw):
 t=raw.split(); window,limit,q=map(int,t[:3]); counts={}; out=[]; p=3
 for _ in range(q):
  timestamp=int(t[p]); key=t[p+1]; p+=2; bucket=timestamp//window; k=(key,bucket)
  if counts.get(k,0)<limit: counts[k]=counts.get(k,0)+1; out.append('ALLOW')
  else: out.append('REJECT')
 return ' '.join(out)
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("用全局总请求数而非 key 独立计数", "k=(key,bucket)", "k=('all',bucket)"),
            ("把固定窗口边界错移一秒", "bucket=timestamp//window", "bucket=(timestamp-1)//window"),
        ],
        "editorial": "## 思路\n\n本站按原题允许的策略选择固定窗口。将每个请求映射为 (key, floor(timestamp/window))，维护该组合已允许次数；未达 limit 时放行并递增，否则拒绝。\n\n## 正确性\n\n固定窗口策略下，每条请求只受自身 key 和窗口编号影响，且额度仅由该组先前已放行请求占用。哈希表精确保存每组计数，因此判定与定义一致。\n\n## 复杂度\n\n每个请求期望 O(1)，总时间 O(q)，空间 O(q)。",
    },
    {
        "id": "oa-roblox-10", "title": "Largest Value of Usage in Minutes",
        "tags": ["数组", "字符串"],
        "description": ("每条记录包含一个五位小写字母 device_id 和四位数字 usage（允许前导零），"
                        "返回 usage 最大的设备 ID。设备 ID 和 usage 值各自两两不同。"),
        "input": "第一行 n；随后 n 行 device_id usage。本站输入协议省略原格式中的逗号与空格以消除其 length=10 与示例字符串长度矛盾。1≤n≤1400，ID 恰为 5 个小写英文字母；usage 按整数解释且 1≤usage≤1400（采用原题 prose 与约束交集）。",
        "output": "输出 usage 最大的 device_id。",
        "encode": usage_encode, "oracle": usage_oracle, "random": random_usage,
        "samples": [[("iqttt",77),("obvhd",93),("flohd",75)],
                    [("abcde",1)], [("zzzzz",1400),("aaaaa",1399)]],
        "public": ["obvhd", "abcde", "zzzzz"],
        "reference": '''import sys
def solve(raw):
 t=raw.split(); n=int(t[0]); best_id=''; best=-1
 for i in range(n):
  key=t[1+2*i]; value=int(t[2+2*i])
  if value>best: best=value; best_id=key
 return best_id
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("选择最小用量设备而非最大用量", "if value>best:", "if value<best:"),
            ("错误地忽略四位数字的后三位", "value=int(t[2+2*i])", "value=int(t[2+2*i][:1])"),
        ],
        "editorial": "## 思路\n\n逐条解析 ID 与四位数字对应的整数，记录用量最大的一项。题面保证用量值互异，因此最大值对应唯一设备。\n\n## 正确性\n\n扫描前 i 条记录后，best 始终是其中用量最大设备的 ID。新记录用量更大时更新，否则保持。扫描结束后 best 因而对应全体最大用量。\n\n## 复杂度\n\n时间 O(n)，额外空间 O(1)。",
    },
    {
        "id": "oa-roblox-12", "title": "Rate Limit by Multiple Request Fields",
        "tags": ["哈希表", "队列", "模拟"],
        "description": ("每条请求包含多个字段维度，每个维度配置自己的 fieldName、window 和 limit。"
                        "请求只有在所有维度均未超限时才 ALLOW；本站明确采用滑动窗口 [timestamp-window,timestamp)，"
                        "只将 ALLOW 请求计入各维度历史，被 REJECT 的请求不会消耗额度。"),
        "input": "第一行 d q；随后 d 行 fieldName window limit；再随后 q 行 timestamp value1 ... valued。本站补充：1≤d≤10，1≤q≤200000，window、limit 为正整数，值不含空格，时间戳非递减。",
        "output": "每条请求输出 ALLOW 或 REJECT，以空格分隔。",
        "encode": multi_encode, "oracle": multi_oracle, "random": random_multi,
        "samples": [([("user",10,2),("device",10,3)],[(1,["u1","d1"]),(2,["u1","d1"]),(3,["u1","d1"]),(4,["u2","d1"]),(11,["u1","d1"]),(12,["u1","d1"])]),
                    ([('user',5,1),('endpoint',3,2)],[(1,['u1','/a']),(2,['u1','/a']),(2,['u2','/a']),(4,['u2','/a'])]),
                    ([('user',2,1)],[(1,['u']),(3,['u'])])],
        "public": ["ALLOW ALLOW REJECT ALLOW ALLOW ALLOW", "ALLOW REJECT ALLOW REJECT", "ALLOW ALLOW"],
        "reference": '''import sys
from collections import defaultdict,deque
def solve(raw):
 t=raw.split(); d,q=map(int,t[:2]); p=2; rules=[]; hist=[]
 for _ in range(d):
  name=t[p]; w=int(t[p+1]); lim=int(t[p+2]); p+=3; rules.append((w,lim)); hist.append(defaultdict(deque))
 out=[]
 for _ in range(q):
  now=int(t[p]); fields=t[p+1:p+1+d]; p+=1+d
  for i,key in enumerate(fields):
   dq=hist[i][key]
   while dq and dq[0]<=now-rules[i][0]: dq.popleft()
  ok=all(len(hist[i][key])<rules[i][1] for i,key in enumerate(fields))
  out.append('ALLOW' if ok else 'REJECT')
  if ok:
   for i,key in enumerate(fields): hist[i][key].append(now)
 return ' '.join(out)
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("仅检查第一个字段维度", "ok=all(len(hist[i][key])<rules[i][1] for i,key in enumerate(fields))", "ok=len(hist[0][fields[0]])<rules[0][1]"),
            ("把被拒请求也加入限流历史", "if ok:\n   for i,key in enumerate(fields): hist[i][key].append(now)", "for i,key in enumerate(fields): hist[i][key].append(now)"),
        ],
        "editorial": "## 思路\n\n每个维度分别以字段值为键维护已放行请求时间的双端队列。处理请求时先移除时间小于等于 now−window 的过期时间，再检查所有维度当前计数是否小于各自限额。只有全部通过才在所有维度记入时间。\n\n## 正确性\n\n滑动窗口定义为 [now−window, now)，因此边界等于 now−window 的旧请求必须过期。逐维检查保证任何一维超限都会拒绝；仅对整体获准请求追加记录，正好实现本站明确规定的额度语义。\n\n## 复杂度\n\n每条请求检查至多 d 个维度；每个时间戳在队列中至多入队出队一次。总时间 O(qd)，空间 O(qd)。",
    },
    {
        "id": "oa-roblox-13", "title": "Schedule Meeting",
        "tags": ["区间", "排序"],
        "description": ("给定员工在一天内的忙碌区间和会议时长，求所有员工都空闲且会议可在当天结束的最早开始分钟；"
                        "若无解输出 -1。本站补充：时间使用半开区间 [start,finish)，因此端点相接不冲突；输入区间可重叠或乱序。"),
        "input": "第一行 n length；对每位员工依次输入区间数 m，再输入 m 对 start finish。1≤n≤100，0≤m≤100，0≤start<finish≤1400，1≤length≤1440。",
        "output": "输出最早开始时间；无可行时间输出 -1。",
        "encode": meeting_encode, "oracle": meeting_oracle, "random": random_meeting,
        "samples": [([[(60,150),(180,240)],[(0,210),(360,420)]],120),
                    ([[(480,510)],[(240,330)],[(375,400)]],180),
                    ([[(0,1400)]],1440)], "public": ["240", "0", "-1"],
        "reference": '''import sys
def solve(raw):
 t=list(map(int,raw.split())); n,length=t[:2]; p=2; busy=[]
 for _ in range(n):
  m=t[p]; p+=1
  for _ in range(m): busy.append((t[p],t[p+1])); p+=2
 busy.sort(); merged=[]
 for a,b in busy:
  if merged and a<=merged[-1][1]: merged[-1]=(merged[-1][0],max(merged[-1][1],b))
  else: merged.append((a,b))
 current=0
 for a,b in merged:
  if a-current>=length: return str(current)
  current=max(current,b)
 return str(current) if current+length<=1440 else '-1'
if __name__=='__main__': print(solve(sys.stdin.read()))
''',
        "mutants": [
            ("会议长度刚好放入空档时仍判失败", "if a-current>=length: return str(current)", "if a-current>length: return str(current)"),
            ("不排序忙碌区间就合并", "busy.sort(); merged=[]", "merged=[]"),
        ],
        "editorial": "## 思路\n\n将所有员工的忙碌区间合并成全局并集，按开始时间排序后从 0 分钟扫描空档。第一个长度至少为 length 的空档，其起点就是最早答案。半开区间允许在忙碌区间结束的同一分钟开始会议。\n\n## 正确性\n\n只要任一员工忙碌，新增会议就不可安排，因此全体忙碌时段的并集恰好是不可用时段。合并后按时间递增检查相邻不可用段之间的空档；第一个足长空档开始时间不晚于任何后续可行区间，并且其自身满足可行条件。最后还需检查一天结束边界。\n\n## 复杂度\n\n最多 10000 个区间，排序时间 O(M log M)，空间 O(M)。",
    },
]


BLOCKED = {
    "oa-roblox-1": "公司 MDX 与原始题源相反：MDX 从所有位置已占用开始并拆除；原始 001-003_image.txt 明确初始为空并依次建房，样例 [2,1,3] 的输出也分别为 [[0,1],[0,1],[4]] 与 [1,2,3]，无法确认哪一版应代表该 ID。",
    "oa-roblox-4": "原始 007_image.txt 是报纸段落自动换行、居中并加星号边框；公司 MDX 却描述 HTML 段落标签格式化。二者输入输出和规则完全不同，同一 ID 下无法判断权威版本。",
    "oa-roblox-6": "fastprep/Roblox/count-pairs.md 示例数组数字和配对计数与标称输出 5 冲突；其解释自己只列出两个有效配对，不能构造可靠判定器。",
    "oa-roblox-7": "fastprep 原文没有题目规则或约束，只要求查看缺失源图；所谓对角线 1,2,0 模式仅是作者猜测，不能据此判题。",
    "oa-roblox-8": "fastprep/Roblox/roblox-find-max-number-of-pairs.md 原题描述被截断在 ‘find the numbers with t’，示例与输出无法补足完整规则。",
    "oa-roblox-11": "原题只说对塔高加减 K；不清楚可否低于零，且样例 [5,7,9,4,11] 的说明结果与规则计算也不一致，无法安全确定唯一答案。",
    "oa-roblox-14": "原题缺少可执行的 cyclic shift 规则；说明重复例子而有效配对数与输出不一致，关键操作定义与计数口径都不明。",
    "oa-roblox-15": "题面文字定义 i<j 且前词为后词后缀，但示例反向展示，另有明显非后缀的词对被算入；输出与解释也不一致。",
    "oa-roblox-16": "按题面等式 a[i]-b[j]=a[j]-b[i] 化简为 a[i]+b[i]=a[j]+b[j]；样例配对和只能得到 2 对，原输出却为 6，矛盾未能消解。",
}


EVIDENCE = {
    "oa-roblox-1": ("OA LIST/Roblox/001_image.txt", "b66318cf2dd8afbf244024409e65612712119177"),
    "oa-roblox-2": ("OA LIST/Roblox/006_image.txt", "aae5ae2c3fb011b6aa56943025fcacd47b0e319a"),
    "oa-roblox-3": ("OA LIST/Roblox/004_image.txt + 005_image.txt", "09fff3c2e87b340f1b614655644b1b241b61e930;0233b309c8dbd12815c4e320f258ec23862d51bd"),
    "oa-roblox-4": ("OA LIST/Roblox/007_image.txt", "e6ec1da2426fefd71111b367ccf71dad8402a55e"),
    "oa-roblox-5": ("OA LIST/Roblox/008_image.txt", "4ae99d8472e89125bb1eb825a5716a4e7be859dc"),
    "oa-roblox-6": ("fastprep/Roblox/count-pairs.md", "74c8f9c66efd0242f8650a4fde64b69984a02463"),
    "oa-roblox-7": ("fastprep/Roblox/roblox-find-longest-diagonal-segment.md", "a5d00d45d213e87f0a98dea03ebf1d09f9e183a4"),
    "oa-roblox-8": ("fastprep/Roblox/roblox-find-max-number-of-pairs.md", "df5ceecada30bf63a9f0a9a93efa47d4b88635b5"),
    "oa-roblox-9": ("fastprep/Roblox/roblox-implement-rate-limiter.md", "11d80a6b8687a61760ea9e7ee1d00b88f980f46d"),
    "oa-roblox-10": ("fastprep/Roblox/roblox-largest-value-of-usage-in-minutes.md", "7a29029ce36ea1c718c0882e1077663b07e3ee27"),
    "oa-roblox-11": ("fastprep/Roblox/roblox-make-towers-strictly-increasing-or-decreasing.md", "c52b0187668af3aac42c5e568ca1d72dd6a104c7"),
    "oa-roblox-12": ("fastprep/Roblox/roblox-rate-limit-by-multiple-request-fields.md", "cb032aaa18582367e8af8642142eb8347bafdb4f"),
    "oa-roblox-13": ("fastprep/Roblox/roblox-schedule-meeting.md", "6545f67bfca11e5b816e3332bed43aa7381ee246"),
    "oa-roblox-14": ("fastprep/Roblox/roblox-shift-ops.md", "188c209d2a87829d8ad5cae58314ed40e5f662ca"),
    "oa-roblox-15": ("fastprep/Roblox/roblox-solution.md", "fea6907f0f387d66628b4af4298d59740bb527f9"),
    "oa-roblox-16": ("fastprep/Roblox/roblox-valid-pairs.md", "a00bb2f70711556aa6144eea40a251fecf551d52"),
}


def main():
    for folder in ("packages", "editorials", "references", "oracles", "mutants",
                   "negative-controls", "reviews", "candidate-batches", "validation",
                   "source-evidence"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    manifest, reports, reviews = [], [], []
    authored_ids = {spec["id"] for spec in SPECS}
    source_evidence = []
    for pid in sorted(EVIDENCE, key=lambda x: int(x.rsplit("-",1)[1])):
        path, blob = EVIDENCE[pid]
        source = SOURCES[pid]
        item = {"id": pid, "catalogContentHash": source["contentHash"],
                "sourceUrl": source["sourceUrl"],
                "status": "authored" if pid in authored_ids else "blocked",
                "reason": "题目规则已按本站明确协议整理，并完成离线验证。"
                if pid in authored_ids else BLOCKED[pid]}
        if ";" in blob:
            paths, hashes = path.split(" + "), blob.split(";")
            item["rawSources"] = [{"path": raw_path, "gitBlobSha": raw_hash}
                                  for raw_path, raw_hash in zip(paths, hashes)]
        else:
            item.update({"path": path, "gitBlobSha": blob})
        source_evidence.append(item)

    for spec in SPECS:
        pid, source = spec["id"], SOURCES[spec["id"]]
        code = spec["reference"].lstrip()
        ref = OUT / "references" / f"{pid}.py"
        ref.write_text(code)
        rng = random.Random(SEED + int(pid.rsplit("-", 1)[1]))
        values = spec["samples"] + [spec["random"](rng) for _ in range(160)]
        oracle_cases = []
        for value in values:
            stdin = spec["encode"](value)
            expected = spec["oracle"](value)
            actual = run(ref, stdin)
            assert actual == expected, (pid, value, expected, actual)
            if len(oracle_cases) < 3:
                assert expected == spec["public"][len(oracle_cases)], (
                    pid, "source/public sample mismatch", expected,
                    spec["public"][len(oracle_cases)])
            oracle_cases.append({"input": stdin, "expectedOutput": expected + "\n"})
        cases = [{"name": f"公开样例 {i+1}", **oracle_cases[i], "hidden": False, "weight": 1}
                 for i in range(3)]
        cases.extend({"name": f"随机隐藏测试 {i+1}", **oracle_cases[i+3],
                      "hidden": True, "weight": 1} for i in range(30))

        if pid == "oa-roblox-2":
            value = ([7,7,7],2)  # pairwise-distinct endpoints matter: one value cannot make two disjoint pairs.
            stdin, expected = spec["encode"](value), spec["oracle"](value)
            assert expected == "0" and run(ref, stdin) == expected
            cases.append({"name":"三次出现只能配成一对", "input":stdin,
                          "expectedOutput":expected+"\n", "hidden":True, "weight":1})
        elif pid == "oa-roblox-3":
            matrix = [[(-1 if (r+c)%2 else 1)*1000000 for c in range(200)] for r in range(200)]
            value = (matrix, 100); stdin, expected = spec["encode"](value), spec["oracle"](value)
            assert run(ref, stdin) == expected
            cases.append({"name":"200乘200矩阵边界", "input":stdin,
                          "expectedOutput":expected+"\n", "hidden":True, "weight":1})
        elif pid == "oa-roblox-5":
            houses = list(range(200000)); queries = list(range(199999,-1,-1))
            value = (houses,queries); stdin=spec["encode"](value)
            expected = " ".join("1" if i < 199999 else "0" for i in range(200000))
            assert run(ref,stdin) == expected
            cases.append({"name":"20万栋房屋逆序拆除", "input":stdin,
                          "expectedOutput":expected+"\n", "hidden":True, "weight":1})
        elif pid == "oa-roblox-9":
            requests = [(i,"same") for i in range(200000)]
            value=(10**9,100000,requests); stdin=spec["encode"](value)
            expected=" ".join(["ALLOW"]*100000+["REJECT"]*100000)
            assert run(ref,stdin) == expected
            cases.append({"name":"20万请求边界", "input":stdin,
                          "expectedOutput":expected+"\n", "hidden":True, "weight":1})
        elif pid == "oa-roblox-10":
            def alpha_id(value):
                out = ""
                for _ in range(5):
                    out = chr(ord("a") + value % 26) + out
                    value //= 26
                return out
            value=[(alpha_id(i), i+1) for i in range(1400)]
            stdin=spec["encode"](value); expected=spec["oracle"](value)
            assert expected == alpha_id(1399) and run(ref,stdin) == expected
            cases.append({"name":"1400条记录边界", "input":stdin,
                          "expectedOutput":expected+"\n", "hidden":True, "weight":1})
        elif pid == "oa-roblox-12":
            rules=[(f"f{i}",10**9,100000) for i in range(10)]
            requests=[(i,[f"v{j}" for j in range(10)]) for i in range(200000)]
            value=(rules,requests); stdin=spec["encode"](value)
            expected=" ".join(["ALLOW"]*100000+["REJECT"]*100000)
            assert run(ref,stdin) == expected
            cases.append({"name":"10维与20万请求边界", "input":stdin,
                          "expectedOutput":expected+"\n", "hidden":True, "weight":1})
        elif pid == "oa-roblox-13":
            value=([[(5,10)]],5)
            stdin=spec["encode"](value); expected=spec["oracle"](value)
            assert expected == "0" and run(ref,stdin) == expected
            cases.append({"name":"长度刚好等于空档", "input":stdin,
                          "expectedOutput":expected+"\n", "hidden":True, "weight":1})
            value=([[(0,1400)] for _ in range(100)],1440)
            stdin=spec["encode"](value); expected="-1"
            assert run(ref,stdin) == expected
            cases.append({"name":"员工数与一天最长会议边界", "input":stdin,
                          "expectedOutput":expected+"\n", "hidden":True, "weight":1})

        mutants, controls = [], []
        for index, (name, old, new) in enumerate(spec["mutants"], 1):
            assert old in code, (pid, "mutation anchor missing", old)
            mutant_code = code.replace(old, new)
            control = OUT / "negative-controls" / f"{pid}-{index}.py"
            control.write_text(mutant_code)
            killed = [i for i, case in enumerate(cases)
                      if run(control, case["input"]) != case["expectedOutput"].rstrip("\n")]
            assert killed, (pid, "mutant survives", name)
            mutants.append({"name": name, "code": mutant_code})
            controls.append({"name": name, "rejectedByCases": killed})

        problem = {
            "id": pid, "courseId": "gomall", "lessonId": "00-overview",
            "title": spec["title"], "difficulty": "中等",
            "tags": ["OA", "Roblox"] + spec["tags"],
            "description": spec["description"] + "\n\n题面中标注的‘本站补充’和标准输入输出协议由本站明确整理，不代表原题另有未说明的规则。",
            "input": spec["input"], "output": spec["output"],
            "explanation": "思路、正确性证明和复杂度见配套题解。",
            "hints": ["先把原题中的每一种规则和本站补充的输入约定分开，再选择适合的数据结构。"],
            "timeLimit": 3, "memoryLimit": 262144, "outputLimit": 4096,
            "checker": "exact", "languages": ["python", "go", "java", "cpp"],
        }
        raw_package = {"schemaVersion":1, "problem":problem, "cases":cases}
        normalize = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
                     "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
                     "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
        result = subprocess.run(["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
                                input=json.dumps(raw_package, ensure_ascii=False), text=True,
                                capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        normalized = result.stdout
        package = json.loads(normalized)
        editorial_text = spec["editorial"]
        editorial = {"schemaVersion":1, "id":pid, "title":spec["title"],
                     "explanation":editorial_text,
                     "solutions":[{"language":"python", "code":code}],
                     "sourceUrl":source["sourceUrl"], "sourceContentHash":source["contentHash"],
                     "author":"CSWork"}
        for folder, document in (("packages",package),("oracles",oracle_cases),
                                 ("mutants",mutants),("editorials",editorial)):
            (OUT/folder/f"{pid}.json").write_text(json.dumps(document,ensure_ascii=False,indent=2)+"\n")
        checksum=hashlib.sha256(normalized.encode()).hexdigest()
        manifest.append({"id":pid,"sourceContentHash":source["contentHash"],
                         "packageChecksum":checksum,"editorial":editorial_text,
                         "authoredSolutions":[{"language":"python","code":code}]})
        reports.append({"id":pid,"oracleCases":len(oracle_cases),"publicCases":3,
                        "hiddenCases":len(cases)-3,"negativeControls":controls,
                        "referenceSha256":hashlib.sha256(code.encode()).hexdigest()})
        reviews.append({"id":pid,"status":"authored",
                        "reason":"已核对 e66f809 原始题源；本站补充的协议/限制已写入题面，163 个独立 oracle 输入及两个正常退出错误程序离线验证通过。",
                        "sourceUrls":[source["sourceUrl"]],
                        "sourceContentHashes":[source["contentHash"]],
                        "sourceCommit":CATALOG["source"]["commit"],
                        "catalogContentHash":source["contentHash"]})
        print(f"{pid}: {len(oracle_cases)} oracle inputs; {len(cases)} judge cases; "
              f"{len(controls)} mutants rejected",flush=True)

    batch="roblox-next"
    (OUT/"candidate-batches"/f"{batch}.json").write_text(
        json.dumps({"schemaVersion":1,"items":manifest},ensure_ascii=False,indent=2)+"\n")
    (OUT/"validation"/f"{batch}.json").write_text(json.dumps(
        {"schemaVersion":1,"seed":SEED,"problems":reports,
         "note":"Offline authored-code/oracle/mutant validation only; not tested against production GoJudge."},
        ensure_ascii=False,indent=2)+"\n")
    reviews.extend({"id":pid,"status":"blocked","reason":reason} for pid,reason in BLOCKED.items())
    reviews.sort(key=lambda item:int(item["id"].rsplit("-",1)[1]))
    (OUT/"reviews"/f"{batch}.json").write_text(
        json.dumps({"schemaVersion":1,"items":reviews},ensure_ascii=False,indent=2)+"\n")
    (OUT/"source-evidence"/f"{batch}.json").write_text(json.dumps(
        {"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master",
         "commit":CATALOG["source"]["commit"],
         "reason":"Read-only verification of immutable original statements; no upstream solution code executed.",
         "items":source_evidence},ensure_ascii=False,indent=2)+"\n")


if __name__ == "__main__":
    main()
