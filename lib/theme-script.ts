/**
 * Site theme: 'system' (follow the OS) by default, or a pinned 'light' / 'dark'.
 * The pick lives in localStorage; the cswork_theme cookie mirrors it so app/layout.tsx
 * renders a pinned theme into the first HTML. THEME_SCRIPT runs inline in <head>
 * before first paint, so a reader on "system" with a dark OS never sees a light flash.
 * <html> gets `.dark` (the class every stylesheet's dark block keys off),
 * data-theme="light|dark" and a matching color-scheme.
 * No React here: the server layout imports these constants.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';
export const THEME_KEY = 'cswork:theme';
export const THEME_COOKIE = 'cswork_theme';

/** The theme the server can render from the cookie alone ('system' waits for the script). */
export function cookieTheme(value: string | undefined): Theme | null {
  return value === 'dark' || value === 'light' ? value : null;
}

/** The theme on screen right now (what THEME_SCRIPT applied); light outside a browser. */
export function currentTheme(): Theme {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';
}

// A string: it runs before the bundle. window.__cswTheme re-applies after a switch,
// and an OS change re-applies while the reader is on "system".
export const THEME_SCRIPT = `(function(){var d=document.documentElement,m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');function p(){var v;try{v=localStorage.getItem('${THEME_KEY}')}catch(e){}if(v!=='light'&&v!=='dark'&&v!=='system'){var c=/(?:^|; )${THEME_COOKIE}=(light|dark|system)/.exec(document.cookie);v=c?c[1]:'system'}return v}function a(){var v=p(),t=v==='system'?(m&&m.matches?'dark':'light'):v;d.classList.toggle('dark',t==='dark');d.setAttribute('data-theme',t);d.style.colorScheme=t}window.__cswTheme=a;a();if(m&&m.addEventListener)m.addEventListener('change',function(){if(p()==='system')a()})})();`;
