def solve(d):
    s=d[0];values=[1,10,100,1000,10000];dp={(-1,0):0}
    for old in reversed(s):
        original=ord(old)-65;new={}
        for (highest,used),score in dp.items():
            for c in range(5):
                changed=used+(c!=original)
                if changed>2:continue
                key=(max(highest,c),changed);candidate=score+(values[c] if c>=highest else -values[c]);new[key]=max(new.get(key,-10**30),candidate)
        dp=new
    return str(max(dp.values()))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
