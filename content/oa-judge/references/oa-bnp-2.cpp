#include <cstdio>
#include <vector>
#include <algorithm>
using namespace std;
unsigned readNumber(){int c=getchar_unlocked();while(c<=32&&c!=EOF)c=getchar_unlocked();unsigned x=0;while(c>32&&c!=EOF){x=x*10+unsigned(c-'0');c=getchar_unlocked();}return x;}
int main(){
 unsigned n=readNumber();vector<unsigned>a(n);
 for(auto &v:a)v=readNumber();
 sort(a.begin(),a.end());
 long long answer=0,rank=0;
 for(unsigned i=0;i<n;i++){
  if(i && a[i]!=a[i-1])rank++;
  answer+=rank;
 }
 printf("%lld\n",answer);
}
