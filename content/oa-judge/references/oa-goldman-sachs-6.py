import sys
def solve(raw):
    values=list(map(int,raw.split()));n,cost,price=values[:3];lengths=values[3:3+n]
    best=0
    for sale in range(1,max(lengths)+1):
        revenue_per_piece=sale*price
        profit=0
        for rod in lengths:
            pieces,remainder=divmod(rod,sale)
            if pieces==0:continue
            if remainder:
                # Every saleable segment must be cut away from the scrap.
                gain=pieces*(revenue_per_piece-cost)
            else:
                # Either make all pieces (one fewer cut) or keep at most
                # pieces-1 and discard the rest after cutting each kept piece.
                all_gain=pieces*revenue_per_piece-(pieces-1)*cost
                partial_gain=max(0,(pieces-1)*(revenue_per_piece-cost))
                gain=max(0,all_gain,partial_gain)
            profit+=max(0,gain)
        best=max(best,profit)
    return str(best)
if __name__=='__main__':print(solve(sys.stdin.read()))
