#include <cstdio>
#include <string>
#include <unordered_map>
using namespace std;
struct Account{string password;bool active=false;};
int main(){int n;if(scanf("%d",&n)!=1)return 0;unordered_map<string,Account> users;users.reserve(size_t(n)*2+1);
char op[16],name[16],pass[16];string out;out.reserve(size_t(n)*24);
for(int i=0;i<n;i++){scanf("%15s %15s",op,name);
if(op[0]=='r'){scanf("%15s",pass);auto r=users.try_emplace(name);if(r.second){r.first->second.password=pass;r.first->second.active=true;out+="Registered Successfully\n";}else out+="Username already exists\n";}
else if(op[3]=='i'){scanf("%15s",pass);auto it=users.find(name);if(it!=users.end()&&!it->second.active&&it->second.password==pass){it->second.active=true;out+="Logged In Successfully\n";}else out+="Login Unsuccessful\n";}
else{auto it=users.find(name);if(it!=users.end()&&it->second.active){it->second.active=false;out+="Logged Out Successfully\n";}else out+="Logout Unsuccessful\n";}}
fwrite(out.data(),1,out.size(),stdout);}
