/**
 * dsh-novel-companion —— Client half.
 *
 * Registered as a factory in the Harness Web page's module table. It renders:
 *   1. `sidebar.panellist` + `main` — the global 「小说」 panel (project list,
 *      the interview boards, the per-chapter outline/draft workflow);
 *   2. `conversation.session.header.utilities` — a compact hand-off row above the
 *      composer that copies the right prompt (or the whole project brief) into
 *      the current conversation's draft.
 *
 * Document data lives on the Host (`./lib/index.js`, Remote namespace `novels`);
 * this file only reads it through the Connection carrier (`remoteCall`) and saves
 * whole documents.
 * Styling uses `--dsw-alias-*` tokens only, so light/dark follow the host theme.
 *
 * NOTE: everything below the `@shared` marker is copied verbatim from
 * `lib/state.js` when the bundle is rebuilt. Edit `lib/state.js`, then rebuild.
 */
window.__ModuleLoader__.load({
  id: 'dsh-novel-companion',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    // __SHARED__
    // ---- @shared end ----

    const NS = 'novel'
    const PANEL_ID = 'novel'

    const zh = {
      'panel': '小说',
      'panel.title': '小说创作',
      'empty.title': '还没有小说项目',
      'empty.hint': '先建一个项目：先聊内核，再一起搭世界观与人物，最后逐章定大纲、写正文。',
      'empty.create': '新建小说',
      'empty.demo': '载入示例',
      'list.new': '新建',
      'list.demo': '示例',
      'prompt.placeholder': '给这个项目起个名字，例如：雾港钟楼',
      'action.create': '创建',
      'action.cancel': '取消',
      'action.save': '保存',
      'action.saving': '保存中…',
      'action.saved': '已保存',
      'action.copy': '复制到会话草稿',
      'action.copied': '已复制到会话草稿，回到对话里发送即可',
      'action.copyFailed': '复制失败：没有可用的会话输入框',
      'action.refresh': '刷新',
      'action.back': '返回对话',
      'action.delete': '删除',
      'action.deleteConfirm': '再点一次确认删除',
      'action.finalize': '定稿',
      'action.reopen': '改回草稿',
      'action.next': '下一步',
      'action.addChapter': '加一章',
      'action.deleteChapter': '删除本章',
      'action.newQuestion': '新增问题',
      'stage': '阶段',
      'blocks': '设定板块',
      'chapters': '章节',
      'questions.title': '还没想好的问题（逐条回答后点保存）',
      'questions.ask': '交给模型逐个提问',
      'questions.askTitle': '把这些待问问题交给模型，一次只问一个',
      'questions.empty': '暂无待问问题',
      'question.placeholder': '把这个问题写具体一点…',
      'field.genre': '类型',
      'field.premise': '一句话故事：谁想要什么，谁在阻止他，失败的代价是什么。',
      'label.outline': '分章大纲',
      'label.draft': '正文',
      'label.status': '章节状态',
      'label.empty': '空',
      'label.finalized': '已定稿',
      'label.draftState': '草稿',
      'action.askOne': '问',
      'action.askOneTitle': '交给对话单独追问',
      'action.removeQuestion': '删除这个问题',
      'action.outlineThis': '让模型写这一章大纲',
      'action.writeThis': '按定稿大纲写正文',
      'action.reviewThis': '请模型审读这一章',
      'unit.chars': '{n} 字',
      'content.placeholder': '在这里写出这一板块的内容；不确定的留空，交给对话一起想。',
      'outline.placeholder': '这一章的大纲：场景顺序、这一章发生的"一件事"、一个转折、结尾的钩子。模型会先给一稿，你改完再定稿。',
      'draft.placeholder': '正文会出现在这里；也可以先手写草稿。',
      'chapter.count': '共 {n} 章，成稿 {m} 章',
      'chapter.outlineState': '大纲',
      'chapter.writingState': '写作中',
      'chapter.finalState': '已定稿',
      'chapter.titlePlaceholder': '章节标题',
      'panel.emptyChapters': '还没有章节。把设定聊厚一点，再一章一章来。',
      'fail.save': '保存失败：{message}',
      'fail.load': '读取失败：{message}',
      'fail.loadHint': '如果一直失败，说明插件的 Host 半没有挂载：把 DSH 桌面端完全退出再打开，然后点“刷新”。',
      'status.loaded': '已载入 {n} 个项目',
      'status.refreshed': '已刷新到最新版本',
      'fail.conflict': '对话里已经改过这个项目，已刷新到最新版本；刚才那次编辑没有保存，请确认后重新输入',
      'readiness.warn': '建议先补齐：{reason}',
      'status.newProject': '新项目已创建',
      'status.chapterAdded': '已追加一章',
    }

    const en = {
      'panel': 'Novel',
      'panel.title': 'Novel writing',
      'empty.title': 'No novel project yet',
      'empty.hint': 'Create a project, talk through the premise, build world and characters, then outline and write chapter by chapter.',
      'empty.create': 'New novel',
      'empty.demo': 'Load example',
      'list.new': 'New',
      'list.demo': 'Example',
      'prompt.placeholder': 'Title, e.g. The Fog Harbour Bell',
      'action.create': 'Create',
      'action.cancel': 'Cancel',
      'action.save': 'Save',
      'action.saving': 'Saving…',
      'action.saved': 'Saved',
      'action.copy': 'Copy to draft',
      'action.copied': 'Copied to the draft — send it in the conversation',
      'action.copyFailed': 'Copy failed: no conversation composer available',
      'action.refresh': 'Refresh',
      'action.back': 'Back to chat',
      'action.delete': 'Delete',
      'action.deleteConfirm': 'Click again to delete',
      'action.finalize': 'Finalize',
      'action.reopen': 'Back to draft',
      'action.next': 'Next',
      'action.addChapter': 'Add chapter',
      'action.deleteChapter': 'Delete chapter',
      'action.newQuestion': 'Add question',
      'stage': 'Stage',
      'blocks': 'Boards',
      'chapters': 'Chapters',
      'questions.title': 'Questions still open (answer, then save)',
      'questions.ask': 'Ask the model',
      'questions.askTitle': 'Hand these open questions to the model, one at a time',
      'questions.empty': 'No open questions',
      'question.placeholder': 'Make the question concrete…',
      'field.genre': 'Genre',
      'field.premise': 'One line: who wants what, who stops them, what it costs to fail.',
      'label.outline': 'Chapter outline',
      'label.draft': 'Prose',
      'label.status': 'Status',
      'label.empty': 'empty',
      'label.finalized': 'final',
      'label.draftState': 'draft',
      'action.askOne': 'Ask',
      'action.askOneTitle': 'Hand this one question to the model',
      'action.removeQuestion': 'Remove this question',
      'action.outlineThis': "Have the model outline this chapter",
      'action.writeThis': 'Write from the final outline',
      'action.reviewThis': 'Have the model review this chapter',
      'unit.chars': '{n} chars',
      'content.placeholder': 'Write this board here; leave gaps for the conversation to fill.',
      'outline.placeholder': 'Scene order, the one thing that happens, a turn, and a closing hook.',
      'draft.placeholder': 'The draft appears here; you can also write it by hand.',
      'chapter.count': '{n} chapters, {m} final',
      'chapter.outlineState': 'outline',
      'chapter.writingState': 'writing',
      'chapter.finalState': 'final',
      'chapter.titlePlaceholder': 'Chapter title',
      'panel.emptyChapters': 'No chapters yet. Thicken the boards first, then go chapter by chapter.',
      'fail.save': 'Save failed: {message}',
      'fail.load': 'Load failed: {message}',
      'fail.loadHint': 'If this keeps failing, the plugin Host half is not mounted: quit DSH Desktop completely, reopen it, then press Refresh.',
      'status.loaded': 'Loaded {n} projects',
      'status.refreshed': 'Refreshed to the latest version',
      'fail.conflict': 'The project was changed in the conversation; refreshed to the latest version. That edit was not saved.',
      'readiness.warn': 'Fill this in first: {reason}',
      'status.newProject': 'Project created',
      'status.chapterAdded': 'Chapter added',
    }

    const CSS = `
/* position + z-index are load-bearing, not decoration. Skins draw their
   wallpaper and character art as an absolutely positioned layer with
   z-index: 0 inside the centre column. A positioned element paints above
   in-flow content, so without this the panel renders correctly and is simply
   covered by the artwork — a blank screen with no error anywhere. The shipped
   conversation dodges it because skins explicitly give it position: relative. */
.nv-root{position:relative;z-index:1;isolation:isolate;width:100%;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.nv-head{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:.5px solid var(--dsw-alias-border-l1);flex:none}
.nv-title{font-size:15px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-body{display:grid;grid-template-columns:230px minmax(0,1fr);flex:1;min-height:0}
.nv-list{display:flex;flex-direction:column;border-right:.5px solid var(--dsw-alias-border-l1);min-height:0;overflow:auto;padding:8px}
.nv-item{display:block;width:100%;text-align:left;background:transparent;border:none;border-radius:8px;padding:8px 10px;color:inherit;font:inherit;cursor:pointer;line-height:1.4}
.nv-item:hover{background:var(--dsw-alias-bg-layer-2)}
.nv-item[data-active="true"]{background:var(--dsw-alias-bg-layer-1)}
.nv-item-title{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-item-sub{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.nv-main{min-width:0;overflow:auto;padding:16px 24px 60px}
.nv-section{max-width:860px;margin:0 auto}
.nv-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.nv-btn{background:transparent;border:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 11px;font-size:12px;line-height:18px;cursor:pointer}
.nv-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.nv-btn:disabled{opacity:.5;cursor:default}
/* Primary emphasis is drawn with the brand colour as an OUTLINE, not as a fill
   with inverted text. A filled button needs an on-brand label colour, and the
   only token that provides one is a background token — which skins routinely set
   to transparent (this one does), leaving the label invisible: a coloured block
   with nothing written on it. An outline keeps the label on the normal text
   token, so it stays legible under every skin and in both themes. */
.nv-btn[data-primary="true"]{background:transparent;border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);font-weight:600}
.nv-btn[data-danger="true"]{color:var(--dsw-alias-state-error-primary)}
.nv-input,.nv-textarea{width:100%;box-sizing:border-box;background:transparent;color:inherit;font:inherit;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;padding:7px 10px;resize:vertical}
.nv-textarea{min-height:120px;line-height:1.65;font-size:13px}
.nv-wrap{white-space:pre-wrap}
.nv-muted{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.nv-tabs{display:flex;gap:4px;flex-wrap:wrap;padding:8px 0}
.nv-tab{background:transparent;border:none;border-radius:999px;padding:5px 12px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.nv-tab:hover{background:var(--dsw-alias-bg-layer-2)}
.nv-tab[data-active="true"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-weight:500}
.nv-tab[data-final="true"]::after{content:" ✓"}
.nv-card{border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;margin:12px 0;background:var(--dsw-alias-bg-layer-1)}
.nv-chip{font-size:11px;border-radius:999px;padding:1px 8px;border:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);line-height:18px}
.nv-chip[data-final="true"]{color:var(--dsw-alias-state-success-primary);border-color:currentColor}
.nv-chip[data-warn="true"]{color:var(--dsw-alias-state-warn-primary);border-color:currentColor}
.nv-q{display:flex;gap:8px;align-items:flex-start;margin:6px 0}
.nv-q .nv-input{flex:1}
.nv-dots{display:flex;gap:4px;flex-wrap:wrap;margin:10px 0}
.nv-dot{width:26px;height:6px;border-radius:3px;background:var(--dsw-alias-state-idle-primary)}
.nv-dot[data-state="final"]{background:var(--dsw-alias-state-success-primary)}
.nv-dot[data-state="writing"]{background:var(--dsw-alias-state-warn-primary)}
.nv-dot[data-current="true"]{outline:1px solid var(--dsw-alias-label-primary)}
.nv-toast{position:sticky;bottom:0;font-size:12px;color:var(--dsw-alias-label-secondary);padding:8px 0}
.nv-err{color:var(--dsw-alias-state-error-primary);font-size:12px}
.nv-glyph{display:block}
`

    /** Install the stylesheet once per page; cleaned up with the plugin fiber. */
    function installStyles(ctx) {
      return ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-novel-companion'
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => {
          tag.remove()
        }
      }, 'novel: styles')
    }

    /** Poll a Remote call once per connection reset, tolerating failures. */
    function useRemoteValue(ctx, loader, deps) {
      const [state, setState] = React.useState({ value: undefined, error: '', loading: true })
      const reload = React.useCallback(() => {
        let alive = true
        setState((previous) => ({ ...previous, loading: true }))
        Promise.resolve()
          .then(loader)
          .then((value) => {
            if (alive) setState({ value, error: '', loading: false })
          })
          .catch((error) => {
            if (alive) setState((previous) => ({ ...previous, error: error?.message ?? String(error), loading: false }))
          })
        return () => {
          alive = false
        }
      }, deps ?? [])
      React.useEffect(reload, [reload])
      React.useEffect(() => ctx.on('connection/reset', reload), [reload])
      return [state, reload, setState]
    }

    /**
     * The session the main column is showing, if any.
     *
     * The `main` panel slot is root-scoped, so it receives no `sessionId` prop;
     * the session-scoped `uiSession` service publishes the retained main binding
     * through `adapter.current` (`{ snapshot, subscribe }`). Every lookup is
     * defensive: a composition without that package must not break the panel.
     *
     * @returns {string | undefined}
     */
    function mainSessionId(ctx, fallback) {
      if (typeof fallback === 'string' && fallback) return fallback
      try {
        const current = ctx.get('uiSession')?.adapter?.current
        const binding = current?.getSnapshot?.()
        const id = binding?.sessionId
        if (typeof id === 'string' && id) return id
      } catch {
        // No session scope installed: nothing to mirror into.
      }
      return undefined
    }

    /**
     * Leave the novel panel and return to the Conversation.
     *
     * `main` is a single keyed slot: selecting another panel replaces the
     * conversation, and the only documented way back is the sidebar. When a skin
     * hides that row the author is stranded on a panel with no way out, so the
     * panel carries its own exit. `layout.selectPanel(null)` is the layout
     * service's own "return to the Conversation" operation.
     *
     * @returns {boolean} whether a layout service accepted the request.
     */
    function backToConversation(ctx) {
      try {
        const layout = ctx.get('layout')
        if (typeof layout?.selectPanel !== 'function') return false
        layout.selectPanel(null)
        return true
      } catch {
        return false
      }
    }

    /**
     * Call one Host-side Remote method.
     *
     * `ctx.remote.novels` cannot be used: the Client's `remote` surface is built
     * from contributions generated when DSH itself is built, so a third-party
     * namespace is simply absent (`Cannot read properties of undefined (reading
     * 'list')`), and the runtime mount that would add it (`remote.$mount`)
     * rejects hand-written descriptors because it requires the generated strict
     * codecs.
     *
     * The gateway itself reaches an endpoint through the Connection carrier —
     * `connection.rpc.call('/api', '<namespace>/<method>', { args })` — and that
     * path is available to any Client plugin. It answers
     * `{ ok: true, value }` or `{ ok: false, error }`, which this unwraps into a
     * value or a thrown Error. SRC-mode arguments are plain JSON, so the named
     * fields match the Host method's parameter names exactly.
     *
     * @param {any} ctx owning Client context
     * @param {string} method Remote method name on the `novels` namespace
     * @param {Record<string, any>} [args] named arguments
     * @returns {Promise<any>} the method's business result
     */
    async function remoteCall(ctx, method, args) {
      const connection = ctx.get('connection')
      const rpc = connection?.rpc
      if (typeof rpc?.call !== 'function') {
        throw new Error('与 Host 的连接不可用，请确认 DSH 桌面端已完全启动后点「刷新」')
      }
      const outcome = await rpc.call('/api', `novels/${method}`, { args: args ?? {} })
      if (outcome === null || typeof outcome !== 'object') {
        throw new Error(`Host 对 novels/${method} 返回了意外结果`)
      }
      if (outcome.ok !== true) {
        const failure = outcome.error
        throw new Error(failure?.message ?? String(failure ?? `novels/${method} 调用失败`))
      }
      return outcome.value
    }

    /**
     * Write text into the composer draft of the session the panel is showing.
     *
     * The draft lives in the session's input shell, which the conversation
     * package exposes as `ctx.get('conversation').input.shell(sessionId)`; its
     * `actions.setDraft` is the supported way to mirror text into the composer
     * without pretending the author typed it. `ctx.get('input')` is NOT that
     * service (it is a per-session Hook source), so it is only a last resort.
     *
     * @returns {boolean} whether a composer accepted the text.
     */
    function copyToDraft(ctx, text, sessionId) {
      if (!text) return false
      const id = mainSessionId(ctx, sessionId)
      try {
        const shell = id === undefined ? undefined : ctx.get('conversation')?.input?.shell?.(id)
        const actions = shell?.actions ?? shell
        if (actions && typeof actions.setDraft === 'function') {
          actions.setDraft(text)
          return true
        }
      } catch {
        // A session that is not retained yet has no shell; fall through.
      }
      const actions = ctx.get('inputActions')
      if (actions && typeof actions.setDraft === 'function') {
        actions.setDraft(text)
        return true
      }
      return false
    }

    /** Small SVG marks; colour comes from `currentColor` so the theme wins. */
    function Glyph(props) {
      return h(
        'svg',
        {
          className: 'nv-glyph',
          viewBox: '0 0 24 24',
          width: props.size ?? 16,
          height: props.size ?? 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z' }),
        h('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }),
        h('path', { d: 'M9 6.5h7M9 10h5' }),
      )
    }

    /**
     * The sidebar glyph registered into `sidebar.panellist`. The owner hands it
     * `{ size, active }`; the sidebar row already paints the selected state, so
     * `active` only widens the stroke a touch for a crisper mark.
     */
    function PanelIcon(props) {
      const size = props?.size ?? 18
      return h('span', { 'data-active': props?.active ? 'true' : 'false', style: { display: 'inline-flex' } }, h(Glyph, { size }))
    }

    /**
     * The main panel: project list on the left, one project on the right.
     * Every mutation goes through `remoteCall(ctx, 'save')` with the whole
     * document, which the Host normalizes before writing.
     */
    function NovelPanel(props) {
      const ctx = props.ctx
      const t = ctx.locale.bind(NS)
      const [list, reloadList] = useRemoteValue(ctx, () => remoteCall(ctx, 'list'), [])
      const [selected, setSelected] = React.useState(undefined)
      const [project, setProject] = React.useState(null)
      const [dirty, setDirty] = React.useState(false)
      /** Bumped on every edit; the debounce effect depends on it. */
      const [tick, setTick] = React.useState(0)
      const [isSaving, setSaving] = React.useState(false)
      const [message, setMessage] = React.useState('')
      const [creating, setCreating] = React.useState('')
      const [confirmDelete, setConfirmDelete] = React.useState('')

      const projects = Array.isArray(list.value) ? list.value : []

      React.useEffect(() => {
        if (selected) return
        if (projects.length > 0) setSelected(projects[0].id)
      }, [projects, selected])

      React.useEffect(() => {
        if (!selected) {
          setProject(null)
          return
        }
        let alive = true
        remoteCall(ctx, 'get', { id: selected })
          .then((value) => {
            if (!alive) return
            setProject(value ?? null)
            setDirty(false)
            setMessage('')
          })
          .catch((error) => {
            if (alive) setMessage(t('fail.load', { message: error?.message ?? String(error) }))
          })
        return () => {
          alive = false
        }
      }, [selected])

      // The newest document, read at save time. Reading from a ref (instead of
      // the render's `project` closure) keeps two failures out of the save path:
      // a save that was queued while the author kept typing would otherwise
      // write a stale snapshot, and the debounce below would reset on every
      // keystroke because `project` is a new object each edit.
      const latest = React.useRef(null)
      latest.current = project
      /** Bumped on every edit so a save knows whether newer text arrived. */
      const revision = React.useRef(0)
      const saving = React.useRef(false)
      /** Read by the unmount flush; mirrors `dirty` without re-running effects. */
      const dirtyRef = React.useRef(false)
      dirtyRef.current = dirty

      // Pull the open document again. The panel holds a whole-document snapshot,
      // and the agent writes through the tool while it is open, so the copy on
      // screen goes stale. Without this, the next autosave posted that stale
      // copy and silently reverted everything the model had just written.
      const refetch = React.useCallback(async (quiet) => {
        if (!selected) return
        try {
          const value = await remoteCall(ctx, 'get', { id: selected })
          setProject(value ?? null)
          latest.current = value ?? null
          setDirty(false)
          setMessage(quiet ? '' : t('status.refreshed'))
        } catch (error) {
          setMessage(t('fail.load', { message: error?.message ?? String(error) }))
        }
      }, [selected])

      const update = React.useCallback((mutator) => {
        setProject((current) => {
          if (!current) return current
          const next = mutator(structuredClone(current))
          next.updatedAt = Date.now()
          return next
        })
        revision.current += 1
        setDirty(true)
        // `dirty` alone cannot restart the debounce: typing while a save is in
        // flight left it `true`, so the effect never re-ran and the pending
        // keystrokes were never saved until something flipped the flag.
        setTick((value) => value + 1)
        setMessage('')
      }, [])

      const save = React.useCallback(
        async (value) => {
          const document = value ?? latest.current
          if (!document) return
          const attempted = revision.current
          saving.current = true
          setSaving(true)
          try {
            const saved = await remoteCall(ctx, 'save', { value: document })
            // Adopt the Host's copy when nothing was typed while it was in
            // flight; otherwise the author's newer text would be thrown away.
            // Either way the new `rev` must be adopted: keeping the old one
            // made the very next save look like a stale write and get refused.
            if (revision.current === attempted) {
              setProject(saved)
              latest.current = saved
              setDirty(false)
            } else {
              setProject((current) => (current ? { ...current, rev: saved.rev } : saved))
            }
            setMessage(t('action.saved'))
            reloadList()
          } catch (error) {
            const reason = error?.message ?? String(error)
            if (reason.includes('已被更新')) {
              // The Host refused a stale write on purpose: the agent changed the
              // project while this panel held a snapshot. Adopt what is stored
              // instead of retrying with the same stale copy.
              setMessage(t('fail.conflict'))
              await refetch(true)
            } else {
              setMessage(t('fail.save', { message: reason }))
            }
          } finally {
            saving.current = false
            setSaving(false)
          }
        },
        [reloadList, refetch],
      )

      // Auto-save a moment after the author stops typing. `dirty` is the only
      // dependency that may reset the timer.
      React.useEffect(() => {
        if (!dirty) return
        const timer = setTimeout(() => {
          void save()
        }, 1200)
        return () => clearTimeout(timer)
      }, [dirty, tick, save])

      // Flush unsaved text before the panel unmounts or the selection changes.
      React.useEffect(
        () => () => {
          if (dirtyRef.current && !saving.current) void save()
        },
        [save],
      )

      const create = async () => {
        try {
          const created = await remoteCall(ctx, 'create', { title: creating })
          setCreating('')
          setSelected(created.id)
          setProject(created)
          setDirty(false)
          setMessage(t('status.newProject'))
          reloadList()
        } catch (error) {
          setMessage(t('fail.save', { message: error?.message ?? String(error) }))
        }
      }

      const loadDemo = async () => {
        try {
          const created = await remoteCall(ctx, 'importDemo')
          setSelected(created.id)
          setProject(created)
          setDirty(false)
          reloadList()
        } catch (error) {
          setMessage(t('fail.save', { message: error?.message ?? String(error) }))
        }
      }

      const remove = async (id) => {
        if (confirmDelete !== id) {
          setConfirmDelete(id)
          return
        }
        setConfirmDelete('')
        try {
          await remoteCall(ctx, 'remove', { id })
          if (selected === id) {
            setSelected(undefined)
            setProject(null)
          }
          reloadList()
        } catch (error) {
          setMessage(t('fail.save', { message: error?.message ?? String(error) }))
        }
      }

      const copy = (mode, options) => {
        if (!project) return
        const ok = copyToDraft(ctx, buildPrompt(project, mode, options), props.sessionId)
        setMessage(ok ? t('action.copied') : t('action.copyFailed'))
      }

      return h(
        'div',
        { className: 'nv-root', 'data-plugin': 'dsh-novel-companion' },
        h(
          'div',
          { className: 'nv-head' },
          h(Glyph, { size: 18 }),
          h('div', { className: 'nv-title' }, project ? `《${project.title}》` : t('panel.title')),
          project && h('span', { className: 'nv-chip' }, stageLabel(project.stage)),
          h(
            'button',
            {
              type: 'button',
              className: 'nv-btn',
              onClick: () => {
                reloadList()
                void refetch()
              },
              disabled: list.loading,
            },
            t('action.refresh'),
          ),
          // Escape hatch: selecting a panel from the sidebar is the only way back
          // to the Conversation otherwise, and some skins hide those rows.
          h(
            'button',
            { type: 'button', className: 'nv-btn', onClick: () => backToConversation(ctx) },
            t('action.back'),
          ),
        ),
        h(
          'div',
          { className: 'nv-body' },
          h(
            'div',
            { className: 'nv-list' },
            h(
              'div',
              { className: 'nv-row', style: { padding: '4px 2px 8px' } },
              h('input', {
                className: 'nv-input',
                style: { flex: 1, minWidth: 0, fontSize: 12 },
                value: creating,
                placeholder: t('prompt.placeholder'),
                onChange: (event) => setCreating(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') void create()
                },
              }),
              h('button', { type: 'button', className: 'nv-btn', 'data-primary': 'true', onClick: create }, t('action.create')),
            ),
            projects.map((entry) =>
              h(
                'button',
                {
                  key: entry.id,
                  type: 'button',
                  className: 'nv-item',
                  'data-active': String(entry.id === selected),
                  onClick: () => setSelected(entry.id),
                  onDoubleClick: () => remove(entry.id),
                },
                h('div', { className: 'nv-item-title' }, entry.title),
                h(
                  'div',
                  { className: 'nv-item-sub' },
                  `${stageLabel(entry.stage)} · ${entry.chapters.length} 章${entry.characters > 0 ? ` · ${entry.characters} 字` : ''}${entry.damaged ? ' · ⚠️ 疑似损坏' : ''}`,
                ),
              ),
            ),
            projects.length === 0 &&
              !list.error &&
              h(
                'button',
                { type: 'button', className: 'nv-item', onClick: loadDemo },
                h('div', { className: 'nv-item-title' }, t('empty.demo')),
                h('div', { className: 'nv-item-sub' }, t('empty.create')),
              ),
          ),
          h(
            'div',
            { className: 'nv-main' },
            list.error &&
              h(
                'div',
                { className: 'nv-section nv-card' },
                h('div', { className: 'nv-err' }, t('fail.load', { message: list.error })),
                h(
                  'div',
                  { className: 'nv-row', style: { marginTop: 10 } },
                  h('button', { type: 'button', className: 'nv-btn', onClick: reloadList }, t('action.refresh')),
                ),
                h('div', { className: 'nv-muted', style: { marginTop: 8 } }, t('fail.loadHint')),
              ),
            !project &&
              !list.loading &&
              !list.error &&
              h(
                'div',
                { className: 'nv-section nv-card' },
                h('div', { style: { fontSize: 14, fontWeight: 600, marginBottom: 6 } }, t('empty.title')),
                h('div', { className: 'nv-muted' }, t('empty.hint')),
                h(
                  'div',
                  { className: 'nv-row', style: { marginTop: 12 } },
                  h('button', { type: 'button', className: 'nv-btn', 'data-primary': 'true', onClick: create }, t('empty.create')),
                  h('button', { type: 'button', className: 'nv-btn', onClick: loadDemo }, t('empty.demo')),
                ),
              ),
            project &&
              h(ProjectView, {
                project,
                update,
                save: () => save(),
                saving: isSaving,
                dirty,
                copy,
                remove: () => remove(project.id),
                confirmDelete: confirmDelete === project.id,
                message,
                ctx,
                t,
              }),
          ),
        ),
        message && h('div', { className: 'nv-toast' }, message),
      )
    }

    /** One open project: stage strip, boards, chapters. */
    function ProjectView(props) {
      const { project, update, save, saving, dirty, copy, remove, confirmDelete, t } = props
      const [tab, setTab] = React.useState('blocks')
      const [blockId, setBlockId] = React.useState('core')
      const [chapterId, setChapterId] = React.useState(project.chapters[0]?.id ?? '')
      const block = project.blocks.find((entry) => entry.id === blockId) ?? project.blocks[0]
      const chapter = project.chapters.find((entry) => entry.id === chapterId) ?? project.chapters[0]

      React.useEffect(() => {
        if (chapterId && project.chapters.some((entry) => entry.id === chapterId)) return
        setChapterId(project.chapters[0]?.id ?? '')
      }, [project.chapters, chapterId])

      const setStage = (stage) => update((next) => ({ ...next, stage }))
      const stageIndex = STAGES.indexOf(project.stage)
      // `readiness` lived in the shared helpers but nothing ever called it, so
      // the panel happily walked to 「已完结」 with every chapter still an outline.
      const check = readiness(project)

      const saveButton = h(
        'button',
        { type: 'button', className: 'nv-btn', 'data-primary': 'true', onClick: () => void save(), disabled: saving },
        saving ? t('action.saving') : dirty ? t('action.save') : t('action.saved'),
      )

      return h(
        'div',
        { className: 'nv-section' },
        h(
          'div',
          { className: 'nv-row' },
          h(
            'div',
            { className: 'nv-dots' },
            project.blocks.map((entry) =>
              h('div', {
                key: entry.id,
                className: 'nv-dot',
                'data-state': entry.status === 'final' ? 'final' : 'draft',
                title: `${entry.name}${entry.status === 'final' ? '（已定稿）' : '（草稿）'}`,
              }),
            ),
          ),
          h('div', { style: { flex: 1 } }),
          saveButton,
          h('button', { type: 'button', className: 'nv-btn', 'data-danger': 'true', onClick: remove }, confirmDelete ? t('action.deleteConfirm') : t('action.delete')),
        ),
        h(
          'div',
          { className: 'nv-row', style: { marginTop: 8 } },
          h('span', { className: 'nv-muted' }, t('stage')),
          STAGES.map((stage, index) =>
            h(
              'button',
              {
                key: stage,
                type: 'button',
                className: 'nv-tab',
                'data-active': String(stage === project.stage),
                onClick: () => setStage(stage),
                title: STAGE_HINTS[stage],
              },
              `${index + 1}. ${stageLabel(stage)}`,
            ),
          ),
          stageIndex < STAGES.length - 1 &&
            h(
              'button',
              { type: 'button', className: 'nv-btn', onClick: () => setStage(STAGES[stageIndex + 1]) },
              `${t('action.next')} →`,
            ),
        ),
        !check.ok && h('div', { className: 'nv-muted', style: { marginTop: 6 } }, t('readiness.warn', { reason: check.reason })),
        h(
          'div',
          { className: 'nv-card' },
          h(
            'div',
            { className: 'nv-row' },
            h('input', {
              className: 'nv-input',
              style: { flex: 2, minWidth: 160, fontSize: 15, fontWeight: 600 },
              value: project.title,
              onChange: (event) => update((next) => ({ ...next, title: event.target.value })),
            }),
            h('input', {
              className: 'nv-input',
              style: { flex: 1, minWidth: 120 },
              value: project.genre,
              placeholder: t('field.genre'),
              onChange: (event) => update((next) => ({ ...next, genre: event.target.value })),
            }),
          ),
          h('textarea', {
            className: 'nv-textarea',
            style: { minHeight: 60, marginTop: 8 },
            value: project.premise,
            placeholder: t('field.premise'),
            onChange: (event) => update((next) => ({ ...next, premise: event.target.value })),
          }),
          h(
            'div',
            { className: 'nv-row', style: { marginTop: 8 } },
            h('button', { type: 'button', className: 'nv-btn', onClick: () => copy('brief') }, t('action.copy')),
            h('span', { className: 'nv-muted' }, STAGE_HINTS[project.stage] ?? ''),
          ),
        ),
        h(
          'div',
          { className: 'nv-tabs' },
          h(
            'button',
            { type: 'button', className: 'nv-tab', 'data-active': String(tab === 'blocks'), onClick: () => setTab('blocks') },
            t('blocks'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'nv-tab',
              'data-active': String(tab === 'chapters'),
              onClick: () => setTab('chapters'),
            },
            `${t('chapters')} (${project.chapters.length})`,
          ),
        ),
        tab === 'blocks' &&
          block &&
          h(BlockView, {
            project,
            block,
            blockId,
            setBlockId,
            update,
            copy,
            t,
          }),
        tab === 'chapters' &&
          h(ChapterView, {
            project,
            chapter,
            setChapterId,
            update,
            copy,
            t,
          }),
      )
    }

    /** One worldbuilding board with its open questions. */
    function BlockView(props) {
      const { project, block, blockId, setBlockId, update, copy, t } = props
      const patch = (changes) =>
        update((next) => ({
          ...next,
          blocks: next.blocks.map((entry) => (entry.id === block.id ? { ...entry, ...changes } : entry)),
        }))
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'nv-tabs' },
          project.blocks.map((entry) =>
            h(
              'button',
              {
                key: entry.id,
                type: 'button',
                className: 'nv-tab',
                'data-active': String(entry.id === blockId),
                'data-final': String(entry.status === 'final'),
                onClick: () => setBlockId(entry.id),
              },
              entry.name,
            ),
          ),
        ),
        h(
          'div',
          { className: 'nv-card' },
          h(
            'div',
            { className: 'nv-row' },
            h('span', { className: 'nv-chip', 'data-final': String(block.status === 'final') }, block.status === 'final' ? t('label.finalized') : t('label.draftState')),
            h('span', { className: 'nv-muted', style: { flex: 1 } }, block.hint),
            h(
              'button',
              {
                type: 'button',
                className: 'nv-btn',
                onClick: () => patch({ status: block.status === 'final' ? 'draft' : 'final' }),
              },
              block.status === 'final' ? t('action.reopen') : t('action.finalize'),
            ),
          ),
          h('textarea', {
            className: 'nv-textarea',
            style: { marginTop: 10 },
            value: block.content,
            placeholder: t('content.placeholder'),
            onChange: (event) => patch({ content: event.target.value }),
          }),
          h('div', { style: { marginTop: 14, fontSize: 12, fontWeight: 600 } }, t('questions.title')),
          block.questions.length === 0 && h('div', { className: 'nv-muted' }, t('questions.empty')),
          block.questions.map((question, index) =>
            h(
              'div',
              { className: 'nv-q', key: `q-${index}` },
              h('input', {
                className: 'nv-input',
                value: question,
                placeholder: t('question.placeholder'),
                onChange: (event) =>
                  patch({ questions: block.questions.map((entry, position) => (position === index ? event.target.value : entry)) }),
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'nv-btn',
                  title: t('action.askOneTitle'),
                  onClick: () => copy('interview', { blockId: block.id, focus: [question] }),
                },
                t('action.askOne'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'nv-btn',
                  title: t('action.removeQuestion'),
                  onClick: () => patch({ questions: block.questions.filter((_, position) => position !== index) }),
                },
                '×',
              ),
            ),
          ),
          h(
            'div',
            { className: 'nv-row', style: { marginTop: 8 } },
            h(
              'button',
              { type: 'button', className: 'nv-btn', onClick: () => patch({ questions: [...block.questions, ''] }) },
              t('action.newQuestion'),
            ),
            // Only meaningful once there is something to hand over; an empty
            // list would copy a prompt with no questions in it.
            block.questions.some((question) => question.trim()) &&
              h(
                'button',
                {
                  type: 'button',
                  className: 'nv-btn',
                  'data-primary': 'true',
                  title: t('questions.askTitle'),
                  onClick: () => copy('interview', { blockId: block.id, focus: block.questions.filter(Boolean) }),
                },
                t('questions.ask'),
              ),
          ),
        ),
      )
    }

    /** Chapter list plus the current chapter's outline and draft. */
    function ChapterView(props) {
      const { project, chapter, setChapterId, update, copy, t } = props
      const patchChapter = (id, changes) =>
        update((next) => ({
          ...next,
          chapters: next.chapters.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
        }))
      // Build the chapter object *outside* the state updater: `update` is a
      // `setState` updater, and React 18 StrictMode calls it twice, which created
      // two ids and (worse) fired `setTimeout` from inside the updater.
      const addChapter = () => {
        const created = {
          id: `chapter-${Date.now().toString(36)}`,
          index: project.chapters.length + 1,
          title: `第 ${project.chapters.length + 1} 章`,
          status: 'outline',
          outline: '',
          draft: '',
          updatedAt: Date.now(),
        }
        update((next) => ({ ...next, chapters: [...next.chapters, created] }))
        setChapterId(created.id)
      }
      const finals = project.chapters.filter((entry) => entry.status === 'final').length
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'nv-row' },
          h('span', { className: 'nv-muted' }, t('chapter.count', { n: project.chapters.length, m: finals })),
          h('div', { style: { flex: 1 } }),
          h('button', { type: 'button', className: 'nv-btn', onClick: addChapter }, t('action.addChapter')),
        ),
        project.chapters.length === 0 && h('div', { className: 'nv-card nv-muted' }, t('panel.emptyChapters')),
        project.chapters.map((entry) =>
          h(
            'button',
            {
              key: entry.id,
              type: 'button',
              className: 'nv-item',
              style: { marginTop: 4 },
              'data-active': String(chapter && entry.id === chapter.id),
              onClick: () => setChapterId(entry.id),
            },
            h(
              'div',
              { className: 'nv-row' },
              h('span', { className: 'nv-item-title', style: { flex: 1 } }, `${entry.index}. ${entry.title}`),
              h(
                'span',
                { className: 'nv-chip', 'data-final': String(entry.status === 'final'), 'data-warn': String(entry.status === 'outline' && !entry.outline.trim()) },
                entry.status === 'final'
                  ? t('chapter.finalState')
                  : entry.status === 'writing'
                    ? t('chapter.writingState')
                    : entry.outline.trim()
                      ? t('chapter.outlineState')
                      : t('label.empty'),
              ),
            ),
          ),
        ),
        chapter &&
          h(
            'div',
            { className: 'nv-card' },
            h(
              'div',
              { className: 'nv-row' },
              h('input', {
                className: 'nv-input',
                style: { flex: 1, fontWeight: 600 },
                value: chapter.title,
                placeholder: t('chapter.titlePlaceholder'),
                onChange: (event) => patchChapter(chapter.id, { title: event.target.value }),
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'nv-btn',
                  'data-danger': 'true',
                  onClick: () =>
                    update((next) => {
                      next.chapters = next.chapters.filter((entry) => entry.id !== chapter.id)
                      next.chapters.forEach((entry, index) => {
                        entry.index = index + 1
                      })
                      return next
                    }),
                },
                t('action.deleteChapter'),
              ),
            ),
            h('div', { style: { marginTop: 12, fontSize: 12, fontWeight: 600 } }, t('label.outline')),
            h('textarea', {
              className: 'nv-textarea',
              style: { marginTop: 6 },
              value: chapter.outline,
              placeholder: t('outline.placeholder'),
              onChange: (event) => patchChapter(chapter.id, { outline: event.target.value }),
            }),
            h(
              'div',
              { className: 'nv-row', style: { marginTop: 8 } },
              h(
                'button',
                { type: 'button', className: 'nv-btn', 'data-primary': 'true', onClick: () => copy('outline', { chapterId: chapter.id }) },
                t('action.outlineThis'),
              ),
              chapter.outline.trim() &&
                h(
                  'button',
                  { type: 'button', className: 'nv-btn', onClick: () => copy('write', { chapterId: chapter.id }) },
                  t('action.writeThis'),
                ),
              // Three explicit states: the Host, the tool and the chapter dot all
              // understand `writing`, but the panel used to toggle only
              // outline ↔ final, so a chapter could never be marked 写作中 here.
              h(
                'div',
                { className: 'nv-row', style: { marginTop: 8 } },
                h('span', { className: 'nv-muted' }, t('label.status')),
                ...[
                  ['outline', t('chapter.outlineState')],
                  ['writing', t('chapter.writingState')],
                  ['final', t('chapter.finalState')],
                ].map(([state, label]) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'nv-btn',
                      key: state,
                      'data-primary': String(chapter.status === state),
                      onClick: () => patchChapter(chapter.id, { status: state }),
                    },
                    label,
                  ),
                ),
              ),
            ),
            h('div', { style: { marginTop: 14, fontSize: 12, fontWeight: 600 } }, t('label.draft')),
            h('textarea', {
              className: 'nv-textarea',
              style: { marginTop: 6, minHeight: 200 },
              value: chapter.draft,
              placeholder: t('draft.placeholder'),
              onChange: (event) => patchChapter(chapter.id, { draft: event.target.value }),
            }),
            chapter.draft && h('div', { className: 'nv-muted', style: { marginTop: 4 } }, t('unit.chars', { n: chapter.draft.length })),
            chapter.draft &&
              h(
                'button',
                { type: 'button', className: 'nv-btn', style: { marginTop: 8 }, onClick: () => copy('review', { chapterId: chapter.id }) },
                t('action.reviewThis'),
              ),
          ),
      )
    }

    /** Client plugin body. */
    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      installStyles(ctx)
      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            zh,
            en,
          }),
        'novel: dictionaries',
      )
      // Global panel: sidebar icon + the `main` panel keyed by the same id.
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => t('panel'), locale: NS }, (props) =>
          h(PanelIcon, { ...props, ctx }),
        ),
      )
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID, label: () => t('panel'), locale: NS }, (props) =>
          h(NovelPanel, { ...props, ctx }),
        ),
      )
      // No `conversation.input.dock` entry on purpose. A hand-off row above the
      // composer appeared in EVERY conversation, whether or not the author was
      // writing, and it duplicated controls the panel already has. The panel is
      // the only surface for the novel; the composer stays untouched.
    }

    // `conversation` and `uiSession` are read lazily through `ctx.get` for the
    // draft hand-off, so they stay out of `inject`: a composition without them
    // still shows the panel, only the "写入对话" buttons report failure.
    // `remote` is deliberately absent: the Host methods are reached through
    // `connection.rpc.call`, because a third-party namespace never appears on the
    // generated `ctx.remote` surface.
    return { inject: ['slots', 'locale', 'connection'], apply }
  },
})
