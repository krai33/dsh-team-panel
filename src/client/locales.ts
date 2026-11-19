/** Team panel Web dictionaries. */

/** Locale namespace owned by the Team panel Web UI. */
export const NS = 'team-panel'

/** Simplified Chinese dictionary and key source. */
export const zh = {
  trigger: '智能体团队',
  loading: '正在加载团队…',
  unavailable: '尚无成员',
  empty: '暂无任务，让主会话用 todo_write 维护计划即可显示',
  roster: '成员',
  tasks: '任务',
  model: '模型',
  open: '打开成员会话',
  current: '当前会话',
  'task.expand': '展开',
  'task.collapse': '收起',
  'memberStatus.running': '运行中',
  'memberStatus.inactive': '未运行',
  'memberStatus.provisioning': '准备中',
  'status.pending': '待处理',
  'status.in_progress': '进行中',
  'status.completed': '已完成',
  'avatar.pick': '选择头像',
  'avatar.image': '成员头像',
  'avatar.loading': '正在加载头像…',
  'avatar.none': '没有可选图片；点击下方“添加图片”上传',
  'avatar.upload': '添加图片',
  'avatar.uploading': '正在上传…',
  'avatar.clear': '恢复默认图标',
  'settings.hint': '为团队成员预配头像：点击“添加图片”上传，然后给每个成员选择一张。',
  'settings.noAssets': 'data/assets/ 目录还没有图片，放入后即在此可选。',
  'settings.empty': '暂无成员；打开带子代理的会话后在此配置。',
  'model.switch': '切换模型',
  'model.loading': '正在加载模型列表…',
  'model.none': '无可用模型',
  'model.hint': '切换在成员下一步生效',
} satisfies Record<string, string>

/** Team panel locale key union. */
export type TeamKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  trigger: 'Agent team',
  loading: 'Loading team…',
  unavailable: 'No members yet',
  empty: 'No tasks yet. Ask the lead session to keep a todo_write plan and they appear here.',
  roster: 'Members',
  tasks: 'Tasks',
  model: 'Model',
  open: 'Open member conversation',
  current: 'Current chat',
  'task.expand': 'Show more',
  'task.collapse': 'Show less',
  'memberStatus.running': 'Running',
  'memberStatus.inactive': 'Inactive',
  'memberStatus.provisioning': 'Provisioning',
  'status.pending': 'Pending',
  'status.in_progress': 'In progress',
  'status.completed': 'Completed',
  'avatar.pick': 'Choose avatar',
  'avatar.image': 'Member avatar',
  'avatar.loading': 'Loading avatars…',
  'avatar.none': 'No images yet; use "Add image" below to upload one',
  'avatar.upload': 'Add image',
  'avatar.uploading': 'Uploading…',
  'avatar.clear': 'Restore default icon',
  'settings.hint': 'Pre-configure team member avatars: upload images with "Add image", then pick one per member.',
  'settings.noAssets': 'No images in data/assets/ yet; drop files there to pick them here.',
  'settings.empty': 'No members yet; open a session with subagents to configure them here.',
  'model.switch': 'Switch model',
  'model.loading': 'Loading models…',
  'model.none': 'No models available',
  'model.hint': 'Applies at the member\u2019s next step',
} satisfies Record<TeamKey, string>
