// monaco-emacs 0.3.0 (MIT, https://github.com/brijeshb42/monaco-emacs), src/ bundled to one
// ES module; the license sits beside this file. Changes: the `monaco-editor` imports use
// monaco-editor 0.56's export path (as vendor/monaco-vim does, so both share one Monaco), and
// small inline functions replace the lodash.throttle and lodash.kebabcase dependencies.
// Loaded on demand by components/editor.tsx when the Emacs keymap is picked.
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// lodash.throttle as the extension uses it: leading and trailing calls, plus cancel().
function throttle(fn, wait) {
  let last = 0;
  let timer;
  const throttled = (...args) => {
    const left = wait - (Date.now() - last);
    clearTimeout(timer);
    if (left <= 0) {
      last = Date.now();
      fn(...args);
    } else
      timer = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, left);
  };
  throttled.cancel = () => clearTimeout(timer);
  return throttled;
}
// lodash.kebabcase for Monaco's enum names (LineThin -> line-thin).
const kebabCase = (name) => String(name).replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

// src/emacs/index.ts
import * as monaco4 from "monaco-editor/editor/editor.api.js";

// src/emacs/actions.ts
var actions_exports = {};
__export(actions_exports, {
  BaseAction: () => BaseAction,
  DeleteLines: () => DeleteLines,
  GotoLine: () => GotoLine,
  InsertLineAfter: () => InsertLineAfter,
  InsertLineBelow: () => InsertLineBelow,
  InsertTabs: () => InsertTabs,
  InvertSelection: () => InvertSelection,
  KeyBoardQuit: () => KeyBoardQuit,
  KillLines: () => KillLines,
  KillSelection: () => KillSelection,
  MoveCursorBottom: () => MoveCursorBottom,
  MoveCursorDown: () => MoveCursorDown,
  MoveCursorLeft: () => MoveCursorLeft,
  MoveCursorRight: () => MoveCursorRight,
  MoveCursorToLineEnd: () => MoveCursorToLineEnd,
  MoveCursorToLineStart: () => MoveCursorToLineStart,
  MoveCursorTop: () => MoveCursorTop,
  MoveCursorUp: () => MoveCursorUp,
  MoveCursorWordLeft: () => MoveCursorWordLeft,
  MoveCursorWordRight: () => MoveCursorWordRight,
  RedoAction: () => RedoAction,
  RevealEditorAction: () => RevealEditorAction,
  RevealToBottomAction: () => RevealToBottomAction,
  RevealToCenterAction: () => RevealToCenterAction,
  RevealToTopAction: () => RevealToTopAction,
  RotateCursorOnScreen: () => RotateCursorOnScreen,
  SOURCE: () => SOURCE,
  Search: () => Search,
  SearchReplace: () => SearchReplace,
  SetMark: () => SetMark,
  UndoAction: () => UndoAction,
  Yank: () => Yank,
  YankRotate: () => YankRotate,
  YankSelectionToRing: () => YankSelectionToRing
});
import * as monaco from "monaco-editor/editor/editor.api.js";
var SOURCE = "extension.emacs";
function moveCursor(editor3, hasSelection, direction, unit, repeat = 1) {
  const action = `cursor${unit === "word" ? "Word" : ""}${direction}${hasSelection ? "Select" : ""}`;
  for (let i = 0; i < repeat; i++) {
    editor3.trigger(SOURCE, action, null);
  }
}
var BaseAction = class {
  constructor() {
    __publicField(this, "description", "");
  }
};
var TriggerAction = class extends BaseAction {
  constructor(trigger) {
    super();
    __publicField(this, "trigger");
    this.trigger = trigger;
  }
  run(editor3) {
    editor3.trigger(SOURCE, this.trigger, {});
  }
};
var KillSelection = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    const selections = editor3.getSelections();
    if (!selections.length) {
      return;
    }
    selections.forEach((sel) => {
      const text = editor3.getModel().getValueInRange(sel);
      ext.state.addToRing(text);
      editor3.executeEdits(SOURCE, [{
        range: sel,
        text: ""
      }]);
    });
  }
};
var KillLines = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    ext.selectionMode = false;
    const model = editor3.getModel();
    const pos = ext.getCursorAnchor();
    let endPos;
    if (repeat === 1) {
      const lineLength = model.getLineLength(pos.lineNumber);
      const isAtEnd = pos.column === lineLength + 1;
      if (!lineLength || isAtEnd) {
        if (repeatedTrigger) {
          ext.state.growRingTop(model.getEOL());
        } else {
          ext.state.addToRing(model.getEOL());
        }
        editor3.trigger(SOURCE, "deleteAllRight", null);
        return;
      } else {
        endPos = new monaco.Position(pos.lineNumber, model.getLineLength(pos.lineNumber) + 1);
      }
    } else {
      const totalLines = model.getLineCount();
      const endLine = pos.lineNumber + repeat > totalLines ? totalLines : pos.lineNumber + repeat;
      endPos = new monaco.Position(endLine, model.getLineLength(endLine) + 1);
    }
    const range = monaco.Range.fromPositions(pos, endPos);
    if (repeatedTrigger) {
      ext.state.growRingTop(model.getValueInRange(range));
    } else {
      ext.state.addToRing(model.getValueInRange(range));
    }
    editor3.executeEdits(SOURCE, [{
      range,
      text: ""
    }]);
    editor3.setSelection(monaco.Selection.fromPositions(pos, pos));
  }
};
var InsertLineBelow = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    const pos = editor3.getPosition();
    editor3.trigger(SOURCE, "editor.action.insertLineAfter", null);
    editor3.setPosition(pos);
  }
};
var InsertLineAfter = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    let text = "";
    for (let i = 0; i < repeat; i++) {
      text += editor3.getModel().getEOL();
    }
    ext.selectionMode = false;
    const pos = ext.getCursorAnchor();
    editor3.executeEdits(SOURCE, [{
      range: monaco.Range.fromPositions(pos),
      text,
      forceMoveMarkers: true
    }]);
  }
};
var SetMark = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    const mode = ext.selectionMode;
    const sel = editor3.getSelection();
    const selEmpty = sel.isEmpty();
    if (!selEmpty) {
      const dir = sel.getDirection();
      if (dir === monaco.SelectionDirection.LTR) {
        editor3.setSelection(monaco.Selection.fromPositions(sel.getEndPosition(), sel.getEndPosition()));
      } else {
        editor3.setSelection(monaco.Selection.fromPositions(sel.getStartPosition(), sel.getStartPosition()));
      }
    }
    if (selEmpty && ext.selectionMode) {
      ext.selectionMode = false;
    } else {
      ext.selectionMode = true;
    }
  }
};
var MoveCursorAction = class extends BaseAction {
  constructor() {
    super(...arguments);
    __publicField(this, "direction");
    __publicField(this, "unit", "char");
  }
  run(editor3, ext, repeat, repeatedTrigger) {
    moveCursor(editor3, ext.selectionMode, this.direction, this.unit, repeat);
  }
};
var MoveCursorUp = class extends MoveCursorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "direction", "Up");
  }
};
var MoveCursorDown = class extends MoveCursorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "direction", "Down");
  }
};
var MoveCursorLeft = class extends MoveCursorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "direction", "Left");
  }
};
var MoveCursorRight = class extends MoveCursorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "direction", "Right");
  }
};
var MoveCursorToLineEnd = class extends MoveCursorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "direction", "End");
  }
};
var MoveCursorToLineStart = class extends MoveCursorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "direction", "Home");
  }
};
var MoveCursorWordRight = class extends MoveCursorRight {
  constructor() {
    super(...arguments);
    __publicField(this, "unit", "word");
  }
};
var MoveCursorWordLeft = class extends MoveCursorLeft {
  constructor() {
    super(...arguments);
    __publicField(this, "unit", "word");
  }
};
var MoveCursorBottom = class extends MoveCursorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "direction", "Bottom");
  }
};
var MoveCursorTop = class extends MoveCursorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "direction", "Top");
  }
};
var KeyBoardQuit = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    ext.selectionMode = false;
    ext.clearState();
    editor3.setPosition(editor3.getPosition());
  }
};
var HistoryAction = class extends BaseAction {
  constructor() {
    super(...arguments);
    __publicField(this, "action");
  }
  run(editor3, ext, repeat, repeatedTrigger) {
    for (let i = 0; i < repeat; i++) {
      editor3.trigger(SOURCE, this.action, null);
    }
  }
};
var UndoAction = class extends HistoryAction {
  constructor() {
    super(...arguments);
    __publicField(this, "action", "undo");
  }
};
var RedoAction = class extends HistoryAction {
  constructor() {
    super(...arguments);
    __publicField(this, "action", "redo");
  }
};
var Yank = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    const text = ext.state.getFromRing(repeat);
    if (!text) {
      return;
    }
    const pos = editor3.getPosition();
    editor3.executeEdits(SOURCE, [{
      range: monaco.Range.fromPositions(pos, pos),
      text,
      forceMoveMarkers: true
    }]);
  }
};
var YankSelectionToRing = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    const sel = editor3.getSelection();
    if (sel.isEmpty()) {
      return;
    }
    ext.state.addToRing(editor3.getModel().getValueInRange(sel));
    ext.selectionMode = false;
    const pos = ext.getCursorAnchor();
    editor3.setSelection(monaco.Selection.fromPositions(pos, pos));
  }
};
var YankRotate = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    const text = ext.state.popFromRing();
    if (!text) {
      return;
    }
    const pos = ext.getCursorAnchor();
    editor3.executeEdits(SOURCE, [{
      range: monaco.Range.fromPositions(pos),
      text,
      forceMoveMarkers: true
    }]);
  }
};
var RevealEditorAction = class extends BaseAction {
  constructor() {
    super(...arguments);
    __publicField(this, "revealFunction");
  }
  run(editor3, ext, repeat, repeatedTrigger) {
    const sel = editor3.getSelection();
    if (this.revealFunction === "up") {
      editor3.trigger(SOURCE, "scrollPageUp", null);
    } else {
      editor3[this.revealFunction](sel);
    }
  }
};
var RevealToTopAction = class extends RevealEditorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "revealFunction", "revealRangeAtTop");
  }
};
var RevealToCenterAction = class extends RevealEditorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "revealFunction", "revealRangeInCenter");
  }
};
var RevealToBottomAction = class extends RevealEditorAction {
  constructor() {
    super(...arguments);
    __publicField(this, "revealFunction", "up");
  }
};
var InsertTabs = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    const model = editor3.getModel();
    const { tabSize, insertSpaces } = model.getOptions();
    let text = "";
    for (let i = 0; i < repeat; i++) {
      let spaces = "";
      for (let j = 0; j < tabSize; j++) {
        spaces += " ";
      }
      text += insertSpaces ? spaces : "	";
    }
    editor3.executeEdits(SOURCE, [{
      range: editor3.getSelection(),
      text,
      forceMoveMarkers: true
    }]);
  }
};
var RotateCursorOnScreen = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    const ranges = editor3.getVisibleRanges();
    if (!ranges.length) {
      return;
    }
    const lineMapping = [];
    let start = 1;
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      for (let j = range.startLineNumber; j <= range.endLineNumber; j++) {
        lineMapping.push(j);
      }
    }
    const pos = editor3.getPosition();
    const expectedCenter = Math.ceil(lineMapping.length / 2);
    let toMovePos;
    if (pos.lineNumber === lineMapping[expectedCenter]) {
      toMovePos = new monaco.Position(lineMapping[0], 1);
    } else if (pos.lineNumber === lineMapping[0]) {
      toMovePos = new monaco.Position(lineMapping[lineMapping.length - 1], 1);
    } else {
      toMovePos = new monaco.Position(lineMapping[expectedCenter], 1);
    }
    editor3.setPosition(toMovePos);
  }
};
var GotoLine = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    ext.getBasicInput("Goto Line: ").then((val) => {
      let line = parseInt(val) || 0;
      const model = editor3.getModel();
      const totalLines = model.getLineCount();
      editor3.focus();
      if (!line) {
        line = 1;
      } else if (line > totalLines) {
        line = totalLines;
      }
      const pos = new monaco.Position(line, 1);
      let range;
      if (!ext.selectionMode) {
        range = monaco.Selection.fromPositions(pos);
      } else {
        const sel = editor3.getSelection();
        if (sel.getDirection() === monaco.SelectionDirection.LTR) {
          range = monaco.Selection.fromPositions(sel.getStartPosition(), pos);
        } else {
          range = monaco.Selection.fromPositions(sel.getEndPosition(), pos);
        }
      }
      editor3.setSelection(range);
      editor3.revealRangeInCenter(range);
    }).catch(() => {
      editor3.focus();
    });
  }
};
var InvertSelection = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    const sel = editor3.getSelection();
    if (sel.isEmpty()) {
      return;
    }
    let newSel;
    if (sel.getDirection() === monaco.SelectionDirection.LTR) {
      newSel = monaco.Selection.fromPositions(sel.getEndPosition(), sel.getStartPosition());
    } else {
      newSel = monaco.Selection.fromPositions(sel.getStartPosition(), sel.getEndPosition());
    }
    editor3.setSelection(newSel);
  }
};
var Search = class extends TriggerAction {
  constructor() {
    super("editor.actions.findWithArgs");
  }
};
var SearchReplace = class extends TriggerAction {
  constructor() {
    super("editor.action.startFindReplaceAction");
  }
};
var DeleteLines = class extends BaseAction {
  run(editor3, ext, repeat, repeatedTrigger) {
    ext.selectionMode = false;
    for (let i = 0; i < repeat; i++) {
      editor3.trigger(SOURCE, "editor.action.deleteLines", null);
    }
  }
};

