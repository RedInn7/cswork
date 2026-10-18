import './resume-print.css';
import './resume-extend.css';
import '@/app/code-review.css';
import '@/app/resume-review-link.css';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { aiEnabled } from '@/lib/server/ai-tutor';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { ResumeBuilder } from '@/components/resume-builder';

const copy = {
  en: {
    title: 'One-Page Resume Builder for Software Engineers (ATS-Friendly) · CSWork',
    description:
      'Build a one-page, ATS-friendly software engineering resume: one column, standard headings, real text. Preview it live, save it as a PDF and keep it in your own browser.',
    kicker: 'RESUME BUILDER · SAVED IN THIS BROWSER',
    h1: 'One page, one column, nothing an ATS trips on.',
    lead: 'Fill in the sections on the left; the right side is exactly what prints. Save as PDF uses your browser’s print dialog: choose “Save as PDF” and Letter paper.',
    privacyTitle: 'Saved in this browser',
    privacy:
      'What you type is kept in this browser’s storage and is not uploaded unless you make a review link. Use Export JSON to move it to another device. Import PDF / DOCX reads the file in this browser as well: for a PDF it downloads pdf.js from jsDelivr, and the file itself is not sent anywhere. The autofill bookmarklet keeps your contact details in the bookmark, so do not share it. Filling in from CSWork only reads your own certificates, rating and solved counts into this page. “Ask someone to review it” stores a snapshot of the resume, without your name or contact lines, on CSWork until you close the link.',
    more: 'Privacy notice',
  },
  zh: {
    title: '一页简历生成器：软件工程师（ATS 友好）· CSWork',
    description: '生成一页、ATS 友好的软件工程师简历：单栏、标准小节标题、文字可选中。实时预览，保存为 PDF，内容保存在你自己的浏览器里（生成评审链接时才上传一份不含联系方式的快照）。',
    kicker: '简历生成器 · 保存在这个浏览器里',
    h1: '一页纸、单栏，ATS 读得懂。',
    lead: '左边按小节填写，右边就是打印出来的样子。“保存为 PDF”会打开浏览器的打印窗口，目标选“另存为 PDF”，纸张选 Letter。',
    privacyTitle: '保存在这个浏览器里',
    privacy:
      '你填写的内容保存在当前浏览器的本地存储里，除非你生成评审链接，否则不会上传。换设备可以用“导出 JSON”带走。“导入 PDF / DOCX”也只在浏览器里读取文件；选 PDF 时会从 jsDelivr 下载 pdf.js，文件本身不发给任何人。填表书签把你的联系方式存在书签里，不要分享。“从 CSWork 填入”只是把你自己的证书、rating 和解题数读到这个页面上。“请人看简历”会把简历快照（不含姓名和联系方式）存到 CSWork 服务器上，直到你关闭链接。',
    more: '隐私说明',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/career/resume/builder' });
}

/** /career/resume/builder (components/resume-builder.tsx); signed-in learners can pull in their CSWork record. */
export default async function ResumeBuilderPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '简历生成器' : 'Resume builder'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <div className="resume-privacy" role="note">
        <strong>{c.privacyTitle}</strong>
        <p>
          {c.privacy} <a href="/privacy#privacy-resume-builder">{c.more}</a>
        </p>
      </div>
      <ResumeBuilder zh={zh} signedIn={!!viewer} ai={aiEnabled()} />
    </>
  );
}
