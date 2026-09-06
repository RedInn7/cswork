int main() {
 using namespace cswork;
 auto encode=[](const Json& j){std::ostringstream out;dump(out,j);return out.str();};
 const vector<string> inputs={"null","true","false","-9223372036854775808","9223372036854775807","0","1.25","-2.5e-100","[1,true,null,\"x\",{\"a\":[2,3]}]","\"\\uD83D\\uDE00\\n\\t\\u0000\""};
 for(const auto& input:inputs){
  auto first=Parser(input).parse();auto encoded=encode(first);auto roundtrip=Parser(encoded).parse();assert(encode(roundtrip)==encoded);
  Json copied(first);assert(encode(copied)==encoded);Json moved(std::move(copied));assert(encode(moved)==encoded);
  Json assigned;assigned=first;assert(encode(assigned)==encoded);Json movedAssigned;movedAssigned=std::move(assigned);assert(encode(movedAssigned)==encoded);
 }
 auto text=Parser(string("\"\\uD83D\\uDE00\\n\\t\\u0000\"")).parse().str();assert(text==string("\xf0\x9f\x98\x80\n\t\0",7));
 auto original=Parser(string("[1,[2,3]]")).parse();auto copied=original;copied.array()[1].array()[0]=Json(9);assert(encode(original)=="[1,[2,3]]");assert(encode(copied)=="[1,[9,3]]");
 for(const string invalid:{"","[1,","{\"x\":}","\"\\uD800\"","\"\\uDC00\"","truex","\"\\q\"","1e9999"}){bool rejected=false;try{Parser(invalid).parse();}catch(const exception&){rejected=true;}assert(rejected);}
 string deep(1026,'[');deep+="0";deep+=string(1026,']');bool rejected=false;try{Parser(deep).parse();}catch(const exception&){rejected=true;}assert(rejected);
 rejected=false;try{encode(Json(numeric_limits<double>::infinity()));}catch(const exception&){rejected=true;}assert(rejected);
 assert(Parser(string("true")).parse().integer()==1);assert(Parser(string("false")).parse().integer()==0);
 std::cout<<"JSON semantics passed\n";
}
