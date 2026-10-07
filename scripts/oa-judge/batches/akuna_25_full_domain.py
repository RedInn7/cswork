#!/usr/bin/env python3
"""Regenerate Akuna25 only; explicit promotion preserves other batch entries."""
from pathlib import Path
import argparse
import copy
import hashlib
import json
import random
import runpy
import subprocess
import sys
import textwrap
import time

PID = "oa-akuna-capital-25"
BATCH = "akuna-rubrik-next"
EVIDENCE = "akuna-25-full-domain"
COMMIT = "e66f809f4c953bce129f68491726176615db6afc"
RAW_PATH = "fastprep/Akuna Capital/akuna-minimal-operations.md"
RAW_BLOB = "e971ed1ddf7c18b88549f41702180da3b91883d3"
RAW_SHA = "a36f5cb7ec99fccf209fd03d14113919d1b1a39f3f907a9fbdc3fdf2381e3689"
INPUT = "第一行 n；随后 n 行小写 ASCII 单词。完整原范围：1≤n≤100，2≤每词长度≤100000；不另限总字符数，合法总长可达10000000。标准输入输出为本站包装。"

def independent_pairs(word):
    edits = 0
    i = 0
    while i + 1 < len(word):
        if word[i] == word[i+1]:
            edits += 1
            i += 2
        else:
            i += 1
    return edits

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository-root", type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument("--output-root", type=Path)
    parser.add_argument("--upstream-root", type=Path, help="Defaults to repository-root fixed Git objects")
    parser.add_argument("--promote-existing", action="store_true", help="Replace only this ID in its existing batch and validation; requires subsequent whole-batch GoJudge")
    args = parser.parse_args()
    repo = args.repository_root.resolve()
    out = args.output_root.resolve() if args.output_root else repo / "content/oa-judge"
    upstream = args.upstream_root.resolve() if args.upstream_root else repo
    source = subprocess.check_output(["git","show",f"{COMMIT}:{RAW_PATH}"],cwd=upstream)
    metadata_root = out if args.promote_existing else repo / "content/oa-judge"
    existing_batch = json.loads((metadata_root/"batches"/f"{BATCH}.json").read_text())
    existing_validation = json.loads((metadata_root/"validation"/f"{BATCH}.json").read_text())
    assert sum(item["id"] == PID for item in existing_batch["items"]) == 1
    assert sum(item["id"] == PID for item in existing_validation["problems"]) == 1
    # Refuse ambiguous ownership before writing any artifacts.
    for manifest in (metadata_root/"batches").glob("*.json"):
        if manifest.stem != BATCH:
            document = json.loads(manifest.read_text())
            assert not any(item["id"] == PID for item in document.get("items",[])), f"duplicate ownership: {manifest}"
    blob = subprocess.check_output(["git","hash-object","--stdin"],input=source,cwd=repo).decode().strip()
    assert blob == RAW_BLOB and hashlib.sha256(source).hexdigest() == RAW_SHA
    assert "1 ≤ n ≤ 100" in source.decode() and "2 ≤ length of words[i] ≤ 10^5" in source.decode()
    module = runpy.run_path(str(repo / "scripts/oa-judge/batches/akuna_rubrik_next.py"))
    spec = copy.copy(next(s for s in module["SPECS"] if s["id"] == PID))
    catalog = module["SOURCES"][PID]
    spec["input"] = INPUT
    for folder in ("packages","references","oracles","mutants","negative-controls","editorials","candidate-batches","validation","source-evidence","resolutions"):
        (out/folder).mkdir(parents=True,exist_ok=True)
    def save(folder,name,obj):
        (out/folder/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
    def execute(code, raw):
        started=time.perf_counter()
        p=subprocess.run([sys.executable,"-I","-c",code],input=raw,text=True,capture_output=True,timeout=20,check=True)
        assert not p.stderr
        return p.stdout.rstrip("\n"),round(time.perf_counter()-started,4)
    def wrap(code):
        return textwrap.dedent(code).strip()+"\nif __name__ == '__main__':\n    import sys\n    print(solve(sys.stdin.read()))\n"
    reference=wrap(spec["code"])
    (out/"references"/f"{PID}.py").write_text(reference)
    rng=random.Random(20261008)
    selected={}
    for words in spec["samples"]:
        selected[spec["encode"](words)]=words
    while len(selected)<163:
        words=spec["random"](rng)
        selected[spec["encode"](words)]=words
    oracles=[]
    for raw,words in selected.items():
        expected=spec["oracle"](words)
        assert " ".join(map(str,map(independent_pairs,words)))==expected
        assert execute(reference,raw)[0]==expected
        oracles.append({"input":raw,"expectedOutput":expected+"\n"})
    tests=oracles[:33]
    boundaries=[
        ("100个十万字符全相同单词",["a"*100000]*100,[50000]*100),
        ("100个十万字符交替与混合游程",["ab"*50000,"a"*99999+"b","aabb"*25000,"abcde"*20000]*25,[0,49999,50000,0]*25),
    ]
    evidence=[]
    for name,words,expected_values in boundaries:
        assert len(words)==100 and all(len(w)==100000 for w in words)
        actual_values=[independent_pairs(w) for w in words]
        assert actual_values==expected_values
        raw=spec["encode"](words);expected=" ".join(map(str,expected_values))
        actual,seconds=execute(reference,raw)
        assert actual==expected
        tests.append({"input":raw,"expectedOutput":expected+"\n","name":name})
        evidence.append({"name":name,"wordCount":100,"maxWordLength":100000,"totalCharacters":10000000,"inputBytes":len(raw.encode()),"outputBytes":len((expected+"\n").encode()),"wallSeconds":seconds,"oracle":"independent nonoverlapping adjacent-pair selection plus closed-form expectations"})
    cases=[{"name":row.get("name",f"独立验证 {i+1}"),"input":row["input"],"expectedOutput":row["expectedOutput"],"hidden":i>=3,"weight":1} for i,row in enumerate(tests)]
    mutants=[];kills=[]
    for index,(name,code) in enumerate(spec["mutants"],1):
        mutant=wrap(code);rejected=[]
        for i,row in enumerate(cases[:33]):
            if execute(mutant,row["input"])[0]!=row["expectedOutput"].strip():
                rejected.append(i)
        assert rejected
        mutants.append({"name":name,"code":mutant})
        kills.append({"name":name,"rejectedByCases":rejected,"normalExitVerified":True})
        (out/"negative-controls"/f"{PID}-{index}.py").write_text(mutant)
    original=json.loads((repo/"content/oa-judge/packages"/f"{PID}.json").read_text())
    problem=original["problem"];problem["input"]=INPUT
    problem["description"]=spec["desc"]+"\n\n完整原始范围保留；本站仅包装标准输入输出。"
    normalized=module["normalize_package"]({"schemaVersion":1,"problem":problem,"cases":cases})
    package=json.loads(normalized)
    editorial="## 思路\n\n"+spec["idea"]+"\n\n## 正确性证明\n\n长度L的同字符游程包含floor(L/2)对不相交相邻位置，每对至少改一个位置，因此下界为floor(L/2)。隔一个位置替换一次，并避开两侧字符即可达到下界；26个字母足以选择，游程边界不会引入新冲突。各游程相加得到最优值。\n\n## 完整范围与复杂度\n\n完整保留100个单词、每词100000字符，总字符可达10000000。总时间O(S)，算法额外空间O(1)；实际输入分行另需O(S)。最大标准输入10000104字节，小于32MiB；不以输入预算为由缩域。\n\n## 独立验证\n\n小例使用26字母最小替换DP；大例用不相交相邻冲突配对及闭式期望交叉验证，两个100×100000真实用例进入正式题包。"
    authored=[{"language":"python","code":reference}]
    entry={"id":PID,"sourceContentHash":catalog["contentHash"],"packageChecksum":hashlib.sha256(normalized.encode()).hexdigest(),"editorial":editorial,"authoredSolutions":authored}
    save("packages",f"{PID}.json",package)
    save("oracles",f"{PID}.json",oracles)
    save("mutants",f"{PID}.json",mutants)
    save("editorials",f"{PID}.json",{"schemaVersion":1,"id":PID,"title":problem["title"],"explanation":editorial,"solutions":authored,"sourceUrl":catalog["sourceUrl"],"sourceContentHash":catalog["contentHash"]})
    existing_batch["items"] = [entry if item["id"] == PID else item for item in existing_batch["items"]]
    save("batches" if args.promote_existing else "candidate-batches",f"{BATCH}.json",existing_batch)
    save("source-evidence",f"{EVIDENCE}.json",{"schemaVersion":1,"repository":"https://github.com/RedInn7/OA-Master","sourceCommit":COMMIT,"items":[{"id":PID,"rawPath":RAW_PATH,"rawGitBlob":blob,"rawSha256":RAW_SHA,"sourceContentHash":catalog["contentHash"],"sourceUrl":catalog["sourceUrl"],"fullBounds":"1<=n<=100; 2<=each length<=100000; no extra total-character cap","upstreamCodeExecuted":False}]})
    validation_entry={"id":PID,"oracleCases":163,"uniqueOracleInputs":163,"formalCases":len(cases),"publicCases":3,"hiddenCases":len(cases)-3,"negativeControls":kills,"referenceSha256":hashlib.sha256(reference.encode()).hexdigest(),"largeBoundaries":evidence,"requiresWholeBatchGoJudge":True}
    existing_validation["problems"]=[validation_entry if item["id"] == PID else item for item in existing_validation["problems"]]
    save("validation",f"{BATCH}.json",existing_validation)
    save("validation",f"{EVIDENCE}.json",{"schemaVersion":1,"problems":[validation_entry],"note":"Offline only; original batch ownership retained. Whole-batch GoJudge must refresh the stale prior report."})
    save("resolutions",f"{EVIDENCE}.json",{"schemaVersion":1,"items":[{"id":PID,"batch":BATCH,"sourceContentHash":catalog["contentHash"],"previousReason":"Site restricted total characters to 1000000 despite original 100*100000 range.","reason":"Restore full source domain and real 10000000-character formal boundaries; no upstream code executed."}]})
    print(json.dumps({"id":PID,"formalCases":len(cases),"oracleCases":163,"largeBoundaries":evidence,"outputDirectory":str(out),"existingBatchUpdated":args.promote_existing,"batch":BATCH,"otherEntriesPreserved":True},ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
