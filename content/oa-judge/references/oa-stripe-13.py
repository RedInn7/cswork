from collections import defaultdict
def solve(raw):
    lines=raw.splitlines(); n=int(lines[0]); groups=defaultdict(list)
    for line in lines[1:n+1]:
        parts=line.split(None,3)
        ts=int(parts[0]); sender=parts[1]; receiver=parts[2]
        subject=parts[3] if len(parts)>3 else ""
        groups[sender].append((ts,receiver,subject))
    out=[]
    for sender in sorted(groups):
        out.append(f"sender: {sender}")
        for ts,receiver,subject in sorted(groups[sender]):
            out.append(f"{ts} {receiver}"+(f" {subject}" if subject else ""))
    return str(len(out))+"\n"+"\n".join(out)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