// src/emacs/commands.ts
var prefixPreservingKeys = {
  "M-g": true,
  "C-x": true,
  "C-q": true,
  "C-u": true
};
var setMarkAction = new SetMark();
var undoAction = new UndoAction();
var moveCursorDown = new MoveCursorDown();
var moveCursorUp = new MoveCursorUp();
var moveCursorRight = new MoveCursorRight();
var moveCursorLeft = new MoveCursorLeft();
var COMMANDS = {
  "M-/": {
    description: "",
    action: "editor.action.triggerSuggest"
  },
  "C-'": {
    description: "",
    action: "editor.action.triggerSuggest"
  },
  "M-;": {
    description: "",
    action: "editor.action.commentLine"
  },
  "C-t": {
    description: "",
    action: "editor.action.transposeLetters"
  },
  "C-x C-p": {
    description: "",
    action: "editor.action.selectAll"
  },
  "Tab": {
    description: "",
    action: "editor.action.formatDocument"
  },
  "C-Backspace": {
    description: "",
    action: "deleteWordLeft"
  },
  "C-d": {
    description: "",
    action: "deleteRight"
  },
  "M-Backspace": {
    description: "",
    action: "deleteWordLeft"
  },
  "M-Delete": {
    description: "",
    action: "deleteWordLeft"
  },
  "C-x C-u": {
    description: "",
    action: "editor.action.transformToUppercase"
  },
  "C-x C-l": {
    description: "",
    action: "editor.action.transformToLowercase"
  },
  "C-v": {
    description: "",
    action: "cursorPageDown"
  },
  "PageDown": {
    description: "",
    action: "cursorPageDown"
  },
  "M-v": {
    description: "",
    action: "cursorPageUp"
  },
  "PageUp": {
    description: "",
    action: "cursorPageUp"
  },
  "M-g n": {
    description: "",
    action: "editor.action.marker.next"
  },
  "M-g p": {
    description: "",
    action: "editor.action.marker.prev"
  },
  "M-C-n": {
    description: "",
    action: "editor.action.addSelectionToNextFindMatch"
  },
  "C-h": {
    description: "",
    action: "deleteLeft"
  },
  "M-d": {
    description: "",
    action: "deleteWordRight"
  },
  "S-C-": {
    description: "",
    action: "editor.action.triggerParameterHints"
  },
  "C-SPC": setMarkAction,
  "S-C-2": setMarkAction,
  "C-/": undoAction,
  "S-C--": undoAction,
  "C-z": undoAction,
  "C-x u": undoAction,
  "C-n": moveCursorDown,
  "C-p": moveCursorUp,
  "C-f": moveCursorRight,
  // Overriding these keys also overrides the navigation when
  // autocomplete is triggered. so let it be default for now
  // 'Left': moveCursorLeft,
  // 'Down': moveCursorDown,
  // 'Up': moveCursorUp,
  // 'Right': moveCursorRight,
  "C-b": moveCursorLeft,
  "S-C-Backspace": new DeleteLines(),
  "M-f": new MoveCursorWordRight(),
  "M-b": new MoveCursorWordLeft(),
  "C-k": new KillLines(),
  "C-m": new InsertLineAfter(),
  "C-w": new KillSelection(),
  "C-o": new InsertLineBelow(),
  "C-g": new KeyBoardQuit(),
  "C-e": new MoveCursorToLineEnd(),
  "C-a": new MoveCursorToLineStart(),
  "C-y": new Yank(),
  "M-w": new YankSelectionToRing(),
  "M-y": new YankRotate(),
  "C-l": new RevealToCenterAction(),
  // This needs to be dynamic so that the character after C-q is inserted
  // instead of hardcoded Tab key
  "C-q Tab": new InsertTabs(),
  "M-r": new RotateCursorOnScreen(),
  "M-g g": new GotoLine(),
  "M-g M-g": new GotoLine(),
  "C-x C-x": new InvertSelection(),
  "S-M-.": new MoveCursorBottom(),
  "S-M-,": new MoveCursorTop(),
  "C-s": new Search(),
  // Same as C-s. Not sure how to put Find/Replace in reverse mode
  "C-r": new Search(),
  "S-M-5": new SearchReplace()
};
function executeCommand(ext, command, inputBuffer, repeatedTrigger) {
  const editor3 = ext.getEditor();
  const repeat = parseInt(inputBuffer) || 1;
  if (command.run) {
    command.run(editor3, ext, repeat, repeatedTrigger);
    return;
  }
  if (typeof command.action === "string") {
    for (let i = 0; i < repeat; i++) {
      editor3.trigger(SOURCE, command.action, null);
    }
  } else if (Array.isArray(command.action)) {
    for (let i = 0; i < repeat; i++) {
      command.action.forEach((cmd) => {
        editor3.trigger(SOURCE, cmd, null);
      });
    }
  }
}
function registerGlobalCommand(key, command) {
  COMMANDS[key] = command;
}
function unregisterKey(key) {
  if (COMMANDS[key]) {
    delete COMMANDS[key];
  }
}
function getAllMappings() {
  const result = {};
  Object.keys(COMMANDS).forEach((key) => {
    result[key] = COMMANDS[key].description;
  });
  return result;
}

