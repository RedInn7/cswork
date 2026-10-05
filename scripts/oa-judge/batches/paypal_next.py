"""Generate offline-only, source-audited PayPal OA candidates.

Reads the pinned OAMaster catalog and immutable source blobs for evidence. Only
the locally authored references, oracles, and mutants are executed.
"""
from collections import Counter
from datetime import date
from itertools import combinations_with_replacement
from pathlib import Path
import hashlib
import heapq
import json
import random
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "content/oa-judge"
CATALOG = json.loads((ROOT / "content/oa-master/catalog.json").read_text())
SOURCES = {item["id"]: item for item in CATALOG["items"]}
SOURCE_REPO = Path("/tmp/oa-master-readonly")
SOURCE_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
SEED = 20261005
VOWELS = set("aeiou")
CONSONANTS = set("bcdfghjklmnpqrstvwxyz")


def run(path, data):
    proc = subprocess.run([sys.executable, "-I", str(path)], input=data, text=True,
                          capture_output=True, timeout=12, check=True)
    return proc.stdout.rstrip("\n")


def password_encode(s):
    return s + "\n"


def password_oracle(s):
    # Independent assignment DP: each character may become any lowercase
    # letter; retain the cheapest cost for every vowel count.
    target = len(s) // 2
    dp = [0] + [10**9] * target
    for ch in s:
        nxt = [10**9] * (target + 1)
        for used, old in enumerate(dp):
            if old >= 10**9:
                continue
            for code in range(ord("a"), ord("z") + 1):
                is_vowel = chr(code) in VOWELS
                count = used + is_vowel
                if count <= target:
                    nxt[count] = min(nxt[count], old + abs(ord(ch) - code))
        dp = nxt
    return str(dp[target])


def random_password(rng):
    n = rng.randrange(2, 11, 2)
    return "".join(rng.choice("abefgikopstuvxyz") for _ in range(n))


def login_encode(logs):
    return str(len(logs)) + "\n" + "".join(f"{u} {t} {d}\n" for u, t, d in logs)


def login_oracle(logs):
    counts = Counter()
    for user, clock, day in logs:
        if not re.fullmatch(r"user(?:0|[1-9][0-9]{0,9})", user):
            continue
        tm = re.fullmatch(r"([0-9]{2}):([0-9]{2}):([0-9]{2})", clock)
        dm = re.fullmatch(r"([0-9]{4})-([0-9]{2})-([0-9]{2})", day)
        if not tm or not dm:
            continue
        hh, mm, ss = map(int, tm.groups())
        year, month, dom = map(int, dm.groups())
        if hh > 23 or mm > 59 or ss > 59 or not 2000 <= year <= 3000:
            continue
        month_lengths = [31, 28 + int(year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)),
                         31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        if month < 1 or month > 12 or dom < 1 or dom > month_lengths[month - 1]:
            continue
        counts[(user, day)] += 1
    rows = sorted((u, d, str(n)) for (u, d), n in counts.items())
    return str(len(rows)) + ("\n" + "\n".join(" ".join(row) for row in rows) if rows else "")


def random_logins(rng):
    logs = []
    for _ in range(rng.randint(1, 22)):
        uid = rng.choice([1, 2, 7, 10, 11, 24, 105])
        year = rng.randint(2000, 2032)
        month = rng.randint(1, 12)
        day = rng.randint(1, 28)
        hh, mm, ss = rng.randrange(24), rng.randrange(60), rng.randrange(60)
        if rng.random() < 0.2:
            hh = rng.choice([24, 25, 99])
        if rng.random() < 0.15:
            month, day = 2, 29
            year = 2021
        logs.append((f"user{uid}", f"{hh:02d}:{mm:02d}:{ss:02d}",
                     f"{year:04d}-{month:02d}-{day:02d}"))
    return logs


def coupon_encode(case):
    prices, m = case
    return f"{len(prices)} {m}\n" + " ".join(map(str, prices)) + "\n"


