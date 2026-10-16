// Fill-in message templates for the job search (/career/templates, components/outreach-templates.tsx).
// Written for CSWork in both languages; the learner sends them from their own mail, nothing is sent
// from the site. Square brackets mark what only the learner can write; {braces} are filled in.

/** The placeholders a template may use, with the form's label for each. */
export const PLACEHOLDERS = {
  name: ['对方称呼', 'Their name'],
  company: ['公司', 'Company'],
  role: ['岗位', 'Role'],
  interviewDate: ['面试日期', 'Interview date'],
  deadline: ['当前截止日期', 'Current deadline'],
  myName: ['你的名字', 'Your name'],
  otherCompany: ['另一家公司', 'Other company'],
} as const;
export type Placeholder = keyof typeof PLACEHOLDERS;

export type OutreachTemplate = {
  id: string;
  title: [string, string];
  /** When to use it, and what to check before sending. */
  tip: [string, string];
  zh: { subject: string; body: string };
  en: { subject: string; body: string };
  /** Negotiation: worth comparing the offers' totals first (/career/offers). */
  offer?: true;
};

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: 'referral',
    title: ['请人内推', 'Ask for a referral'],
    tip: [
      '先找了解你工作的人或校友。一次只请对方推一个最合适的岗位，附上岗位链接和 PDF 简历。',
      'Ask people who know your work, or alumni, first. Ask for one role that fits best, with the posting link and a PDF resume.',
    ],
    zh: {
      subject: '内推请求：{company} {role}',
      body: `{name}，你好！

我正在申请 {company} 的 {role} 岗位，想问问你是否方便帮我内推。

我觉得自己适合这个岗位，主要是因为：[一两句话，写你最相关的项目或经历，最好带一个数字]。

岗位链接：[职位链接或编号]。简历在附件里。如果不方便内推也完全没关系，能跟我聊聊团队的情况我就很感激了。

谢谢你抽时间看！
{myName}`,
    },
    en: {
      subject: 'Referral request: {role} at {company}',
      body: `Hi {name},

I'm applying for the {role} position at {company} and wanted to ask whether you'd be comfortable referring me.

Why I think I fit: [one or two sentences about your most relevant project or experience, ideally with a number].

The posting: [job link or ID]. My resume is attached. If a referral doesn't work for you, no problem at all; I'd still be grateful to hear a little about the team.

Thanks for taking a look,
{myName}`,
    },
  },
  {
    id: 'recruiter-follow-up',
    title: ['投递后跟进招聘方', 'Follow up with a recruiter'],
    tip: [
      '投递一两周没有消息时发一次就够了，不要连续催。',
      'Send it once when a week or two has passed without news; one follow-up is enough.',
    ],
    zh: {
      subject: '跟进投递：{role}',
      body: `{name}，您好：

我前段时间投递了 {company} 的 {role} 岗位，想跟进一下。我对这个职位依然很感兴趣，尤其是[团队或产品里吸引你的具体一点]。

如果需要我补充材料，或者再介绍一下我在[相关技能]方面的经历，请随时告诉我。

谢谢！
{myName}`,
    },
    en: {
      subject: 'Following up on my application: {role}',
      body: `Hi {name},

I applied for the {role} position at {company} a little while ago and wanted to follow up. I'm still very interested, especially in [one specific thing about the team or product].

If it would help, I'm happy to send anything else or say more about my experience with [a relevant skill].

Thank you,
{myName}`,
    },
  },
  {
    id: 'thank-you',
    title: ['面试后感谢信', 'Thank-you note after an interview'],
    tip: [
      '面试当天或第二天发，提一件你们真正聊过的事，几句话就好。',
      'Send it the same day or the next, mention one thing you actually discussed, and keep it short.',
    ],
    zh: {
      subject: '感谢面试：{role}',
      body: `{name}，您好：

感谢您 {interviewDate} 抽时间和我聊 {role} 岗位。我很喜欢这次交流，尤其是关于[你们聊到的一个话题]的讨论。

这让我更希望加入 {company}。如果还需要我提供什么，请随时告诉我。

祝好！
{myName}`,
    },
    en: {
      subject: 'Thank you: {role} interview',
      body: `Hi {name},

Thank you for taking the time to talk with me on {interviewDate} about the {role} position. I enjoyed the conversation, especially our discussion of [a topic you covered].

It made me even more excited about {company}. Please let me know if I can provide anything else.

Best regards,
{myName}`,
    },
  },
  {
    id: 'status-check',
    title: ['询问进度', 'Ask about the timeline'],
    tip: [
      '面试后一般要等一到三周；过了对方说的时间再问，语气保持轻松。',
      'Results often take one to three weeks; ask once the time you were given has passed, and keep it light.',
    ],
    zh: {
      subject: '询问进度：{role} 面试',
      body: `{name}，您好：

我在 {interviewDate} 参加了 {company} {role} 岗位的面试，想了解一下后续安排大概在什么时候。

我对这个职位依然很感兴趣，也感谢您在整个流程中的帮助。

祝好！
{myName}`,
    },
    en: {
      subject: 'Checking in: {role} interviews',
      body: `Hi {name},

I interviewed for the {role} position at {company} on {interviewDate} and wanted to check in on the timeline for next steps.

I'm still very interested in the role. Thank you for your help throughout the process.

Best,
{myName}`,
    },
  },
  {
    id: 'extension',
    title: ['申请延长 offer 截止日期', 'Ask for more time on an offer'],
    tip: [
      '越早提越好，给出一个具体日期。只在确实还有流程在进行时这样说。',
      'Ask early and name a specific date. Only say another process is under way if it is.',
    ],
    zh: {
      subject: '关于 offer 答复时间：{role}',
      body: `{name}，您好：

再次感谢你们给我 {role} 岗位的 offer，我很期待 {company} 的这个机会。

我还有一个面试流程在收尾，希望能慎重地做决定。请问能否把答复截止日期从 {deadline} 延长到[具体日期]？

如果不方便我也完全理解，无论如何都感谢你们的安排。

祝好！
{myName}`,
    },
    en: {
      subject: 'Offer deadline: {role}',
      body: `Hi {name},

Thank you again for the offer for the {role} position. I'm excited about the opportunity at {company}.

I'm finishing another interview process and want to make a careful decision. Would it be possible to move my deadline from {deadline} to [a specific date]?

I understand if that isn't possible, and I appreciate your help either way.

Best regards,
{myName}`,
    },
  },
  {
    id: 'counter-competing',
    title: ['有其他 offer 时谈薪', 'Negotiate with a competing offer'],
    tip: [
      '只提真实存在的 offer，说清楚差在哪一部分；先按四年总额比较两份 offer。所有改动拿到书面确认后再接受。',
      'Mention only a real offer and say which part differs; compare both offers over four years first. Get every change in writing before you accept.',
    ],
    offer: true,
    zh: {
      subject: '关于我的 offer：{role}',
      body: `{name}，您好：

感谢你们给我 {role} 岗位的 offer。我很希望加入 {company}，也希望能一起把细节谈妥。

我目前还拿到了 {otherCompany} 的 offer，整体待遇更高，主要差在[有差距的部分，比如签字费或股票]。请问[具体的部分]有没有调整的空间？这样我就能更安心地接受。

如果需要，我可以提供另一份 offer 的书面信息。谢谢你们考虑！

祝好！
{myName}`,
    },
    en: {
      subject: 'Discussing my offer: {role}',
      body: `Hi {name},

Thank you for the offer for the {role} position. I'd really like to join {company} and hope we can work out the details.

I've also received an offer from {otherCompany} that is higher overall, mainly in [the part that differs, such as the sign-on bonus or equity]. Is there any flexibility on [that part]? It would make it much easier for me to accept.

I can share the other offer in writing if that helps. Thank you for considering it.

Best regards,
{myName}`,
    },
  },
  {
    id: 'counter-no-competing',
    title: ['没有其他 offer 时谈薪', 'Negotiate without a competing offer'],
    tip: [
      '问具体的一项（签字费、股票或入职日期），说出你的依据和希望的数字。有的公司完全不谈，礼貌地问一句一般不会有风险。',
      'Ask about one specific part (sign-on bonus, equity or start date) with your reasoning and the number you hope for. Some companies don’t negotiate at all; a polite question rarely hurts.',
    ],
    offer: true,
    zh: {
      subject: '关于我的 offer 的一个问题：{role}',
      body: `{name}，您好：

感谢你们给我 {role} 岗位的 offer，我很喜欢 {company} 的团队和要做的事情。

签约前想问一下：[签字费、股票或入职日期]有没有调整的空间？结合[我对同城同级别岗位的了解 / 我的相关经历]，我希望能调整到[具体数字或改动]。

如果 offer 不能调整，我也理解。无论如何都谢谢您，期待接下来的安排。

祝好！
{myName}`,
    },
    en: {
      subject: 'A question about my offer: {role}',
      body: `Hi {name},

Thank you for the offer for the {role} position. I'm excited about the team and the work at {company}.

Before I sign, I wanted to ask whether there is any flexibility on [the sign-on bonus, equity or start date]. Based on [what I've learned about similar roles at this level in this city / my relevant experience], I was hoping for [a specific number or change].

I understand if the offer is fixed. Either way, thank you, and I'm looking forward to the next steps.

Best regards,
{myName}`,
    },
  },
  {
    id: 'accept',
    title: ['接受 offer', 'Accept an offer'],
    tip: [
      '确认谈好的改动都已写进书面 offer 再发。接受以后要守约，并撤回其他流程。',
      'Send it once every agreed change is in the written offer. Once you accept, honour it and withdraw from other processes.',
    ],
    zh: {
      subject: '接受 offer：{role}',
      body: `{name}，您好：

我很高兴接受 {company} {role} 岗位的 offer，感谢您在整个流程中的帮助。

请告诉我接下来的步骤，以及需要我准备哪些材料。很期待加入团队！

祝好！
{myName}`,
    },
    en: {
      subject: 'Accepting the offer: {role}',
      body: `Hi {name},

I'm happy to accept the offer for the {role} position at {company}. Thank you for all your help through the process.

Please let me know the next steps and anything you need from me. I'm looking forward to joining the team.

Best regards,
{myName}`,
    },
  },
  {
    id: 'decline-offer',
    title: ['婉拒 offer', 'Decline an offer'],
    tip: [
      '尽早告诉对方，让他们能联系其他候选人。不必解释细节，保持感谢。',
      'Tell them soon so they can move on to other candidates. No details needed; stay thankful.',
    ],
    zh: {
      subject: '关于 {role} 的 offer',
      body: `{name}，您好：

非常感谢你们给我 {role} 岗位的 offer，也感谢 {company} 的各位在面试中花的时间。

慎重考虑之后，我决定接受另一个更符合我目前规划的机会，所以只能婉拒这份 offer。这个决定并不容易。

希望以后还有机会合作，祝您和团队一切顺利。

祝好！
{myName}`,
    },
    en: {
      subject: 'Your offer for {role}',
      body: `Hi {name},

Thank you very much for the offer for the {role} position, and for the time everyone at {company} spent with me.

After careful thought, I've decided to accept another opportunity that fits my plans better right now, so I must decline. It wasn't an easy decision.

I hope our paths cross again, and I wish you and the team all the best.

Kind regards,
{myName}`,
    },
  },
  {
    id: 'decline-interview',
    title: ['婉拒面试邀请', 'Decline an interview'],
    tip: [
      '确定不去就尽早回复，不要直接不出现。留一句保持联系，以后还可能再申请。',
      'Reply as soon as you know rather than not showing up, and leave the door open: you may apply again later.',
    ],
    zh: {
      subject: '关于 {role} 的面试邀请',
      body: `{name}，您好：

感谢您邀请我参加 {company} {role} 岗位的面试，也感谢你们考虑我。

[我已经接受了其他 offer / 我的计划有变]，所以想退出这次招聘流程。给您添麻烦了，希望以后还有机会保持联系。

祝好！
{myName}`,
    },
    en: {
      subject: 'Interview invitation: {role}',
      body: `Hi {name},

Thank you for inviting me to interview for the {role} position at {company}, and for considering me.

[I've accepted another offer / My plans have changed], so I'd like to withdraw from the process. I'm sorry for any inconvenience, and I hope we can stay in touch.

Best regards,
{myName}`,
    },
  },
];

const BRACES = /\{(\w+)\}/g;
/** The placeholders a text uses, in order of first use. */
export const placeholdersIn = (text: string) => [...new Set([...text.matchAll(BRACES)].map((m) => m[1]))];
/** The text with each filled-in placeholder replaced; an empty one stays as {name}. */
export const fillTemplate = (text: string, values: Partial<Record<Placeholder, string>>) =>
  text.replace(BRACES, (all, key: string) => (Object.hasOwn(PLACEHOLDERS, key) && values[key as Placeholder]?.trim()) || all);