// src/emacs/util.ts
import * as monaco2 from "monaco-editor/editor/editor.api.js";
var modifierKeys = {
  Alt: "M",
  Control: "C",
  Ctrl: "C",
  Meta: "CMD",
  Shift: "S"
};
var specialKeys = {
  Enter: "Return",
  Space: "SPC",
  Backslash: "\\",
  Slash: "/",
  Backquote: "`",
  BracketRight: "]",
  BracketLeft: "[",
  Comma: ",",
  Period: ".",
  Equal: "=",
  Minus: "-",
  Quote: "'",
  Semicolon: ";"
};
var oneCharKeyPrefixes = ["Key", "Numpad"];
var arrowSuffix = "Arrow";
function monacoToEmacsKey(ev) {
  const keyName = monaco2.KeyCode[ev.keyCode];
  if (modifierKeys[keyName]) {
    return "";
  }
  let key = oneCharKeyPrefixes.some((prefix) => keyName.startsWith(prefix)) ? keyName[keyName.length - 1] : keyName;
  if (keyName.endsWith(arrowSuffix)) {
    key = keyName.substring(0, keyName.length - arrowSuffix.length);
  } else if (specialKeys[keyName]) {
    key = specialKeys[key];
  }
  if (key.length === 1) {
    key = key.toLowerCase();
  }
  if (ev.altKey) {
    key = `${modifierKeys.Alt}-${key}`;
  }
  if (ev.ctrlKey) {
    key = `${modifierKeys.Ctrl}-${key}`;
  }
  if (ev.metaKey) {
    key = `${modifierKeys.Meta}-${key}`;
  }
  if (ev.shiftKey) {
    key = `${modifierKeys.Shift}-${key}`;
  }
  return key;
}
var Event;
((Event2) => {
  const _disposable = { dispose() {
  } };
  Event2.None = function() {
    return _disposable;
  };
})(Event || (Event = {}));
var Emitter = class {
  constructor() {
    __publicField(this, "_event");
    __publicField(this, "_disposed");
    __publicField(this, "_listeners", []);
  }
  get event() {
    if (!this._event) {
      this._event = (listener) => {
        this._listeners.push(listener);
        const result = {
          dispose: () => {
            if (this._disposed) {
              return;
            }
            const index = this._listeners.indexOf(listener);
            if (index < 0) {
              return;
            }
            this._listeners.splice(index, 1);
          }
        };
        return result;
      };
    }
    return this._event;
  }
  fire(ev) {
    if (!this._listeners.length) {
      return;
    }
    this._listeners.forEach((l) => l(ev));
  }
  dispose() {
    if (this._disposed) {
      return;
    }
    this._listeners = void 0;
    this._disposed = true;
  }
};

