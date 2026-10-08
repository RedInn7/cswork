#include <cstdio>
#include <cstdint>
#include <algorithm>
using namespace std;
uint32_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();uint32_t x=0;while(c>32&&c!=EOF){x=x*10+uint32_t(c-'0');c=getchar_unlocked();}return x;}
int main(){uint32_t n=readNumber(),left=2147483647u,right=0;for(uint32_t i=0;i<n;i++){uint32_t a=readNumber(),b=readNumber();left=min(left,a);right=max(right,b);}uint64_t answer=n?(uint64_t(left)+right)*(uint64_t(right)-left+1)/2:0;printf("%llu\n",(unsigned long long)answer);}
