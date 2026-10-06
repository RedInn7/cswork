import sys
n=int(sys.stdin.read()); M=10**9+7; print(pow((pow(3,n,M)-3)%M,3,M))