// src/emacs/basicInput.ts
import * as monaco3 from "monaco-editor/editor/editor.api.js";
var BASE_CLASS = "ext-emacs-basic-input";
function generateCss() {
  return `
  .${BASE_CLASS} {
    color: #d4d4d4;
    transition: top 200ms linear;
    visibility: hidden;
    width: 200px;
    display: flex;
    align-items: center;
    padding: 5px;
  }

  .${BASE_CLASS}.${BASE_CLASS}-visible {
    visibility: visible;
  }

  .${BASE_CLASS} input {
    color: rgb(97, 97, 97);
    background-color: transparent;
    display: inline-block;
    box-sizing: border-box;
    height: 100%;
    line-height: inherit;
    border: none;
    font-family: inherit;
    font-size: inherit;
    resize: none;
    padding-top: 2px;
    padding-bottom: 2px;
    margin-left: 5px;
    max-width: 50px;
  }

  .${BASE_CLASS} input:focus {
    outline: none;
  }

  .vs .${BASE_CLASS} {
    color: rgb(97, 97, 97);
    background-color: #efeff2;
    box-shadow: 0 2px 8px #a8a8a8;
  }

  .vs-dark .${BASE_CLASS} {
    background-color: #2d2d30;
    box-shadow: 0 2px 8px #000000;
  }

  .vs-dark .${BASE_CLASS} input {
    color: rgb(204, 204, 204);
  }

  .hc-black .${BASE_CLASS} {
    border: 2px solid #6fc3df;
    background-color: #0c141f;
    color: #ffffff;
  }

  .hc-black .${BASE_CLASS} input {
    color: #ffffff;
  }
`;
}
var BasicInputWidget = class {
  constructor() {
    __publicField(this, "_dom");
    __publicField(this, "_input");
    __publicField(this, "_messageDom");
    __publicField(this, "_style");
    __publicField(this, "_pendingPromise", null);
    __publicField(this, "onKeyDown", (ev) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      if (ev.which === 13) {
        if (this._pendingPromise) {
          ev.preventDefault();
          this._pendingPromise.resolve(ev.target.value);
          this._pendingPromise = null;
        }
      } else if (ev.which === 27) {
        if (this._pendingPromise) {
          this._pendingPromise.reject();
          this._pendingPromise = null;
        }
      }
    });
    __publicField(this, "onBlur", () => {
      if (this._pendingPromise) {
        this._pendingPromise.reject();
        this._pendingPromise = null;
      }
    });
    this._dom = document.createElement("div");
    this._messageDom = document.createElement("div");
    const medDom = document.createElement("div");
    this._dom.setAttribute("class", BASE_CLASS);
    this._dom.setAttribute("aria-hidden", "true");
    this._input = document.createElement("input");
    this._dom.appendChild(this._messageDom);
    medDom.appendChild(this._input);
    this._dom.appendChild(medDom);
    this.addListeners();
    this._style = document.createElement("style");
    this._style.type = "text/css";
    this._style.textContent = generateCss();
    (document.head || document.body).appendChild(this._style);
  }
  getDomNode() {
    return this._dom;
  }
  getId() {
    return "extension.emacs.basicinput";
  }
  getPosition() {
    return {
      preference: monaco3.editor.OverlayWidgetPositionPreference.TOP_RIGHT_CORNER
    };
  }
  addListeners() {
    this._input.addEventListener("keydown", this.onKeyDown);
    this._input.addEventListener("blur", this.onBlur);
  }
  showWidgetAndFocus(message) {
    this._dom.classList.add(`${BASE_CLASS}-visible`);
    this._dom.setAttribute("aria-hidden", "false");
    this._messageDom.textContent = message;
    this._input.focus();
  }
  cleanup() {
    this._dom.classList.remove(`${BASE_CLASS}-visible`);
    this._dom.setAttribute("aria-hidden", "true");
    this._messageDom.textContent = "";
    this._input.placeholder = "";
    this._input.value = "";
  }
  getInput(message) {
    if (this._pendingPromise) {
      this._pendingPromise.reject();
      this._pendingPromise = null;
    }
    return new Promise((resolve, reject) => {
      this._pendingPromise = {
        resolve: (val) => {
          resolve(val);
          this.cleanup();
        },
        reject: () => {
          reject();
          this.cleanup();
        }
      };
      this.showWidgetAndFocus(message);
    });
  }
  dispose() {
    this.cleanup();
    this._input.removeEventListener("keydown", this.onKeyDown);
    this._input.removeEventListener("blur", this.onBlur);
    (document.head || document.body).removeChild(this._style);
  }
};

