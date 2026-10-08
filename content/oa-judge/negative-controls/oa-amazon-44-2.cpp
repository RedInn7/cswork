#include <cstdio>
int main(){char buf[1<<16];size_t k;while((k=fread(buf,1,sizeof buf,stdin))>0)fwrite(buf,1,k,stdout);}
