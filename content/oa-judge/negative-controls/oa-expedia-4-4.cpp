#include <cstdio>
#include <cstdint>
#include <vector>
#include <array>
using namespace std;
uint32_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();uint32_t x=0;while(c>32&&c!=EOF){x=x*10+uint32_t(c-'0');c=getchar_unlocked();}return x;}
int main(){uint32_t n=readNumber();vector<uint32_t>a(size_t(n)*2),scratch(size_t(n)*2);
for(uint32_t i=0;i<n;i++){uint32_t left=readNumber(),right=readNumber();a[size_t(i)*2]=left;a[size_t(i)*2+1]=right+uint32_t(1);}
array<uint32_t,65536> count;
for(unsigned shift:{0u,16u}){count.fill(0);for(uint32_t value:a)++count[(value>>shift)&65535u];uint32_t sum=0;
for(uint32_t &v:count){uint32_t old=v;v=sum;sum+=old;}
for(uint32_t value:a)scratch[count[(value>>shift)&65535u]++]=value;a.swap(scratch);}
uint64_t answer=0;for(size_t i=0;i<a.size();i+=2){uint64_t left=a[i],end=a[i+1];answer+=(left+end-1)*(end-left)/2;}
uint32_t low=uint32_t(answer);long long wrong=low<2147483648u?low:(long long)low-4294967296LL;printf("%lld\n",wrong);}