// src/emacs/state.ts
var EAT_UP_KEY = "==-==";
var State = class {
  constructor() {
    // Harcoded support for only C-u
    __publicField(this, "_inargumentMode", false);
    __publicField(this, "_prefixKey");
    __publicField(this, "_inputBuffer");
    __publicField(this, "_lastInputBuffer");
    __publicField(this, "_killRing", []);
    __publicField(this, "_lastCommandKey");
  }
  updateAndGetKey(key) {
    if (key === "C-g" && (this._inargumentMode || this._prefixKey)) {
      this.resetState();
      return EAT_UP_KEY;
    }
    if (this.updateCuMode(key)) {
      return EAT_UP_KEY;
    }
    if (!this._prefixKey) {
      if (prefixPreservingKeys[key]) {
        this._prefixKey = key;
        return EAT_UP_KEY;
      }
      return key;
    } else {
      return `${this._prefixKey} ${key}`;
    }
  }
  setLastCommandKey(lastCommandKey) {
    this._lastCommandKey = lastCommandKey;
  }
  isLastCommandKey(lastCommandKey) {
    return this._lastCommandKey == lastCommandKey;
  }
  resetState(setLastInput = false) {
    this._inargumentMode = setLastInput;
    this._prefixKey = null;
    if (setLastInput) {
      this._lastInputBuffer = this._inputBuffer;
    } else {
      this._lastInputBuffer = null;
    }
    this._inputBuffer = null;
  }
  updateCuMode(key) {
    if (this._inargumentMode) {
      if (typeof key === "string" && /^\d$/.test(key)) {
        this._inputBuffer = (this._inputBuffer || "") + key;
        return true;
      } else if (prefixPreservingKeys[key]) {
        this.resetState(true);
        return false;
      }
    } else if (!this._prefixKey && key === "C-u") {
      this._inargumentMode = true;
      this._inputBuffer = null;
      this._lastInputBuffer = null;
      return true;
    }
  }
  updateStateOnExecution(reset = false) {
    this.resetState(reset);
  }
  getInputBuffer() {
    return this._lastInputBuffer || this._inputBuffer;
  }
  addToRing(str) {
    this._killRing.push(str);
    if (this._killRing.length > 50) this._killRing.shift();
  }
  growRingTop(str) {
    if (!this._killRing.length) {
      this.addToRing(str);
    }
    this._killRing[this._killRing.length - 1] += str;
  }
  getFromRing(n) {
    return this._killRing[this._killRing.length - (n ? Math.min(n, 1) : 1)] || "";
  }
  popFromRing() {
    if (this._killRing.length > 1) {
      return this._killRing.pop();
    }
    return this.getFromRing();
  }
  getReadableState() {
    let str = "";
    if (this._inargumentMode) {
      str += "C-u";
      if (this._inputBuffer) {
        str += ` ${this._inputBuffer}`;
      } else if (this._lastInputBuffer) {
        str += ` ${this._lastInputBuffer}`;
      }
    }
    if (this._prefixKey) {
      str += ` ${this._prefixKey}`;
    }
    return str;
  }
};

