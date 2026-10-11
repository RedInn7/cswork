/**
 * English for server messages shown to users. Keys are the exact Chinese messages;
 * PATTERNS cover messages with numbers or names in them. Unknown messages fall back
 * to the original text. Plain data: the client bundle imports this too.
 * tests/messages-en.test.ts fails when a server HttpError/judge message has no entry.
 */
const EN: Record<string, string> = {
  // Shared API errors (lib/server/http.ts and route plumbing)
  请先登录: 'Please sign in first',
  请检查填写内容: 'Please check the highlighted fields',
  暂时无法完成请稍后重试: 'Something went wrong. Please try again later',
  '暂时无法完成，请稍后重试': 'Something went wrong. Please try again later',
  仅老师可以执行此操作: 'Only instructors can do this',
  请求来源无效: 'Invalid request origin',
  内容过长: 'Content is too long',
  无效的请求内容: 'Invalid request body',
  '此课程尚未开通，请联系老师或购买课程':
    "This course isn't unlocked yet. Ask your instructor for access or purchase it",
  '操作有些频繁，请稍后再试': 'Too many requests. Please try again later',
  '无效的 JSON': 'Invalid JSON',
  接口不存在: 'Endpoint not found',
  操作不存在: 'Action not found',
  操作不支持: 'Action not supported',
  操作方式无效: 'Invalid request method',
  不支持此请求方式: 'Request method not supported',
  只支持读取: 'Only read requests are supported',
  页面不存在: 'Page not found',
  分页游标无效: 'Invalid page cursor',

  // Sign-in (lib/server/auth.ts, mail.ts, app/api/auth)
  '昵称需为 1–80 个字符': 'Display name must be 1–80 characters',
  学员: 'Student',
  '邮箱验证服务尚未开放，请使用已配置的登录方式或联系老师。':
    "Email verification isn't available yet. Use another sign-in method or contact your instructor.",
  '邮件服务地址必须使用 HTTPS': 'The mail service URL must use HTTPS',
  '验证码邮件未能发送，请稍后重试。':
    "Couldn't send the verification code email. Please try again later.",
  '登录服务正在准备中，请稍后再试': 'Sign-in is being set up. Please try again later',
  '登录暂时不可用，请检查配置或稍后重试':
    'Sign-in is temporarily unavailable. Check the configuration or try again later',

  // Courses, lessons and updates
  课程不存在: 'Course not found',
  课程暂未开放: 'This course is not available yet',
  章节不存在: 'Lesson not found',
  章节不存在或尚未发布: 'Lesson not found or not published yet',
  '课程 ID 已存在': 'Course ID already exists',
  '章节 ID 已存在': 'Lesson ID already exists',
  请先发布至少一个章节: 'Publish at least one lesson first',
  课程已开放: 'Course now available',
  // Notification seeded by lib/server/seed.ts
  'GoMall 课程讲义已开放': 'GoMall course notes are now available',
  新版本号必须大于当前发布版本: 'The new version number must be greater than the published version',
  课件正文不能为空: 'Lesson content cannot be empty',
  请等待所有视频处理完成后发布: 'Wait for all videos to finish processing before publishing',
  '此版本已经发布，请重新载入后使用新版本号':
    'This version is already published. Reload and use a new version number',
  课件版本不存在: 'Lesson version not found',
  请先发布课件版本: 'Publish a lesson version first',
  '内容已被更新，请重新载入后再提交；你的编辑尚未覆盖服务器内容':
    'This content was updated elsewhere. Reload before submitting; your edits have not overwritten the saved version',
  '一次只能选择本地视频或 Stream 视频': 'Choose either an uploaded video or a Stream video, not both',
  不能重复选择同一视频: 'The same video cannot be selected twice',
  视频尚未发布: 'Video not published yet',
  视频不属于此章节: "This video doesn't belong to this lesson",
  没有需要保存的内容: 'Nothing to save',
  提交不存在: 'Submission not found',
  更新不存在: 'Update not found',
  '此章节已有未发布草稿，请在课程管理中继续编辑':
    'This lesson already has an unpublished draft. Continue editing it in course management',
  知识点不存在: 'Concept not found',
  题目暂不可用: 'Problem unavailable',

  // Invitations and access grants
  '邀请已过期或被撤销，请联系老师重新生成':
    'This invitation has expired or was revoked. Ask your instructor for a new one',
  邀请操作不存在: 'Invitation action not found',
  老师账号不需要学员邀请: "Instructor accounts don't need a student invitation",
  全部课程: 'All courses',
  '此邀请已经使用，请直接登录': 'This invitation has already been used. Please sign in',
  '该邮箱已有账号，请先使用原账号登录，再接受邀请':
    'An account already exists for this email. Sign in with it first, then accept the invitation',
  '邀请属于另一个邮箱，请切换到对应账号':
    'This invitation is for a different email. Switch to that account',
  '邀请状态已变化，请刷新': 'The invitation status has changed. Please refresh',
  '邮箱刚刚注册，请使用已有账号登录':
    'This email was just registered. Sign in with the existing account',
  到期时间必须在未来: 'The expiry time must be in the future',
  此幂等请求已用于其他授权内容: 'This idempotency key was already used for a different grant',
  授权记录不存在: 'Access grant not found',

  // Support tickets, attachments and reviews
  工单不存在: 'Ticket not found',
  附件不存在: 'Attachment not found',
  '支持图片、PDF、文本或代码文件': 'Only images, PDFs, text, or code files are supported',
  '每个工单最多 10 个附件': 'Each ticket can have up to 10 attachments',
  '附件不能超过 2MB': 'Attachments must be 2 MB or smaller',
  附件不能为空: 'Attachment cannot be empty',
  '附件空间配置无效，请联系老师':
    'Attachment storage is misconfigured. Please contact your instructor',
  '磁盘可用空间不足，暂时不能上传附件':
    'Not enough disk space. Attachments cannot be uploaded right now',
  '站点附件空间已满，请联系老师清理后再试':
    'Attachment storage is full. Ask your instructor to free up space, then try again',
  '附件已被删除，请重新上传': 'The attachment was deleted. Please upload it again',
  '请提供 GitHub 仓库或 PR 链接': 'Provide a GitHub repository or pull request link',
  请提供工单版本: 'Ticket version is required',
  老师回复了你的问题: 'Your instructor replied to your question',
  请选择老师: 'Choose an instructor',
  老师: 'Instructor',
  作业不存在: 'Assignment not found',
  只能重新提交自己的作业: 'You can only resubmit your own assignment',
  请提供作业版本: 'Assignment version is required',
  '作业正在等待评审，请等待老师反馈后再提交修改':
    'This assignment is awaiting review. Wait for instructor feedback before submitting changes',
  作业评审已完成: 'Your assignment has been reviewed',

  // Video and media uploads
  视频标识无效: 'Invalid video ID',
  视频服务正在准备中: 'The video service is being set up',
  暂时无法播放此视频: "This video can't be played right now",
  '先连接视频服务，再发布视频': 'Connect the video service before publishing videos',
  '视频私密访问设置未完成，暂不能发布':
    "Private video access isn't set up yet, so videos can't be published",
  '上传位置已变化，请恢复上传': 'The upload offset changed. Please resume the upload',
  '视频存储空间不足，请联系管理员': 'Not enough video storage. Please contact the administrator',
  素材存储信息无效: 'Invalid media storage record',
  素材不存在: 'Media not found',
  视频范围无效: 'Invalid video range',
  视频尚未就绪: 'The video is not ready yet',
  '视频文件暂不可用，请联系老师': 'The video file is unavailable. Please contact your instructor',
  视频文件尚未完整写入: 'The video file has not been fully written yet',
  '单块视频不能超过 4 MiB': 'Each video chunk must be 4 MiB or smaller',
  缺少上传数据: 'Missing upload data',
  上传数据为空: 'Upload data is empty',
  本章节没有此视频: "This lesson doesn't have this video",
  '最多同时保留 10 个上传任务，请先完成已有上传':
    'You can have at most 10 uploads in progress. Finish existing uploads first',
  '视频素材容量已达上限，请联系管理员':
    'Video storage limit reached. Please contact the administrator',
  上传任务不存在或已过期: 'Upload not found or expired',
  缺少上传位置: 'Missing upload offset',
  上传内容超过声明大小: 'The upload exceeds the declared size',
  此视频已经完成上传: 'This video has already been uploaded',
  '上传锁已失效，请恢复上传': 'The upload lock expired. Please resume the upload',
  此素材不可完成上传: "This upload can't be completed",
  视频尚未上传完整: 'The video upload is incomplete',
  '文件不是完整的 MP4/WebM 视频': 'The file is not a complete MP4/WebM video',
  请先从章节中移除此素材: 'Remove this media from its lessons first',
  素材操作不存在: 'Media action not found',

  // Resources library
  未知的内容类型: 'Unknown content type',
  内容不存在: 'Content not found',
  内容库尚未发布: 'The content library is not published yet',
  未知题单: 'Unknown problem list',

  // Code completion
  '智能补全暂未开放，代码仍可运行和提交':
    "Code completion isn't available yet. You can still run and submit your code",
  智能补全配置不可用: 'Code completion is not configured',
  补全服务未返回结果: 'The completion service returned no result',
  '补全结果过大，请缩小代码范围': 'The completion result is too large. Try a smaller code range',
  无效的补全请求: 'Invalid completion request',
  本题不支持该语言: "This problem doesn't support that language",
  '代码超过 64 KiB': 'Code exceeds 64 KiB',
  缺少光标位置: 'Missing cursor position',
  光标位置超出代码范围: 'The cursor position is outside the code',
  '补全服务暂忙，继续输入或重新触发即可重试':
    'The completion service is busy. Keep typing or trigger completion again to retry',
  '代码已更新，请重新触发补全': 'The code changed. Trigger completion again',
  '补全服务暂不可用，代码仍可运行和提交':
    'Code completion is unavailable. You can still run and submit your code',
  '补全服务连接中断，继续输入或重新触发即可重试':
    'Lost connection to the completion service. Keep typing or trigger completion again to retry',
  // Editor status line (components/monaco-intelligence.ts)
  '正在启动语言服务…': 'Starting the language service…',
  智能补全已就绪: 'Code completion ready',
  '智能补全已就绪 · 错误检查请运行':
    'Code completion ready · Run your code to check for errors',
  语言服务暂不可用: 'Language service unavailable',

  // Problems, submissions and the judge
  题目不存在: 'Problem not found',
  题目不存在或尚未发布: 'Problem not found or not published yet',
  题目版本不存在: 'Problem version not found',
  题目测试数据尚未就绪: "This problem's test data isn't ready yet",
  '题目数据完整性检查未通过，请联系老师':
    "This problem's data failed the integrity check. Please contact your instructor",
  '请先验证邮箱，再运行和提交代码': 'Verify your email before running or submitting code',
  请先验证邮箱: 'Please verify your email first',
  '题目文件不是有效 JSON': 'The problem file is not valid JSON',
  关联章节必须属于所选课程: 'The linked lesson must belong to the selected course',
  '无效的题目 JSON': 'Invalid problem JSON',
  草稿版本无效: 'Invalid draft version',
  '题目尚未创建，请先载入正确草稿': "This problem hasn't been created yet. Load the correct draft first",
  '已创建题目不能更换所属课程，请使用新题目 ID':
    "A created problem can't move to another course. Use a new problem ID",
  '草稿已被更新，请重新载入后保存': 'The draft was updated. Reload before saving',
  '草稿已被更新，请重新载入后发布': 'The draft was updated. Reload before publishing',
  '草稿与当前发布版本相同，无需重复发布':
    'The draft matches the published version. Nothing to publish',
  无效的进度标记: 'Invalid progress marker',
  判题接口不存在: 'Judge endpoint not found',
  '代码最多 64 KiB': 'Code can be at most 64 KiB',
  代码不能包含空字符: 'Code cannot contain null characters',
  '代码和自定义输入分别最多 64 KiB': 'Code and custom input are limited to 64 KiB each',
  内容不能包含空字符: 'Content cannot contain null characters',
  正式提交不能携带自定义输入: "Submissions can't include custom input",
  此题未开放该语言: "This language isn't available for this problem",
  '此题未开放 LeetCode 模式': "LeetCode mode isn't available for this problem",
  '此请求编号已经用于另一份代码，请重新提交':
    'This request ID was already used for different code. Please submit again',
  '判题服务尚未配置，代码草稿已保留': "The judge isn't configured yet. Your code draft was kept",
  '你已有两份代码正在处理，请等待完成或取消后再提交':
    'You already have two submissions in progress. Wait for them to finish or cancel one first',
  '判题队列已满，请稍后重试，代码草稿已保留':
    'The judge queue is full. Try again later; your code draft was kept',
  '等待中的请求过多，请稍后重试': 'Too many pending requests. Please try again later',
  // Written into submission.message by the judge worker
  '任务多次中断，请重新提交': 'Judging was interrupted too many times. Please submit again',
  '判题任务多次中断，请重新提交': 'Judging was interrupted too many times. Please submit again',
  '函数驱动版本已更新，请重新提交；原代码已保留。':
    'The function harness was updated. Please submit again; your code was kept.',
  'Codec 自定义输入应是一行 JSON 层序树数组，例如 [1,2,3,null,4]。':
    'Codec custom input must be one line with a JSON level-order tree array, e.g. [1,2,3,null,4].',
  已取消运行: 'Run cancelled',
  '执行服务暂时中断，正在自动重试': 'The execution service was interrupted. Retrying automatically',
  '判题未能完成，请重试；本次不计入错题':
    "Judging couldn't be completed. Please try again; this attempt won't count as a mistake",
  // Judge feed
  没有找到这位用户的提交: 'No submissions found for this user',
  我: 'You',
  未知的评测结果: 'Unknown result',
  未知的语言: 'Unknown language',

  // OA problems
  'OA 题目不存在': 'OA problem not found',
  'OA 接口不存在': 'OA endpoint not found',
  未知公司: 'Unknown company',
  '这道题的题解和测试数据正在校验，暂未开放':
    "This problem's solution and test data are being verified and aren't available yet",
  '这道题的题解正在校验，暂未开放': "This problem's solution is being verified and isn't available yet",
  '这道 OA 题的测试数据尚未校验完成，暂不能评测':
    "This OA problem's test data hasn't been verified yet, so it can't be judged",
  '这道 OA 题的版本正在校验，请刷新后重试':
    'This OA problem version is being verified. Refresh and try again',
  '这道 OA 题的版本已变化，请等待重新校验':
    'This OA problem version changed. Wait for it to be verified again',
  'Payment Intent 四阶段综合练习': 'Payment Intent: combined four-stage practice',
  '本阶段包含在四阶段综合练习中；本阶段未单独评测。综合练习使用带时间戳的命令，需实现第 1–4 阶段的全部规则，请按练习页的输入格式提交。':
    "This stage is part of the combined four-stage practice and isn't judged on its own. The combined practice uses timestamped commands and needs every rule from stages 1–4; submit using the input format on the practice page.",

  // LeetCode sync and practice rounds
  刷题轮次不存在: 'Practice round not found',
  同步任务不存在: 'Sync job not found',
  同步接口不存在: 'Sync endpoint not found',
  '同步失败，请稍后继续': 'Sync failed. Please resume later',
  '同步请求已中断，可稍后继续': 'The sync request was interrupted. You can resume later',
  '当前 LeetCode 账号与该同步任务不一致，请使用原账号继续':
    "The current LeetCode account doesn't match this sync job. Continue with the original account",
  重复请求的站点或刷题轮次不一致: 'This retried request has a different site or practice round',
  重复请求的同步账号或刷题轮次不一致:
    'This retried request has a different sync account or practice round',
  '已达到单次同步 40,000 条提交上限，历史记录尚未全部同步':
    'Reached the 40,000-submission limit for one sync. Not all history has been synced',
  'LeetCode 分页出现重复，可能同步时提交了新代码；请新建同步任务重试，已有记录会自动去重':
    'LeetCode pages overlapped, possibly because new code was submitted during the sync. Start a new sync; existing records are deduplicated automatically',
  'LeetCode 提交编号与题目不一致，已停止同步':
    "A LeetCode submission ID doesn't match its problem. Sync stopped",
  'LeetCode 登录已失效，请重新提供登录凭据':
    'Your LeetCode session expired. Please provide your sign-in credentials again',
  'LeetCode 登录已失效，请重新登录': 'Your LeetCode session expired. Please sign in again',
  'LeetCode 拒绝访问或要求浏览器验证，请稍后重试；本站不会绕过验证':
    'LeetCode denied access or asked for browser verification. Try again later; we never bypass verification',
  'LeetCode 请求过于频繁，请稍后继续同步': 'Too many requests to LeetCode. Resume syncing later',
  'LeetCode 暂时无法访问，请稍后继续同步': "LeetCode can't be reached right now. Resume syncing later",
  'LeetCode 返回了验证页面，未导入本页记录':
    'LeetCode returned a verification page. Records on this page were not imported',
  'LeetCode 响应过大，已停止本页同步': 'The LeetCode response was too large. Stopped syncing this page',
  'LeetCode 响应为空': 'LeetCode returned an empty response',
  'LeetCode 返回格式无效，未导入本页记录':
    'LeetCode returned an invalid format. Records on this page were not imported',
  'LeetCode 连接失败或超时，请稍后继续同步':
    'The connection to LeetCode failed or timed out. Resume syncing later',
  'LeetCode 账号接口格式发生变化，已停止同步': "LeetCode's account API changed. Sync stopped",
  '无法确认 LeetCode 账号身份': "Couldn't verify your LeetCode account",
  'LeetCode 提交接口格式发生变化，未导入本页记录':
    "LeetCode's submissions API changed. Records on this page were not imported",
  'LeetCode 分页标记异常，未将不完整记录标记为完成':
    'LeetCode returned an unexpected page marker. Incomplete records were not marked as complete',
  'LeetCode 提交记录异常，已停止本页同步':
    'LeetCode returned unexpected submission records. Stopped syncing this page',

  // Payments, orders and refunds
  '课程购买尚未开放，可先向老师申请开通。':
    "Course purchases aren't open yet. You can ask your instructor to unlock the course.",
  '这门课程暂未开放购买，请向老师申请开通':
    "This course isn't available for purchase yet. Ask your instructor to unlock it",
  订单不存在: 'Order not found',
  '请输入有效的 Stripe Price ID': 'Enter a valid Stripe Price ID',
  该价格不存在或不属于当前支付账号:
    "This price doesn't exist or doesn't belong to the current payment account",
  '暂时无法确认价格，请稍后重试': "Couldn't confirm the price right now. Please try again later",
  '请选择已启用、固定金额的一次性课程价格': 'Choose an active, fixed-amount, one-time course price',
  '课程价格已更新，请刷新后重新购买': 'The course price changed. Refresh and purchase again',
  '课程已经开通，无需重复购买': 'This course is already unlocked. No need to buy it again',
  '付款已确认，课程已开通，请刷新页面':
    'Payment confirmed and the course is unlocked. Please refresh the page',
  '支付仍在处理中，请在账号页查看订单进度':
    'Your payment is still processing. Check the order status on your Account page',
  '暂时未能打开结账页面，重试会继续同一订单。':
    "Couldn't open the checkout page. Retrying will continue the same order.",
  '结账暂时不可用，请稍后重试；不会重复创建订单':
    'Checkout is temporarily unavailable. Try again later; no duplicate order will be created',
  '正在更新订单，请稍后重试': 'Updating your order. Please try again shortly',
  '支付状态暂时无法确认，请稍后重试':
    "Couldn't confirm the payment status right now. Please try again later",
  支付订单信息不一致: "The payment order details don't match",
  支付价格信息不一致: "The payment price details don't match",
  通过支付平台操作: 'Issued from the payment platform',
  '订单状态正在更新，请稍后刷新': 'The order status is updating. Please refresh shortly',
  '支付未完成，可以重新发起购买。': "Payment wasn't completed. You can start the purchase again.",
  仅老师可以执行退款: 'Only instructors can issue refunds',
  这笔订单尚无可退回的付款: 'This order has no payment to refund yet',
  退款操作标识已用于另一请求: 'This refund operation ID was already used for another request',
  '可退款金额已变化，或已有退款正在处理，请刷新订单':
    'The refundable amount changed or a refund is already in progress. Refresh the order',
  '退款请求未被支付平台接受。': 'The payment platform did not accept the refund request.',
  '请求结果待确认。请使用同一操作重试，避免重复退款。':
    'The result is still being confirmed. Retry the same operation to avoid a duplicate refund.',
  '支付平台未接受退款，请检查订单后重试。':
    "The payment platform didn't accept the refund. Check the order and try again.",
  '退款结果正在确认，请稍后刷新；重试会继续同一笔退款。':
    'Confirming the refund. Refresh shortly; retrying continues the same refund.',
  支付尚未配置: 'Payments are not configured',
  缺少签名: 'Missing signature',
  签名验证失败: 'Signature verification failed',

  // Client-side fallbacks shown in the same error slots (lib/types.ts, lib/oj-client.ts)
  '服务暂时不可用，请稍后重试': 'Service temporarily unavailable. Please try again later',
  操作失败: 'Something went wrong',
  '服务返回了无法识别的数据，请重试': 'The server returned unrecognized data. Please try again',
  '请求超时，请重试。重复请求会使用相同提交编号，避免重复判题。':
    "The request timed out. Please try again; retries reuse the same submission ID, so nothing is judged twice.",
  '无法连接判题服务，请检查网络后重试': "Can't reach the judge. Check your network and try again",
};
const PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^题目文件最多 (\d+(?:\.\d+)?) MiB$/, (n) => `The problem file can be at most ${n} MiB`],
  [/^课程更新：([\s\S]+)$/, (title) => `Course update: ${title}`],
  [/^服务暂时不可用（(\d+)）$/, (status) => `Service temporarily unavailable (${status})`],
];

export function englishMessage(message: string) {
  if (Object.hasOwn(EN, message)) return EN[message];
  for (const [pattern, render] of PATTERNS) {
    const m = pattern.exec(message);
    if (m) return render(...m.slice(1));
  }
  return message;
}
