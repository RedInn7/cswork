import sys
n,k=map(int,sys.stdin.read().split());print(26*pow(25,n-1,1000000007)%1000000007)