// src/emacs/index.ts
var {
  TextEditorCursorBlinkingStyle,
  TextEditorCursorStyle
} = monaco4.editor;
var EmacsExtension = class {
  constructor(editor3) {
    __publicField(this, "_editor");
    __publicField(this, "_disposables", []);
    __publicField(this, "_inSelectionMode", false);
    __publicField(this, "_changeDisposable", null);
    __publicField(this, "_throttledScroll");
    __publicField(this, "_intialCursorType");
    __publicField(this, "_intialCursorBlinking");
    __publicField(this, "_basicInputWidget");
    __publicField(this, "_state", new State());
    __publicField(this, "_onDidMarkChange", new Emitter());
    __publicField(this, "onDidMarkChange", this._onDidMarkChange.event);
    __publicField(this, "_onDidChangeKey", new Emitter());
    __publicField(this, "onDidChangeKey", this._onDidChangeKey.event);
    this._editor = editor3;
    const config = getConfiguration(editor3);
    this._intialCursorType = config.cursorStyle;
    this._intialCursorBlinking = config.cursorBlinking;
    this._basicInputWidget = new BasicInputWidget();
  }
  start() {
    if (this._disposables.length) {
      return;
    }
    this.addListeners();
    this._editor.updateOptions({
      cursorStyle: kebabCase(TextEditorCursorStyle[TextEditorCursorStyle.Block]),
      cursorBlinking: kebabCase(TextEditorCursorBlinkingStyle[TextEditorCursorBlinkingStyle.Blink])
    });
    this._editor.addOverlayWidget(this._basicInputWidget);
  }
  get state() {
    return this._state;
  }
  getEditor() {
    return this._editor;
  }
  addListeners() {
    this._disposables.push(this._editor.onKeyDown(this.onKeyDown.bind(this)));
    this._throttledScroll = throttle(this.onEditorScroll.bind(this), 500);
    this._disposables.push(this._editor.onDidScrollChange(this._throttledScroll));
  }
  cancelKey(ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  /**
   * @todo Refactor this function as it may lead to future complexity
   * and it is the entry point for all key presses.
   */
  onKeyDown(ev) {
    if (ev.browserEvent.defaultPrevented) {
      return;
    }
    let key = monacoToEmacsKey(ev);
    if (!key) {
      return;
    }
    key = this._state.updateAndGetKey(key);
    this._onDidChangeKey.fire(this._state.getReadableState());
    if (key === EAT_UP_KEY) {
      this._onDidChangeKey.fire(this._state.getReadableState());
      this.cancelKey(ev);
      return;
    }
    const command = COMMANDS[key];
    if (!command) {
      this._onDidChangeKey.fire(this._state.getReadableState());
      this._state.setLastCommandKey(key);
      return;
    }
    this.cancelKey(ev);
    const repeatedTrigger = this._state.isLastCommandKey(key);
    executeCommand(this, command, this._state.getInputBuffer(), repeatedTrigger);
    this._state.setLastCommandKey(key);
    this._state.updateStateOnExecution();
  }
  onEditorScroll() {
    const { height } = this._editor.getLayoutInfo();
    const layout = this._editor.getScrolledVisiblePosition(this._editor.getPosition());
    if (layout.top >= 0 && layout.top <= height) {
      return;
    }
    const ranges = this._editor.getVisibleRanges();
    if (!ranges.length) {
      return;
    }
    let newPos;
    const sel = this._editor.getSelection();
    if (layout.top < 0) {
      newPos = new monaco4.Position(ranges[0].getStartPosition().lineNumber, 1);
    } else if (layout.top > height) {
      newPos = new monaco4.Position(ranges[ranges.length - 1].getEndPosition().lineNumber, 1);
    }
    if (this._inSelectionMode) {
      this._editor.setSelection(monaco4.Selection.fromPositions(sel.getStartPosition(), newPos));
    } else {
      this._editor.setPosition(newPos);
    }
  }
  onContentChange() {
    this.selectionMode = false;
  }
  clearState() {
    this._state.updateStateOnExecution();
  }
  set selectionMode(mode) {
    if (mode === this._inSelectionMode) {
      return;
    }
    this._inSelectionMode = mode;
    if (mode) {
      this._changeDisposable = this._editor.onDidChangeModelContent(this.onContentChange.bind(this));
    } else if (this._changeDisposable) {
      this._changeDisposable.dispose();
      this._changeDisposable = null;
    }
    this._onDidMarkChange.fire(mode);
  }
  get selectionMode() {
    return this._inSelectionMode;
  }
  getCursorAnchor() {
    const sel = this._editor.getSelection();
    const dir = sel.getDirection();
    return dir === monaco4.SelectionDirection.LTR ? sel.getEndPosition() : sel.getStartPosition();
  }
  getBasicInput(message) {
    return this._basicInputWidget.getInput(message);
  }
  dispose() {
    this._disposables.forEach((d) => d.dispose());
    this._disposables = void 0;
    if (this._changeDisposable) {
      this._changeDisposable.dispose();
      this._changeDisposable = null;
    }
    this._editor.updateOptions({
      cursorStyle: this._intialCursorType,
      cursorBlinking: this._intialCursorBlinking
    });
    this._editor.removeOverlayWidget(this._basicInputWidget);
    this._basicInputWidget.dispose();
    this._throttledScroll.cancel();
    this._state = null;
  }
};
function getConfiguration(editor3) {
  const cursorStyle = editor3.getOption(monaco4.editor.EditorOption.cursorStyle);
  const cursorBlinking = editor3.getOption(monaco4.editor.EditorOption.cursorBlinking);
  return {
    cursorStyle: kebabCase(TextEditorCursorStyle[cursorStyle]),
    cursorBlinking: kebabCase(TextEditorCursorBlinkingStyle[cursorBlinking])
  };
}

// src/index.ts
var index_default = EmacsExtension;
export {
  actions_exports as Actions,
  EmacsExtension,
  index_default as default,
  getAllMappings,
  registerGlobalCommand,
  unregisterKey
};
