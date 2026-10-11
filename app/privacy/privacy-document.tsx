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
            <p className="privacy-updated">更新于 2026 年 10 月 7 日</p>

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
                工单会保存你填写的问题、回复、附件，以及主动关联的课时、视频位置或提交记录。工单、作业和个人提交记录按账户权限提供给你及负责教学管理的老师查看，不作为面向其他学员的公开讨论内容。老师会使用这些资料答疑、评审作业、管理授权和跟进学习问题。
              </p>
              <p>
                算法判题会把提交的代码与测试输入交给平台的隔离执行环境运行。你在工单或作业中主动提供的外部链接，则仍由对应网站按其自身设置控制访问。
              </p>
              <p>
                为缩短运行和提交的等待时间，登录后编辑 C++、Java 或 Go
                代码并停止输入片刻，平台可能将最新草稿发送到服务器预编译。预编译只准备可执行程序，不自动运行测试，也不产生提交记录或学习成绩。预编译请求处理后或到期时会从任务队列移除，编译结果仅作短期缓存。
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
                平台使用必要的 Cookie 保持登录和完成认证。登录会话可以记录 IP
                地址、设备或浏览器信息与有效期，用于账号安全和查看已登录设备；服务器也会产生访问、错误和管理操作记录，以排查故障和限制滥用。
              </p>
              <p>
                浏览器本地存储用于恢复代码、工单或课件编辑草稿，以及记住编辑器设置等。部分草稿只保存在当前浏览器；退出账号不会自动清除全部本地草稿。共用设备时，可以在浏览器中清除此网站的存储数据，这也会清除尚未提交的本地内容。
              </p>
            </section>

            <section aria-labelledby="privacy-storage">
              <h2 id="privacy-storage">存储、访问与保留</h2>
              <p>
                cswork
                使用独立的应用、数据库和文件目录保存课程业务数据、视频及附件。当前部署与
                CSGrad 共用服务器基础设施，但两者的业务和账户数据没有对接。
              </p>
              <p>
                除提供服务所需的教师和运维访问外，第三方登录、邮件和支付功能会与相应服务商交换完成这些功能所需的资料。课程中的外部图片或视频链接也可能让浏览器向对应资源服务商发出请求。
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
            <p className="privacy-updated">Updated October 7, 2026</p>

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
                The platform uses necessary cookies to keep you signed in and to
                complete authentication. Sign-in sessions may record your IP
                address, device or browser information, and expiration time, for
                account security and so you can see which devices are signed in;
                the server also generates access, error, and administrative
                action logs to troubleshoot problems and limit abuse.
              </p>
              <p>
                Browser local storage is used for things like restoring drafts
                of code, tickets, or course materials you are editing, and
                remembering editor settings. Some drafts are saved only in the
                current browser; signing out does not automatically clear all
                local drafts. On a shared device, you can clear this site’s
                stored data in your browser; this also clears local content that
                has not been submitted yet.
              </p>
            </section>

            <section aria-labelledby="privacy-storage">
              <h2 id="privacy-storage">Storage, access, and retention</h2>
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
                send requests to the corresponding resource providers.
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
