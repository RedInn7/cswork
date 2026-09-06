// Version 1 is an immutable ABI shared by the judge image and generated drivers.
// Changing this interface requires a new asset version, never replacing v1 in place.
#ifndef CSWORK_JSON_RUNTIME_V1_HPP
#define CSWORK_JSON_RUNTIME_V1_HPP
#include <bits/stdc++.h>
namespace cswork {
using namespace std;
struct Json {
    using Array=vector<Json>; using Object=map<string,Json>;
    variant<nullptr_t,bool,long long,double,string,Array,Object> value=nullptr;
    Json() noexcept; Json(nullptr_t); Json(bool); Json(long long); Json(int); Json(double);
    Json(string); Json(const char*); Json(Array); Json(Object);
    Json(const Json&); Json(Json&&) noexcept; ~Json();
    Json& operator=(const Json&); Json& operator=(Json&&) noexcept;
    bool null()const;
    const Array& array()const; Array& array();
    const Object& object()const;
    const Json& at(const string& key)const;
    bool has(const string& key)const;
    string str()const; long long integer()const; double number()const;
};
class Parser { const string& s; public: explicit Parser(const string& input):s(input){} Json parse(); };
void dump(ostream& out,const Json& j);
} // namespace cswork
#endif
