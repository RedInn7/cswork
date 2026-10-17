/**
 * English for server messages shown to users. Keys are the exact Chinese messages;
 * PATTERNS cover messages with numbers or names in them. Unknown messages fall back
 * to the original text. Plain data: the client bundle imports this too.
 * tests/messages-en.test.ts fails when a server HttpError/judge message has no entry.
 */
const EN: Record<string, string> = {
  // Curated list stages (lib/server/study-library.ts), shown as filter and pip labels
  // Problem difficulty (lib/server/oa-topics.ts maps estimates onto these)
  简单: 'Easy',
  中等: 'Medium',
  困难: 'Hard',
  基础: 'Foundation',
  核心: 'Core',
  进阶: 'Advanced',
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
  // A wave-7 route whose module has not shipped yet.
  未开放: 'Not available yet',
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
  证书不存在: 'Certificate not found',
  请先发布课件版本: 'Publish a lesson version first',
  '内容已被更新，请重新载入后再提交；你的编辑尚未覆盖服务器内容':
    'This content was updated elsewhere. Reload before submitting; your edits have not overwritten the saved version',
  '一次只能选择本地视频或 Stream 视频': 'Choose either an uploaded video or a Stream video, not both',
  不能重复选择同一视频: 'The same video cannot be selected twice',
  视频尚未发布: 'Video not published yet',
  视频不属于此章节: "This video doesn't belong to this lesson",
  没有需要保存的内容: 'Nothing to save',
  提交不存在: 'Submission not found',
  // Private code review links (lib/server/code-reviews.ts); the notice title too
  评审链接不存在或已关闭: 'This review link does not exist or was closed',
  只能为正式提交生成评审链接: 'Review links are for submitted solutions only',
  '未关闭的评审链接已达上限，请先关闭不用的链接': 'You have too many open review links. Close one you no longer need first',
  行号超出代码范围: 'That line is outside the code',
  这条评审链接的评论已达上限: 'This review link has reached its comment limit',
  '今天生成的评审链接已达上限，请明天再试': "You've made today's maximum of review links. Try again tomorrow",
  你的代码收到了新的评审意见: 'Your code got new review comments',
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
  未知的面试模板: 'Unknown interview template',
  抽题编号无效: 'Invalid set number',

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
  '无法格式化：请先修正语法错误': "Couldn't format: fix the syntax errors first",
  '格式化暂不可用，请稍后重试': 'Formatting is unavailable right now. Try again shortly',
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
  // Personal access tokens for MCP clients (lib/server/api-tokens.ts)
  访问令牌不能调用这个接口: "Access tokens can't call this endpoint",
  访问令牌无效或已吊销: 'The access token is invalid or revoked',
  访问令牌不存在: 'Access token not found',
  '最多保留 10 个访问令牌，请先吊销不用的': 'You can keep at most 10 access tokens. Revoke one you no longer use first',
  笔记或标记已达上限: "You've reached the limit for notes or marks",
  // Resume project repo links (lib/server/my-practice.ts, project:<slug> notes)
  '仓库链接只支持 GitHub、GitLab 或 Codeberg 的 https 地址': 'Repository links must be https addresses on GitHub, GitLab or Codeberg',
  // Points (lib/server/points.ts) and the bank's solved-date filter
  积分不足: 'Not enough points',
  '本月的补签卡已经买满 3 张': "You've bought this month's 3 streak freezes",
  无效的日期: 'Invalid date',
  // Placement quiz (lib/server/placement.ts)
  '30 天内已经测过，到期后再来重测': 'You took the placement quiz in the last 30 days. Retake it once they have passed',
  题库里还没有可测的题: 'There are no problems to quiz you on yet',
  没有进行中的定位测验: 'No placement quiz is in progress',
  '这道题已经答过了，请刷新页面': 'That question is already answered. Refresh the page',
  选项无效: 'Invalid choice',
  // Lists, public profile and asked reports (lib/server/learner-cloud.ts)
  题单不存在: 'List not found',
  题单接口不存在: 'List endpoint not found',
  题单数量已达上限: "You've reached the limit for lists",
  '题单最多 500 道题': 'A list can hold at most 500 problems',
  '题单内容已变化，请刷新后再排序': 'The list has changed. Refresh and reorder again',
  这个主页名已被占用: 'That handle is taken',
  这枚徽章还没有获得: 'You haven’t earned that badge yet',
  面试月份无效: 'Invalid interview month',
  没有这家公司: 'Unknown company',
  今天的报告次数已达上限: "You've reached today's limit for reports",
  // Member interview experiences (lib/server/experience-submissions.ts)
  今天的投稿次数已达上限: "You've reached today's limit for submissions",
  '待审核的投稿太多，请等审核后再投': 'You have too many submissions awaiting review. Please wait for a review first',
  不能举报自己的投稿: "You can't report your own submission",
  请写明不通过的原因: 'Please tell the author why it was rejected',
  '正文的引用、列表或强调嵌套太深': 'The post nests quotes, lists or emphasis too deeply',
  '没有 OA 轮次时不能填写 OA 成绩': 'OA scores need an Online Assessment round',
  题目标的轮次不在所选轮次里: "A question's round isn't one of the rounds you picked",
  关联的题目不存在或不能关联: "That problem doesn't exist or can't be linked",
  'OA 做出的题数不能多于总题数': 'OA problems solved can’t exceed the total',
  // Study groups (lib/server/study-groups.ts)
  学习小组不存在: 'Study group not found',
  学习小组接口不存在: 'Study group endpoint not found',
  '每人最多创建 3 个学习小组': 'You can create at most 3 study groups',
  '最多加入 10 个学习小组': 'You can be in at most 10 study groups',
  '小组已满（最多 50 人）': 'This group is full (50 members max)',
  邀请码无效: 'Invalid invite code',
  这个昵称在小组里已被使用: 'Someone in this group already uses that name',
  '组长不能退出，可以解散小组': "The owner can't leave. Disband the group instead",
  只有组长可以管理小组: 'Only the group owner can manage the group',
  成员不存在: 'Member not found',
  消息不存在: 'Message not found',
  只有处理举报时老师才能查看小组聊天: 'Teachers can read a group chat only while a message in it is reported',
  // Work email badge (lib/server/work-verify.ts)
  '个人邮箱不能验证员工身份，请用公司邮箱': "A personal email can't verify an employer. Use your work email",
  '暂不支持这个邮箱域名，目前只支持有公司页的公司': "This email domain isn't supported yet: only companies with a company page are",
  '邮件服务尚未开放，暂时无法验证工作邮箱': "Email isn't set up yet, so work emails can't be verified for now",
  '验证码已失效，请重新获取': 'This code has expired. Ask for a new one',
  验证码不正确: 'That code is not right',
  '验证码邮件未能发送，请稍后重试': "The code email couldn't be sent. Please try again later",
  这个工作邮箱已经验证过另一个账号: 'This work email already verified another account',
  还没有验证工作邮箱: "You haven't verified a work email yet",
  // Direct messages (lib/server/direct-messages.ts); notification titles too
  内推帖不存在或已失效: 'This referral post is gone or no longer offers referrals',
  互相关注后才能发私信: 'You can message someone once you follow each other',
  对方暂不接收你的私信: "This person isn't taking messages from you",
  今天发送的私信已达上限: "You've sent today's maximum of messages",
  今天新开的私信会话已达上限: "You've started today's maximum of new conversations",
  '对方今天收到的新私信太多了，请明天再试': 'This person got too many new messages today. Please try tomorrow',
  你收到一条内推请求: 'You have a new referral request',
  你收到一条新私信: 'You have a new message',
  会话不存在: 'Conversation not found',
  不能给自己发私信: "You can't message yourself",
  对方暂不接收新的私信: "This person isn't taking new conversations",
  // Peer mock interviews (lib/server/mock-peer.ts); notification titles too
  同伴模拟面试已匹配: 'Peer mock interview matched',
  同伴模拟面试已取消: 'Peer mock interview cancelled',
  对方报告你没有出席模拟面试: 'Your partner reported that you missed the mock interview',
  对方: 'Partner',
  '你被报告爽约两次，匹配已暂停 90 天': 'Two partners reported you missing, so matching is paused for 90 days',
  '一周内取消了 3 场已匹配的面试，暂时不能匹配': 'You cancelled 3 matched sessions this week, so matching is paused for now',
  你已经有一个在等待匹配的请求: 'You already have a request waiting for a partner',
  '已经约了 3 场，先完成再约': 'You already have 3 sessions booked. Finish one before booking more',
  这个小时你已经约了一场模拟面试: 'You already have a mock interview booked this hour',
  '请至少选一个未来 7 天内的时段': 'Pick at least one time slot in the next 7 days',
  这场模拟面试不存在: 'Mock interview not found',
  这场模拟面试已结束或已取消: 'This mock interview is over or was cancelled',
  这场模拟面试已开始或已取消: 'This mock interview has started or was cancelled',
  现在不能报告爽约: "You can't report a no-show right now",
  故事已达上限: "You've reached the limit for stories",
  // Contest rooms and the weekly contest (lib/server/contests.ts)
  比赛不存在: 'Contest not found',
  比赛接口不存在: 'Contest endpoint not found',
  '开赛时间最多提前 7 天': 'A contest can start at most 7 days from now',
  有题目不能用于比赛: "Some of these problems can't be used in a contest",
  '可判的题目不够，换个题源或减少题量': 'Not enough judgeable problems. Pick another source or fewer questions',
  这场周赛没有可判的题目: 'None of that contest’s problems can be judged here',
  '每天最多创建 10 个比赛房间': 'You can open at most 10 contest rooms a day',
  房间已满: 'This room is full',
  这个昵称在本场已被使用: 'Someone in this contest already uses that name',
  '这道题在你正在进行的比赛里，题解、讨论和 AI 助教赛后开放':
    "This problem is in a contest you're taking. Its editorial, solutions and AI tutor open once your contest ends",
  题目不在这场比赛里: "That problem isn't in this contest",
  '比赛结束 15 分钟后才能看代码': 'Shared code opens 15 minutes after the contest ends',
  你没有报名这场比赛: "You haven't entered this contest",
  // Ranked duels (lib/server/duels.ts)
  '可判的题目不够，暂时无法匹配': 'Not enough judgeable problems to match you right now',
  // Community solutions (lib/server/solution-posts.ts)
  题解不存在: 'Solution not found',
  这道题没有可用的参考解: 'This problem has no reference solution to compare with',
  这道题暂不支持对拍: "Stress testing isn't available for this problem",
  // Whiteboard and stress-before-AC records (lib/server/practice-aids.ts)
  '还在判题，判完后再记录': "Still judging. It's recorded once judging finishes",
  评论不存在: 'Comment not found',
  题解接口不存在: 'Solutions endpoint not found',
  仅老师可以管理题解: 'Only instructors can moderate solutions',
  不能举报自己的内容: "You can't report your own post",
  不能给自己的题解投票: "You can't vote for your own solution",
  今天发布的帖子已达上限: "You've reached today's limit for posts",
  请填写标题: 'Please add a title',
  标签无效: 'Unknown tag',
  // Discussion v2: anonymous posts, replies, comment votes and their notices
  这里不能匿名发帖: "You can't post anonymously here",
  不能给自己的评论点赞: "You can't upvote your own comment",
  有人回复了你的帖子: 'New reply to your post',
  有人回复了你的评论: 'New reply to your comment',
  有人在讨论中提到了你: 'You were mentioned in a discussion',
  // Thread polls (lib/server/solution-posts.ts)
  只有讨论帖可以发起投票: 'Only discussion threads can have a poll',
  投票截止时间要晚于现在: 'The poll must close in the future',
  '已经有人投票，不能再修改投票': "People have voted already, so the poll can't change",
  投票不存在: 'Poll not found',
  投票已截止: 'This poll has closed',
  投票选项无效: 'Invalid poll choice',
  你已经投过票了: "You've already voted",
  // Saved lists and follows (lib/server/learner-cloud.ts, lib/server/follows.ts)
  不能收藏自己的题单: "You can't save your own list",
  请在题单页收藏: 'Save lists from their page',
  主页不存在: 'Profile not found',
  不能关注自己: "You can't follow yourself",
  关注人数已达上限: "You're following as many people as you can",
  // Company follows (lib/server/follows.ts, company-follows.ts) and reminders (lib/server/reminders.ts); notification titles too
  公司不存在: 'Company not found',
  '最多关注 20 家公司': 'You can follow up to 20 companies',
  推送尚未开通: "Push notifications aren't available yet",
  不支持这个推送服务: "This push service isn't supported",
  今日学习提醒: "Today's practice reminder",
  '你报名的比赛 1 小时内开始': 'A contest you entered starts within the hour',
  // Application tracker (lib/server/applications.ts)
  投递记录已达上限: "You've reached the limit for tracked applications",
  投递记录不存在: 'Application not found',
  // Career contacts (lib/server/contacts.ts) and tracker reminders (lib/server/reminders.ts)
  联系人已达上限: "You've reached the limit for contacts",
  联系人不存在: 'Contact not found',
  'OA 将在 24 小时内截止': 'An OA is due within 24 hours',
  'OA 将在 2 小时内截止': 'An OA is due within 2 hours',
  '面试将在 1 小时内开始': 'An interview starts within the hour',
  今天的评论已达上限: "You've reached today's limit for comments",
  今天的举报次数已达上限: "You've reached today's limit for reports",
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
  // AI tutor (lib/server/ai-tutor.ts)
  'AI 助教今天的额度已用完，明天再来': 'The AI tutor is out of credit for today. Come back tomorrow',
  '今天的 AI 提示次数已用完，明天再来': "You've used today's AI hints. Come back tomorrow",
  '今天的 AI 点评次数已用完，明天再来': "You've used today's AI reviews. Come back tomorrow",
  '今天的 AI 问答次数已用完，明天再来': "You've used today's Ask AI questions. Come back tomorrow",
  'AI 助教暂时不可用，请稍后再试': 'The AI tutor is unavailable right now. Please try again later',
  'AI 助教无法回答这个请求': "The AI tutor can't answer this request",
  '代码过长，AI 助教最多读取 20000 个字符': 'The code is too long; the AI tutor reads at most 20,000 characters',
  '今天的 AI 追问次数已用完，明天再来': "You've used today's AI questions. Come back tomorrow",
  '今天的 AI 用例生成次数已用完，明天再来': "You've used today's AI test ideas. Come back tomorrow",
  '今天的 AI 调试次数已用完，明天再来': "You've used today's AI debugging help. Come back tomorrow",
  '今天的 AI 复杂度分析次数已用完，明天再来': "You've used today's AI complexity checks. Come back tomorrow",
  '今天的 AI 解释次数已用完，明天再来': "You've used today's AI explanations. Come back tomorrow",
  // Resume review (lib/server/ai-resume.ts)
  '今天的简历点评次数已用完，明天再来': "You've used today's resume reviews. Come back tomorrow",
  '请粘贴完整的简历文字（至少 80 个字符）': 'Paste your whole resume as text (at least 80 characters)',
  '简历过长，最多读取 12000 个字符': 'The resume is too long; the review reads at most 12,000 characters',
  // JD readiness checklist (lib/server/ai-jd.ts)
  '请粘贴完整的职位描述（至少 80 个字符）': 'Paste the whole job description (at least 80 characters)',
  // AI-assisted round (lib/server/ai-rounds.ts, createProjectRun)
  练习任务不存在: 'Practice task not found',
  请先通过上一关: 'Pass the previous level first',
  '项目最多 30 个文件，合计 256 KiB': 'A project is limited to 30 files and 256 KiB in all',
  '今天的 AI 结对次数已用完，明天再来': "You've used today's AI pair requests. Come back tomorrow",
  'AI 结对今天的额度已用完，明天再来': 'The AI pair is out of credit for today. Come back tomorrow',
  '今天的 AI 结对评估次数已用完，明天再来': "You've used today's AI round reviews. Come back tomorrow",
  '今天的 AI 作答点评次数已用完，明天再来': "You've used today's AI answer feedback. Come back tomorrow",
  '今天的职位描述分析次数已用完，明天再来': "You've used today's job description checks. Come back tomorrow",
  '比赛进行中，AI 结对暂停，赛后开放': 'The AI pair is paused while your contest runs; it reopens afterwards',
  // Round review (lib/server/round-review.ts)
  '对话过长，评估最多读取 24000 个字符': 'The conversation is too long; the review reads at most 24,000 characters',
  '比赛或考试进行中，AI 评估暂停，结束后开放': 'AI reviews are paused while your contest or exam runs; they reopen afterwards',
  '带回家作业没有 AI 结对可评估': 'Take-home assignments have no AI pair to review',
  '先和 AI 结对聊几轮再评估': 'Ask the AI pair a few questions before asking for a review',
  // Answer and STAR story feedback (lib/server/ai-answer.ts)
  '这道题没有参考答案，不能 AI 点评': "This question has no reference answer, so AI feedback isn't available",
  '至少写 80 个字符再请求 AI 点评': 'Write at least 80 characters before asking for AI feedback',
  '内容过长，AI 点评最多读取 6000 个字符': 'Too long: AI feedback reads at most 6,000 characters',
  '比赛或考试进行中，AI 作答点评暂停，结束后开放':
    'AI answer feedback is paused while your contest or exam runs; it reopens afterwards',
  '这道题没有 LeetCode 模式': "This problem has no LeetCode mode",
  请先输入问题: 'Type a question first',
  请先在题面里选中一段文字: 'Select some text in the statement first',
  通过本题后才能分析复杂度: 'Complexity analysis opens once you pass this problem',
  还没有失败的运行或提交可以分析: 'There is no failed run or submission to look at yet',
  '只能给题目和官方题解投票，或给面经和面试题点赞':
    'Only problems and editorials can be voted on, and experiences and interview questions upvoted',
  只有老师可以把内容设为精选: 'Only teachers can mark content as curated',
  // AI interviewer (lib/server/ai-interviewer.ts)
  'AI 面试官暂时不可用，请稍后再试': 'The AI interviewer is unavailable right now. Please try again later',
  'AI 面试官无法回答这个请求': "The AI interviewer can't answer this request",
  'AI 面试官响应超时，请稍后再试': 'The AI interviewer took too long. Please try again',
  '今天的 AI 模拟面试次数已用完，明天再来': "You've used today's AI mock interviews. Come back tomorrow",
  '今天的 AI 面试对话轮数已用完，明天再来': "You've used today's AI interview messages. Come back tomorrow",
  '这场 AI 面试已失效，请重新开始': 'This AI interview has expired. Your next message starts a new one',
  '这场面试的对话轮数已用完': 'This interview is out of messages',
  这场面试的分步反馈次数已用完: 'This interview is out of step feedback',
  这一步还没有你的回答: "You haven't answered anything in this step yet",
  这道题没有这个步骤: "This question doesn't have that step",
  'AI 面试官今天的额度已用完，明天再来': 'The AI interviewer is out of credit for today. Come back tomorrow',
  '这场面试已经生成过评估': 'This interview already has its report',
  '这道题的对话太长了，请换下一题或结束面试': "This question's conversation is too long. Move on to the next question or finish the interview",
  '对话太长，无法生成评估': 'The conversation is too long to grade',
  题目不在面试题库里: "This question isn't in the interview bank",
  还没有可以评估的对话: "There's no conversation to grade yet",
  '请先写一些代码再请求点评': 'Write some code before asking for a review',
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
  这道题没有调试练习: "This problem has no debugging drill",
  未知公司: 'Unknown company',
  // Timed mock OA (lib/server/mock-oa.ts)
  '模拟 OA 接口不存在': 'Mock OA endpoint not found',
  '没有这家公司的模拟 OA': "There's no mock OA for this company",
  这篇面经没有能判题的关联题: 'None of the problems this experience links can be judged here yet',
  '这家公司的可判题还不够，换一家公司或减少题量':
    "There aren't enough judgeable problems for this mock yet. Pick another company or fewer questions",
  '所选知识点下的题不够，减少题量或多选几个':
    'Not enough problems on the topics you picked. Draw fewer questions or pick more topics',
  模拟考试参数无效: 'Invalid mock exam parameters',
  // OA multiple-choice answer stats (lib/server/mcq-stats.ts)
  选择题不存在: 'Question not found',
  选项不合法: 'Invalid choice',
  '一次最多查询 50 道题': 'Ask for at most 50 questions at a time',
  // Skill certification exams (lib/server/skill-tests.ts) and their certificates
  你还有一场认证考试没有结束: 'You still have a certification exam in progress',
  '同一项认证 7 天内只能考一次': 'You can take each certification exam once every 7 days',
  '题库里你还没做过的题不够，暂时无法开考':
    "There aren't enough problems you haven't solved for this exam yet",
  没有进行中的认证考试: 'No certification exam in progress',
  认证考试接口不存在: 'Certification endpoint not found',
  系统设计面试课: 'System Design Interview Course',
  // Course star ratings (lib/server/course-ratings.ts)
  学完至少一节后才能评分: 'Finish at least one lesson before rating this course',
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
  'LeetCode 同步暂不可用：LeetCode 接口有变化，正在适配':
    "LeetCode sync is temporarily unavailable: LeetCode changed its API and we're adapting",
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
  // Course gifts (lib/server/course-gifts.ts); notification titles too
  课程礼物的兑换码已生成: 'Your course gift code is ready',
  你送出的课程礼物已被兑换: 'Your course gift was redeemed',
  兑换码无效或已被使用: 'This gift code is invalid or already used',
  这个兑换码已被使用或已作废: 'This gift code was already used or voided',
  '你已经开通了这门课程，兑换码可以留给别人': 'You already have this course. Save the code for someone else',
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
  // POST problems/<id>/expected (lib/testcase-fields.ts checkConstraints)
  [
    /^超出题目约束：(\S+) (长度|节点数|的值) (\S+ [<>] \S+)$/,
    (name, what, rest) =>
      `Outside the problem's constraints: ${name} ${what === '的值' ? 'value' : what === '节点数' ? 'node count' : 'length'} ${rest}`,
  ],
  [/^(\d+) 人赞了你的帖子$/, (n) => `${n} ${n === '1' ? 'person' : 'people'} upvoted your post`],
  [/^关注的公司上线了 (\d+) 道新 OA 题$/, (n) => `${n} new OA ${n === '1' ? 'problem' : 'problems'} at companies you follow`],
  [/^关注的公司有 (\d+) 条新动态$/, (n) => `${n} ${n === '1' ? 'update' : 'updates'} at companies you follow`],
  // The daily digest with a saved /career/jobs search (lib/server/company-follows.ts).
  [/^保存的筛选有 (\d+) 个新岗位$/, (n) => `${n} new ${n === '1' ? 'opening matches' : 'openings match'} your saved search`],
  [
    /^保存的筛选有 (\d+) 个新岗位，关注的公司有 (\d+) 条新动态$/,
    (n, m) => `${n} new ${n === '1' ? 'opening matches' : 'openings match'} your saved search; ${m} ${m === '1' ? 'update' : 'updates'} at companies you follow`,
  ],
  [/^(.+) 有新面经$/, (company) => `New interview report: ${company}`],
];

export function englishMessage(message: string) {
  if (Object.hasOwn(EN, message)) return EN[message];
  for (const [pattern, render] of PATTERNS) {
    const m = pattern.exec(message);
    if (m) return render(...m.slice(1));
  }
  return message;
}
