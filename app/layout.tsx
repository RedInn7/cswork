import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'cswork · 学习工作台',
  description: '从 Go 后端到系统设计，学习、练习与一对一反馈。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
