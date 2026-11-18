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
  'avatar.none': '没有可选图片；把图片放入插件 data/assets/ 目录',
  'avatar.clear': '恢复默认图标',
  'settings.hint': '为团队成员预配头像：图片放在插件 data/assets/ 目录，这里选择后成员卡片即显示。',
  'settings.noAssets': 'data/assets/ 目录还没有图片，放入后即在此可选。',
  'settings.empty': '暂无成员；打开带子代理的会话后在此配置。',
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
  'avatar.none': 'No images available; drop files into the plugin data/assets/ directory',
  'avatar.clear': 'Restore default icon',
  'settings.hint': 'Pre-configure team member avatars: put images in the plugin data/assets/ directory, then pick one here and member cards display it.',
  'settings.noAssets': 'No images in data/assets/ yet; drop files there to pick them here.',
  'settings.empty': 'No members yet; open a session with subagents to configure them here.',
} satisfies Record<TeamKey, string>
