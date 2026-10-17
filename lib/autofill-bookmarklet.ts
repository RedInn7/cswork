import type { Resume } from '@/components/resume-builder';

/**
 * The resume builder's autofill bookmarklet: the builder's contact fields, first school and
 * latest company baked into a javascript: link. Clicked on a Greenhouse, Lever or Ashby
 * application page it fills the empty plain text fields it recognises and stops there: no
 * submit, no file, select or textarea. The data lives in the bookmark itself.
 */
export type AutofillData = {
  first: string;
  last: string;
  full: string;
  email: string;
  phone: string;
  city: string;
  linkedin: string;
  github: string;
  site: string;
  school: string;
  degree: string;
  company: string;
};

export function autofillData(r: Resume): AutofillData {
  const full = r.name.trim().replace(/\s+/g, ' ');
  // "Ada King Lovelace": first "Ada King", last "Lovelace"; 张三 (no space) only fills a full-name field.
  const cut = full.lastIndexOf(' ');
  const links = r.links.split(/[,，]/).map((l) => l.trim()).filter(Boolean);
  const url = (l = '') => (l && !/^https?:\/\//i.test(l) ? `https://${l}` : l);
  const linkedin = links.find((l) => /linkedin\.com/i.test(l));
  const github = links.find((l) => /github\.com/i.test(l));
  return {
    first: cut > 0 ? full.slice(0, cut) : '',
    last: cut > 0 ? full.slice(cut + 1) : '',
    full,
    email: r.email.trim(),
    phone: r.phone.trim(),
    city: r.location.trim(),
    linkedin: url(linkedin),
    github: url(github),
    site: url(links.find((l) => l !== linkedin && l !== github)),
    school: r.education[0]?.title.trim() ?? '',
    degree: r.education[0]?.subtitle.trim() ?? '',
    company: r.experience[0]?.title.trim() ?? '',
  };
}

/**
 * The tracker's "Save to tracker" bookmarklet body (components/application-tracker-extras.tsx),
 * shared with the autofill overlay: opens `open` (a JSON string literal of the tracker URL) with
 * the page's site name, title, address and selected text.
 */
export const trackerOpenJs = (open: string) =>
  // c cuts to n code units without leaving half an emoji, which encodeURIComponent would throw on.
  `(()=>{const d=document,e=encodeURIComponent,c=(x,n)=>x.slice(0,n).replace(/[\\uD800-\\uDBFF]$/,''),` +
  `m=d.querySelector('meta[property="og:site_name"]'),s=c(String(getSelection()).trim(),10000);` +
  `window.open(${open}+'&company='+e(c((m&&m.content)||location.hostname,100))` +
  `+'&role='+e(c(d.title,120))+'&link='+e(location.href)+(s?'#jd='+e(s):''))})()`;

/**
 * The bookmarklet's script, written out by hand in ES2017 (not a function's toString, which a
 * bundler would rewrite): (data, zh, saveToTracker). Off the three hosts it offers to open an
 * embedded application iframe instead, since a cross-origin frame is out of a bookmarklet's reach.
 * A field's key is its name, id, autocomplete, aria-label and label text; the first rule that
 * matches decides it, and its placeholder is read only when none does, since an example such as
 * "name@example.com" would match the name rule. An email or tel input takes only the email or the
 * phone. Values go through the native setter plus input and change events, so React forms see them.
 */
export const AUTOFILL_JS = String.raw`function (D, Z, S) {
  var t = function (zh, en) { return Z ? zh : en; };
  var ATS = /^https:\/\/(?:[\w-]+\.)*greenhouse\.io\/|^https:\/\/jobs\.(?:eu\.)?lever\.co\/|^https:\/\/jobs\.ashbyhq\.com\//;
  if (!ATS.test(location.origin + "/")) {
    var frame = [].filter.call(document.querySelectorAll("iframe[src]"), function (f) { return ATS.test(f.src); })[0];
    if (!frame) {
      alert(t("填表书签只支持 Greenhouse、Lever、Ashby 的申请页，这个页面不是（Workday 等其他系统也不支持）。", "The autofill bookmarklet works on Greenhouse, Lever and Ashby application pages only, and this is not one (Workday and other systems are not supported)."));
    } else if (confirm(t("申请表嵌在这个页面的 iframe 里，书签够不到。打开申请表本身，再点一次书签？", "The application form is embedded in a frame this bookmarklet cannot reach. Open the form itself, then click the bookmarklet again?"))) {
      window.open(frame.src, "_self");
    }
    return;
  }
  var RULES = [
    ["school", /\b(school|university|college|institution)\b|学校|院校/],
    ["degree", /\bdegree\b|学位|学历/],
    ["company", /\b(company|employer|org|organization)\b|公司|单位/],
    ["first", /\b(first|given) ?name\b|\bfname\b|名字/],
    ["last", /\b(last|family|sur) ?name\b|\blname\b|姓氏/],
    ["full", /\bname\b|\bfull ?name\b|姓名/],
    ["email", /e-?mail|邮箱/],
    ["phone", /phone|mobile|\btel\b|电话|手机/],
    ["city", /\b(city|location|address level2)\b|城市|所在地/],
    ["linkedin", /linkedin/],
    ["github", /github/],
    ["site", /\b(website|portfolio|blog|homepage|url)\b|个人网站|作品集/]
  ];
  var SKIP = /refer|emergency|recruiter|hear|pronoun|preferred|twitter/;
  var setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  var clean = function (s) { return s.toLowerCase().replace(/[-_\[\].]+/g, " "); };
  var keyOf = function (el) {
    var parts = [el.name, el.id, el.getAttribute("autocomplete"), el.getAttribute("aria-label")];
    [].forEach.call(el.labels || [], function (l) { parts.push(l.textContent); });
    (el.getAttribute("aria-labelledby") || "").split(/\s+/).forEach(function (id) {
      var label = id && document.getElementById(id);
      if (label) parts.push(label.textContent);
    });
    return clean(parts.join(" "));
  };
  var ruleOf = function (key) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(key)) return RULES[i][0];
    return "";
  };
  var n = 0;
  [].forEach.call(document.querySelectorAll("input"), function (el) {
    if (["text", "email", "tel", "url"].indexOf(el.type) < 0 || el.disabled || el.readOnly || el.value) return;
    if (el.getAttribute("role") === "combobox" || el.hasAttribute("aria-autocomplete")) return;
    var key = keyOf(el);
    var hint = clean(el.placeholder || "");
    if (SKIP.test(key + " " + hint)) return;
    var value = D[el.type === "email" ? "email" : el.type === "tel" ? "phone" : ruleOf(key) || ruleOf(hint)];
    if (!value) return;
    setValue.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    n++;
  });
  var old = document.getElementById("cswork-autofill");
  if (old) old.remove();
  var box = document.createElement("div");
  box.id = "cswork-autofill";
  box.setAttribute("role", "status");
  box.style.cssText = "position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:320px;padding:12px 14px;border-radius:10px;background:#0e1a2b;color:#fff;font:14px/1.5 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3)";
  var note = document.createElement("p");
  note.style.cssText = "margin:0 0 8px;color:#fff";
  note.textContent = t("已填 " + n + " 项，请检查后自己提交。", "Filled " + n + (n === 1 ? " field" : " fields") + ". Check them, then submit it yourself.");
  box.appendChild(note);
  [[t("存到投递看板", "Save to tracker"), S], [t("关闭", "Close"), function () { box.remove(); }]].forEach(function (b) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = b[0];
    button.onclick = b[1];
    button.style.cssText = "margin:0 8px 0 0;padding:4px 10px;border:1px solid #fff;border-radius:6px;background:transparent;color:#fff;font:inherit;cursor:pointer";
    box.appendChild(button);
  });
  document.body.appendChild(box);
}`;

/** The bookmarklet's href. Percent-encoded, since a browser decodes a javascript: URL once before it runs, and a "%" in the data would not survive that. */
export function autofillHref(data: AutofillData, { origin, zh }: { origin: string; zh: boolean }) {
  const json = JSON.stringify(data).replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
  const save = trackerOpenJs(JSON.stringify(`${origin}/career/tracker?add=1`));
  return `javascript:${encodeURIComponent(`void (${AUTOFILL_JS})(${json},${zh},function(){${save}})`)}`;
}
