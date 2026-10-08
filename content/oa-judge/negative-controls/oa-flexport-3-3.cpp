#include <cstdio>
#include <cstdint>
int main(){const uint64_t M=1000000007ULL;static char buf[1<<16];size_t k;bool first=true;uint64_t c=0,f=0,g=0;
while((k=fread(buf,1,sizeof buf,stdin))>0)for(size_t i=0;i<k;i++){char ch=buf[i];if(ch<'0'||ch>'9')continue;uint64_t d=ch-'0';
if(first){c=1;f=d;g=d;first=false;continue;}
uint64_t cd=c*d%M;f=(2*f+9*g+cd)%M;g=(10*g+2*cd)%M;c=c*2%M;}
printf("%llu\n",(unsigned long long)f);}
