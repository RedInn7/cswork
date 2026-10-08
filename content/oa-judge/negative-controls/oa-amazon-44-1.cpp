#include <cstdio>
#include <string>
#include <algorithm>
using namespace std;
int main(){string s;char buf[1<<16];size_t k;while((k=fread(buf,1,sizeof buf,stdin))>0)s.append(buf,k);
while(!s.empty()&&(s.back()=='\n'||s.back()=='\r'))s.pop_back();sort(s.begin(),s.end());s+='\n';fwrite(s.data(),1,s.size(),stdout);}
