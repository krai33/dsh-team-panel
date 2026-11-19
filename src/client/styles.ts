/**
 * Team panel class map and stylesheet injection. Class names are prefixed
 * `tp-` and the style tag is inserted once at factory materialization — the
 * standalone equivalent of the in-repo CSS-modules build.
 */

const stylesheet = `.tp-root{position:relative}
.tp-trigger{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:3px 7px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12px;cursor:pointer}
.tp-trigger:focus-visible{color:var(--dsw-alias-label-primary)}
@media (hover:hover){.tp-trigger:hover{color:var(--dsw-alias-label-primary)}}
@container (max-width:480px){.tp-triggerLabel{display:none}}
.tp-count{color:var(--dsw-alias-label-caption);font-size:12px;font-weight:400;font-variant-numeric:tabular-nums;line-height:16px}
.tp-panel{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);display:flex;flex-direction:column;position:fixed;z-index:100;box-sizing:border-box;width:min(500px,100vw - 32px);max-height:min(680px,calc(100vh - 32px),var(--dsh-anchored-max-height,100vh));padding:8px 2px 0;overflow:hidden;border:0;border-radius:12px;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);max-width:var(--dsh-anchored-max-width,none)}
.tp-panel::before{content:'';position:absolute;z-index:-1;inset:0;border-radius:12px;background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter)}
.tp-panelCompact{width:min(320px,100vw - 32px)}
.tp-panelCompact .tp-roster{grid-template-columns:minmax(0,1fr)}
.tp-body{--dsh-scrollbar-track-margin:8px;flex:1 1 auto;min-height:0;padding:0 9px 16px 14px;overflow-y:auto;scrollbar-gutter:stable}
.tp-taskTitle{display:flex;align-items:center;gap:8px}
.tp-taskTitle strong{font-size:13px;font-weight:500}
.tp-panel h3{display:flex;align-items:center;gap:8px;margin:16px 0 8px 4px;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}
.tp-body section:first-of-type h3{margin-top:8px}
.tp-roster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tp-member{display:flex;align-items:flex-start;gap:8px;min-width:0;padding:10px 12px;border:0;--dsw-elevation-stroke-color:var(--dsw-alias-border-l2);box-shadow:var(--dsw-elevation-stroke);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;text-align:left}
.tp-memberOpen{display:flex;flex:1 1 auto;min-width:0;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.tp-memberOpen:disabled{cursor:default}
.tp-memberOpen:not(:disabled):focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:2px;border-radius:6px}
.tp-memberCurrent{--dsw-elevation-stroke-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);box-shadow:var(--dsw-elevation-stroke),inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent)}
.tp-member:focus-within{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3);box-shadow:var(--dsw-elevation-panel)}
@media (hover:hover){.tp-member:hover{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3);box-shadow:var(--dsw-elevation-panel)}}
.tp-memberDot{display:inline-flex;align-items:center;flex:none;position:relative;height:1lh}
.tp-runningDot{position:absolute;right:-3px;bottom:-1px;width:9px;height:9px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2);animation:tp-breathe 1.8s ease-in-out infinite}
@keyframes tp-breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.78)}}
.tp-inactiveIcon{color:var(--dsw-alias-label-tertiary)}
.tp-memberText{display:flex;flex-direction:column;min-width:0}
.tp-memberName{display:inline-flex;align-items:center;gap:5px;min-width:0}
.tp-memberNameText,.tp-memberText small{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tp-memberModel{display:inline}
.tp-currentTag{display:inline-block;flex:0 999 auto;min-width:0;padding:0 4px;overflow:hidden;font-size:10px;line-height:15px;text-overflow:ellipsis}
.tp-memberText small{color:var(--dsw-alias-label-tertiary);font-size:11px}
.tp-tasks{display:flex;flex-direction:column;gap:7px}
.tp-emptyNotice{margin:16px 0 0 4px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.tp-task{padding:11px 13px;border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-2)}
.tp-taskState{display:inline-flex;align-items:center;gap:6px;margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:11px}
.tp-task p{margin:5px 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;white-space:pre-wrap}
.tp-clampedDescription{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.tp-expandToggle{display:inline-flex;align-items:center;gap:2px;float:right;margin-left:10px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:20px;cursor:pointer}
.tp-expandToggle:focus-visible{color:var(--dsw-alias-label-primary)}
@media (hover:hover){.tp-expandToggle:hover{color:var(--dsw-alias-label-primary)}}
.tp-expandToggle svg{transition:transform 120ms ease}
.tp-expandToggleOpen{transform:rotate(180deg)}
.tp-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:20px}
.tp-meta>span{margin-right:10px}
.tp-notice,.tp-error{display:flex;align-items:center;gap:6px;padding:9px;font-size:12px}
.tp-error{color:var(--dsw-alias-state-error-primary)}
.tp-avatarSeat{position:relative}
.tp-avatarButton{display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:6px;background:transparent;cursor:pointer}
.tp-avatarButton:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:1px}
.tp-avatarImage{display:block;width:22px;height:22px;border-radius:6px;object-fit:cover}
.tp-avatarMenu{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);display:flex;flex-direction:column;position:fixed;z-index:110;box-sizing:border-box;min-width:200px;max-height:280px;padding:6px;overflow-y:auto;border-radius:10px;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter)}
.tp-avatarOption{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;text-align:left;cursor:pointer}
.tp-avatarOption:focus-visible{background:var(--dsw-alias-bg-layer-2)}
@media (hover:hover){.tp-avatarOption:hover{background:var(--dsw-alias-bg-layer-2)}}
.tp-avatarOptionActive{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.tp-avatarThumb{display:block;width:20px;height:20px;border-radius:4px;object-fit:cover;flex:none}
.tp-avatarName{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tp-avatarClear{width:100%;padding:6px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px;text-align:left;cursor:pointer}
.tp-avatarClear:focus-visible,.tp-avatarClear:hover{color:var(--dsw-alias-label-primary)}
.tp-avatarUpload{display:flex;align-items:center;gap:6px;margin-top:4px;padding:6px 8px;border-top:1px solid var(--dsw-alias-border-l2);border-radius:0 0 6px 6px;color:var(--dsw-alias-label-secondary);font-size:11px;cursor:pointer}
.tp-avatarUpload:focus-within,.tp-avatarUpload:hover{color:var(--dsw-alias-label-primary)}
.tp-avatarUploadInput{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.tp-settingsTab{display:flex;flex-direction:column;gap:8px}
.tp-settingsHint{margin:0 0 4px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.tp-settingsRow{display:flex;align-items:center;gap:10px;min-width:0;padding:2px 0}
.tp-settingsLabel{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);font-size:12px}
.tp-settingsSelect{flex:0 1 200px;min-width:0;max-width:200px}
.tp-settingsError{flex:none;color:var(--dsw-alias-state-error-primary);font-size:11px}
`

