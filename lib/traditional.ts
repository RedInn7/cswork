import * as OpenCC from 'opencc-js/cn2t';

/**
 * Traditional Chinese: the page is rendered in Simplified and its text converted in place
 * (Taiwan phrasing), so every t('中文', 'English') and server `zh ?` string is covered by one pass.
 * ponytail: DOM conversion after render, so a first load flashes Simplified briefly; convert
 * on the server too if that ever matters.
 */
const convert = OpenCC.Converter({ from: 'cn', to: 'twp' });
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
// Code and what the reader types stay as written.
const SKIP = 'script, style, pre, code, textarea, [contenteditable], .monaco-editor, [data-no-convert]';
const HAN = /[一-鿿]/;

function convertText(node: Text) {
  const value = node.nodeValue;
  if (!value || !HAN.test(value) || node.parentElement?.closest(SKIP)) return;
  const next = convert(value);
  if (next !== value) node.nodeValue = next;
}
function convertAttributes(element: Element) {
  if (element.closest(SKIP)) return;
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value && HAN.test(value)) {
      const next = convert(value);
      if (next !== value) element.setAttribute(name, next);
    }
  }
}
function convertTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return convertText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  convertAttributes(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) convertText(node as Text);
    else convertAttributes(node as Element);
  }
}
function convertTitle() {
  if (HAN.test(document.title)) {
    const next = convert(document.title);
    if (next !== document.title) document.title = next;
  }
}

/** Converts the page now and whatever React renders later; returns the stop function. */
export function convertPage() {
  convertTree(document.body);
  convertTitle();
  // Each write is already Traditional, so the observer's own changes settle on the next pass.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') convertText(record.target as Text);
      else if (record.type === 'attributes') convertAttributes(record.target as Element);
      else record.addedNodes.forEach(convertTree);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
  const titleObserver = new MutationObserver(convertTitle);
  titleObserver.observe(document.head, { subtree: true, childList: true, characterData: true });
  return () => {
    observer.disconnect();
    titleObserver.disconnect();
  };
}
