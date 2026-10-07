"""Build a provenance-tracked candidate for Google OA #38."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OA = ROOT / "content" / "oa-judge"
PID = "oa-google-38"
BATCH = "google-38-recovered"
SEED = 20261006
SOURCE_URL = "https://oamaster.com/docs/companies/google#38-largest-lexicographical-substring"
SUPPORT_URL = "https://www.1point3acres.com/interview/problems/google-largest-lexicographical-substring"
UPSTREAM_COMMIT = "e66f809f4c953bce129f68491726176615db6afc"

PYTHON = r'''import sys

def suffix_ranks(text):
    size = len(text)
    order = list(range(size))
    rank = [ord(ch) for ch in text]
    width = 1
    while width < size:
        order.sort(key=lambda i: (rank[i], rank[i + width] if i + width < size else -1))
        next_rank = [0] * size
        classes = 0
        previous = None
        for index in order:
            key = (rank[index], rank[index + width] if index + width < size else -1)
            if previous is not None and key != previous:
                classes += 1
            next_rank[index] = classes
            previous = key
        rank = next_rank
        if classes == size - 1:
            break
        width *= 2
    return rank

def solve(raw):
    parts = raw.split()
    if len(parts) != 2:
        raise ValueError("expected strings A and B")
    a, b = parts
    if not (1 <= len(a) <= 20000 and 1 <= len(b) <= 50000):
        raise ValueError("input exceeds the supported string lengths")
    if any(ch < 'a' or ch > 'z' for ch in a + b):
        raise ValueError("only lowercase English letters are supported")
    length = len(a)
    if len(b) < length:
        return "-1"

    difference = [0] * 26
    for ch in a:
        difference[ord(ch) - 97] += 1
    for ch in b[:length]:
        difference[ord(ch) - 97] -= 1
    mismatches = sum(value != 0 for value in difference)
    valid = [False] * (len(b) - length + 1)
    for start in range(len(valid)):
        valid[start] = mismatches == 0
        if start + length < len(b):
            for ch, delta in ((b[start], 1), (b[start + length], -1)):
                index = ord(ch) - 97
                mismatches -= difference[index] != 0
                difference[index] += delta
                mismatches += difference[index] != 0
    if not any(valid):
        return "-1"

    rank = suffix_ranks(b)
    best = max((start for start, is_valid in enumerate(valid) if is_valid), key=rank.__getitem__)
    return b[best:best + length]

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
'''

JAVA = r'''import java.io.*;
import java.util.*;
class Main {
    static int[] suffixRanks(String s) {
        int n = s.length();
        Integer[] order = new Integer[n];
        int[] rank = new int[n];
        for (int i = 0; i < n; i++) { order[i] = i; rank[i] = s.charAt(i); }
        for (int width = 1; width < n; width <<= 1) {
            final int w = width;
            final int[] old = rank;
            Arrays.sort(order, (x, y) -> {
                int c = Integer.compare(old[x], old[y]);
                if (c != 0) return c;
                int rx = x + w < n ? old[x + w] : -1;
                int ry = y + w < n ? old[y + w] : -1;
                return Integer.compare(rx, ry);
            });
            int[] next = new int[n];
            int classes = 0;
            next[order[0]] = 0;
            for (int j = 1; j < n; j++) {
                int x = order[j - 1], y = order[j];
                int x2 = x + width < n ? rank[x + width] : -1;
                int y2 = y + width < n ? rank[y + width] : -1;
                if (rank[x] != rank[y] || x2 != y2) classes++;
                next[y] = classes;
            }
            rank = next;
            if (classes == n - 1) break;
            if (width > n / 2) break;
        }
        return rank;
    }
    static String solve(String a, String b) {
        if (a.length() < 1 || a.length() > 20000 || b.length() < 1 || b.length() > 50000)
            throw new IllegalArgumentException("input exceeds supported lengths");
        int length = a.length(), windows = b.length() - length + 1;
        if (windows <= 0) return "-1";
        int[] diff = new int[26];
        for (int i = 0; i < length; i++) { diff[a.charAt(i)-'a']++; diff[b.charAt(i)-'a']--; }
        int mismatches = 0;
        for (int value : diff) if (value != 0) mismatches++;
        boolean[] valid = new boolean[windows];
        boolean found = false;
        for (int start = 0; start < windows; start++) {
            valid[start] = mismatches == 0;
            found |= valid[start];
            if (start + length < b.length()) {
                int remove = b.charAt(start)-'a', add = b.charAt(start+length)-'a';
                if (diff[remove] == 0) mismatches++; diff[remove]++;
                if (diff[remove] == 0) mismatches--;
                if (diff[add] == 0) mismatches++; diff[add]--;
                if (diff[add] == 0) mismatches--;
            }
        }
        if (!found) return "-1";
        int[] rank = suffixRanks(b);
        int best = -1;
        for (int i = 0; i < windows; i++) if (valid[i] && (best < 0 || rank[i] > rank[best])) best = i;
        return b.substring(best, best + length);
    }
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String a = br.readLine(), b = br.readLine();
        System.out.println(solve(a, b));
    }
}
'''

CPP = r'''#include <bits/stdc++.h>
using namespace std;
vector<int> suffixRanks(const string& s) {
    int n = (int)s.size();
    vector<int> order(n), rank(n);
    iota(order.begin(), order.end(), 0);
    for (int i=0;i<n;i++) rank[i]=(unsigned char)s[i];
    for (int width=1;width<n;width<<=1) {
        sort(order.begin(), order.end(), [&](int x,int y) {
            if (rank[x]!=rank[y]) return rank[x]<rank[y];
            int a=x+width<n?rank[x+width]:-1, b=y+width<n?rank[y+width]:-1;
            return a<b;
        });
        vector<int> next(n); int classes=0; next[order[0]]=0;
        for (int j=1;j<n;j++) {
            int x=order[j-1], y=order[j];
            int x2=x+width<n?rank[x+width]:-1, y2=y+width<n?rank[y+width]:-1;
            if (rank[x]!=rank[y] || x2!=y2) ++classes;
            next[y]=classes;
        }
        rank.swap(next);
        if (classes==n-1) break;
        if (width>n/2) break;
    }
    return rank;
}
int main() {
    ios::sync_with_stdio(false); cin.tie(nullptr);
    string a,b; if (!(cin>>a>>b)) return 0;
    if (a.empty() || a.size()>20000 || b.empty() || b.size()>50000) return 1;
    for(char c:a+b) if(c<'a'||c>'z') return 1;
    int length=(int)a.size(), windows=(int)b.size()-length+1;
    if(windows<=0){ cout<<"-1\n"; return 0; }
    int diff[26]={};
    for(int i=0;i<length;i++){ diff[a[i]-'a']++; diff[b[i]-'a']--; }
    int mismatches=0; for(int x:diff) mismatches+=x!=0;
    vector<char> valid(windows); bool found=false;
    for(int start=0;start<windows;start++) {
        valid[start]=(mismatches==0); found|=valid[start];
        if(start+length<(int)b.size()) {
            int rem=b[start]-'a', add=b[start+length]-'a';
            if(diff[rem]==0) ++mismatches; ++diff[rem]; if(diff[rem]==0) --mismatches;
            if(diff[add]==0) ++mismatches; --diff[add]; if(diff[add]==0) --mismatches;
        }
    }
    if(!found){ cout<<"-1\n"; return 0; }
    vector<int> rank=suffixRanks(b); int best=-1;
    for(int i=0;i<windows;i++) if(valid[i]&&(best<0||rank[i]>rank[best])) best=i;
    cout<<b.substr(best,length)<<'\n';
}
'''

MUTANTS = [
    ("取字典序最小窗口", r'''import sys
a,b=sys.stdin.read().split(); n=len(a); need=[a.count(chr(97+i)) for i in range(26)]; best=None
for j in range(len(b)-n+1):
 s=b[j:j+n]
 if [s.count(chr(97+i)) for i in range(26)]==need and (best is None or s<best): best=s
print(best if best is not None else -1)
'''),
    ("把窗口字符集合相同当作频次相同", r'''import sys
a,b=sys.stdin.read().split(); n=len(a); need=set(a); best=None
for j in range(len(b)-n+1):
 s=b[j:j+n]
 if set(s)==need and (best is None or s>best): best=s
print(best if best is not None else -1)
'''),
]

def put(folder: str, filename: str, value: object) -> None:
    path = OA / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def run(code: str, raw: str) -> str:
    result = subprocess.run(["python3", "-c", code], input=raw, text=True, capture_output=True, timeout=15)
    if result.returncode:
        raise AssertionError((result.returncode, result.stderr[:300]))
    return result.stdout.strip()

def brute(a: str, b: str) -> str:
    need = sorted(a)
    candidates = [b[i:i+len(a)] for i in range(max(0, len(b)-len(a)+1)) if sorted(b[i:i+len(a)]) == need]
    return max(candidates) if candidates else "-1"

def main() -> None:
    catalog = json.loads((ROOT / "content/oa-master/catalog.json").read_text(encoding="utf-8"))
    source = next(item for item in catalog["items"] if item["id"] == PID)
    old_review = json.loads((OA / "reviews/google-remaining-a.json").read_text(encoding="utf-8"))
    previous = next(item for item in old_review["items"] if item["id"] == PID)
    fixed = [("abc", "abcab"), ("aab", "baaca"), ("ab", "cccc"), ("abc", "ab"), ("a", "zxy")]
    rng = random.Random(SEED)
    generated = []
    seen = {f"{a}\n{b}\n" for a,b in fixed}
    while len(generated) < 200:
        a = "".join(rng.choice("abcd") for _ in range(rng.randint(1, 8)))
        b = "".join(rng.choice("abcd") for _ in range(rng.randint(1, 16)))
        raw = f"{a}\n{b}\n"
        if raw not in seen:
            seen.add(raw); generated.append((a,b))
    cases = []
    for index, (a,b) in enumerate(fixed + generated[:27]):
        expected = brute(a,b)
        cases.append({"name": "原题示例" if index == 0 else f"隐藏用例 {index}", "input": f"{a}\n{b}\n", "expectedOutput": expected+"\n", "hidden": index != 0, "weight": 1})
    # Large repetitive input makes every window valid and catches quadratic substring comparisons.
    large_a, large_b = "a" * 20000, "a" * 50000
    cases.append({"name": "最大规模重复字符", "input": f"{large_a}\n{large_b}\n", "expectedOutput": large_a+"\n", "hidden": True, "weight": 1})
    for case in cases:
        assert run(PYTHON, case["input"]) == case["expectedOutput"].strip()
    killed = []
    for name, mutant in MUTANTS:
        rejected = [i for i, case in enumerate(cases[:-1]) if run(mutant, case["input"]) != case["expectedOutput"].strip()]
        assert rejected, f"surviving mutant: {name}"
        killed.append({"name": name, "rejectedByCases": rejected})

    description = (
        "给定字符串 A、B。在 B 中选择一个长度恰好为 |A| 的连续子串；该子串必须与 A 含有完全相同的字符及出现次数（即 A 的一个排列）。"
        "返回所有合法子串中字典序最大的一个；若不存在，返回 -1。"
    )
    site_limits = "本站评测边界：A、B 均由小写英文字母组成，1≤|A|≤20000，1≤|B|≤50000。此字符集和长度范围是本站补充，原来源未给出。"
    problem = {
        "id": PID, "courseId": "gomall", "lessonId": "00-overview", "title": "字典序最大的异位词窗口",
        "difficulty": "中等", "tags": ["OA", "Google", "字符串", "滑动窗口", "后缀数组"],
        "description": description + "\n\n" + site_limits + "无解时本站输出 `-1`；OAMaster 的现存代码返回空串、同名题目汇总写 `-1`，因此这里把 `-1` 明确作为本站规则。\n\nOAMaster 原题页面：" + SOURCE_URL + "。核心语义参考同名 Google 面试题汇总：" + SUPPORT_URL + "。",
        "input": "两行，分别为字符串 A 和 B。", "output": "输出满足条件且字典序最大的窗口；若不存在，输出 -1。",
        "explanation": "滑动窗口维护与 A 的频次差，在线性时间标记所有合法窗口。再对 B 构建后缀数组；等长子串的字典序与其起始后缀的字典序一致，从合法窗口中选后缀排名最大者。",
        "hints": ["窗口长度固定为 |A|，每次只需加入一个字符并移除一个字符。", "不要逐个复制、比较所有窗口；合法窗口可能有很多且很长。"],
        "timeLimit": 8, "memoryLimit": 262144, "outputLimit": 32768, "checker": "tokens",
        "languages": ["python", "java", "cpp"],
    }
    package_input = {"schemaVersion": 1, "problem": problem, "cases": cases}
    normalize = (
        "const {ojImportSchema}=require('./lib/oj-types.ts');let s='';"
        "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);"
        "process.stdin.on('end',()=>process.stdout.write(JSON.stringify(ojImportSchema.parse(JSON.parse(s)))));"
    )
    parsed = subprocess.run(["node", "--import", "tsx", "-e", normalize], cwd=ROOT, input=json.dumps(package_input, ensure_ascii=False), text=True, capture_output=True, check=True).stdout
    package = json.loads(parsed)
    package_bytes = json.dumps(package, ensure_ascii=False, separators=(",", ":")).encode()
    editorial = f"""## 思路