def coupon_oracle(case):
    prices, m = case
    heap = [-p for p in prices]
    heapq.heapify(heap)
    while m and heap and heap[0] < 0:
        value = -heapq.heappop(heap)
        heapq.heappush(heap, -(value // 2))
        m -= 1
    return str(-sum(heap))


def random_coupons(rng):
    prices = [rng.randint(1, 70) for _ in range(rng.randint(1, 12))]
    return prices, rng.randint(0, 45)


def modify_encode(values):
    return f"{len(values)}\n" + " ".join(map(str, values)) + "\n"


def modify_oracle(values):
    lo, hi = min(values), max(values)

    def brute(seq):
        best = 10**30
        for target in combinations_with_replacement(range(lo, hi + 1), len(seq)):
            cost = sum(abs(a - b) for a, b in zip(seq, target))
            if cost < best:
                best = cost
        return best

    return str(min(brute(values), brute(values[::-1])))


def random_modify(rng):
    return [rng.randint(0, 5) for _ in range(rng.randint(1, 7))]


PASSWORD_REFERENCE = """import sys
V=set('aeiou')
def solve(raw):
 s=raw.strip(); n=len(s); v=sum(ch in V for ch in s); target=n//2
 if n%2: return '-1'
 need=abs(v-target)
 source=[ch for ch in s if (ch in V)==(v>target)]
 other=V if v<target else set('bcdfghjklmnpqrstvwxyz')
 costs=[min(abs(ord(ch)-ord(to)) for to in other) for ch in source]
 return str(sum(sorted(costs)[:need]))
if __name__=='__main__': print(solve(sys.stdin.read()))
"""

LOGIN_REFERENCE = """import sys,re
from datetime import date
def solve(raw):
 lines=raw.splitlines(); n=int(lines[0]); counts={}
 for line in lines[1:1+n]:
  user,tm,day=line.split()
  if not re.fullmatch(r'user(?:0|[1-9][0-9]{0,9})',user): continue
  if not re.fullmatch(r'[0-9]{2}:[0-9]{2}:[0-9]{2}',tm): continue
  if not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}',day): continue
  h,m,s=map(int,tm.split(':'))
  if h>=24 or m>=60 or s>=60: continue
  try: date.fromisoformat(day)
  except ValueError: continue
  if not 2000<=int(day[:4])<=3000: continue
  counts[(user,day)]=counts.get((user,day),0)+1
 rows=sorted((u,d,c) for (u,d),c in counts.items())
 return str(len(rows))+('\\n'+'\\n'.join(f'{u} {d} {c}' for u,d,c in rows) if rows else '')
if __name__=='__main__': print(solve(sys.stdin.read()))
"""

COUPON_REFERENCE = """import sys
def coupons_to_cap(a,cap):
 total=0
 for x in a:
  if x>cap: total+=(x//(cap+1)).bit_length()
 return total
def solve(raw):
 t=list(map(int,raw.split())); n,m=t[0],t[1]; a=t[2:2+n]
 if coupons_to_cap(a,0)<=m: return '0'
 lo,hi=0,max(a)
 while hi-lo>1:
  mid=(lo+hi)//2
  if coupons_to_cap(a,mid)<=m: hi=mid
  else: lo=mid
 used=0; total=0
 for x in a:
  steps=(x//(hi+1)).bit_length() if x>hi else 0
  used+=steps; total+=x>>steps
 return str(total-(m-used)*(hi-hi//2))
if __name__=='__main__': print(solve(sys.stdin.read()))
"""

MODIFY_REFERENCE = """import sys
def nondecreasing_cost(a):
 vals=sorted(set(a)); dp=[abs(a[0]-v) for v in vals]
 for x in a[1:]:
  nd=[]; best=10**30
  for j,v in enumerate(vals):
   best=min(best,dp[j]); nd.append(best+abs(x-v))
  dp=nd
 return min(dp)
def solve(raw):
 t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
 return str(min(nondecreasing_cost(a),nondecreasing_cost(a[::-1])))
if __name__=='__main__': print(solve(sys.stdin.read()))
"""


def password_mutants():
    y_is_vowel = PASSWORD_REFERENCE.replace("V=set('aeiou')", "V=set('aeiouy')")
    unit_cost = PASSWORD_REFERENCE.replace(
        "costs=[min(abs(ord(ch)-ord(to)) for to in other) for ch in source]\n return str(sum(sorted(costs)[:need]))",
        "return str(need)")
    return [("把 y 当作元音", y_is_vowel), ("把每次字符类型转换都误算为 1 步", unit_cost)]


def login_mutants():
    no_filter = LOGIN_REFERENCE.replace(
        "  if h>=24 or m>=60 or s>=60: continue\n  try: date.fromisoformat(day)\n  except ValueError: continue\n  if not 2000<=int(day[:4])<=3000: continue",
        "  # invalid time/date accepted")
    numeric_sort = LOGIN_REFERENCE.replace("rows=sorted((u,d,c) for (u,d),c in counts.items())",
        "rows=sorted(((u,d,c) for (u,d),c in counts.items()),key=lambda r:(int(r[0][4:]),r[1]))")
    return [("没有过滤无效时间或日期", no_filter), ("按用户 ID 数值而非字典序排序", numeric_sort)]


def coupon_mutants():
    min_heap = """import sys,heapq
def solve(raw):
 t=list(map(int,raw.split())); n,m=t[:2]; h=t[2:2+n]; heapq.heapify(h)
 while m and h and h[0]>0:
  x=heapq.heappop(h); heapq.heappush(h,x//2); m-=1
 return str(sum(h))
if __name__=='__main__': print(solve(sys.stdin.read()))
"""
    round_up = """import sys,heapq
def solve(raw):
 t=list(map(int,raw.split())); n,m=t[:2]; h=[-x for x in t[2:2+n]]; heapq.heapify(h)
 while m and h and h[0]<0:
  x=-heapq.heappop(h); heapq.heappush(h,-((x+1)//2)); m-=1
 return str(-sum(h))
if __name__=='__main__': print(solve(sys.stdin.read()))
"""
    return [("每张优惠券错误地打在当前最低价商品上", min_heap),
            ("折半时向上取整而非向下取整", round_up)]


def modify_mutants():
    ascending_only = MODIFY_REFERENCE.replace(
        "return str(min(nondecreasing_cost(a),nondecreasing_cost(a[::-1])))",
        "return str(nondecreasing_cost(a))")
    strict = MODIFY_REFERENCE.replace(
        "best=min(best,dp[j]); nd.append(best+abs(x-v))",
        "best=min(dp[:j],default=10**30); nd.append(best+abs(x-v))")
    return [("只考虑升序，不考虑降序", ascending_only),
            ("误要求严格递增，重复值也必须修改", strict)]


SPECS = [
    {
        "id": "oa-paypal-1", "title": "Similar Password", "difficulty": "简单",
        "tags": ["字符串", "贪心"], "encode": password_encode, "oracle": password_oracle,
        "random": random_password, "samples": ["aabb", "zzzz", "yybb"],
        "public": ["aabb\n", "zzzz\n", "yybb\n"], "expected": ["0", "10", "2"],
        "description": "对小写密码逐字符加一或减一，使元音数与辅音数相等；元音为 a、e、i、o、u。",
        "input": "一行小写英文字母串。原题没有完整约束且奇数长度无法达到相等；本站只接收偶数长度 2..100000。",
        "output": "输出最少单字符加一/减一操作数。",
        "reference": PASSWORD_REFERENCE, "mutants": password_mutants(),
        "editorial": "## 思路\n\n设元音数为 v、长度为 n，目标元音数为 n/2，因此需把 |v−n/2| 个字符从数量较多的一类改成另一类。每个候选字符的代价是沿字母表加减操作到相反类别的最近距离。对这些代价排序，取最小的所需数量。本站把长度限为偶数，避免原题未定义奇数长度无解时的返回值。\n\n## 正确性\n\n每次操作只改变一个字符，只有字符跨过元音/辅音类别边界才会改变总数，且一次跨界恰使元音数变化 1。故必须至少转换 |v−n/2| 个字符。任意被选字符跨界的代价下界是到相反类别字母的最短距离，这个距离可单独实现；字符之间互不影响。选择所需数量中代价最小者同时达到下界。\n\n## 复杂度\n\n令 L 为密码长度，最多对每个字符检查 26 个字母并排序，时间 O(26L+L log L)，空间 O(L)。",
    },
    {
        "id": "oa-paypal-2", "title": "Count User Logins", "difficulty": "简单",
        "tags": ["哈希表", "排序", "日期"], "encode": login_encode, "oracle": login_oracle,
        "random": random_logins,
        "samples": [
            [("user1", "09:00:00", "2021-01-01"), ("user1", "13:00:00", "2021-01-01"),
             ("user2", "14:00:00", "2021-01-01"), ("user1", "20:00:00", "2021-01-02"),
             ("user2", "21:00:00", "2021-01-01")],
            [("user1", "09:00:00", "2021-01-01"), ("user1", "13:00:00", "2021-01-01"),
             ("user2", "14:00:00", "2021-01-01"), ("user1", "20:00:00", "2021-01-01"),
             ("user2", "21:00:00", "2021-01-01"), ("user3", "25:00:00", "2021-01-01"),
             ("user4", "22:00:00", "2021-02-29")],
            [("user2", "10:00:00", "2024-03-01"), ("user10", "11:00:00", "2024-02-29"),
             ("user2", "12:00:00", "2024-02-29")],
        ],
        "public": [
            "5\nuser1 09:00:00 2021-01-01\nuser1 13:00:00 2021-01-01\nuser2 14:00:00 2021-01-01\nuser1 20:00:00 2021-01-02\nuser2 21:00:00 2021-01-01\n",
            "7\nuser1 09:00:00 2021-01-01\nuser1 13:00:00 2021-01-01\nuser2 14:00:00 2021-01-01\nuser1 20:00:00 2021-01-01\nuser2 21:00:00 2021-01-01\nuser3 25:00:00 2021-01-01\nuser4 22:00:00 2021-02-29\n",
            "3\nuser2 10:00:00 2024-03-01\nuser10 11:00:00 2024-02-29\nuser2 12:00:00 2024-02-29\n",
        ],
        "expected": ["3\nuser1 2021-01-01 2\nuser1 2021-01-02 1\nuser2 2021-01-01 2",
                     "2\nuser1 2021-01-01 3\nuser2 2021-01-01 2",
                     "3\nuser10 2024-02-29 1\nuser2 2024-02-29 1\nuser2 2024-03-01 1"],
        "description": "统计每个用户名在每个合法日期的登录次数；丢弃无效时间或日期的记录，并按用户名和日期的字典序输出。来源样例的两段解释与样例输入/输出计数不一致，本站以输入数据和明确规则重算；输出字段沿用样例与来源参考实现中的 userX 形式。",
        "input": "第一行 n；随后 n 行各为 user<ID> HH:MM:SS YYYY-MM-DD。本站补充：1≤n≤1000；ID 为 0..10^9 的规范十进制非负整数；年份 2000..3000。时间须符合 00:00:00..23:59:59，日期须为公历有效日期；无效时间/日期行会被忽略。",
        "output": "先输出有效 (用户,日期) 分组数 k；随后 k 行输出 user<ID> YYYY-MM-DD 登录次数，按用户名字符串、再按日期升序排列。若没有有效记录，输出 0。",
        "reference": LOGIN_REFERENCE, "mutants": login_mutants(),
        "editorial": "## 思路\n\n逐行校验用户名、固定格式时间和公历日期。无效时间/日期的记录跳过。用 (用户名,日期) 作为键累计次数，最后按两个字符串字典序排序。本站 I/O 先输出分组数，再逐行输出用户名、日期和次数。\n\n## 正确性\n\n每条有效日志恰好给唯一的 (用户,日期) 键增加一次；无效日期或时间不参与统计，符合过滤规则。字典计数因此等于该组的登录记录数。对所有键按用户名、日期排序，恰好满足规定顺序；组数和每组字段一一对应。\n\n来源样例 1 的解释把 user1 当天的 2 次写成 3 次，又把 user2 的 2 次写成 1 次；样例 2 的解释把 user2 的 2 次写成 3 次。两组样例的实际输出与原始日志一致，本站沿用输出并记录解释笔误。\n\n## 复杂度\n\nn 条日志，哈希聚合 O(n)，排序 g 个分组 O(g log g)，空间 O(g)。",
    },
    {
        "id": "oa-paypal-3", "title": "Find Minimum Price to Spend", "difficulty": "中等",
        "tags": ["贪心", "堆", "二分"], "encode": coupon_encode, "oracle": coupon_oracle,
        "random": random_coupons, "samples": [([1, 2, 3], 2), ([2, 4], 2), ([5, 1], 0)],
        "public": ["3 2\n1 2 3\n", "2 2\n2 4\n", "2 0\n5 1\n"], "expected": ["3", "3", "6"],
        "description": "使用至多 m 张优惠券购买全部商品。对一个价格连续使用 x 张券后，价格变为 floor(price/2^x)。每张券至多用于一件商品的一次折半。",
        "input": "第一行 n m；第二行 n 个正整数价格。来源缺少约束；本站补充：1≤n≤100000，0≤m≤10^9，1≤price[i]≤10^9；总价和答案按 64 位整数输出。",
        "output": "输出使用优惠券后购买全部商品的最低总价。",
        "reference": COUPON_REFERENCE, "mutants": coupon_mutants(),
        "editorial": "## 思路\n\n对一个上限 H，计算把每个价格反复向下折半到不超过 H 所需的优惠券数。若 p>H，最少折半次数为 bit_length(floor(p/(H+1)))。该总次数随 H 增大而不增，因此二分最小的可行 H。达到上限后，剩余优惠券只需从仍等于 H 的商品中各用一次；最小可行 H 的定义保证这些商品足够。\n\n## 正确性\n\n每张优惠券都把一个当前价格 p 改为 floor(p/2)，节省 p−floor(p/2)，该节省随 p 单调不减。因此逐次把券用在当前最高价商品上是最优的。阈值 H 所需次数恰是每个商品首次降到 H 以下或等于 H 的折半步数；二分找到的最小可行 H 表示再把任一剩余 H 继续折半所需的优惠券总数会超过预算，所以预算内的额外优惠券只能用于现有价格为 H 的商品。它们每次节省相同，得到与最大边际节省贪心相同的最小总价。\n\n来源整理站的函数实现明确采用整数向下折半；同目录另一个“Items Purchase”版本也明确写 floor 与相同贪心规则。本站统一为整数 floor，且把 int 返回扩展为可容纳约 10^14 的 64 位十进制结果。\n\n## 复杂度\n\n每次阈值计数为 O(n)，二分价格范围需要 O(log max(price)) 轮，总时间 O(n log max(price))，额外空间 O(n)。",
    },
    {
        "id": "oa-paypal-4", "title": "Modify Array", "difficulty": "中等",
        "tags": ["动态规划", "单调序列"], "encode": modify_encode, "oracle": modify_oracle,
        "random": random_modify,
        "samples": [[9, 8, 7, 2, 3, 3], [1, 2, 3, 3, 4], [0, 1, 2, 5, 6, 5, 7]],
        "public": ["6\n9 8 7 2 3 3\n", "5\n1 2 3 3 4\n", "7\n0 1 2 5 6 5 7\n"],
        "expected": ["1", "0", "1"],
        "description": "求把数组修改为非递减或非递增序列的最小总绝对修改代价；每个位置可改为整数值，代价为新旧值差的绝对值。",
        "input": "第一行 n；第二行 n 个整数。原约束为 1≤n≤1000、1≤arr[i]≤10^9；本站将值域扩为 0..10^9，以保留来源第三个样例中的 0。",
        "output": "输出两个方向中的最小总修改代价，按 64 位非负整数输出。",
        "reference": MODIFY_REFERENCE, "mutants": modify_mutants(),
        "editorial": "## 思路\n\n先求非递减代价。最优的新值可取原数组出现过的值之一；把这些值离散化为 v[j]。令 dp[j] 为处理到当前位置且当前值取 v[j] 的最小代价，则新状态为 |arr[i]−v[j]| 加上上一行所有下标 ≤j 的 dp 最小值。扫描时维护前缀最小值即可。非递增代价等于反转数组后求非递减代价，答案取两者较小。\n\n## 正确性\n\n若当前位置取 v[j]，非递减限制恰要求前一位置取值不超过 v[j]；所有满足此条件的前缀状态中选择最低代价并加上当前位置绝对差，得到该状态的最优解。归纳覆盖全部前缀与末值。任一整数单调回归最优解都可把平台值移至该平台原始值中位数而不增代价，所以坐标压缩不遗漏最优值。反转把非递增序列与非递减序列一一对应且保持总代价。\n\n## 复杂度\n\n令 k 为不同元素数，时间 O(nk)，额外空间 O(k)；本站 n≤1000。\n\n来源样例 3 含 0，但同一原文列出的下界为 1。题意和该样例均自然支持非负整数；本站明确把值域扩至 0..10^9，不改变目标函数。",
    },
]


RAW_PATHS = {
    "oa-paypal-1": "fastprep/Paypal/paypal-count-minimum-operations.md",
    "oa-paypal-2": "fastprep/Paypal/paypal-count-user-logins.md",
    "oa-paypal-3": "fastprep/Paypal/paypal-find-minimum-price-to-spend.md",
    "oa-paypal-4": "fastprep/Paypal/paypal-modify-array.md",
}
COMPANY_PAGE = "web/content/docs/companies/paypal.mdx"
RELATED_PRICE_VARIANT = "fastprep/Paypal/paypal-find-minimum-price.md"
BLOCKED = {}


def raw_evidence(path):
    raw = subprocess.run(["git", "-C", str(SOURCE_REPO), "show", f"{SOURCE_COMMIT}:{path}"],
                         capture_output=True, check=True).stdout
    return {"path": path,
            "gitBlobSha": hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest(),
            "rawSha256": hashlib.sha256(raw).hexdigest()}


def make_large(spec):
    pid = spec["id"]
    if pid == "oa-paypal-1":
        s = "z" * 100000
        expected = "250000"
    elif pid == "oa-paypal-2":
        logs = [("user12", "23:59:59", "3000-12-31") for _ in range(1000)]
        s = spec["encode"](logs)
        expected = "1\nuser12 3000-12-31 1000"
    elif pid == "oa-paypal-3":
        s = spec["encode"](([10**9] * 100000, 10**9))
        expected = "0"
    else:
        s = spec["encode"]([10**9 if i % 2 else 0 for i in range(1000)])
        expected = "499000000000"
    return s, expected


def main():
    for folder in ("packages", "editorials", "references", "oracles", "mutants",
                   "negative-controls", "reviews", "candidate-batches", "validation"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)

    manifest, reports, reviews = [], [], []
    source_evidence = {"schemaVersion": 1,
        "repository": "https://github.com/RedInn7/OA-Master", "commit": SOURCE_COMMIT,
        "reason": "完整核对不可变 FastPrep Markdown 与站内公司题页；上游方案代码仅阅读、未执行；所有本站 reference、oracle 与错误程序为单独编写。",
        "companyPage": raw_evidence(COMPANY_PAGE),
        "relatedPriceVariant": dict(raw_evidence(RELATED_PRICE_VARIANT),
            note="非 catalog 题目；其独立题面显式写出 floor 舍入，用作相邻重复题型的语义佐证，不计入本批题目。"),
        "items": []}

    for spec in SPECS:
        pid = spec["id"]
        source = SOURCES[pid]
        source_evidence["items"].append({"id": pid, **raw_evidence(RAW_PATHS[pid]),
            "catalogContentHash": source["contentHash"], "sourceUrl": source["sourceUrl"],
            "status": "authored" if pid not in BLOCKED else "blocked",
            "reason": BLOCKED.get(pid, spec["description"]),
            "clarification": {"oa-paypal-1": "本站限制偶数密码长度，避免原题未定义的奇数长度无解返回值。",
                              "oa-paypal-2": "两个说明段的部分计数笔误按原日志及样例 Output 修正；用户名顺序明定为字典序。",
                              "oa-paypal-3": "使用整数向下折半；值域与 64 位结果范围由本站明示。",
                              "oa-paypal-4": "为兼容原第三样例把非负整数 0 纳入本站范围。"}[pid]})
        code = spec["reference"].lstrip()
        ref_path = OUT / "references" / f"{pid}.py"
        ref_path.write_text(code)

        rng = random.Random(SEED + int(pid.rsplit("-", 1)[1]))
        samples = spec["samples"]
        oracle_records = []
        seen = set()
        for value in samples:
            stdin = spec["encode"](value)
            if stdin in seen:
                continue
            seen.add(stdin)
            expected = spec["oracle"](value)
            actual = run(ref_path, stdin)
            assert actual == expected, (pid, value, expected, actual)
            oracle_records.append({"input": stdin, "expectedOutput": expected + "\n"})
        while len(oracle_records) < 163:
            value = spec["random"](rng)
            stdin = spec["encode"](value)
            if stdin in seen:
                continue
            seen.add(stdin)
            expected = spec["oracle"](value)
            actual = run(ref_path, stdin)
            assert actual == expected, (pid, value, expected, actual)
            oracle_records.append({"input": stdin, "expectedOutput": expected + "\n"})
        assert len(oracle_records) == 163, (pid, len(oracle_records))

        cases = [{"name": f"公开样例 {i+1}", **oracle_records[i], "hidden": False, "weight": 1}
                 for i in range(3)]
        cases.extend({"name": f"隐藏随机测试 {i+1}", **oracle_records[i+3], "hidden": True, "weight": 1}
                     for i in range(29))
        large_input, large_output = make_large(spec)
        actual_large = run(ref_path, large_input)
        assert actual_large == large_output, (pid, "large boundary", large_output, actual_large)
        cases.append({"name": "本站最大输入边界", "input": large_input,
                      "expectedOutput": large_output + "\n", "hidden": True, "weight": 1})

        mutants, negative_controls = [], []
        for index, (name, mutant_code) in enumerate(spec["mutants"], 1):
            control = OUT / "negative-controls" / f"{pid}-{index}.py"
            control.write_text(mutant_code.lstrip())
            rejected = []
            test_cases = cases[:-1] if pid == "oa-paypal-3" else cases
            for case_index, case in enumerate(test_cases):
                try:
                    output = run(control, case["input"])
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                    raise AssertionError((pid, name, "mutant did not exit normally", case_index))
                if output != case["expectedOutput"].rstrip("\n"):
                    rejected.append(case_index)
            assert rejected, (pid, "mutant survives", name)
            mutants.append({"name": name, "code": mutant_code.lstrip()})
            negative_controls.append({"name": name, "rejectedByCases": rejected,
                                      "normalExit": True})

        problem = {"id": pid, "courseId": "gomall", "lessonId": "00-overview",
            "title": spec["title"], "difficulty": spec["difficulty"],
            "tags": ["OA", "Paypal"] + spec["tags"],
            "description": spec["description"] + "\n\n所有额外约束和 I/O 形式都是本站补充，不冒充原题平台格式。",
            "input": spec["input"], "output": spec["output"],
            "explanation": "算法说明、正确性证明与复杂度见配套题解。",
            "hints": ["先按题意写清楚边界，再处理最容易漏掉的有效性或最优性条件。"],
            "timeLimit": 3, "memoryLimit": 262144,
            "outputLimit": 65536 if pid == "oa-paypal-2" else 4096,
            "checker": "exact", "languages": ["python", "go", "java", "cpp"]}
        raw_package = {"schemaVersion": 1, "problem": problem, "cases": cases}
        normalize = ("const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
                     "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
                     "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));")
        result = subprocess.run(["node", "--import", "tsx", "-e", normalize], cwd=ROOT,
            input=json.dumps(raw_package, ensure_ascii=False), text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        normalized = result.stdout
        package = json.loads(normalized)
        editorial_text = spec["editorial"]
        editorial = {"schemaVersion": 1, "id": pid, "title": spec["title"],
            "explanation": editorial_text,
            "solutions": [{"language": "python", "code": code}],
            "sourceUrl": source["sourceUrl"], "sourceContentHash": source["contentHash"],
            "author": "CSWork"}
        for folder, document in (("packages", package), ("oracles", oracle_records),
                                 ("mutants", mutants), ("editorials", editorial)):
            (OUT / folder / f"{pid}.json").write_text(
                json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        checksum = hashlib.sha256(normalized.encode()).hexdigest()
        manifest.append({"id": pid, "sourceContentHash": source["contentHash"],
            "packageChecksum": checksum, "editorial": editorial_text,
            "authoredSolutions": [{"language": "python", "code": code}]})
        reports.append({"id": pid, "oracleCases": len(oracle_records), "publicCases": 3,
            "hiddenCases": len(cases) - 3, "negativeControls": negative_controls,
            "referenceSha256": hashlib.sha256(code.encode()).hexdigest()})
        reviews.append({"id": pid, "status": "authored",
            "reason": "已逐条核对 OAMaster 原始题面与 catalog；本站输入协议及每处补充范围在题面明示，样例文字笔误已记录。",
            "sourceCommit": SOURCE_COMMIT, "rawPath": RAW_PATHS[pid],
            "rawGitBlob": source_evidence["items"][-1]["gitBlobSha"],
            "rawSha256": source_evidence["items"][-1]["rawSha256"],
            "catalogContentHash": source["contentHash"],
            "clarification": source_evidence["items"][-1]["clarification"]})
        print(f"{pid}: {len(oracle_records)} oracle inputs, {len(cases)} formal cases, "
              f"all {len(mutants)} normally-exiting mutants killed", flush=True)

    batch = "paypal-next"
    (OUT / "candidate-batches" / f"{batch}.json").write_text(
        json.dumps({"schemaVersion": 1, "items": manifest}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "validation" / f"{batch}.json").write_text(json.dumps(
        {"schemaVersion": 1, "seed": SEED, "problems": reports,
         "note": "本地 authored reference/oracle/mutant 验证；不代表 GoJudge 沙箱验证或线上发布。"},
        ensure_ascii=False, indent=2) + "\n")
    (OUT / "reviews" / f"{batch}.json").write_text(
        json.dumps({"schemaVersion": 1, "items": reviews}, ensure_ascii=False, indent=2) + "\n")
    (OUT / "source-evidence" / f"{batch}.json").write_text(
        json.dumps(source_evidence, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
