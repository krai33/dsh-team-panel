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
} satisfies Record<TeamKey, string>