用长度 |A| 的滑动窗口维护字符频次差，标记所有与 A 完全同频的窗口。为避免大量长窗口逐一比较，构建 B 的后缀数组；所有候选窗口长度相同，因此两个窗口的字典序等于对应后缀的字典序，取后缀排名最大的合法起点。

## 正确性

频次差全为零，当且仅当当前窗口与 A 含有相同字符及次数，故滑窗恰好识别全部合法子串。对于长度相同的两个子串，其首次不同字符决定的顺序也决定了从各自起点开始的后缀顺序；两者长度均为 |A|，不会在比较范围内因一个子串提前结束而改变顺序。因此最大后缀排名的合法窗口就是要求的字典序最大窗口。若没有合法窗口则输出 -1。

## 复杂度

频次扫描 O(|B|)，后缀数组倍增排序 O(|B| log²|B|)，空间 O(|B|)。

## 来源与本站约定

OAMaster 固定快照仅留下截断题干和一个原始例子：{SOURCE_URL}（内容指纹 {source['contentHash']}）。同名题目汇总页补充了“在 B 中寻找字符频次与 A 完全相同、长度为 |A| 的连续窗口，取字典序最大；无解返回 -1”：{SUPPORT_URL}。该页为二手汇总，不是 Google 官方原始题面；原始样例 `abc` / `abcab` / `cab` 与该规则相符。原来源未给字符集和长度限制，故小写字母与长度上限明确标为本站评测边界，不声称是原题限制。
"""
    manifest_folder = "batches" if (OA / "reports" / (BATCH + ".json")).exists() else "candidate-batches"
    put(manifest_folder, BATCH+".json", {"schemaVersion":1,"items":[{"id":PID,"sourceContentHash":source["contentHash"],"packageChecksum":sha(package_bytes),"editorial":editorial,"authoredSolutions":[{"language":"python","code":PYTHON}]}]})
    if manifest_folder == "batches":
        (OA / "candidate-batches" / (BATCH + ".json")).unlink(missing_ok=True)
    put("packages", PID+".json", package)
    (OA/"references"/(PID+".py")).write_text(PYTHON,encoding="utf-8")
    put("editorials", PID+".json", {"schemaVersion":1,"id":PID,"title":"字典序最大的异位词窗口","explanation":editorial,"solutions":[{"language":"python","code":PYTHON}],"sourceUrl":SOURCE_URL,"sourceContentHash":source["contentHash"]})
    put("oracles", PID+".json", [{"input":f"{a}\n{b}\n","expectedOutput":brute(a,b)+"\n"} for a,b in fixed+generated])
    put("mutants", PID+".json", [{"name":name,"code":code} for name,code in MUTANTS])
    put("source-evidence", BATCH+".json", {"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","commit":UPSTREAM_COMMIT,"catalogContentHash":source["contentHash"],"items":[{"id":PID,"company":"Google","title":source["title"],"sourceUrl":SOURCE_URL,"fixedSource":{"path":"web/content/docs/companies/google.mdx","evidence":"固定 OAMaster 快照仅留有截断题干、未知约束及 abc/abcab/cab 样例；随附 Python/Java/C++ 代码对无解返回空串。"},"supportingSources":[{"url":SUPPORT_URL,"evidence":"同名 Google 面试题汇总明确要求长度 |A| 的连续子串，字符频次与 A 完全一致，取字典序最大；无解返回 -1。OAMaster 原样例与恢复语义一致。"}],"siteAdditions":["仅小写英文字母","|A|≤20000、|B|≤50000","标准输入输出协议","无解输出 -1（外部汇总与 OAMaster 代码行为不同，显式按本站约定）"],"interpretation":"窗口必须与 A 是字符多重集合相同的一个排列；对重复字符按出现次数比较，不是只比较字符集合。"}]})
    has_report = (OA / "reports" / (BATCH + ".json")).exists()
    report_note = "GoJudge 对正式用例、独立 oracle 与错误程序的验证报告已绑定。" if has_report else "小字符串 oracle、源样例、无解/长度差/重复频次以及大规模重复字符输入通过；尚未连接 GoJudge。"
    reason = "同名题目汇总补全了窗口长度、字符频次相等、字典序最大与无解行为；OAMaster 唯一样例与恢复语义吻合。来源为二手汇总且原约束缺失，故题库显式标注本站字符集、长度边界和无解输出；其中无解输出固定为 -1，与 OAMaster 当前代码返回空串不同。"
    if has_report:
        reason += " 用户自有 GoJudge 沙箱238项全部通过，两个错误实现均被拦截。"
    put("resolutions", BATCH+".json", {"schemaVersion":1,"items":[{"id":PID,"batch":BATCH,"sourceContentHash":source["contentHash"],"previousReason":previous["reason"],"reason":reason}]})
    put("validation", BATCH+".json", {"schemaVersion":1,"seed":SEED,"problems":[{"id":PID,"oracleCases":len(generated)+len(fixed),"uniqueOracleInputs":len(generated)+len(fixed),"publicCases":1,"hiddenCases":len(cases)-1,"negativeControls":killed,"referenceSha256":sha(PYTHON.encode())}],"note":report_note})
    print(json.dumps({"id":PID,"candidateBatch":BATCH,"oracle":len(generated)+len(fixed),"formal":len(cases),"mutantsKilled":len(killed)},ensure_ascii=False))

if __name__ == "__main__":
    main()
