package main

import (
	csjson "encoding/json"
	csfmt "fmt"
	csos "os"
	csreflect "reflect"
	csstrings "strings"
)

var csnodes []csreflect.Value
var csids = map[uintptr]int{}

func csdecode(v interface{}, t csreflect.Type) csreflect.Value {
	if v == nil {
		return csreflect.Zero(t)
	}
	if m, ok := v.(map[string]interface{}); ok {
		if id, ok := m["$ref"]; ok {
			return csnodes[int(id.(float64))]
		}
	}
	r := csreflect.New(t).Elem()
	switch t.Kind() {
	case csreflect.Slice:
		a := v.([]interface{})
		r = csreflect.MakeSlice(t, len(a), len(a))
		for i, x := range a {
			r.Index(i).Set(csdecode(x, t.Elem()))
		}
	case csreflect.Int, csreflect.Int8, csreflect.Int16, csreflect.Int32, csreflect.Int64:
		if s, ok := v.(string); ok {
			r.SetInt(int64([]rune(s)[0]))
		} else {
			r.SetInt(int64(v.(float64)))
		}
	case csreflect.Uint, csreflect.Uint8, csreflect.Uint16, csreflect.Uint32, csreflect.Uint64:
		if s, ok := v.(string); ok {
			r.SetUint(uint64([]byte(s)[0]))
		} else {
			r.SetUint(uint64(v.(float64)))
		}
	case csreflect.Float32, csreflect.Float64:
		r.SetFloat(v.(float64))
	case csreflect.Bool:
		r.SetBool(v.(bool))
	case csreflect.String:
		r.SetString(v.(string))
	default:
		panic("Unsupported argument " + t.String())
	}
	return r
}
func csencode(v csreflect.Value) interface{} {
	if !v.IsValid() {
		return nil
	}
	if v.Kind() == csreflect.Interface {
		if v.IsNil() {
			return nil
		}
		return csencode(v.Elem())
	}
	switch v.Kind() {
	case csreflect.Ptr:
		if v.IsNil() {
			return nil
		}
		p := v.Pointer()
		id, ok := csids[p]
		if !ok {
			id = len(csnodes)
			csids[p] = id
			csnodes = append(csnodes, v)
		}
		return map[string]interface{}{"$ref": id}
	case csreflect.Slice, csreflect.Array:
		a := make([]interface{}, v.Len())
		for i := range a {
			a[i] = csencode(v.Index(i))
		}
		return a
	case csreflect.Uint8:
		return string([]byte{byte(v.Uint())})
	case csreflect.String:
		return v.String()
	case csreflect.Bool:
		return v.Bool()
	case csreflect.Int, csreflect.Int8, csreflect.Int16, csreflect.Int32, csreflect.Int64:
		return v.Int()
	case csreflect.Uint, csreflect.Uint16, csreflect.Uint32, csreflect.Uint64:
		return v.Uint()
	case csreflect.Float32, csreflect.Float64:
		return v.Float()
	}
	panic("Unsupported result " + v.Type().String())
}
func csargs(raw []interface{}, f csreflect.Value) []csreflect.Value {
	t := f.Type()
	if len(raw) != t.NumIn() {
		panic("Argument count mismatch")
	}
	a := make([]csreflect.Value, len(raw))
	for i, x := range raw {
		a[i] = csdecode(x, t.In(i))
	}
	return a
}
func cscall(f interface{}, raw []interface{}) (interface{}, []csreflect.Value) {
	fn := csreflect.ValueOf(f)
	a := csargs(raw, fn)
	out := fn.Call(a)
	if len(out) == 0 {
		return nil, a
	}
	return csencode(out[0]), a
}
func main() {
	var q map[string]interface{}
	if e := csjson.NewDecoder(csos.Stdin).Decode(&q); e != nil {
		panic(e)
	}
	ns := q["nodes"].([]interface{})
	for _, x := range ns {
		n := x.(map[string]interface{})
		var o interface{}
		switch n["type"] {
		case "TreeNode":
			o = &TreeNode{}
		case "ListNode":
			o = &ListNode{}
		case "Node":
			o = &Node{}
		case "Interval":
			o = &Interval{}
		case "MountainArray":
			o = &MountainArray{}
		default:
			panic("Unknown node")
		}
		v := csreflect.ValueOf(o)
		csids[v.Pointer()] = len(csnodes)
		csnodes = append(csnodes, v)
	}
	for i, x := range ns {
		for k, v := range x.(map[string]interface{})["fields"].(map[string]interface{}) {
			f := csnodes[i].Elem().FieldByName(csstrings.ToUpper(k[:1]) + k[1:])
			if f.IsValid() && f.CanSet() {
				f.Set(csdecode(v, f.Type()))
			}
		}
	}
	var result interface{}
	args := []csreflect.Value{}
	// CSWORK_DISPATCH
	encodedArgs := make([]interface{}, len(args))
	for i, v := range args {
		encodedArgs[i] = csencode(v)
	}
	encodedNodes := []interface{}{}
	for i := 0; i < len(csnodes); i++ {
		o := csnodes[i].Elem()
		fields := map[string]interface{}{}
		for j := 0; j < o.NumField(); j++ {
			name := o.Type().Field(j).Name
			if name == "Calls" {
				continue
			}
			fields[csstrings.ToLower(name[:1])+name[1:]] = csencode(o.Field(j))
		}
		encodedNodes = append(encodedNodes, map[string]interface{}{"id": i, "type": o.Type().Name(), "fields": fields})
	}
	b, e := csjson.Marshal(map[string]interface{}{"result": result, "args": encodedArgs, "nodes": encodedNodes})
	if e != nil {
		panic(e)
	}
	if e = csos.WriteFile("cswork-result.json", b, 0600); e != nil {
		panic(e)
	}
	_ = csfmt.Sprint
}
