import json
def solve(raw):
    s,H,L,U=json.loads(raw);trans=[{}];link=[-1];length=[0];occ=[0];first=[-1];last=0
    for index,c in enumerate(s):
        cur=len(trans);trans.append({});length.append(length[last]+1);link.append(0);occ.append(1);first.append(index);p=last
        while p>=0 and c not in trans[p]:trans[p][c]=cur;p=link[p]
        if p>=0:
            q=trans[p][c]
            if length[p]+1==length[q]:link[cur]=q
            else:
                clone=len(trans);trans.append(trans[q].copy());length.append(length[p]+1);link.append(link[q]);occ.append(0);first.append(first[q])
                while p>=0 and trans[p].get(c)==q:trans[p][c]=clone;p=link[p]
                link[q]=link[cur]=clone
        last=cur
    order=sorted(range(1,len(trans)),key=lambda i:length[i],reverse=True)
    for v in order:occ[link[v]]+=occ[v]
    counts={};valid=[False]*len(s)
    for i,c in enumerate(s):
        counts[c]=counts.get(c,0)+1
        if i>=L:
            old=s[i-L];counts[old]-=1
            if counts[old]==0:del counts[old]
        if i>=L-1:valid[i]=len(counts)<=U
    return str(max((occ[v] for v in order if length[link[v]]<L<=length[v] and valid[first[v]]),default=0))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
