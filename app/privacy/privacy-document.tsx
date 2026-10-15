'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useLocale, useT } from '@/lib/i18n';

export function PrivacyDocument() {
  const locale = useLocale(),
    t = useT();
  // metadata is static English; keep the tab title and <html lang> in the reader's language.
  useEffect(() => {
    document.title =
      locale === 'zh' ? '隐私说明 · cswork' : 'Privacy notice · cswork';
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);
  return (
    <main className="privacy-page">
      <header className="privacy-header">
        <Link href="/" className="privacy-brand">
          cswork
        </Link>
        <Link href="/">{t('返回学习平台 →', 'Back to cswork →')}</Link>
      </header>
      <article className="privacy-document">
        {locale === 'zh' ? (
          <>
            <p className="privacy-eyebrow">关于你的资料</p>
            <h1>隐私说明</h1>
            <p className="privacy-intro">
              cswork
              是提供课程、视频、编程练习与教学反馈的学习平台。这份说明介绍平台当前如何处理你的资料，以及你可以如何联系我们。
            </p>
            <p className="privacy-updated">更新于 2026 年 10 月 15 日</p>

            <section aria-labelledby="privacy-account">
              <h2 id="privacy-account">账户与第三方登录</h2>
              <p>
                创建和使用账户时，平台保存你的邮箱、昵称、邮箱验证状态及账户标识，用来识别身份、匹配课程权限和提供账号管理。使用密码登录时，平台保存密码的哈希值；不会保存明文密码。
              </p>
              <p>
                选择 Google 或 GitHub
                登录、绑定账户时，平台接收你授权提供的基础资料，例如第三方账户标识、姓名或昵称、邮箱及头像地址。认证系统也可能保存该登录方式返回的授权令牌及其有效期，用于身份验证和账户关联。平台当前不使用这些授权访问你的
                Google Drive、Gmail、通讯录或 GitHub 私有代码仓库。
              </p>
              <p>
                开启邮箱验证码服务时，你的收件邮箱和验证码邮件内容会交由邮件服务商发送；当前邮件集成使用
                Resend。平台内的验证码以哈希形式保存并设有有效期。
              </p>
            </section>

            <section aria-labelledby="privacy-learning">
              <h2 id="privacy-learning">学习记录与私密反馈</h2>
              <p>
                为支持续播、练习和教学，平台保存课程权限、视频播放位置、完成进度、笔记与收藏，以及你提交的代码、判题结果、作业链接和评审记录。课程更新与工单回复也会产生站内通知及已读记录。
              </p>
              <p>
                登录后，交卷的模拟 OA 成绩、自建题单、对题目和题库面试题的「我面试被问到过」报告，以及给面经和面试题的点赞也保存在你的账号里。题单默认私有，设为公开后持链接的人都能看到和复制；公开主页默认关闭，打开后只显示你设定的主页名、简介和刷题统计，以及由此得到的徽章（包括按月的每日一题全勤，和你选择展示在主页名旁的一枚），不显示昵称和邮箱。你还可以选填最多 4 个链接（个人网站、GitHub、LinkedIn、X，只接受 https）、学校、毕业年份和目标岗位，填了就显示在公开主页上；学校是自填的，不做核实。同时打开「展示比赛记录」后，你会出现在这所学校的比赛排行榜上（同校至少 3 人公开时才有这个榜，榜上注明学校未经验证，不被搜索引擎收录）。公开主页还会按年份显示热力图和年度回顾（通过题数、所到站点，打开比赛展示时还有当年参赛场数和 rating 变化），是否允许搜索引擎收录跟随主页的设置；别人可以把两到三个公开主页放在一起对比，对比页只显示各自主页上已有的统计，不列出具体题目，也不被搜索引擎收录；只有当你本人在对比之列、并且和其他每个人都互相关注时，才会额外显示大家共同通过的题数。面试报告和点赞只以人数汇总展示，不公开报告人和点赞人。模拟 OA 成绩和 AI 面试评分还会匿名参与「超过多少人」的百分位统计，同一场景不足 20 人（AI 面试不足 30 人）时不显示。
              </p>
              <p>
                你在社区发布的题解、讨论帖、回答和评论（包括系统设计章节下的讨论）以公开主页名或打码后的昵称显示。收藏的帖子只有你自己能看到，帖子上只显示被收藏的总次数。参与讨论帖里的投票时，平台记录你的账号选了哪几项，用来保证每个账号只投一次；结果只显示每个选项的票数和投票人数，不公开谁投了什么。
              </p>
              <p>
                在面经讨论、求职、上岸故事频道，以及面经评论、面试题回答和系统设计章节下发帖时，可以选择匿名发布；面经投稿也可以匿名。匿名内容对其他人不显示主页名、昵称、员工徽章和声望，也不会出现在你的公开主页上；你在自己匿名帖下的回复同样显示为匿名。匿名面经通过审核后，你在它评论区里发的帖子和评论（包括回复别人的评论）一律匿名发出，评论标为「楼主」。平台仍记录作者，你自己和负责审核的老师能看到是谁发的，点赞照常给你积分，但不计入公开的声望。声望是你的帖子被点赞、面经通过审核所得积分的合计（不含匿名内容），只在公开主页名旁边和主页上显示。别人回复你的帖子或评论、用 @主页名 提到你（只认已公开的主页名）时，你会收到站内通知，内容是对方的主页名或打码后的昵称和一行摘要。有人赞了你的帖子时，通知只写当天点赞的人数和帖子标题，不显示是谁点的赞；同一帖子一天内的点赞合并成一条。你屏蔽的人回复或提到你，不会通知你。匿名作者（包括在自己匿名面经下发言的投稿人）的通知不显示名字，它 @ 别人不发通知，它回复你时不论屏蔽与否都会通知你，这样有没有通知都推断不出作者是谁。题目在你正在进行的比赛或认证考试里时，关于它题解讨论的回复和 @ 通知不带摘要。这些通知不发邮件。
              </p>
              <p>
                参加比赛时，计分板只显示你报名时填写的比赛昵称；周赛、入门赛和 1v1 排位的 rating 与胜负记录保存在你的账号里，只有你在公开主页上打开「展示比赛记录」后才会出现在主页上。排位匹配期间，平台暂存你的比赛昵称、对战 rating 和排队时间，匹配成功或取消时删除，离开页面后最迟 20 分钟内删除。报名时可以选择「赛后公开我的 AC 代码」（默认不勾选）：勾选后，比赛结束 15 分钟起，能打开该场比赛的登录用户可以看到你在比赛时间内每题首次通过的代码；之后随时可以在比赛页关掉，关掉后不再向任何人展示。计分板的「只看关注」只列出主页展示比赛记录的人。
              </p>
              <p>
                参加技能认证考试时，平台保存每场考试抽到的题目、开考和交卷时间、成绩与是否通过，用于计时、计分、7 天的重考间隔和你的考试记录；成绩由你在考试时间内的正式提交算出，不会公开。通过后签发的证书和课程结业证书一样，只有你在证书列表里勾选「在公开主页展示」后才会出现在公开主页上，证书页面显示你的账号名称。给课程打分时，平台保存你给的星级（1–5 星，不含文字）和时间；其他人只能看到汇总的平均分和人数，不足 5 人时不显示平均分。
              </p>
              <p>
                预约同伴互面时，服务器保存你填写的昵称、面试类型、级别、可用时段、时区和语言，以及你选填的目标公司和话题；同伴只能看到昵称，匹配通知里会写出你们共同的公司和话题。开着「邮件提醒」时，开始前一天和前一小时会给你已验证的账户邮箱发提醒（经 Resend 发送），内容是面试类型、时间、同伴昵称和会议链接；预约时取消勾选就不会收到。
              </p>
              <p id="privacy-reminders">
                学习提醒默认关闭。在账户页打开后，服务器保存你选的提醒内容（到期复习、连续打卡、每日一题、报名的周赛和入门赛）、每天的提醒时间、时区偏移和语言，每天最多一条，写进站内消息；报名的比赛开始前 1 小时还会再提醒一次。在某台设备上开启推送时，平台保存这台设备的浏览器给出的推送地址（属于 Google、Mozilla、Apple 或 Microsoft 的推送服务，每个账号最多 10 台设备）；推送本身不带任何内容，设备收到后再向本平台读取提醒文字，推送服务商看不到提醒写了什么。关闭这台设备的推送或退出登录时，这个地址随即删除。打开邮件提醒后，每天最多一封发到已验证的账户邮箱（经 Resend 发送），每封都能一键退订。关闭学习提醒会删除这些设置。关注的公司（最多 20 家）只有你自己能看到；它们有新面经通过审核或上线新的 OA 题时，你会收到站内消息，不发邮件，也不推送。
              </p>
              <p id="privacy-tracker">
                使用投递追踪（/career/tracker）时，平台在你的账号里保存你填写的公司、岗位、阶段、投递日期、OA 截止和面试时间、内推信息、职位链接和备注，每个账号最多 300 条。这些记录只有你自己能看到，不出现在公开主页、排行榜和任何统计里；删除一条就从服务器上删除。导出的 CSV 和 OA 截止日历文件在你的浏览器里生成，截止提醒由你自己的日历应用发出，平台不发送提醒。
              </p>
              <p>
                学习小组的聊天消息只有本组成员能看到，显示你在本组填的昵称；消息保留 180 天后自动删除，小组解散时一并删除；小组里有消息被举报、尚未处理时，负责审核的老师可以打开这个小组的聊天查看上下文。私信只有对话双方能看到，只能在互相关注的人之间，或者从内推帖请求内推时开始；你可以设置谁能给你发起新对话，也可以屏蔽对方。私信保留 365 天后自动删除。新私信只产生站内通知，通知里只有对方的公开主页名或打码后的昵称，不含正文，也不发邮件。被举报的聊天消息和私信（只有被举报的那一条）会交给负责审核的老师查看和处理。
              </p>
              <p>
                验证员工身份时，你填写的工作邮箱只用来发送验证码（经 Resend 发送）。平台不保存邮箱本身，只保存它加上服务器密钥后计算的不可逆摘要（用来保证一个工作邮箱只验证一个账号）、邮箱域名和对应的公司，验证有效 1 年。「已验证 · 公司员工」默认哪里都不显示，你可以分别打开公开主页、讨论帖和题解、内推帖三处展示，换成另一家公司的邮箱验证后三处都会重新关闭；讨论帖只限算法、内推和站务频道，面经讨论、求职、上岸故事频道、公司 OA 题的题解和面经评论里永远不显示。公开主页显示徽章时，主页的帖子列表不列出面经讨论、求职、上岸故事帖和公司 OA 题的题解，但这些帖子本身仍署你的主页名。账号设置里随时可以删除验证记录。
              </p>
              <p>
                工单会保存你填写的问题、回复、附件，以及主动关联的课时、视频位置或提交记录。工单、作业和个人提交记录按账户权限提供给你及负责教学管理的老师查看，不作为面向其他学员的公开讨论内容。老师会使用这些资料答疑、评审作业、管理授权和跟进学习问题。
              </p>
              <p>
                算法判题会把提交的代码与测试输入交给平台的隔离执行环境运行。你在工单或作业中主动提供的外部链接，则仍由对应网站按其自身设置控制访问。
              </p>
              <p>
                为缩短运行和提交的等待时间，登录后编辑 C++、Java 或 Go
                代码并停止输入片刻，平台可能将最新草稿发送到服务器预编译。预编译只准备可执行程序，不自动运行测试，也不产生提交记录或学习成绩。预编译请求处理后或到期时会从任务队列移除，编译结果仅作短期缓存。
              </p>
              <p>
                登录后，题目的代码草稿会在你停止输入约 3 秒后保存到服务器，方便在其他设备上接着写；每个账号最多保留 2000 份，最久未改的先删除。模拟 OA 中的题目草稿只留在当前浏览器。代码沙盒（/playground）的运行和自定义输入运行一样交给隔离环境执行：每次运行的代码和输入同样保存在你的运行记录里，你和负责教学管理的老师按权限可以查看，只是不出现在提交列表、统计和学习进度中；分享链接把代码放在网址的 # 之后，服务器不保存链接内容。
              </p>
            </section>

            <section aria-labelledby="privacy-leetcode">
              <h2 id="privacy-leetcode">LeetCode 记录同步</h2>
              <p>
                你主动开始同步时，平台会临时使用你提供的登录凭据，向所选的
                leetcode.cn 或 leetcode.com
                核验账号并读取当前原站会话可访问的提交记录。凭据只在浏览器和服务器处理请求期间的内存中使用，不写入平台数据库、浏览器本地存储或同步任务；平台不需要你的原站密码，也不会替你提交代码或切换原站刷题会话。
              </p>
              <p>
                平台保存成功提交的原站账号、地区、提交编号、题目、语言、时间及链接，以及同步任务进度；不导入提交代码。这些记录用于你选定轮次的学习进度，并与本站判题记录分开标注。新开一轮不会删除旧记录，也不会自动继承导入进度。你可以停止同步，已导入的记录仍保留；需要删除时可按下方联系方式提出请求。
              </p>
            </section>

            <section aria-labelledby="privacy-payment">
              <h2 id="privacy-payment">购买与支付资料</h2>
              <p>
                开放在线购买的课程使用 Stripe 托管结账页面处理支付。平台会向
                Stripe
                提供结账所需的邮箱、课程与订单标识，并保存订单金额、币种、支付或退款状态、支付平台标识及收据链接，用于对账和开通课程。
              </p>
              <p>
                你在 Stripe
                结账页面输入的完整银行卡号和安全码由支付平台处理，cswork
                的业务数据库不保存这些信息。
              </p>
            </section>

            <section aria-labelledby="privacy-device">
              <h2 id="privacy-device">登录状态、浏览器存储与运行记录</h2>
              <p>
                平台使用必要的 Cookie
                保持登录、完成认证，并记住你选择的界面语言。登录会话可以记录 IP
                地址、设备或浏览器信息与有效期，用于账号安全和查看已登录设备；服务器也会产生访问、错误和管理操作记录，以排查故障和限制滥用。
              </p>
              <p>
                浏览器本地存储用于恢复代码、工单或课件编辑草稿，以及记住编辑器设置等。部分草稿只保存在当前浏览器；未登录时在经典题单上手动标记的“已做”也只存在当前浏览器，登录后打开该题单时会合并到你的账号，并从浏览器中删除。退出账号不会自动清除全部本地草稿。共用设备时，可以在浏览器中清除此网站的存储数据，这也会清除尚未提交的本地内容。签证身份时间线里填写的日期只保存在当前浏览器，不会上传。OA 选择题练习（/oa/mcq）的作答记录和模拟 OA 选择题环节的作答也只保存在当前浏览器，不会上传，也不随模拟成绩同步到账号。
              </p>
              <p>
                把网站安装到主屏后，浏览器会缓存离线提示页和网站自身的脚本、样式等构建文件，不缓存任何页面内容和个人数据；在账号设置里退出登录时，这些缓存会一并清空。
              </p>
              <p>
                平台自己的服务器会记录基本的使用事件（访问的页面、来源网站的域名和推广链接里的 utm 标签、站内搜索词、登录方式、判题耗时与出错情况），用于运营统计。这部分统计不经过 Google，也不受下方 Google Analytics 选项的影响：浏览器本地存储里会保存一个随机生成的匿名访客编号，用来统计访客数；登录时事件会关联到你的账号。我们不记录 IP 地址和设备标识，这些记录保留 120 天。
              </p>
            </section>

            <section aria-labelledby="privacy-storage">
              <h2 id="privacy-storage">可选统计、存储与保留</h2>
              <p>
                只有你点击允许后，平台才加载 Google Analytics 并使用统计
                Cookie，了解访问量、设备和页面类别。Google
                会接收浏览器统计请求，并可能生成大致地区等汇总数据。拒绝不影响网站功能。
              </p>
              <p>
                我们仅发送预先限定的页面类别，不发送邮箱、昵称、用户标识、代码、搜索词、工单内容、邀请令牌或原始网址参数；不启用广告个性化或
                Google
                signals。来源统计只保留白名单内搜索引擎和社交网站的域名，不含路径或搜索内容。统计
                Cookie 有效期为 90 天。
              </p>
              <p>
                可随时通过右下角“Privacy /
                隐私设置”撤回同意，停止后续统计并清除本网站的 Google Analytics
                Cookie。之前已收集的数据不会因此自动删除；选择只保存在当前浏览器。详见{' '}
                <a href="https://policies.google.com/privacy" rel="noreferrer">
                  Google 隐私政策
                </a>
                。
              </p>
              <p>
                cswork
                使用独立的应用、数据库和文件目录保存课程业务数据、视频及附件。当前部署与
                CSGrad 共用服务器基础设施，但两者的业务和账户数据没有对接。
              </p>
              <p>
                除提供服务所需的教师和运维访问外，第三方登录、邮件和支付功能会与相应服务商交换完成这些功能所需的资料。课程中的外部图片或视频链接也可能让浏览器向对应资源服务商发出请求。打开 Python 逐行调试器时，浏览器会从 jsDelivr（cdn.jsdelivr.net）下载 Pyodide 运行时；你的代码和输入只在浏览器里运行，不会发给 jsDelivr 或本平台。
              </p>
              <p>
                在题目页使用 AI 助教（提示、代码点评、追问、边界用例、失败调试、复杂度分析或解释选中的题面文字）时，服务器会把这道题的题面、你当前的代码和你在这道题上最近一次判题结果发送给
                Anthropic，用于生成回复；追问时还会发送本页最近几轮问答，调试时还会发送你自己能看到的失败信息（判题结果、报错和公开样例或自定义输入的输入输出，不含隐藏测试数据），解释题面时只发送题面和你选中的文字、不发送代码。不发送邮箱、姓名或账户标识。平台只记录每天的调用次数和用量，不保存发送的内容和 AI 的回复。不使用 AI 助教就不会发送。
              </p>
              <p>
                使用模拟面试的 AI 面试官时，服务器会把这道题的题面和面试官参考资料、你这一题的对话、计时和代码框里的代码发送给 Anthropic，用于生成面试官的回复和结束时的评估；系统设计和低层设计题点「完成这一步」时，还会发送这一步的对话，用于这一步的打分和建议。招聘方初筛和 offer 谈判的角色扮演会发送练习场景（虚构的公司类型、岗位和 offer 数字）和你的对话，场景里的招聘方底线只在服务器上。同样不发送邮箱、姓名或账户标识。平台不保存对话和评估文字（它们只存在你的浏览器里），只保存每场评估的各项 1–4 分和结论，用于和同类面试比较；生成评估前你自己打的 1–4 分（可以不打）也和这场评估存在一起，只用于「我的进度」里你自己的自评校准，不对外显示。语音输入使用浏览器自带的语音识别，部分浏览器（例如 Chrome）会把录音发送到浏览器厂商的服务器转成文字，这一过程不经过本平台；不点语音输入就不会录音。模拟 OA 的代码回放和专注度自检（离开页面的时段、超过 40 字符的粘贴）只保存在你的浏览器里，不会上传，也不用于监考。
              </p>
              <p>
                在搜索框（⌘K）里点「问 AI」时，服务器会把你的问题、你选中的页面文字（如有）和站内匹配到的几段公开内容发送给
                Anthropic，用于生成带出处的回答；同样不发送邮箱、姓名或账户标识，也只记录调用次数和用量。只搜索不提问不会发送。
              </p>
              <p id="privacy-resume">
                在「简历 AI 点评」页（/career/resume）提交时，服务器会把你粘贴的简历文字、目标岗位和职位描述（如有）发送给
                Anthropic，用于生成点评；不发送你的邮箱或账户标识。简历里本身写着的姓名、电话等信息会随文字一起发送，提交前可以先删掉。平台不保存简历文字和点评结果，只记录每天的调用次数和用量；点评只显示在你当前的浏览器页面里。不提交就不会发送。
              </p>
              <p id="privacy-ai-round">
                在「AI 辅助编程轮」练习（/ai-assisted）里点「运行测试」时，项目的全部文件会交给隔离环境运行公开测试和隐藏测试；这些文件和测试结果像代码沙盒的运行一样保存在你的运行记录里，你和负责教学管理的老师按权限可以查看，不出现在提交列表、统计、积分和学习进度中。编辑中的文件只保存在当前浏览器。使用 AI 结对时，服务器会把这道练习的说明、你当前的文件（总量有上限，超出的只发送文件名）、最近几轮对话和你上一次运行的公开测试结果（隐藏测试只有通过数量）发送给
                Anthropic，用于生成回复；不发送邮箱、姓名或账户标识，平台只记录每天的调用次数和用量，不保存发送的内容和 AI 的回复。不提问就不会发送。
              </p>
              <p>
                平台会为持续提供课程、处理教学反馈、对账及故障恢复保留必要资料和备份，目前没有对所有账户及学习记录统一设置自动删除期限。业务数据与备份的清理时间可能不同；收到删除请求后，会确认涉及的资料、处理范围及需要保留的记录。
              </p>
            </section>

            <section aria-labelledby="privacy-contact">
              <h2 id="privacy-contact">查看、更正或删除你的资料</h2>
              <p>
                你可以在账号页修改昵称、管理登录方式并退出其他设备的会话。若希望查询、更正或删除账户及相关学习资料，请使用你的账户邮箱联系：
              </p>
              <a className="privacy-contact" href="mailto:capsfly7@gmail.com">
                capsfly7@gmail.com
              </a>
              <p>
                邮件中请说明你的 cswork
                账户邮箱和希望处理的资料。平台目前没有自助销号入口，需要先核验请求人与账户的关系，再确认具体处理方式。请勿在邮件中发送密码、验证码或完整银行卡资料。
              </p>
              <p>
                如果你对这份说明或平台的数据处理有疑问，也可以使用上述邮箱联系。平台行为变化时，会更新本页面并标明更新日期。
              </p>
            </section>
          </>
        ) : (
          <>
            <p className="privacy-eyebrow">About your data</p>
            <h1>Privacy notice</h1>
            <p className="privacy-intro">
              cswork is a learning platform that offers courses, videos, coding
              practice, and teaching feedback. This notice explains how the
              platform currently handles your data and how you can contact us.
            </p>
            <p className="privacy-updated">Updated October 15, 2026</p>

            <section aria-labelledby="privacy-account">
              <h2 id="privacy-account">Accounts and third-party sign-in</h2>
              <p>
                When you create and use an account, the platform stores your
                email address, nickname, email verification status, and account
                identifier to identify you, match your course access, and
                provide account management. If you sign in with a password, the
                platform stores a hash of the password; it does not store the
                password in plain text.
              </p>
              <p>
                When you choose to sign in with Google or GitHub, or to link
                either to your account, the platform receives the basic
                information you authorize to be shared, such as your third-party
                account identifier, name or nickname, email address, and avatar
                URL. The authentication system may also store the authorization
                tokens returned by that sign-in method, along with their
                expiration times, for identity verification and account linking.
                The platform does not currently use these authorizations to
                access your Google Drive, Gmail, contacts, or private GitHub
                repositories.
              </p>
              <p>
                When the email verification code service is enabled, your email
                address and the content of the verification email are passed to
                an email service provider for delivery; the current email
                integration uses Resend. Verification codes are stored on the
                platform in hashed form and expire after a set time.
              </p>
            </section>

            <section aria-labelledby="privacy-learning">
              <h2 id="privacy-learning">
                Learning records and private feedback
              </h2>
              <p>
                To support resuming playback, practice, and teaching, the
                platform stores your course access, video playback positions,
                completion progress, notes and bookmarks, as well as the code
                you submit, judge results, assignment links, and review records.
                Course updates and ticket replies also create on-site
                notifications and records of whether they have been read.
              </p>
              <p>
                When you are signed in, finished mock OA results, the problem
                lists you create, your “I was asked this” reports on problems
                and library interview questions, and your upvotes on
                experiences and interview questions are also stored with your
                account. Lists are private until you make one
                public, after which anyone with the link can view and copy it.
                The public profile is off by default; when on, it shows only the
                handle and bio you chose, your practice statistics and the
                badges they earn (including daily-problem months, and one badge
                you may feature beside your handle), never your name or email.
                You may also add up to four links (website, GitHub, LinkedIn,
                X; https only), a school, a graduation year and a target role,
                which then show on the profile; schools are self-reported and
                never checked. With showing contests also on, you appear on your
                school’s contest board (a school gets one once 3 learners show
                it; the board says schools are unverified and stays out of
                search). The profile also shows a heatmap per year and a year in
                review (problems solved, stops reached and, with contests shown,
                that year’s contests and rating change), indexed only if your
                profile is. Anyone can put two or three public profiles side by
                side: the comparison shows only the counts each profile already
                shows, never which problems, and stays out of search. How many
                problems all of them solved appears only to one of the people
                compared who follows each of the others and is followed back.
                Interview reports and upvotes are shown only as counts of
                people; reporters and voters are never named. Mock OA scores and
                AI interview scores also count, anonymously, toward the
                percentiles other learners see, which only appear once a
                scenario has 20 people (30 for AI interviews).
              </p>
              <p>
                Solutions, threads, answers and comments you post in the
                community (including a system design chapter’s discussion)
                show under your public handle or a masked display name. Only you
                can see which posts you saved; a post shows only how many people
                saved it. When you vote in a thread’s poll, the platform
                records which options your account chose, so each account votes
                once; results show only each option’s count and the number of
                voters, never who voted for what.
              </p>
              <p>
                You may post anonymously in the Interviews, Careers and Offers
                channels, under interview experiences and questions and in a
                system design chapter’s discussion, and you may submit an
                interview experience anonymously. Others then see no handle,
                name, employee badge or reputation, it stays off your public
                profile, and your replies under your own anonymous post show as
                anonymous too. Once an anonymous interview report is approved,
                everything you post in its comments, replies to others’
                comments included, goes up anonymously, with your comments
                marked OP. The platform still records you as the author:
                you and the reviewing instructors can see it is yours, and
                upvotes still earn you points, though not public reputation.
                Reputation is the points your posts’ upvotes and approved
                interview reports earned (anonymous ones left out), shown only
                beside your public handle and on your profile. When someone
                replies to your post or comment or mentions you by @handle (only
                visible handles count), you get an on-site notification with
                their handle or masked name and a one-line excerpt. When people
                upvote your post, the notification gives only how many did so
                that day and the post’s title, never who; a day’s upvotes on one
                post merge into one. Replies and mentions from someone you
                blocked don’t notify you. An anonymous author’s notifications
                (an anonymous report’s author’s in its comments included) carry
                no name, its @mentions notify no one, and its replies to you
                notify you even if you blocked them, so whether a notification
                arrives never hints at who wrote it. While a problem is in your
                running contest or certification exam, reply and mention
                notifications about its solutions carry no excerpt. No email is sent for these.
              </p>
              <p>
                In contests, scoreboards show only the contest name you enter
                with. Weekly, starter and ranked 1v1 ratings and duel records are
                stored with your account and appear on your public profile only
                if you turn on showing contests there. While you wait for a
                ranked duel, the platform keeps your contest name, duel rating
                and queue time, deleted once you are matched or cancel, and
                within 20 minutes of leaving the page. When
                entering you may choose to show your accepted code after the
                contest (off by default): if you do, from 15 minutes after the
                end, signed-in readers who can open that contest see the first
                accepted code you submitted for each question during it. You
                can turn this off on the contest page at any time, after which
                it is no longer shown to anyone. The
                scoreboard’s “only people I follow” view lists only people whose
                profile shows contests.
              </p>
              <p>
                When you take a skill certification exam, the platform keeps the
                questions it drew, the start and hand-in times, the score and
                whether you passed, for the timer, the scoring, the 7-day retake
                interval and your exam history. The score comes from your formal
                submissions during the exam and is never published. Certificates
                you earn work like course certificates: they appear on your
                public profile only if you tick “show on my public profile”, and
                the certificate page shows your account name. When you rate a
                course, the platform keeps your stars (1–5, no text) and when you
                gave them; others see only the average and the number of
                ratings, and no average until 5 people have rated.
              </p>
              <p>
                When you book a peer mock interview, the server keeps the name
                you enter, the interview type, level, the hours you offer, your
                time zone and language, and any target companies and topics you
                add. Partners see only that name; the match notice lists the
                companies and topics you share. With email reminders on, your
                verified account email gets a reminder a day and an hour before
                the session (sent through Resend) with the type, time, your
                partner&apos;s name and the call link; untick it when booking to
                get none.
              </p>
              <p id="privacy-reminders">
                Reminders are off by default. Turn them on in your account and
                the server keeps what you want reminding of (reviews due,
                streaks, the daily problem, weeklies and starters you entered),
                the hour, your time zone offset and language: at most one
                reminder a day, in your notifications, plus one an hour before
                a contest you entered. When you turn push on for a device, the
                platform keeps the push address its browser gives (a Google,
                Mozilla, Apple or Microsoft push service; at most 10 devices an
                account). Pushes carry no content: the device then fetches the
                reminder text from cswork, so the push service never sees it.
                Turning push off on that device, or signing out there, deletes
                the address. With email reminders on, at most one email a day
                goes to your verified account address (sent through Resend),
                each with one-click unsubscribe. Turning reminders off deletes
                these settings. The companies you follow (up to 20) are visible
                only to you; a newly approved interview report or new OA
                problem at one of them is a notification, never an email or
                push.
              </p>
              <p id="privacy-tracker">
                When you use the application tracker (/career/tracker), your
                account keeps the company, role, stage, application date, OA
                deadline and interview time, referral, job link and notes you
                enter, up to 300 applications. Only you can see them: they never
                appear on your public profile, on leaderboards or in any
                statistics, and deleting one removes it from the server. The CSV
                and the OA deadline calendar file are made in your browser, and
                the reminders come from your own calendar app; the platform sends
                none.
              </p>
              <p>
                Study group chat messages are seen only by that group&apos;s
                members, under the name you use in the group; they are deleted
                after 180 days, and with the group when it is disbanded.
                Moderating teachers can read a group&apos;s chat only while a
                message in it is reported and not yet handled. Direct
                messages are seen only by the two people in the conversation,
                which can start only between people who follow each other or
                from a referral thread&apos;s request button; you choose who may
                start a conversation with you, and you can block anyone. Direct
                messages are deleted after 365 days. A new one only creates an
                on-site notification naming the sender by public handle or a
                masked name, never its text, and no email. A reported chat or
                direct message (only that one message) is shown to the teachers
                who moderate the community.
              </p>
              <p>
                When you verify where you work, the work email you enter is used
                only to send the code (through Resend). The platform never keeps
                the address: only a one-way digest of it computed with a server
                secret (so one work email verifies one account), its domain and
                the company, valid for a year. &ldquo;Verified &middot; company
                employee&rdquo; shows nowhere by default; you can turn it on
                separately for your public profile, threads and solutions, and
                referral threads, and all three turn off again when you verify
                a work email at another company. Threads means the Algorithms,
                Referrals and Site feedback channels: it never shows in the
                Interviews, Careers or Offers channels, on solutions to a
                company&rsquo;s OA problems or on experience comments. While
                your public profile shows the badge, its post list leaves out
                Interviews, Careers and Offers threads and OA solutions, though
                those posts still carry your handle. You can remove the
                verification in account settings at any time.
              </p>
              <p>
                Tickets store the questions you write, replies, and attachments,
                along with any lessons, video positions, or submissions you
                choose to link. Tickets, assignments, and personal submission
                records are visible to you and to the teachers responsible for
                teaching and course management, according to account
                permissions; they are not public discussion content for other
                students. Teachers use this information to answer questions,
                review assignments, manage access, and follow up on learning
                issues.
              </p>
              <p>
                For algorithm judging, submitted code and test inputs are sent
                to the platform’s isolated execution environment to run. Access
                to external links that you choose to provide in tickets or
                assignments remains controlled by the corresponding websites
                according to their own settings.
              </p>
              <p>
                To shorten the wait when you run or submit code, if you are
                signed in and stop typing for a moment while editing C++, Java,
                or Go code, the platform may send your latest draft to the
                server to precompile it. Precompiling only prepares an
                executable program; it does not run tests automatically and does
                not create a submission record or a grade. Precompile requests
                are removed from the job queue after they are processed or when
                they expire, and compiled results are cached only for a short
                time.
              </p>
              <p>
                When you are signed in, your code drafts on problems are saved
                to the server about 3 seconds after you stop typing, so you can
                continue on another device. Each account keeps up to 2,000
                drafts; the least recently edited go first. Drafts of mock OA
                questions stay in the current browser only. Runs in the code
                playground (/playground) execute in the isolated environment
                like custom-input runs, and like them each run&apos;s code and
                input are kept with your run records, which you and the
                teachers who manage your learning can view under their
                permissions; they never appear in your submission list,
                statistics or progress. A share link carries the code after
                the # in the address, which the server does not store.
              </p>
            </section>

            <section aria-labelledby="privacy-leetcode">
              <h2 id="privacy-leetcode">LeetCode record sync</h2>
              <p>
                When you choose to start a sync, the platform temporarily uses
                the sign-in credentials you provide to verify your account with
                the leetcode.cn or leetcode.com site you selected, and to read
                the submission records that your current LeetCode session can
                access. The credentials are used only in memory, in the browser
                and on the server, while the request is being processed; they
                are not written to the platform database, browser local storage,
                or sync jobs. The platform does not need your LeetCode password,
                and it does not submit code on your behalf or switch your
                LeetCode practice session.
              </p>
              <p>
                For successful submissions, the platform stores the LeetCode
                account, region, submission ID, problem, language, time, and
                link, along with sync job progress; it does not import the
                submitted code. These records are used for your learning
                progress in the round you select and are labeled separately from
                this site’s judge records. Starting a new round does not delete
                old records, and it does not automatically carry over imported
                progress. You can stop syncing, and records already imported are
                kept; if you want them deleted, you can request this using the
                contact details below.
              </p>
            </section>

            <section aria-labelledby="privacy-payment">
              <h2 id="privacy-payment">Purchases and payment information</h2>
              <p>
                Courses offered for online purchase use a Stripe-hosted checkout
                page to process payments. The platform provides Stripe with the
                email address and the course and order identifiers needed for
                checkout, and stores the order amount, currency, payment or
                refund status, payment platform identifiers, and receipt link
                for reconciliation and to grant course access.
              </p>
              <p>
                The full card number and security code you enter on the Stripe
                checkout page are processed by the payment platform; cswork’s
                business database does not store this information.
              </p>
            </section>

            <section aria-labelledby="privacy-device">
              <h2 id="privacy-device">
                Sign-in status, browser storage, and operational logs
              </h2>
              <p>
                The platform uses necessary cookies to keep you signed in, to
                complete authentication, and to remember the site language you
                choose. Sign-in sessions may record your IP address, device or
                browser information, and expiration time, for account security
                and so you can see which devices are signed in; the server also
                generates access, error, and administrative action logs to
                troubleshoot problems and limit abuse.
              </p>
              <p>
                Browser local storage is used for things like restoring drafts
                of code, tickets, or course materials you are editing, and
                remembering editor settings. Some drafts are saved only in the
                current browser. Problems you tick as done on a classic list
                while signed out also stay in this browser until you open that
                list signed in, when they move into your account and leave the
                browser. Signing out does not automatically clear all
                local drafts. On a shared device, you can clear this site’s
                stored data in your browser; this also clears local content that
                has not been submitted yet. Dates you enter in the visa timeline
                stay in the current browser and are never uploaded. So do your
                answers on the OA multiple-choice practice page (/oa/mcq) and in
                a mock OA&apos;s multiple-choice section: they are not uploaded and
                do not sync to your account with mock OA results.
              </p>
              <p>
                If you install the site to your home screen, the browser caches
                the offline page and the site&apos;s own build files (scripts,
                styles); it caches no page content and no personal data, and
                signing out in account settings empties these caches.
              </p>
              <p>
                The platform&apos;s own server records basic usage events (pages
                viewed, the referring site&apos;s domain and campaign (utm) tags,
                site searches, sign-in method, judging time and errors) for
                operating statistics. These do not go to Google and do not depend on the
                Google Analytics choice below: your browser&apos;s local storage
                keeps a randomly generated anonymous visitor ID so visitors can
                be counted, and when you are signed in, events are linked to
                your account. We do not record IP addresses or device
                identifiers, and these records are kept for 120 days.
              </p>
            </section>

            <section aria-labelledby="privacy-storage">
              <h2 id="privacy-storage">
                Optional analytics, storage, and retention
              </h2>
              <p>
                Only after you allow it, we load Google Analytics and use
                analytics cookies to measure visits, devices and page
                categories. Google receives browser analytics requests and may
                derive approximate location reports. Declining does not affect
                site features.
              </p>
              <p>
                We send predefined page categories and allowlisted search/social
                source domains without paths or queries, not email, names, user
                IDs, code, search terms, ticket content, invitation tokens or
                raw URL parameters. Advertising personalization and Google
                signals are disabled. Analytics cookies expire after 90 days.
              </p>
              <p>
                You can withdraw consent through “Privacy / 隐私设置” at the
                bottom right. This stops future analytics and clears this site's
                Google Analytics cookies, but does not automatically delete
                previously collected data. Your choice is stored in the current
                browser only. See{' '}
                <a href="https://policies.google.com/privacy" rel="noreferrer">
                  Google's privacy policy
                </a>
                .
              </p>
              <p>
                cswork uses a separate application, database, and file directory
                to store its course business data, videos, and attachments. The
                current deployment shares server infrastructure with CSGrad, but
                the business and account data of the two are not linked.
              </p>
              <p>
                Apart from the teacher and operations access needed to provide
                the service, the third-party sign-in, email, and payment
                features exchange the information needed to perform those
                functions with the corresponding service providers. External
                image or video links in courses may also cause your browser to
                send requests to the corresponding resource providers. Opening the
                Python step debugger makes your browser download the Pyodide
                runtime from jsDelivr (cdn.jsdelivr.net); your code and input
                run only in the browser and are not sent to jsDelivr or to
                cswork.
              </p>
              <p>
                When you use the AI tutor on a problem page (a hint, a code
                review, a question, edge-case ideas, debugging help, a
                complexity check or an explanation of selected statement
                text), the server sends that problem's statement, your
                current code and your latest verdict on that problem to
                Anthropic to write the reply. A question also sends the last
                few questions and answers on the page; debugging also sends
                the failure details you can see yourself (the verdict, error
                messages, and the input and output of a public example or
                your custom input, never hidden test data); an explanation
                sends only the statement and the text you selected, not your
                code. Your email, name and account identifiers are not sent.
                The platform records only how many calls you make each day
                and their usage, never what was sent or the AI's reply.
                Nothing is sent unless you use the tutor.
              </p>
              <p>
                When you use the AI interviewer in a mock interview, the server
                sends the question, its interviewer notes, your conversation on
                that question, the clock and the code in the code box to
                Anthropic to write the interviewer&apos;s replies and the final
                report; when you finish a step of a system design or low-level
                design question, it also sends that step&apos;s conversation to
                score it and suggest one fix. Your email, name and account
                identifiers are not sent. The recruiter-screen and
                offer-negotiation role-plays send the practice scenario (a
                fictional company type, role and offer figures) and your
                conversation; the recruiter&apos;s limits in the scenario stay
                on the server. The platform keeps neither the conversation nor
                the report text (they live in your browser), only each
                report&apos;s 1–4 scores and verdict, to compare with similar
                interviews, and the 1–4 scores you give yourself before a
                report (if you do), kept with it only for your own
                self-assessment calibration under My progress and never shown
                to anyone else. Dictation uses your browser&apos;s own
                speech recognition; some browsers (Chrome, for example) send the
                audio to the browser maker&apos;s servers to turn it into text,
                without going through this platform, and nothing is recorded
                unless you press dictate. Mock OA code replays and the focus
                self-check (time away from the page, pastes over 40 characters)
                stay in your browser, are never uploaded and are not
                proctoring.
              </p>
              <p>
                When you choose Ask AI in the search box (⌘K), the server sends
                your question, any page text you selected and a few matching
                public CSWork pages to Anthropic to write an answer that cites
                them. Again no email, name or account identifier is sent, and
                only call counts and usage are recorded. Searching without
                asking sends nothing.
              </p>
              <p id="privacy-resume">
                When you submit on the AI resume review page (/career/resume),
                the server sends the resume text you pasted, the target role and
                any job description to Anthropic to write the review. Your email
                and account identifier are not sent, but anything written in the
                resume itself (such as your name or phone number) goes with the
                text, so remove it first if you prefer. The platform does not
                store the resume text or the review; it records only daily call
                counts and usage, and the review exists only on your open page.
                Nothing is sent unless you submit.
              </p>
              <p id="privacy-ai-round">
                When you run the tests of an AI-assisted round project
                (/ai-assisted), every file of the project goes to the isolated
                environment to run the public and hidden tests. Like playground
                runs, the files and results are kept in your run records, which
                you and the instructors who manage teaching can view under their
                permissions; they never appear in your submissions, statistics,
                points or progress. Files you are editing stay in your browser.
                When you use the AI pair, the server sends the project's brief,
                your current files (up to a size cap; beyond it only file names),
                the last few turns of the conversation and your last run's public
                test results (hidden tests as counts only) to Anthropic to write a
                reply. No email, name or account identifier is sent; the platform
                records only daily call counts and usage, never what was sent or
                the AI's reply. Nothing is sent unless you ask.
              </p>
              <p>
                The platform retains necessary data and backups to keep
                providing courses, handle teaching feedback, reconcile payments,
                and recover from failures, and it currently does not set a
                uniform automatic deletion period for all accounts and learning
                records. Business data and backups may be cleaned up at
                different times; after receiving a deletion request, we will
                confirm the data involved, what will be handled, and the records
                that need to be kept.
              </p>
            </section>

            <section aria-labelledby="privacy-contact">
              <h2 id="privacy-contact">
                Viewing, correcting, or deleting your data
              </h2>
              <p>
                On your account page, you can change your nickname, manage
                sign-in methods, and sign out sessions on other devices. To look
                up, correct, or delete your account and related learning data,
                please contact us from your account email address:
              </p>
              <a className="privacy-contact" href="mailto:capsfly7@gmail.com">
                capsfly7@gmail.com
              </a>
              <p>
                In your email, please include your cswork account email address
                and the data you want handled. The platform does not currently
                offer self-service account deletion; we first need to verify the
                requester’s relationship to the account, then confirm how the
                request will be handled. Please do not send passwords,
                verification codes, or full card details by email.
              </p>
              <p>
                If you have questions about this notice or how the platform
                handles data, you can also contact us at the email address
                above. When the platform’s behavior changes, we will update this
                page and note the date of the update.
              </p>
            </section>
          </>
        )}
      </article>
      <footer className="privacy-footer">
        <span>{t('cswork · 学习工作台', 'cswork · Learning workspace')}</span>
        <Link href="/">{t('返回首页', 'Back to home')}</Link>
      </footer>
    </main>
  );
}
