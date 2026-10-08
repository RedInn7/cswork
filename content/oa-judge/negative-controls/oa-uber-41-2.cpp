#include <cstdio>
#include <string>
#include <vector>
using namespace std;
int main(){int n;if(scanf("%d",&n)!=1)return 0;vector<string>w(n);char buf[32];for(int i=0;i<n;i++){scanf("%31s",buf);w[i]=buf;}
string out;out.reserve(3*n);for(int i=0;i+1<n||(n==1&&i==0);i++){out+=w[i][0];out+=w[(i+1)%n].back();out+='\n';}
fwrite(out.data(),1,out.size(),stdout);}
