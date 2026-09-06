import type { Metadata } from 'next';
import Link from 'next/link';
import './privacy.css';

export const metadata: Metadata = {
  title: '隐私说明 · cswork',
  description:
    '了解 cswork 如何处理课程账户、学习记录、私密工单与支付信息，以及如何联系我们提出数据删除请求。',
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <header className="privacy-header">
        <Link href="/" className="privacy-brand">
          cswork
        </Link>
        <Link href="/">返回学习平台 →</Link>
      </header>
      <article className="privacy-document">
        <p className="privacy-eyebrow">关于你的资料</p>
        <h1>隐私说明</h1>
        <p className="privacy-intro">
          cswork
          是提供课程、视频、编程练习与教学反馈的学习平台。这份说明介绍平台当前如何处理你的资料，以及你可以如何联系我们。
        </p>
        <p className="privacy-updated">更新于 2026 年 9 月 6 日</p>

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
            为缩短运行和提交的等待时间，登录后编辑 C++
            代码并停止输入片刻，平台可能将最新草稿发送到服务器预编译。预编译只准备可执行程序，不自动运行测试，也不产生提交记录或学习成绩。预编译请求处理后或到期时会从任务队列移除，编译结果仅作短期缓存。
          </p>
        </section>

        <section aria-labelledby="privacy-payment">
          <h2 id="privacy-payment">购买与支付资料</h2>
          <p>
            开放在线购买的课程使用 Stripe 托管结账页面处理支付。平台会向 Stripe
            提供结账所需的邮箱、课程与订单标识，并保存订单金额、币种、支付或退款状态、支付平台标识及收据链接，用于对账和开通课程。
          </p>
          <p>
            你在 Stripe 结账页面输入的完整银行卡号和安全码由支付平台处理，cswork
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
      </article>
      <footer className="privacy-footer">
        <span>cswork · 学习工作台</span>
        <Link href="/">返回首页</Link>
      </footer>
    </main>
  );
}
