import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SubagentCatalogEntry } from '@deepseek-ai/dsh-subagent/types'
import type { TodoItem } from '@deepseek-ai/dsh-tool-todo/types'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import {
  IconChevronDownOutlineRegular, IconCloseOutlineRegular, IconPlusOutlineRegular,
  IconUserOutlineRegular, IconUsersOutlineRegular, StateDot, Tag, Tooltip,
  useAnchoredPosition, useDismissOnOutsidePointer, type StateDotState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS, type TeamKey } from './locales.ts'
import { AvatarSeat } from './AvatarSeat.tsx'
import { addMember } from './add-member.ts'
import { getRemovedSnapshot, loadRemoved, removeMember, subscribeRemoved } from './removed.ts'
import { getStagedSnapshot, loadStaged, subscribeStaged } from './staged.ts'
import css from './styles.ts'

/** Business actions injected by the browser plugin. */
export interface TeamActionInjected {
  /** Open a roster Session from the current conversation. */
  openTeammate: (sessionId: SessionId, childSessionId: SessionId) => void
}

/** Durable lifecycle overlaid with the member Session's live turn activity. */
type MemberStatus = 'running' | 'inactive' | 'provisioning'

/** Full props of the Team panel conversation-header action. */
export type TeamActionProps =
  PropsRuntime<'conversation.session.header.actions'> & TeamActionInjected & PropsLocale<typeof NS>

function statusKey(status: TodoItem['status']): TeamKey {
  switch (status) {
    case 'pending': return 'status.pending'
    case 'in_progress': return 'status.in_progress'
    case 'completed': return 'status.completed'
  }
}

function memberStatusKey(status: MemberStatus): TeamKey {
  switch (status) {
    case 'running': return 'memberStatus.running'
    case 'inactive': return 'memberStatus.inactive'
    case 'provisioning': return 'memberStatus.provisioning'
  }
}

function taskDotState(task: TodoItem): StateDotState {
  switch (task.status) {
    case 'pending': return 'idle'
    case 'in_progress': return 'ongoing'
    case 'completed': return 'done'
  }
}

type TeamMemberRowProps = Pick<TeamActionProps,
  'sessionId' | 'useSessions' | 'useSessionStatus' | 'openTeammate' | 't'
> & {
  member: SubagentCatalogEntry
  memberCount: number
  onError: (message: string) => void
}

function TeamMemberRow({
  member, memberCount, sessionId, useSessions, useSessionStatus, openTeammate, onError, t,
}: TeamMemberRowProps) {
  const model = useSessions(state => state.projectionsBySession[member.id]?.values.modelSelection?.next?.model)
  const staged = useSyncExternalStore(subscribeStaged, getStagedSnapshot).byMember[member.id]
  const shownModel = staged?.model ?? model
  const running = useSessionStatus(state => state.get(member.id)?.running)
  const summaryRunning = useSessions(state => state.byId[member.id]?.running)
  const status: MemberStatus
    = (running ?? summaryRunning ?? false) === true ? 'running'
      : member.mode === 'unknown' ? 'provisioning'
        : 'inactive'
  const isCurrent = member.id === sessionId
  const highlightCurrent = isCurrent && memberCount > 1
  const inert = isCurrent || member.mode !== 'continuable'

  return (
    <Tooltip label={t('open')} side="bottom" gap={4} disabled={inert}>
      <div
        className={highlightCurrent ? `${css.member} ${css.memberCurrent}` : css.member}
        data-member-card
      >
        <span className={css.memberDot} title={t(memberStatusKey(status))}>
          <AvatarSeat sessionId={member.id} t={t} />
          {(status === 'running' || status === 'provisioning') && (
            <span className={css.runningDot} data-running-dot aria-hidden="true" />
          )}
        </span>
        <button
          type="button"
          className={css.memberOpen}
          disabled={inert}
          aria-label={t('open')}
          onClick={() => {
            try {
              openTeammate(sessionId, member.id)
            } catch (reason) {
              onError(String(reason))
            }
          }}
        >
          <span className={css.memberText}>
            <span className={css.memberName}>
              <span className={css.memberNameText}>{member.label ?? member.id}</span>
              {isCurrent && <Tag tone="info" className={css.currentTag}>{t('current')}</Tag>}
            </span>
            <small className={css.memberStatusLine}>
              {shownModel !== undefined && (
                <span className={css.memberModel}>{`${t('model')}: ${shownModel}`}</span>
              )}
            </small>
          </span>
        </button>
      </div>
    </Tooltip>
  )
}

