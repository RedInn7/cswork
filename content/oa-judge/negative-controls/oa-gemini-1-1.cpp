#include <cstdio>
#include <cstdint>
int main(){unsigned n,h,previous=0;uint64_t answer=0;scanf("%u",&n);while(n--){scanf("%u",&h);if(h>previous)answer+=uint64_t(h)-previous;previous=h;}printf("%llu\n",(unsigned long long)answer);}
