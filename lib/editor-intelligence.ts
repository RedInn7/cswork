import type { Language } from './problems';
import type {
  CompletionItem,
  CompletionList,
  Diagnostic,
  Hover,
  SignatureHelp,
  TextEdit,
} from 'vscode-languageserver-protocol';

export type IntelligenceAction =
  | 'completion'
  | 'hover'
  | 'signature'
  | 'diagnostics'
  | 'format';
export type IntelligenceStatus = {
  state: 'idle' | 'starting' | 'ready' | 'unavailable';
  message: string;
};
export type IntelligenceResponse = {
  version: number;
  language: Language;
  server: string;
  result:
    | CompletionItem[]
    | CompletionList
    | Hover
    | SignatureHelp
    | TextEdit[]
    | null;
  diagnostics: Diagnostic[];
  diagnosticsVersion?: number | null;
};
