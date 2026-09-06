# 导入 GoMall 真实课程视频

在已安装全部依赖、已执行数据库迁移的源代码目录运行。工具复用 `saveLessonDraft` / `publishLesson`，因此需要开发依赖 `tsx`；不要直接在仅含 standalone 产物的目录运行。

```sh
node --env-file=.env scripts/import-gomall-videos.mjs \
  --source /home/ubuntu/cswork-build/videos \
  --media /srv/cswork/media \
  --dry-run
```

`DATABASE_PATH` 指向现有目标数据库，`ADMIN_EMAILS` 中第一个已验证账号作为发布老师；可用 `--actor 邮箱` 选择另一位已配置的老师。默认仅预览，不创建媒体目录、不修改数据。核对预览后，用相同命令将 `--dry-run` 改为 `--apply`。

映射固定为：00→系统全景；01/02→用户鉴权上下集；03→余额支付；04→支付对账；05/06→清算上下集；07→卖家结算；08→商品搜索；09→混合召回。脚本保存对应 Drive 文件 ID 为 `source_id`，素材 ID 为 `gomall-video-00` 至 `gomall-video-09`。

源目录存在 `metadata.json` 时，必须是十项 `{index,duration,size,streams}` 数组。工具校验编号唯一、时长为正数、大小与实际视频一致，再保存 ffprobe 时长；没有此文件时，时长保持为空。

执行时先校验十个 MP4 的文件头、大小和 SHA-256，再复制为带内容哈希的不可覆盖文件。所有文件准备好后，独立 CLI 连接才取得 SQLite 写锁，将媒体记录、八章视频列表、递增的补丁版本、历史快照、审计和站内通知一起提交。不会发送邮件或其他外部消息。正文、标题、已有进度及其他用户数据保持原值。重复执行只核验，不重复发布版本或通知。

存在未发布草稿、已下架课程/章节、其他视频或 Stream 配置、文件内容冲突时会拒绝导入。普通错误及 SIGINT/SIGTERM 会回滚未提交的数据，并清理本轮新建且未被数据库引用的文件。可先短暂停止应用再正式执行，减少与老师编辑冲突；工具也会在复制后重新核对课件版本。

运行前备份数据库，并保留原视频。`MEDIA_PATH` 应使用部署文档中的组权限设置，让应用和 Nginx 可读取新文件。若机器断电或进程被强制终止，SQLite 会恢复未提交事务；先确认导入进程已结束，再检查 `.gomall-video-import.lock` 和 `.import-*.tmp`。不要覆盖或批量删除现有媒体，遗留的相同内容文件会在下次运行时被核验并复用。

以 root 执行正式导入后，必须设置新视频的归属并验证服务用户能读取；否则 `root:www-data` 的 `0640` 文件会阻止 `cswork` 读取和创建备份硬链接。以下命令让通配符在有权限的 shell 内展开：

```sh
sudo sh -c 'chown cswork:www-data /srv/cswork/media/gomall-video-*.mp4 && chmod 0640 /srv/cswork/media/gomall-video-*.mp4'
sudo -u cswork sh -c 'for video in /srv/cswork/media/gomall-video-*.mp4; do test -f "$video" && head -c 1 "$video" >/dev/null || exit 1; done; echo "cswork 可以读取已导入视频"'
```
