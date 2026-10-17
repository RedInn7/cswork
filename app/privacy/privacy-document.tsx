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
            <p className="privacy-updated">更新于 2026 年 10 月 17 日</p>

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
                登录后，交卷的模拟 OA 成绩、自建题单、对题目和题库面试题的「我面试被问到过」报告，给面经和面试题的点赞，以及对官方题解「有帮助 / 没帮助」的评价也保存在你的账号里。题单默认私有，设为公开后持链接的人都能看到和复制；公开主页默认关闭，打开后只显示你设定的主页名、简介和刷题统计，以及由此得到的徽章（包括按月的每日一题全勤，和你选择展示在主页名旁的一枚），不显示昵称和邮箱。你还可以选填最多 4 个链接（个人网站、GitHub、LinkedIn、X，只接受 https）、学校、毕业年份和目标岗位，填了就显示在公开主页上；学校是自填的，不做核实。同时打开「展示比赛记录」后，你会出现在这所学校的比赛排行榜上（同校至少 3 人公开时才有这个榜，榜上注明学校未经验证，不被搜索引擎收录）。公开主页还会按年份显示热力图和年度回顾（通过题数、所到站点，打开比赛展示时还有当年参赛场数和 rating 变化），是否允许搜索引擎收录跟随主页的设置；别人可以把两到三个公开主页放在一起对比，对比页只显示各自主页上已有的统计，不列出具体题目，也不被搜索引擎收录；只有当你本人在对比之列、并且和其他每个人都互相关注时，才会额外显示大家共同通过的题数。面试报告、点赞和题解评价只以人数汇总展示，不公开报告人、点赞人和评价人。模拟 OA 成绩和 AI 面试评分还会匿名参与「超过多少人」的百分位统计，同一场景不足 20 人（AI 面试不足 30 人）时不显示。
              </p>
              <p>
                你在社区发布的题解、讨论帖、回答和评论（包括系统设计章节下的讨论）以公开主页名或打码后的昵称显示。收藏的帖子只有你自己能看到，帖子上只显示被收藏的总次数。参与讨论帖里的投票时，平台记录你的账号选了哪几项，用来保证每个账号只投一次；结果只显示每个选项的票数和投票人数，不公开谁投了什么。
              </p>
              <p>
                在面经讨论、求职、上岸故事频道，以及面经评论、面试题回答和系统设计章节下发帖时，可以选择匿名发布；面经投稿也可以匿名。面经里有 OA 轮次时，可以选填 OA 成绩（做出几题、共几题、通过用例的比例、用时，以及是否进了下一轮），随面经一起公开；公司页上的 OA 统计只显示汇总的人数，同一组不足 8 篇公开面经时不显示。匿名内容对其他人不显示主页名、昵称、员工徽章和声望，也不会出现在你的公开主页上；你在自己匿名帖下的回复同样显示为匿名。匿名面经通过审核后，你在它评论区里发的帖子和评论（包括回复别人的评论）一律匿名发出，评论标为「楼主」。平台仍记录作者，你自己和负责审核的老师能看到是谁发的，点赞照常给你积分，但不计入公开的声望。声望是你的帖子被点赞、面经通过审核所得积分的合计（不含匿名内容），只在公开主页名旁边和主页上显示。别人回复你的帖子或评论、用 @主页名 提到你（只认已公开的主页名）时，你会收到站内通知，内容是对方的主页名或打码后的昵称和一行摘要。有人赞了你的帖子时，通知只写当天点赞的人数和帖子标题，不显示是谁点的赞；同一帖子一天内的点赞合并成一条。你屏蔽的人回复或提到你，不会通知你。匿名作者（包括在自己匿名面经下发言的投稿人）的通知不显示名字，它 @ 别人不发通知，它回复你时不论屏蔽与否都会通知你，这样有没有通知都推断不出作者是谁。题目在你正在进行的比赛或认证考试里时，关于它题解讨论的回复和 @ 通知不带摘要。这些通知不发邮件。
              </p>
              <p>
                参加比赛时，计分板只显示你报名时填写的比赛昵称；周赛、入门赛和 1v1 排位的 rating 与胜负记录保存在你的账号里，只有你在公开主页上打开「展示比赛记录」后才会出现在主页上。排位匹配期间，平台暂存你的比赛昵称、对战 rating 和排队时间，匹配成功或取消时删除，离开页面后最迟 20 分钟内删除。报名时可以选择「赛后公开我的 AC 代码」（默认不勾选）：勾选后，比赛结束 15 分钟起，能打开该场比赛的登录用户可以看到你在比赛时间内每题首次通过的代码；之后随时可以在比赛页关掉，关掉后不再向任何人展示。计分板的「只看关注」只列出主页展示比赛记录的人。
              </p>
              <p>
                参加技能认证考试时，平台保存每场考试抽到的题目、开考和交卷时间、成绩与是否通过，用于计时、计分、7 天的重考间隔和你的考试记录；成绩由你在考试时间内的正式提交算出，不会公开。通过后签发的证书和课程结业证书一样，只有你在证书列表里勾选「在公开主页展示」后才会出现在公开主页上，证书页面显示你的账号名称。给课程打分时，平台保存你给的星级（1–5 星，不含文字）和时间；其他人只能看到汇总的平均分和人数，不足 5 人时不显示平均分。
              </p>
              <p id="privacy-practice-board">
                做定位测验（/placement）时，进行中的题目和作答、以及最近一次结果（各组答对数、估计水平、是否可以跳过和推荐题）由服务器存在你的账号里，用来在冲刺计划里标出已掌握的站；重测会覆盖旧结果，不发给任何第三方，也不用 AI。练习排行榜（/leaderboard）需要你在公开主页打开后才会上榜：上榜后显示主页名、练习积分、通过题数和连续打卡天数，可以按你自填的学校（未经验证）和提交语言筛选，关闭后立即下榜。公开主页还提供 /u/&lt;主页名&gt;/badge.svg 徽章，可以放进 README，显示通过题数和连续天数，上榜时加上积分和名次，主页关闭后失效；主页上新增的累计解题和每日难度图显示每道题首次通过的日期和难度。
              </p>
              <p id="privacy-share-cards">
                公开主页、证书、OA 公司页和周赛、入门赛的链接被分享到社交网站或聊天软件时，链接预览里的图片由本站服务器生成：公开主页的图片只有主页名、按难度的通过题数、最长连续通过天数，以及打开「展示比赛记录」时的最新 rating；证书的图片和证书页一样，显示课程名称、账号名称、日期和验证编号；比赛的图片只有场次名称、日期和参赛人数，私人房间和 1v1 排位只用网站的通用图片。图片用本站自带的字体绘制，不把任何文字发给字体服务或其他第三方；账号名称里有这套字体画不出的字时，改为显示公开主页名，没有公开主页名就不显示名字。证书页的「分享到 LinkedIn」「分享到 X」和只有证书持有人能看到的「添加到 LinkedIn 资料」都只是链接：点击后，浏览器才会把证书链接（添加到资料时还有课程名称、签发年月和验证编号）带到对方网站。
              </p>
              <p>
                预约同伴互面时，服务器保存你填写的昵称、面试类型、级别、可用时段、时区和语言，以及你选填的目标公司和话题；同伴只能看到昵称，匹配通知里会写出你们共同的公司和话题。开着「邮件提醒」时，开始前一天和前一小时会给你已验证的账户邮箱发提醒（经 Resend 发送），内容是面试类型、时间、同伴昵称和会议链接；预约时取消勾选就不会收到。
              </p>
              <p id="privacy-reminders">
                学习提醒默认关闭。在账户页打开后，服务器保存你选的提醒内容（到期复习、连续打卡、每日一题、报名的周赛和入门赛、投递提醒）、每天的提醒时间、时区偏移和语言，每天最多汇总成一条，写进站内消息；报名的比赛开始前 1 小时还会再提醒一次。投递提醒在打开学习提醒时默认勾选，可以单独关掉：服务器读取你投递追踪卡片上的 OA 截止和面试时间，在 OA 截止前 24 小时和 2 小时、面试前 1 小时各写一条站内消息，内容是公司、岗位和时间；投递卡和联系人的跟进日期到了，只在每日汇总里写到期的数量。删除一张投递卡时，它的投递提醒消息一并删除。在某台设备上开启推送时，平台保存这台设备的浏览器给出的推送地址（属于 Google、Mozilla、Apple 或 Microsoft 的推送服务，每个账号最多 10 台设备）；推送本身不带任何内容，设备收到后再向本平台读取提醒文字，推送服务商看不到提醒写了什么。关闭这台设备的推送或退出登录时，这个地址随即删除。打开邮件提醒后，每天最多一封发到已验证的账户邮箱（经 Resend 发送），只含每日汇总，每封都能一键退订。关闭学习提醒会删除这些设置和所有设备的推送地址。关注的公司（最多 20 家）只有你自己能看到；它们有新面经通过审核、上线新的 OA 题或有新的实习/新毕业生岗位时，你会收到站内消息，不发邮件；只有当这条消息里同时有你保存的岗位筛选的新结果时才会推送（见下方「在招岗位」一段）。
              </p>
              <p id="privacy-tracker">
                使用投递追踪（/career/tracker）时，平台在你的账号里保存你填写的公司、岗位、阶段、投递日期、OA 截止和面试时间、内推信息和内推进度、投递渠道、下一步和跟进日期、所用简历版本的名字、职位链接和备注，以及阶段变更记录（每张卡片最近 40 次）和可选的职位描述快照（最多 1 万字），每个账号最多 300 条。职位描述快照只在打开这张卡片时读取，不随列表返回。这些记录只有你自己能看到，不出现在公开主页、排行榜和任何统计里；删除一条就从服务器上删除。每周投递目标存在你账号里的私人笔记（career:goal）中；可选的简历版本名从简历生成器存在这个浏览器里的版本读取。「岗位已下线」提示只是在服务器上拿卡片链接比对本站已同步的公开岗位，不会因此向外部网站发请求。「存到投递看板」书签只在你点它时读取当前招聘页的标题、站点名（或主机名）、网址和你选中的文字，打开投递追踪页并预填表单：选中的文字放在网址 # 后面，浏览器不会把它发给服务器；未登录时，预填内容临时存在当前标签页的会话存储里，登录后读取一次就删除；只有你点保存才会写进账号。导出的 CSV 和日历文件（OA 截止、面试和跟进事项）在你的浏览器里生成；平台自己发出的投递提醒见上一段。
              </p>
              <p id="privacy-jobs">
                「在招岗位」（/career/jobs 和公司页）列出的是各公司在 Greenhouse、Lever、Ashby 上公开发布的招聘信息，由服务器定时抓取，抓取时不发送任何用户数据；点岗位标题会打开第三方的招聘页面。点「加入投递追踪」只是预填表单，你点保存后才写进自己的投递记录；未登录时，这个岗位的公司、职位和链接会临时存在当前标签页的会话存储里，登录后打开投递追踪读取一次就删除。登录后可以保存一个岗位筛选，存成你账号里的私人笔记（career:jobs-search）：不带参数打开 /career/jobs 时会套用它；每天北京时间 9 点后，之前 24 小时内新出现、符合这个筛选的岗位会合成一条站内消息（和关注公司的动态合在一起），开启推送的设备也会收到推送，推送本身不带内容。保存的筛选随时可以删除。登录后，页面还会读取你投递记录里的职位链接，标出已经在投递看板上的岗位；没有保存筛选时，会按你资料里填的目标岗位预选方向。点「隐藏」的岗位只记在当前浏览器的本地存储里（最多 500 个），不会上传。
              </p>
              <p id="privacy-contacts">
                联系人（/career/contacts）是你记录的他人信息：姓名、公司、职位、怎么认识的、链接、上次联系和下次跟进的日期、备注，以及可选关联的一张投递卡，每个账号最多 200 位。它们只保存在你自己的账号里，其他人都看不到，可以随时删除；关联的投递卡删除后，联系人保留，只是不再关联。请只记录求职需要的内容。求职指南各章清单的勾选状态，登录时存成你账号里的私人笔记（checklist:&lt;章节&gt;），未登录时只存在当前浏览器，登录后打开这一章会并入账号并从浏览器删除。外联模板页（/career/templates）登录后在浏览器里读取你的投递卡和联系人来填空；你填的「你的名字」只存在当前浏览器。复制和「在邮件应用中打开」都在你的设备上完成，平台不替你发送任何消息。
              </p>
              <p id="privacy-practice-aids">
                做题时，平台会在你的账号里记下你在一道题上第一次查看第 2 级及以后的提示、打开题解、使用 AI 助教（解释题面除外）的时间，以及第一次通过时题目计时器的读数，用来在「我的进度」里区分独立通过和借助提示通过、统计用时，并安排复习间隔。这些记录只有你自己能看到，不公开，也不计入积分和排行榜；未登录时不记录。平台还会记下你在一道题上第一次白板模式提交是否通过，以及第一次通过前是否有一次对拍结果和参考解完全一致，同样只在「我的进度」里给你自己看；未登录时不记录。白板模式的手动推演草稿作为私人笔记（wb:&lt;题号&gt;）存在你的账号里，未登录时只存在当前浏览器。
              </p>
              <p id="privacy-code-review">
                在提交详情里生成「代码评审链接」后，拿到链接并登录的人都能看到这次提交的代码、你的留言和全部评论；页面只显示公开主页名，没有主页名时显示「作者」或「评审者 N」，不显示昵称和邮箱，也不被搜索引擎收录。服务器只保存链接的哈希，完整链接只在生成时显示一次。你可以随时关闭链接：关闭后链接失效，评论不再对任何人显示，但仍保留在数据库里。有新评论时只发站内通知。每个账号最多同时开 20 条链接，每天最多新建 50 条。
              </p>
              <p>
                学习小组的聊天消息只有本组成员能看到，显示你在本组填的昵称；消息保留 180 天后自动删除，小组解散时一并删除；小组里有消息被举报、尚未处理时，负责审核的老师可以打开这个小组的聊天查看上下文。私信只有对话双方能看到，只能在互相关注的人之间，或者从内推帖请求内推时开始；你可以设置谁能给你发起新对话，也可以屏蔽对方。私信保留 365 天后自动删除。新私信只产生站内通知，通知里只有对方的公开主页名或打码后的昵称，不含正文，也不发邮件。被举报的聊天消息和私信（只有被举报的那一条）会交给负责审核的老师查看和处理。
              </p>
              <p>
                验证员工身份时，你填写的工作邮箱只用来发送验证码（经 Resend 发送）。平台不保存邮箱本身，只保存它加上服务器密钥后计算的不可逆摘要（用来保证一个工作邮箱只验证一个账号）、邮箱域名和对应的公司，验证有效 1 年。「已验证 · 公司员工」默认哪里都不显示，你可以分别打开公开主页、讨论帖和题解、内推帖三处展示，换成另一家公司的邮箱验证后三处都会重新关闭；讨论帖只限算法、内推和站务频道，面经讨论、求职、上岸故事频道、公司 OA 题的题解和面经评论里永远不显示。公开主页显示徽章时，主页的帖子列表不列出面经讨论、求职、上岸故事帖和公司 OA 题的题解，但这些帖子本身仍署你的主页名。账号设置里随时可以删除验证记录。
              </p>
              <p>
                工单会保存你填写的问题、回复、附件，以及主动关联的课时、视频位置或提交记录。工单、作业和个人提交记录按账户权限提供给你及负责教学管理的老师查看，不作为面向其他学员的公开讨论内容。老师会使用这些资料答疑、评审作业、管理授权和跟进学习问题。在选择题、系统设计章节和学习页点「纠错」时，你选的原因和写的说明作为一张工单提交，标题带上对应内容的标记（例如 [mcq:…]），同样只有你和负责的老师能看到。
              </p>
              <p>
                算法判题会把提交的代码与测试输入交给平台的隔离执行环境运行。你在工单或作业中主动提供的外部链接，则仍由对应网站按其自身设置控制访问。
              </p>
              <p>
                为缩短运行和提交的等待时间，登录后编辑 C++、Java 或 Go
                代码并停止输入片刻，平台可能将最新草稿发送到服务器预编译。预编译只准备可执行程序，不自动运行测试，也不产生提交记录或学习成绩。预编译请求处理后或到期时会从任务队列移除，编译结果仅作短期缓存。
              </p>
              <p>
                登录后，题目的代码草稿会在你停止输入约 3 秒后保存到服务器，方便在其他设备上接着写；每个账号最多保留 2000 份，最久未改的先删除。模拟 OA 中的题目草稿只留在当前浏览器。代码沙盒（/playground）的运行和自定义输入运行一样交给隔离环境执行：每次运行的代码和输入同样保存在你的运行记录里，你和负责教学管理的老师按权限可以查看，只是不出现在提交列表、统计和学习进度中；分享链接把代码放在网址的 # 之后，服务器不保存链接内容。OA 调试练习（修复埋入的 bug）的提交和运行也一样：代码和判题结果保存在你的运行记录里，不计积分、不算作通过这道题，也不出现在提交列表、统计和学习进度中；调试练习的代码草稿只留在当前浏览器。代码评审练习里标记的行号只用于当次判分，附加的说明不会上传，服务器都不保存。「对拍」（随机生成小用例，拿你的代码和参考解比对）的代码和生成的输入同样保存在你的运行记录里，不出现在提交列表、统计和学习进度中。通过后弹窗里的代码提示和提交前的「追问」检查都在浏览器里完成，不上传、不保存。
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
                浏览器本地存储用于恢复代码、工单或课件编辑草稿，以及记住编辑器设置等。部分草稿只保存在当前浏览器；未登录时在经典题单上手动标记的“已做”也只存在当前浏览器，登录后打开该题单时会合并到你的账号，并从浏览器中删除。退出账号不会自动清除全部本地草稿。共用设备时，可以在浏览器中清除此网站的存储数据，这也会清除尚未提交的本地内容。签证身份时间线里填写的日期只保存在当前浏览器，不会上传；Offer 对比（/career/offers）里填的数字也只存在当前浏览器的本地存储里，不会上传，「从投递看板导入」只读取你自己投递看板上处于 Offer 阶段的卡片的公司和岗位。模拟 OA 选择题环节的作答也只保存在当前浏览器，不会上传，也不随模拟成绩同步到账号。OA 选择题练习（/oa/mcq）和各题型页小测的作答与复习安排，未登录时存在当前浏览器；登录后存进你账号里的私密笔记（最多 20KB），浏览器里的记录在账号保存成功后删除。登录并验证过邮箱后，你在 /oa/mcq 第一次提交某道题时，服务器还会单独记下这次作答（题号、所选选项、是否答对和时间），只用来计算全站的答对率和各选项的选择人数；不到 20 人作答的题不显示，也不展示任何人的作答。练习页还会读取你自己的系统设计章节测验答案来列出错题，不读取设计草稿。调试与代码评审练习（/oa/drills）完成了哪些，也只记在当前浏览器。
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
                使用模拟面试的 AI 面试官时，服务器会把这道题的题面和面试官参考资料、你这一题的对话、计时和代码框里的代码发送给 Anthropic，用于生成面试官的回复和结束时的评估；系统设计和低层设计题点「完成这一步」时，还会发送这一步的对话，用于这一步的打分和建议。简历项目深挖还会随每条消息和最后的评估发送简历文字：你粘贴的内容，或从简历生成器自动填入的内容（自动填入时默认去掉姓名和联系方式，粘贴的简历按原样发送）；服务器不保存简历，它只存在你浏览器本地存储里这场面试的进度中。招聘方初筛和 offer 谈判的角色扮演会发送练习场景（虚构的公司类型、岗位和 offer 数字）和你的对话，场景里的招聘方底线只在服务器上。同样不发送邮箱、姓名或账户标识。平台不保存对话和评估文字（它们只存在你的浏览器里），只保存每场评估的各项 1–4 分和结论，用于和同类面试比较，并在「我的进度」里给你自己看各维度的走势；生成评估前你自己打的 1–4 分（可以不打）也和这场评估存在一起，只用于「我的进度」里你自己的自评校准，不对外显示。语音输入使用浏览器自带的语音识别，部分浏览器（例如 Chrome）会把录音发送到浏览器厂商的服务器转成文字，这一过程不经过本平台；不点语音输入就不会录音。AI 模拟面试里的表达指标（语速、口头禅、说话时长和停顿）只在浏览器里计算并存在本机，不上传。模拟 OA 和比赛的代码回放和专注度自检（离开页面的时段、超过 40 字符的粘贴）只保存在你的浏览器里，不会上传，也不用于监考；比赛回放只给录制它的参赛者本人看。比赛日历的订阅链接是公开的固定赛程，不含账号信息，单场比赛的日历文件在你的浏览器里生成。
              </p>
              <p>
                在搜索框（⌘K）里点「问 AI」时，服务器会把你的问题、你选中的页面文字（如有）和站内匹配到的几段公开内容发送给
                Anthropic，用于生成带出处的回答；同样不发送邮箱、姓名或账户标识，也只记录调用次数和用量。只搜索不提问不会发送。
              </p>
              <p id="privacy-resume">
                在「简历 AI 点评」页（/career/resume）提交时，服务器会把你粘贴的简历文字、目标岗位和职位描述（如有）发送给
                Anthropic，用于生成点评；不发送你的邮箱或账户标识。简历里本身写着的姓名、电话等信息会随文字一起发送，提交前可以先删掉。平台不保存简历文字和点评结果，只记录每天的调用次数和用量；点评只显示在你当前的浏览器页面里。不提交就不会发送。
              </p>
              <p id="privacy-answer-feedback">
                在面试题、系统设计案例的设计草稿或模拟面试里点「AI 点评我的答案」、或在故事库里点评一个 STAR 故事时，服务器会把你写的答案（或故事各部分和你选的行为面试题）、这道题的题面和参考答案（如有；系统设计案例的参考是这一章的正文）发送给
                Anthropic，用于生成点评；不发送邮箱、姓名或账户标识。平台不保存答案和点评，只记录每天的调用次数和用量。不点就不会发送。
              </p>
              <p id="privacy-jd">
                「JD 准备度检查」（/career/jd）没有启用 AI 时，职位描述只在你的浏览器里做关键词匹配，不会上传；登录后只有匹配到的技能名称（例如 python、sql）会发送给服务器，用来读取你的练习进度，不保存。和简历的比对读取简历生成器存在这个浏览器里的简历（包括各个版本），也只在浏览器里进行。启用 AI 时，提交后服务器只把你粘贴的职位描述发送给
                Anthropic，用于整理出这个岗位要的技能和面试轮次；不发送邮箱、姓名、账户标识或你的练习记录，你的练习进度在服务器上读取，只和结果一起显示给你。职位描述和检查结果都不保存，只记录每天的调用次数和用量。从简历 AI 点评页带过来的职位描述经当前标签页的会话存储传递，读取后立即删除。
              </p>
              <p id="privacy-resume-builder">
                在简历生成器（/career/resume/builder）里填写的内容只保存在当前浏览器的本地存储里，不会上传；「复制为新版本」保存的各个版本也一样；「导出 JSON」的文件也在浏览器里生成。规则检查和「粘贴文本导入」都在浏览器里完成，粘贴的简历文字不会上传。登录后点「从 CSWork 填入」时，页面会向服务器读取你自己的证书、比赛 rating、通过题数和公开主页名（主页公开时），只填到这个页面上，服务器不记录简历内容。点「送去 AI 点评」时，简历的纯文字暂存在当前标签页的会话存储里，简历 AI 点评页读取后立即删除；只有你在那里提交，文字才会按上一段的方式发送给 Anthropic。AI 模拟面试的简历项目深挖也会读取这里的内容（不含姓名和联系方式），只随你发出的消息和最后的评估发送，方式见上面 AI 面试官一段。
              </p>
              <p id="privacy-ai-round">
                在「AI 辅助编程轮」练习（/ai-assisted）里点「运行测试」时，项目的全部文件会交给隔离环境运行公开测试和隐藏测试；这些文件和测试结果像代码沙盒的运行一样保存在你的运行记录里，你和负责教学管理的老师按权限可以查看，不出现在提交列表、统计、积分和学习进度中。编辑中的文件只保存在当前浏览器。使用 AI 结对时，服务器会把这道练习的说明、你当前的文件（总量有上限，超出的只发送文件名）、最近几轮对话和你上一次运行的公开测试结果（隐藏测试只有通过数量）发送给
                Anthropic，用于生成回复；不发送邮箱、姓名或账户标识，平台只记录每天的调用次数和用量，不保存发送的内容和 AI 的回复。不提问就不会发送。点 AI 结对下方的「结束并评估」时，服务器会把你当前的文件、本页的结对对话（最多 40 轮、2.4 万字）、最近一次运行的公开测试结果和隐藏测试通过数、近 3 小时的运行情况发送给 Anthropic；带回家作业点「评估代码质量」时改为发送当前文件、最近一次运行结果和设计说明。评估同样不保存，只记录每天的调用次数和用量。带回家作业（/take-home）点「运行测试」时和上面一样，项目文件和测试结果保存在你的运行记录里；编辑中的代码、计时开始时间和设计说明只保存在当前浏览器。
              </p>
              <p id="privacy-ica">
                「CodeSignal ICA 式练习」（/oa/ica）的运行与上面相同：项目文件和测试结果保存在你的运行记录里，平台据此判断你通过了哪些关卡、解锁下一关。90 分钟计时只记在当前浏览器。这项练习没有 AI 结对，不向任何第三方发送内容。
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
            <p className="privacy-updated">Updated October 17, 2026</p>

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
                and library interview questions, your upvotes on experiences
                and interview questions, and whether you found an official
                editorial helpful are also stored with your account. Lists are private until you make one
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
                Interview reports, upvotes and editorial ratings are shown only
                as counts of people; reporters and voters are never named. Mock OA scores and
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
                interview experience anonymously. An experience with an OA round
                may give its score (problems solved of how many, share of tests
                passed, minutes taken and whether it led to the next round),
                published with the post; company pages show only OA counts
                summed over posts, and none for a group of fewer than 8 public
                posts. Anonymous posts show no handle,
                name, employee badge or reputation, stay off your public
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
              <p id="privacy-practice-board">
                The placement quiz (/placement) keeps the questions and answers
                of a quiz in progress, and your latest result (correct answers per
                group, estimated level, which groups you can skip and the
                suggested problems), in your account on the server; the sprint
                plan uses it to mark the stops you have mastered. A retake
                replaces the old result. Nothing goes to a third party and no AI
                is involved. You appear on the practice leaderboard (/leaderboard)
                only after you turn it on with a public profile: it then shows
                your handle, practice points, problems solved and streak, and can
                be filtered by the school you entered (not verified) and by
                submission language; turning it off removes you at once. A public
                profile also serves a /u/&lt;handle&gt;/badge.svg badge for READMEs
                with your solved count and streak, plus points and rank while you
                are on the board; it stops working when the profile is off. The
                profile&apos;s solve curve and daily difficulty charts show the
                date and difficulty of each problem&apos;s first accepted solve.
              </p>
              <p id="privacy-share-cards">
                When a link to a public profile, a certificate, an OA company
                page or a weekly or starter contest is shared on a social site
                or in a chat app, the preview image is drawn by this site&apos;s
                server. A profile&apos;s image shows only the handle, problems
                solved by difficulty, the longest run of days with an accepted
                answer and, with showing contests on, the latest rating. A
                certificate&apos;s image shows what its page shows: the course,
                the account name, the date and the verification ID. A
                contest&apos;s image shows only its name, date and number of
                entrants; private rooms and ranked duels use the site&apos;s
                generic image. Images are drawn with a font bundled with the
                site, and no text is sent to a font service or any other third
                party: an account name with characters that font lacks is
                replaced by the public handle, or left out when there is none.
                On a certificate page, “Share on LinkedIn”, “Share on X” and
                “Add to LinkedIn profile” (shown only to the holder) are plain
                links: only when you click one does your browser take the
                certificate link (and, when adding to your profile, the course
                name, issue month and verification ID) to that site.
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
                streaks, the daily problem, weeklies and starters you entered,
                job applications), the hour, your time zone offset and
                language: at most one digest a day, in your notifications, plus
                one an hour before a contest you entered. Job application
                reminders come ticked when you turn reminders on and can be
                turned off on their own: the server reads the OA deadlines and
                interview times on your tracker cards and writes a notification
                (company, role and time) 24 hours and 2 hours before an OA
                deadline and an hour before an interview; follow-ups due on
                your cards and contacts appear only as a count in the daily
                digest. Deleting a card deletes its reminder notifications.
                When you turn push on for a device, the
                platform keeps the push address its browser gives (a Google,
                Mozilla, Apple or Microsoft push service; at most 10 devices an
                account). Pushes carry no content: the device then fetches the
                reminder text from cswork, so the push service never sees it.
                Turning push off on that device, or signing out there, deletes
                the address. With email reminders on, at most one email a day
                goes to your verified account address (sent through Resend),
                carrying only the daily digest, each with one-click
                unsubscribe. Turning reminders off deletes
                these settings and every device’s push address. The
                companies you follow (up to 20) are visible
                only to you; a newly approved interview report, a new OA
                problem or a new intern or new-grad opening at one of them is a
                notification, never an email, and pushed only when the same
                notification also carries new matches for your saved job
                search (see Open roles below).
              </p>
              <p id="privacy-tracker">
                When you use the application tracker (/career/tracker), your
                account keeps the company, role, stage, application date, OA
                deadline and interview time, referral and its status, channel,
                next step and follow-up date, the name of the resume version
                used, job link and notes you enter, plus each card&apos;s stage
                history (its last 40 moves) and an optional snapshot of the job
                description (up to 10,000 characters), up to 300 applications.
                The snapshot is read only when you open that card, never with
                the list. Only you can see them: they never appear on your
                public profile, on leaderboards or in any statistics, and
                deleting one removes it from the server. Your weekly
                application goal is a private note on your account
                (career:goal); the resume version names come from the versions
                the resume builder keeps in this browser. &ldquo;Posting
                closed&rdquo; only compares a card&apos;s link on the server with
                the public postings this site has already synced; no request
                goes to another site for it. The &ldquo;Save to tracker&rdquo;
                bookmarklet, only when you click it, reads the job page&apos;s
                title, site name (or host), address and any text you selected,
                and opens the tracker with the form filled in: the selected text
                travels after the # in the address, which browsers never send
                to a server; signed out, the filled-in values wait in this
                tab&apos;s session storage and are deleted once read after you
                sign in; nothing reaches your account until you press save. The
                CSV and the calendar file (OA deadlines, interviews and
                follow-ups) are made in your browser; the reminders the platform
                itself sends are described above.
              </p>
              <p id="privacy-jobs">
                Open roles (/career/jobs and company pages) are the postings
                companies publish on Greenhouse, Lever and Ashby. The server
                fetches them on a schedule and sends no user data when it does;
                a role&apos;s title opens the third-party job page. Add to
                tracker only fills in the form, and nothing is saved to your
                applications until you press save. When you are signed out, the
                role&apos;s company, title and link wait in this tab&apos;s
                session storage and are deleted once the tracker reads them
                after you sign in. Signed in, you can save one job search as a
                private note on your account (career:jobs-search): /career/jobs
                opened without filters applies it, and after 09:00 Beijing time
                each day the new postings of the previous 24 hours that match it
                arrive as one notification (together with your followed
                companies&apos; news), also pushed to devices with push on; the
                push itself carries no content. You can delete the saved search
                at any time. Signed in, the page also reads the job links on
                your own applications to mark roles already on your tracker,
                and without a saved search it preselects the role from the
                target role in your profile. Roles you hide are remembered only
                in this browser&apos;s local storage (up to 500) and never
                uploaded.
              </p>
              <p id="privacy-contacts">
                Contacts (/career/contacts) are details you record about other
                people: name, company, role, how you met, a link, when you last
                and next get in touch, notes and optionally one of your tracker
                cards, up to 200 people. They are kept only in your own account,
                nobody else can see them, and you can delete any at any time; when
                a linked card is deleted, the contact stays without the link.
                Please keep to what your job search needs. Ticks on a career
                guide chapter&apos;s checklist are a private note on your account
                (checklist:&lt;chapter&gt;) when you are signed in, or stay only
                in this browser when you are not, and move into your account (and
                out of the browser) the next time you open that chapter signed in.
                Signed in, the outreach templates page (/career/templates) reads
                your tracker cards and contacts in your browser to fill in the
                blanks; the &ldquo;Your name&rdquo; you enter stays only in this
                browser. Copying and &ldquo;Open in your mail app&rdquo; happen on your
                device, and the platform sends no message for you.
              </p>
              <p id="privacy-practice-aids">
                While you solve a problem, your account records when you first
                open the second or a later hint, open the editorial or use the
                AI tutor (except for explaining the statement), and the problem
                timer&apos;s reading when you first pass. My progress uses this
                to tell independent solves from assisted ones, show your solve
                times and space your reviews. Only you can see it; it is never
                public and never counts toward points or leaderboards. Nothing
                is recorded when you are signed out. It also records whether
                your first whiteboard-mode submission on a problem passed, and
                whether a stress test agreed with the reference before you first
                passed; only you see these, in My progress, and nothing is
                recorded when you are signed out. The whiteboard dry-run pad is
                saved as a private note on your account (wb:&lt;problem id&gt;),
                or only in this browser when you are signed out.
              </p>
              <p id="privacy-code-review">
                When you create a code review link from a submission&apos;s
                details, anyone signed in who has the link can see that
                submission&apos;s code, your note and every comment. The page
                shows public handles only, or &ldquo;Author&rdquo; and
                &ldquo;Reviewer N&rdquo; without one, never nicknames or email,
                and it stays out of search. The server stores only a hash of the
                link, which is shown in full once, when it is made. You can close
                a link at any time: it stops working and its comments are no
                longer shown to anyone, though they stay in the database. New
                comments send on-site notifications only. Each account can have
                20 open links at a time and create 50 a day.
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
                issues. &ldquo;Report an issue&rdquo; on a multiple-choice
                question, a system design chapter or a lesson files the reason
                and note you give as a ticket, its title tagged with that
                content (such as [mcq:…]), seen likewise only by you and the
                teachers responsible.
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
                the # in the address, which the server does not store. OA
                debugging drills (fixing a planted bug) work the same way:
                their submissions&apos; and runs&apos; code and results are kept with your run
                records, earn no points, never mark the problem solved and stay
                out of your submission list, statistics and progress; a
                drill&apos;s code draft stays in the current browser. The lines
                you flag in a code-review drill are used only to score that
                attempt and are not stored, and your notes on them are never
                uploaded. A stress test (small random inputs run against your
                code and a reference solution) keeps your code and the generated
                inputs in your run records the same way, out of your submission
                list, statistics and progress. The code notes after an accepted
                submission and the follow-up check before submitting run in your
                browser; nothing is uploaded or stored.
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
                stay in the current browser and are never uploaded, and so do
                the figures in the offer comparison (/career/offers), kept in
                local storage (&ldquo;Import from my tracker&rdquo; reads only the
                company and role of your own tracker cards at the Offer stage),
                and your
                answers in a mock OA&apos;s multiple-choice section: they are not
                uploaded and do not sync to your account with mock OA results.
                Answers and the review schedule on the OA multiple-choice practice
                page (/oa/mcq) and the topic pages&apos; quick quizzes stay in this
                browser while you are signed out; signed in, they are kept in a
                private note on your account (up to 20KB), and the browser copy
                is deleted once the account has saved it. Signed in with a
                verified email, the first time you submit a question on /oa/mcq
                the server also records that answer on its own (question,
                choices picked, whether right, and when), used only for the
                site-wide share of right answers and how many picked each choice; a
                question answered by fewer than 20 people shows nothing, and
                nobody&apos;s answers are ever shown. The practice page also
                reads your own system design chapter quiz answers to list the
                ones you missed, never your design drafts. Which
                debugging and code-review drills (/oa/drills) you have
                completed is likewise kept in this browser only.
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
                score it and suggest one fix. A resume project deep dive also
                sends the resume text with each message and with the final
                report: what you paste, or what is filled in from the resume
                builder (without your name and contact details by default; a
                pasted resume is sent as written). The server does not store
                it; it stays only in this sitting&apos;s progress in your
                browser&apos;s local storage. Your email, name and account
                identifiers are not sent. The recruiter-screen and
                offer-negotiation role-plays send the practice scenario (a
                fictional company type, role and offer figures) and your
                conversation; the recruiter&apos;s limits in the scenario stay
                on the server. The platform keeps neither the conversation nor
                the report text (they live in your browser), only each
                report&apos;s 1–4 scores and verdict, to compare with similar
                interviews and to show you each dimension&apos;s trend under My
                progress, and the 1–4 scores you give yourself before a
                report (if you do), kept with it only for your own
                self-assessment calibration under My progress and never shown
                to anyone else. Dictation uses your browser&apos;s own
                speech recognition; some browsers (Chrome, for example) send the
                audio to the browser maker&apos;s servers to turn it into text,
                without going through this platform, and nothing is recorded
                unless you press dictate. The delivery stats in an AI mock
                interview (pace, filler words, talk time and pauses) are worked
                out in your browser and kept on this device; they are never
                uploaded. Mock OA and contest code replays and
                the focus self-check (time away from the page, pastes over 40
                characters) stay in your browser, are never uploaded and are
                not proctoring; a contest replay shows only to the entrant it
                recorded. The contest calendar feed is the public fixed
                schedule with nothing about your account, and a single
                contest&apos;s calendar file is made in your browser.
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
              <p id="privacy-answer-feedback">
                When you choose AI feedback on your answer to an interview
                question, on your draft for a system design case or in a mock
                interview, or on a STAR story in the story bank, the server
                sends what you wrote (or the story&apos;s parts and the
                behavioral question you picked), the question and its reference
                answer (if any; for a system design case, that chapter&apos;s
                text) to Anthropic to write the feedback.
                Your email, name and account identifier are not sent. The
                platform does not store the answer or the feedback; it records
                only daily call counts and usage. Nothing is sent unless you ask.
              </p>
              <p id="privacy-jd">
                Without AI, the JD check (/career/jd) matches the job
                description against its keyword list in your browser and never
                uploads it. When you are signed in, only the names of the skills
                found (such as python or sql) go to the server to read your
                progress, and nothing is stored. The comparison with your resume
                reads the resume (and its versions) that the resume builder
                keeps in this browser, and runs only there too. With AI enabled,
                when you submit, the server sends only the job description you
                pasted to Anthropic, to pick out the skills and interview rounds
                the role asks for.
                Your email, name, account identifier and practice records are
                not sent; your progress is read on the server and shown only to
                you beside the result. The job description and the result are
                not stored; only daily call counts and usage are recorded. A job
                description carried over from the AI resume review page passes
                through this tab&apos;s session storage and is deleted once read.
              </p>
              <p id="privacy-resume-builder">
                What you enter in the resume builder (/career/resume/builder)
                is kept only in this browser&apos;s local storage and is never
                uploaded, and so are the versions saved with “Copy as new
                version”; Export JSON makes its file in the browser too. The
                rule check and “Paste text to import” run in the browser as well,
                and pasted resume text is not uploaded. When
                you are signed in and choose “Fill in from CSWork”, the page
                reads your own certificates, contest rating, solved counts and
                public handle (if your profile is public) from the server into
                this page only; the server does not record the resume. “Send to
                AI review” keeps the resume&apos;s plain text in this tab&apos;s
                session storage until the AI resume review page reads it, then
                deletes it; the text goes to Anthropic, as described above, only
                if you submit there. The AI mock interview&apos;s resume project
                deep dive also reads this content, without your name and contact
                details, and sends it only with the messages you send and the
                final report, as described for the AI interviewer above.
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
                the AI's reply. Nothing is sent unless you ask. When you choose
                Finish and review under the AI pair, the server sends your
                current files, this page&apos;s pair conversation (up to 40 turns
                and 24,000 characters), your last run&apos;s public results and
                hidden-test pass count and your runs over the last 3 hours to
                Anthropic to write the review; Review code quality on a
                take-home sends your current files, the last run and your design
                note instead. The review is not stored either, and only daily
                call counts and usage are recorded. Runs of a take-home project
                (/take-home) are kept in your run records the same way; the code
                you are editing, its start time and your design notes stay only
                in your browser.
              </p>
              <p id="privacy-ica">
                Runs in the CodeSignal ICA-style practice (/oa/ica) work the
                same way: the project files and results are kept in your run
                records, and the platform reads them to know which levels you
                passed and which to unlock. The 90-minute timer lives only in
                your browser. There is no AI pair there, and nothing is sent to
                any third party.
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
