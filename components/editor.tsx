'use client';
import {useEffect,useRef} from 'react';
import {EditorView,keymap,lineNumbers,highlightActiveLine} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {defaultKeymap,history,historyKeymap,indentWithTab} from '@codemirror/commands';
import {syntaxHighlighting,defaultHighlightStyle,StreamLanguage,bracketMatching} from '@codemirror/language';
import {python} from '@codemirror/lang-python';
import {java} from '@codemirror/lang-java';
import {cpp} from '@codemirror/lang-cpp';
import {go} from '@codemirror/legacy-modes/mode/go';
import type {Language} from '@/lib/problems';
export function CodeEditor({value,language,onChange}:{value:string;language:Language;onChange:(code:string)=>void}){const host=useRef<HTMLDivElement>(null),callback=useRef(onChange);callback.current=onChange;
useEffect(()=>{if(!host.current)return;const view=new EditorView({parent:host.current,state:EditorState.create({doc:value,extensions:[lineNumbers(),history(),highlightActiveLine(),bracketMatching(),keymap.of([indentWithTab,...defaultKeymap,...historyKeymap]),syntaxHighlighting(defaultHighlightStyle),({python:python(),java:java(),cpp:cpp(),go:StreamLanguage.define(go)})[language],EditorView.updateListener.of(u=>{if(u.docChanged)callback.current(u.state.doc.toString())}),EditorView.contentAttributes.of({'aria-label':'代码编辑器','spellcheck':'false'}),EditorView.theme({'&':{height:'420px',fontSize:'14px'},'.cm-content':{fontFamily:'SFMono-Regular,Consolas,monospace',padding:'16px 0'},'.cm-scroller':{overflow:'auto'},'.cm-gutters':{backgroundColor:'#f7f9fc',color:'#a0a9b9',border:'none'},'.cm-line':{padding:'0 16px'},'&.cm-focused':{outline:'2px solid #2858e830'}})]})});return ()=>view.destroy()},[language]);return <div ref={host} className="code-editor"/>}
