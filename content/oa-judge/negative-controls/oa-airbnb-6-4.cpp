#include <cstdio>
#include <string>
using namespace std;
int main(){string in;char buf[1<<16];size_t r;while((r=fread(buf,1,sizeof buf,stdin))>0)in.append(buf,r);
size_t p=0;long n=0,w=0;while(p<in.size()&&in[p]==' ')p++;while(p<in.size()&&in[p]>='0'&&in[p]<='9')n=n*10+(in[p++]-'0');
while(p<in.size()&&in[p]==' ')p++;while(p<in.size()&&in[p]>='0'&&in[p]<='9')w=w*10+(in[p++]-'0');
while(p<in.size()&&in[p]!='\n')p++;if(p<in.size())p++;
string border="+"+string(w+2,'-')+"+\n";string out;out.reserve((size_t)(2*n+1)*(w+5));
for(long i=0;i<n;i++){size_t e=in.find('\n',p);if(e==string::npos)e=in.size();size_t len=e-p;
 out+=border;out+="| ";out.append(in,p,len);out.append(w-len,' ');out+=" |\n";p=e<in.size()?e+1:e;}
out+=border;fwrite(out.data(),1,out.size(),stdout);}
