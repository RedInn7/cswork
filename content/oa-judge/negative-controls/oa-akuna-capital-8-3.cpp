#include <cstdio>
#include <cstdint>
#include <deque>
using namespace std;
uint64_t readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();uint64_t x=0;while(c>32&&c!=EOF){x=x*10+uint64_t(c-'0');c=getchar_unlocked();}return x;}
struct Entry{uint64_t time;uint32_t size;};
int main(){
 uint64_t limit=readNumber(),window=readNumber(),n=readNumber(),sum=0,total=0;
 deque<Entry> accepted;
 for(uint64_t i=0;i<n;i++){
  uint64_t t=readNumber(),size=readNumber();
  while(!accepted.empty() && t-accepted.front().time>window){sum-=accepted.front().size;accepted.pop_front();}
  if(sum+size<=limit)total+=size;sum+=size;if(size)accepted.push_back({t,uint32_t(size)});
 }
 printf("%llu\n",static_cast<unsigned long long>(total));
}