const classNames = {
  root: 'tp-root',
  trigger: 'tp-trigger',
  triggerLabel: 'tp-triggerLabel',
  count: 'tp-count',
  panel: 'tp-panel',
  panelCompact: 'tp-panelCompact',
  body: 'tp-body',
  roster: 'tp-roster',
  member: 'tp-member',
  memberOpen: 'tp-memberOpen',
  memberCurrent: 'tp-memberCurrent',
  memberDot: 'tp-memberDot',
  runningDot: 'tp-runningDot',
  inactiveIcon: 'tp-inactiveIcon',
  memberText: 'tp-memberText',
  memberName: 'tp-memberName',
  memberNameText: 'tp-memberNameText',
  memberModel: 'tp-memberModel',
  memberStatusLine: 'tp-memberText',
  currentTag: 'tp-currentTag',
  tasks: 'tp-tasks',
  emptyNotice: 'tp-emptyNotice',
  task: 'tp-task',
  taskTitle: 'tp-taskTitle',
  taskState: 'tp-taskState',
  clampedDescription: 'tp-clampedDescription',
  expandToggle: 'tp-expandToggle',
  expandToggleOpen: 'tp-expandToggleOpen',
  meta: 'tp-meta',
  notice: 'tp-notice',
  error: 'tp-error',
  avatarSeat: 'tp-avatarSeat',
  avatarButton: 'tp-avatarButton',
  avatarImage: 'tp-avatarImage',
  avatarMenu: 'tp-avatarMenu',
  avatarOption: 'tp-avatarOption',
  avatarOptionActive: 'tp-avatarOptionActive',
  avatarThumb: 'tp-avatarThumb',
  avatarName: 'tp-avatarName',
  avatarClear: 'tp-avatarClear',
  avatarUpload: 'tp-avatarUpload',
  avatarUploadInput: 'tp-avatarUploadInput',
  settingsTab: 'tp-settingsTab',
  settingsHint: 'tp-settingsHint',
  settingsRow: 'tp-settingsRow',
  settingsLabel: 'tp-settingsLabel',
  settingsSelect: 'tp-settingsSelect',
  settingsError: 'tp-settingsError',
} as const

const TAG_ID = 'dsh-team-panel/TeamAction.css'

if (typeof document !== 'undefined'
  && document.querySelector(`style[data-plugin-css=${JSON.stringify(TAG_ID)}`) === null) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-team-panel'
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = stylesheet
  document.head.appendChild(tag)
}

export default classNames
