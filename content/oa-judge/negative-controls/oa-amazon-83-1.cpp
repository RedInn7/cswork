#include <iostream>
#include <numeric>
using namespace std;
int main(){long long n,x,g=0;cin>>n;for(long long i=0;i<n;++i){cin>>x;g=gcd(g,x);}cout<<g*n<<'\n';}