/** Card plus its hover-gated remove control; the lead row has no remove. */
function TeamChildRow(props: TeamMemberRowProps & { onRemoved: (message: string) => void }) {
  const { member, t } = props
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const confirmPosition = useAnchoredPosition({
    open: confirming, anchorRef, panelRef, gap: 6, margin: 12,
  })

  useEffect(() => {
    if (!confirming) return
    const dismiss = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setConfirming(false)
    }
    document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('keydown', dismiss) }
  }, [confirming])

  useDismissOnOutsidePointer(anchorRef, confirming, setConfirming, panelRef)

  const confirmRemove = (): void => {
    if (busy) return
    setBusy(true)
    setError(null)
    void removeMember(props.sessionId, member.id)
      .catch((reason: unknown) => { setError(reason instanceof Error ? reason.message : String(reason)) })
      .finally(() => setBusy(false))
  }

  return (
    <div ref={anchorRef} className={css.memberRemoveWrap}>
      <TeamMemberRow {...props} />
      <button
        type="button"
        className={css.memberRemove}
        aria-label={t('remove.aria')}
        aria-haspopup="dialog"
        aria-expanded={confirming}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation()
          setError(null)
          setConfirming(current => !current)
        }}
      >
        <IconCloseOutlineRegular size={11} />
      </button>
      {confirming && createPortal(
        <div
          ref={panelRef}
          className={css.confirmCard}
          style={confirmPosition ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="dialog"
          aria-label={t('remove.confirmTitle')}
          onPointerDown={(event) => { event.stopPropagation() }}
          onClick={(event) => { event.stopPropagation() }}
        >
          <div className={css.confirmTitle}>{t('remove.confirmTitle')}</div>
          <div className={css.confirmDesc}>{t('remove.confirmDesc', { name: member.label ?? member.id })}</div>
          {error !== null && <div className={css.confirmError} role="alert">{error}</div>}
          <div className={css.confirmActions}>
            <button type="button" className={css.confirmCancel} disabled={busy} onClick={() => { setConfirming(false) }}>
              {t('remove.cancel')}
            </button>
            <button type="button" className={css.confirmGo} disabled={busy} onClick={confirmRemove}>
              {busy ? t('remove.pending') : t('remove.confirm')}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/** Roster-header control that creates a member under the lead with a chosen delegation depth. */
function AddMemberSeat({ leadSessionId, t }: { leadSessionId: SessionId; t: TranslateNS<typeof NS> }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [label, setLabel] = useState('')
  const [depth, setDepth] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const position = useAnchoredPosition({ open, anchorRef, panelRef, gap: 6, margin: 12 })

  useDismissOnOutsidePointer(anchorRef, open, setOpen, panelRef)

  useEffect(() => {
    if (!open) return
    promptRef.current?.focus()
    const dismiss = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('keydown', dismiss) }
  }, [open])

  const submit = (): void => {
    if (pending || prompt.trim() === '') return
    setPending(true)
    setError(null)
    void addMember({
      sessionId: leadSessionId,
      prompt: prompt.trim(),
      ...label.trim() === '' ? {} : { label: label.trim() },
      depth,
    })
      .then(() => {
        setPrompt('')
        setLabel('')
        setDepth(1)
        setOpen(false)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => { setPending(false) })
  }

  return (
    <span ref={anchorRef} className={css.addSeat}>
      <button
        type="button"
        className={css.addTrigger}
        aria-label={t('add.aria')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setError(null); setOpen(current => !current) }}
      >
        <IconPlusOutlineRegular size={12} />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className={css.addCard}
          style={position ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="dialog"
          aria-label={t('add.title')}
          onPointerDown={(event) => { event.stopPropagation() }}
          onClick={(event) => { event.stopPropagation() }}
        >
          <div className={css.confirmTitle}>{t('add.title')}</div>
          <label className={css.addField}>
            <span>{t('add.prompt')}</span>
            <textarea
              ref={promptRef}
              className={css.addTextarea}
              value={prompt}
              placeholder={t('add.promptPlaceholder')}
              onChange={(event) => { setPrompt(event.target.value) }}
            />
          </label>
          <label className={css.addField}>
            <span>{t('add.label')}</span>
            <input
              type="text"
              className={css.addInput}
              value={label}
              onChange={(event) => { setLabel(event.target.value) }}
            />
          </label>
          <fieldset className={css.addField}>
            <legend>{t('add.depth')}</legend>
            <div className={css.addDepthRow}>
              {[1, 2, 3].map(tier => (
                <label key={tier} className={css.addDepthOption}>
                  <input
                    type="radio"
                    name="team-panel-add-depth"
                    checked={depth === tier}
                    onChange={() => { setDepth(tier) }}
                  />
                  <span>{String(tier)}</span>
                </label>
              ))}
            </div>
            <small className={css.addHint}>{t('add.depthHint')}</small>
          </fieldset>
          {error !== null && <div className={css.confirmError} role="alert">{error}</div>}
          <div className={css.confirmActions}>
            <button
              type="button"
              className={css.confirmCancel}
              disabled={pending}
              onClick={() => { setOpen(false) }}
            >
              {t('add.cancel')}
            </button>
            <button
              type="button"
              className={css.addSubmit}
              disabled={pending || prompt.trim() === ''}
              onClick={submit}
            >
              {pending ? t('add.pending') : t('add.submit')}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}

/** Task card with a two-line description clamp expanded from a toggle in the meta row. */
function TaskCard({ task, t }: { task: TodoItem; t: TranslateNS<typeof NS> }) {
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(() => {
    if (expanded) return
    const paragraph = textRef.current
    /* v8 ignore next -- the paragraph mounts in the same commit as the effect. */
    if (paragraph === null) return
    const measure = (): void => { setClamped(paragraph.scrollHeight > paragraph.clientHeight + 1) }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(paragraph)
    return () => { observer.disconnect() }
  }, [task.content, expanded])
  return (
    <article className={css.task}>
      <div className={css.taskTitle}>
        <strong>{task.content}</strong>
        <span className={css.taskState}>
          <StateDot state={taskDotState(task)} />
          <span>{t(statusKey(task.status))}</span>
        </span>
      </div>
      <div className={css.meta}>
        {(clamped || expanded) && (
          <button
            type="button"
            className={css.expandToggle}
            aria-expanded={expanded}
            onClick={() => { setExpanded(current => !current) }}
          >
            {t(expanded ? 'task.collapse' : 'task.expand')}
            <IconChevronDownOutlineRegular size={12} className={expanded ? css.expandToggleOpen : undefined} />
          </button>
        )}
      </div>
    </article>
  )
}

/** Render the Team roster and read-only task board. */
export function TeamAction({
  sessionId, useSession, useSessions, useSessionStatus, openTeammate, t,
}: TeamActionProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerLabelRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const position = useAnchoredPosition({
    open, anchorRef: triggerRef, panelRef, gap: 5, margin: 16,
  })
  const positioned = position !== null
  const leadSessionId = useSession(snapshot => snapshot.subagent?.address.parentSessionId) ?? sessionId
  const catalog = useSessions(state => state.projectionsBySession[leadSessionId]?.values.subagentCatalog)
  const tasks = useSessions(state => state.projectionsBySession[leadSessionId]?.values.todos)
  const ownModel = useSessions(state => state.projectionsBySession[leadSessionId]?.values.modelSelection?.next?.model)
  const ownRunning = useSessionStatus(state => state.get(leadSessionId)?.running)
  const opening = useSession(snapshot => snapshot.openState === 'loading')
  const listing = useSessions(state => state.phase === 'pending')
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pinnedRef = useRef(false)
  const removed = useSyncExternalStore(subscribeRemoved, getRemovedSnapshot, getRemovedSnapshot)

  useEffect(() => { if (open) loadRemoved(leadSessionId) }, [open, leadSessionId])
  // Staged routes are session-independent plugin data; load once per open.
  useEffect(() => { if (open) loadStaged() }, [open])

  const archivedChildren = new Set(removed.byLead[leadSessionId] ?? [])

  const members: SubagentCatalogEntry[] = [
    {
      id: leadSessionId,
      createdAt: 0,
      mode: 'continuable',
      label: useSessions(state => state.byId[leadSessionId]?.displayTitle) ?? leadSessionId,
    },
    ...(catalog ?? []).filter(entry => entry.mode !== 'external' && !archivedChildren.has(entry.id)),
  ]

  const cancelHoverChange = (): void => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = undefined
  }

  useEffect(() => {
    cancelHoverChange()
    pinnedRef.current = false
    setOpen(false)
    setError(null)
  }, [sessionId])

  useEffect(() => cancelHoverChange, [])

  useLayoutEffect(() => {
    if (open && positioned && pinnedRef.current) panelRef.current?.focus()
  }, [open, positioned])

  const changeOpen = (next: boolean): void => {
    cancelHoverChange()
    if (!next) pinnedRef.current = false
    setOpen(next)
  }

  const scheduleHoverOpen = (): void => {
    cancelHoverChange()
    if (open) return
    const label = triggerLabelRef.current
    /* v8 ignore next -- the label mounts with the trigger that received the hover. */
    if (label === null) return
    // Icon-only trigger (label collapsed by the header container query):
    // hover-open would surprise on such a small target, so only click opens.
    if (getComputedStyle(label).display === 'none') return
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = undefined
      changeOpen(true)
    }, 150)
  }

  const scheduleHoverClose = (): void => {
    cancelHoverChange()
    if (pinnedRef.current) return
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = undefined
      changeOpen(false)
    }, 120)
  }

  useDismissOnOutsidePointer(rootRef, open, changeOpen, panelRef)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancelHoverChange()
      pinnedRef.current = false
      setOpen(false)
      if (panelRef.current?.contains(document.activeElement)) triggerRef.current?.focus()
    }
    document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('keydown', dismiss) }
  }, [open])

  const compact = members.length === 1 && (tasks?.length ?? 0) === 0

  return (
    <div
      ref={rootRef}
      className={css.root}
      data-team-action
      onMouseLeave={scheduleHoverClose}
    >
      <button
        type="button"
        ref={triggerRef}
        onMouseEnter={scheduleHoverOpen}
        className={css.trigger}
        aria-label={t('trigger')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          cancelHoverChange()
          pinnedRef.current = true
          if (!open) changeOpen(true)
          else panelRef.current?.focus()
        }}
      >
        <IconUsersOutlineRegular size={14} />
        <span ref={triggerLabelRef} className={css.triggerLabel}>{t('trigger')}</span>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className={compact ? `${css.panel} ${css.panelCompact}` : css.panel}
          style={position ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="dialog"
          tabIndex={-1}
          aria-label={t('trigger')}
          data-team-panel
          onMouseEnter={cancelHoverChange}
          onMouseLeave={scheduleHoverClose}
        >
          <div className={css.body}>
            {error !== null && (
              <div className={css.error} role="alert"><StateDot state="error" />{error}</div>
            )}
            {catalog === undefined && opening === undefined && listing && (
              <div className={css.notice} role="status">
                <StateDot state="ongoing" />
                {t('loading')}
              </div>
            )}
            <section>
              <h3>
                {t('roster')}
                {members.length > 1 && <span className={css.count}>{members.length}</span>}
                <AddMemberSeat leadSessionId={leadSessionId} t={t} />
              </h3>
              <div className={css.roster}>
                <TeamMemberRow
                  key={leadSessionId}
                  member={members[0]}
                  memberCount={members.length}
                  sessionId={sessionId}
                  useSessions={useSessions}
                  useSessionStatus={useSessionStatus}
                  openTeammate={openTeammate}
                  onError={setError}
                  t={t}
                />
                {members.slice(1).map(member => (
                  <TeamChildRow
                    key={member.id}
                    member={member}
                    memberCount={members.length}
                    sessionId={sessionId}
                    useSessions={useSessions}
                    useSessionStatus={useSessionStatus}
                    openTeammate={openTeammate}
                    onError={setError}
                    onRemoved={setError}
                    t={t}
                  />
                ))}
              </div>
            </section>
            <section>
              {(tasks?.length ?? 0) === 0
                ? <p className={css.emptyNotice}>{t('empty')}</p>
                : (
                  <>
                    <h3>{t('tasks')}<span className={css.count}>{tasks?.length}</span></h3>
                    <div className={css.tasks}>
                      {tasks?.map(task => <TaskCard key={task.content} task={task} t={t} />)}
                    </div>
                  </>
                )}
            </section>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
