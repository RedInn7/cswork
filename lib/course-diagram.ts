import type { MermaidConfig } from 'mermaid';

export const DIAGRAM_MAX_LENGTH = 30_000;

export function courseDiagramConfig(): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    htmlLabels: false,
    maxTextSize: DIAGRAM_MAX_LENGTH,
    maxEdges: 500,
    theme: 'base',
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
    themeVariables: {
      fontSize: '15px',
      primaryColor: '#eef3fc',
      primaryTextColor: '#273b5b',
      primaryBorderColor: '#8ca6cc',
      lineColor: '#617b9f',
      secondaryColor: '#f0f7f5',
      tertiaryColor: '#f9f5ec',
      background: '#ffffff',
    },
    secure: [
      'secure',
      'securityLevel',
      'startOnLoad',
      'suppressErrorRendering',
      'maxTextSize',
      'maxEdges',
      'htmlLabels',
      'dompurifyConfig',
      'themeCSS',
      'fontFamily',
    ],
  };
}

export function prepareCourseDiagram(source: string): string {
  const text = source.trim();
  if (!text || text.length > DIAGRAM_MAX_LENGTH)
    throw new Error('图表内容为空或超过长度限制。');
  // Course authors provide diagram syntax, not renderer configuration. This
  // also blocks frontmatter/directives from weakening sanitization globally.
  if (/%%\s*\{/.test(text) || /^---(?:\r?\n|$)/.test(text))
    throw new Error('课程图表不支持内嵌渲染配置，请使用标准图表语法。');
  return text;
}

export function courseDiagramLabel(source: string): string {
  const accessibleTitle = source.match(/^\s*accTitle\s*:\s*(.+)$/m)?.[1];
  if (accessibleTitle) return accessibleTitle.slice(0, 160);
  if (/^\s*sequenceDiagram\b/m.test(source)) return '课程时序图';
  if (/^\s*stateDiagram(?:-v2)?\b/m.test(source)) return '课程状态图';
  return '课程流程图';
}
