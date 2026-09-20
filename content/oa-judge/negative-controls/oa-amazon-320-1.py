def solve(d):
    import json
    s=d[0] if d else '';parts=s.split('|');n=len(parts);out=[None]*n;values=set();digits=set('0123456789');letters=set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
    for part in parts:
        if len(part)<5 or not set(part[:4])<=digits or not set(part[4:])<=letters:return '["Invalid configuration"]'
        index=int(part[:4]);value=part[4:]
        if not 1<=index<=n or out[index-1] is not None or False:return '["Invalid configuration"]'
        out[index-1]=value;values.add(value)
    return json.dumps(out,separators=(',',':'))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
