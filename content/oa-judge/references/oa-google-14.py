def solve(data):
    target=int(data[0]); dp=[0]*37; dp[0]=1
    for position in range(4):
        next_dp=[0]*37
        for total in range(37):
            for digit in range(10):
                if total+digit<37:next_dp[total+digit]+=dp[total]
        dp=next_dp
    return str(dp[target])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
