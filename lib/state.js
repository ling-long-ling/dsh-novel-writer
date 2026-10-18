// @ts-check
/**
 * Pure document helpers shared by the Host and Client halves of
 * dsh-novel-companion. No imports and no side effects: the browser bundle is
 * produced by wrapping this exact file, so it must run in both runtimes.
 *
 * The Host half validates whatever it reads from disk or from the agent
 * through `normalizeProject`; the Client half starts from `emptyProject`.
 */

/** Project stages, in the order the companion walks them. */
export const STAGES = ['interview', 'world', 'characters', 'plot', 'outline', 'writing', 'done']

/** Human labels for {@link STAGES}. */
export const STAGE_LABELS = {
  interview: '了解你',
  world: '世界观',
  characters: '人物',
  plot: '情节设计',
  outline: '分章大纲',
  writing: '章节写作',
  done: '已完结',
}

/** One line explaining what the companion does at each stage. */
export const STAGE_HINTS = {
  interview: '先聊故事内核：类型、主题、你想要的阅读体验。',
  world: '时代、地点、规则与氛围；规则要能被读者记住。',
  characters: '主角、对手、配角各要三层：欲望、缺陷、秘密。',
  plot: '主线由冲突和转折组成，先定开场、中段危机、高潮与结局。',
  outline: '逐章写大纲：每章一件事、一个转折、一个钩子。',
  writing: '按定稿大纲写正文，每章写完先审再定稿。',
  done: '检查伏笔与人物弧线是否收束，准备改稿。',
}

/** The fixed set of worldbuilding boards. */
export const BLOCKS = [
  { id: 'core', name: '故事内核', hint: '一句话故事：谁想要什么，谁在阻止他，失败的代价是什么。' },
  { id: 'world', name: '世界观', hint: '时代、地点、规则、社会结构、独特的细节。' },
  { id: 'characters', name: '人物小传', hint: '每个人的欲望、缺陷、秘密、口头习惯与关系网。' },
  { id: 'plot', name: '情节设计', hint: '主线冲突、转折点清单、伏笔与回收。' },
  { id: 'rules', name: '设定规则', hint: '力量体系、禁忌、代价：规则越硬，冲突越好写。' },
  { id: 'style', name: '文风与叙事', hint: '人称、时态、语言密度、样例段落、不要写成什么样子。' },
]

/**
 * Default interview questions. The panel asks them one at a time; the model may
 * replace or extend them (`questions`) per project and per block.
 */
export const DEFAULT_QUESTIONS = {
  core: [
    '用一句话说出这个故事：谁想要什么，谁在阻止，失败的代价是什么？',
    '如果只能让读者记住一个画面，你希望是哪个？',
    '这个故事属于什么类型，读者可能拿哪部作品来比较？',
  ],
  world: [
    '故事发生在什么时候、什么地方？有什么只有这个世界才有的细节？',
    '这个世界最残酷的规则是什么？角色会为它付出什么代价？',
    '普通人的一天是什么样子？他们最怕的东西是什么？',
  ],
  characters: [
    '主角最想要什么？为此愿意做哪些不体面的事？',
    '主角最致命的缺陷是什么？它会在哪一章真正伤到他自己？',
    '对手和主角争的是什么？他自认为正义的理由是什么？',
  ],
  plot: [
    '开场第一个让读者坐直的瞬间是什么？',
    '中段的转折让主角失去什么？',
    '结局里，主角得到了什么、又失去了什么？',
  ],
  rules: [
    '力量的来源与代价是什么？它的禁忌是什么？',
    '这条规则在故事里会被怎样钻空子？',
  ],
  style: [
    '你喜欢的文风样例是哪一段？能不能贴三十个字左右的样句？',
    '禁止出现的写法是什么？（例如：上帝视角解说、大段心理独白）',
  ],
}

/** Maximum length kept for one text field, to keep documents sane. */
const LIMIT = 200_000

/** Maximum number of chapters kept in one project. */
export const MAX_CHAPTERS = 500

/**
 * Longest a single text field may be *written*. `normalizeProject` still clamps
 * on read (so a legacy document is repaired instead of failing), but a write
 * that would lose text is refused rather than silently truncated.
 */
export const FIELD_LIMIT = LIMIT

/**
 * How `projectMarkdown` treats the prose of chapters that are not the one being
 * written. See the option of the same name in {@link projectMarkdown}.
 */
export const CONTEXT_MODES = ['prev', 'recent', 'all', 'none']

/** Characters kept from each end for a chapter rendered as a teaser. */
export const PROSE_PREVIEW = 300

/**
 * How many earlier chapters keep a head/tail teaser in the default `prev`
 * context. Without a cap, a 30-chapter `get` grew from 7.7k to 18k tokens; with
 * it, the model still sees the recent voice and the opening without letting a
 * 100-chapter book crowd out the actual task.
 */
export const PROSE_PREVIEW_LIMIT = 8

/**
 * The fields a *write* must carry. `normalizeProject` fills every gap so that a
 * legacy document still opens, but applying that repair on the write path is
 * how half a document silently replaced a whole book: `save()` with only
 * `{ id, blocks }` used to reset the title, stage and every chapter, and still
 * report success. Writes are refused instead; only the read path repairs.
 * @param {any} raw a document as received from the panel or the agent
 * @returns {string} `''` when complete, otherwise a Chinese explanation
 */
export function missingProjectFields(raw) {
  if (!isObject(raw)) return '不是项目文档（不是对象），已拒绝写入'
  /** @type {string[]} */
  const missing = []
  if (typeof raw.title !== 'string') missing.push('title')
  if (!Array.isArray(raw.blocks)) missing.push('blocks')
  if (!Array.isArray(raw.chapters)) missing.push('chapters')
  if (!STAGES.includes(raw.stage)) missing.push('stage')
  if (missing.length > 0) {
    return `缺少必需字段 ${missing.join(' / ')}（疑似半份文档），已拒绝写入；面板请整篇保存，模型请用 action=block/outline/chapter`
  }
  // Structurally complete but nameless: say that plainly instead of pretending
  // it is a partial document.
  if (raw.title.trim() === '') return 'title 不能为空：先给这本书填一个书名再保存'
  return ''
}

/**
 * A soft heads-up for a project that looks like it was overwritten by a partial
 * document: default title, no chapters, yet the boards still carry canon. A
 * fresh project in the interview stage can look like this while the author is
 * still filling boards, so the creation date must be older than today.
 * @param {any} project
 * @returns {string} `''` or a warning line
 */
export function projectIntegrity(project) {
  if (!project || !Array.isArray(project.blocks) || !Array.isArray(project.chapters)) return ''
  const hasCanon = project.blocks.some((block) => block.content.trim() !== '')
  if (!hasCanon) return ''
  if (project.title !== '未命名小说' || project.chapters.length > 0) return ''
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  if (!(project.createdAt < startOfToday.getTime())) return ''
  return '⚠️ 这份项目疑似曾被半份文档覆盖：书名是默认值、章节为 0，但设定板块仍有内容。先和作者核对，再决定是否补回章节，不要直接重写。'
}

/**
 * Describe the first field that would be truncated on write, or `''`.
 * Called before every save so losing text is an error, not a surprise.
 * @param {any} raw a project document as received from the panel or the agent
 * @returns {string}
 */
export function oversizeField(raw) {
  const blocks = Array.isArray(raw?.blocks) ? raw.blocks : []
  for (const block of blocks) {
    if (typeof block?.content === 'string' && block.content.length > LIMIT) {
      return `板块「${block.id ?? '?'}」的内容有 ${block.content.length} 字，超过单字段上限 ${LIMIT} 字`
    }
  }
  const chapters = Array.isArray(raw?.chapters) ? raw.chapters : []
  for (const chapter of chapters) {
    for (const key of ['outline', 'draft']) {
      const value = chapter?.[key]
      if (typeof value === 'string' && value.length > LIMIT) {
        return `章节「${chapter.title ?? chapter.id ?? '?'}」的${key === 'outline' ? '大纲' : '正文'}有 ${value.length} 字，超过单字段上限 ${LIMIT} 字（请拆章）`
      }
    }
  }
  return ''
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  if (typeof value !== 'string') return ''
  return value.length > LIMIT ? value.slice(0, LIMIT) : value
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function stamp(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * @param {unknown} raw
 * @returns {object}
 */
function normalizeBlock(raw) {
  const record = isObject(raw) ? /** @type {Record<string, any>} */ (raw) : {}
  const known = BLOCKS.find((block) => block.id === record.id)
  const questions = Array.isArray(record.questions) ? record.questions.slice(0, 12) : []
  return {
    id: known ? known.id : String(record.id || 'block'),
    name: text(record.name) || known?.name || '设定',
    hint: text(record.hint) || known?.hint || '',
    content: text(record.content),
    status: record.status === 'final' ? 'final' : 'draft',
    questions: questions.map((question) => text(question).slice(0, 500)).filter(Boolean),
  }
}

/**
 * @param {unknown} raw
 * @param {number} fallbackIndex
 * @returns {object}
 */
function normalizeChapter(raw, fallbackIndex) {
  const record = isObject(raw) ? /** @type {Record<string, any>} */ (raw) : {}
  const status = record.status === 'final' || record.status === 'writing' ? record.status : 'outline'
  return {
    id: text(record.id) || `chapter-${fallbackIndex + 1}`,
    index: typeof record.index === 'number' && Number.isFinite(record.index) ? record.index : fallbackIndex + 1,
    title: text(record.title) || `第 ${fallbackIndex + 1} 章`,
    status,
    outline: text(record.outline),
    draft: text(record.draft),
    updatedAt: stamp(record.updatedAt, 0),
  }
}

/**
 * Validate and clamp a project document. Unknown fields are dropped so that a
 * newer Host and an older Client agree on the stored shape.
 * @param {any} raw
 * @returns {any}
 */
export function normalizeProject(raw) {
  const record = isObject(raw) ? raw : {}
  const now = Date.now()
  const blocksInput = Array.isArray(record.blocks) ? record.blocks.filter(isObject) : []
  const identified = blocksInput.filter((block) => typeof block.id === 'string' && block.id !== '')
  // Only fall back to positional matching for id-less documents (an older shape).
  // Mixing the two would copy one block's prose onto another block's id.
  const byPosition = identified.length === 0 ? blocksInput : []
  const blocks = BLOCKS.map((known) => {
    const match = identified.find((block) => block.id === known.id)
    return normalizeBlock(match ? { ...match, id: known.id } : { id: known.id })
  })
  if (byPosition.length > 0) {
    BLOCKS.forEach((known, index) => {
      const source = byPosition[index]
      if (source !== undefined) blocks[index] = normalizeBlock({ ...source, id: known.id })
    })
  }
  const chaptersInput = Array.isArray(record.chapters) ? record.chapters.slice(0, MAX_CHAPTERS) : []
  const chapters = chaptersInput.map((chapter, index) => normalizeChapter(chapter, index))
  chapters.forEach((chapter, index) => {
    chapter.index = index + 1
  })
  const stage = STAGES.includes(record.stage) ? record.stage : 'interview'
  return {
    version: 1,
    // Monotonic revision bumped by the Host on every accepted write. Writers
    // send the revision they read; a mismatch means someone else (the agent,
    // another window) wrote in between and the write is refused instead of
    // silently reverting their work.
    rev: typeof record.rev === 'number' && record.rev >= 0 ? Math.floor(record.rev) : 0,
    id: String(record.id || ''),
    title: text(record.title).slice(0, 120) || '未命名小说',
    genre: text(record.genre).slice(0, 120),
    premise: text(record.premise),
    stage,
    blocks,
    chapters,
    createdAt: stamp(record.createdAt, now),
    updatedAt: stamp(record.updatedAt, now),
  }
}

/**
 * A brand-new project document.
 * @param {string} id
 * @param {string} title
 * @returns {any}
 */
export function emptyProject(id, title) {
  const now = Date.now()
  return normalizeProject({
    id,
    title,
    genre: '',
    premise: '',
    stage: 'interview',
    blocks: BLOCKS.map((block) => ({
      id: block.id,
      name: block.name,
      hint: block.hint,
      content: '',
      status: 'draft',
      questions: [...(DEFAULT_QUESTIONS[block.id] ?? [])],
    })),
    chapters: [],
    createdAt: now,
    updatedAt: now,
  })
}

/** @returns {any} an empty "no project" state for the panel. */
export function emptyState() {
  return { projects: [], project: null, loaded: false, error: '' }
}

/** @param {string} stage @returns {string} */
export function stageLabel(stage) {
  return STAGE_LABELS[stage] ?? stage
}

/** @param {any} block @returns {boolean} whether a board still needs answers. */
export function blockOpen(block) {
  return block.status !== 'final'
}

/**
 * Compact project overview used in the system prompt and tool output.
 * @param {any} project
 * @returns {string}
 */
export function projectSummary(project) {
  if (!project) return ''
  const lines = [`《${project.title}》　阶段：${stageLabel(project.stage)}`]
  if (project.genre) lines.push(`类型：${project.genre}`)
  if (project.premise) lines.push(`内核：${project.premise}`)
  for (const block of project.blocks) {
    const mark = block.status === 'final' ? '✅' : '⬜'
    const open = block.questions.filter(Boolean).length
    lines.push(`${mark} ${block.name}${block.status === 'final' ? '' : open > 0 ? `（待答 ${open} 问）` : '（待补充内容）'}`)
  }
  if (project.chapters.length > 0) {
    const finals = project.chapters.filter((chapter) => chapter.status === 'final').length
    const characters = project.chapters.reduce((sum, chapter) => sum + chapter.draft.length, 0)
    lines.push(`章节：${project.chapters.length} 章，成稿 ${finals} 章${characters > 0 ? `，正文 ${characters} 字` : ''}`)
  }
  const warning = projectIntegrity(project)
  if (warning) lines.push(warning)
  return lines.join('\n')
}

/**
 * Render one board as Markdown for the "交给模型" hand-off.
 * @param {any} block
 * @returns {string}
 */
export function blockMarkdown(block) {
  if (!block) return ''
  const lines = [`【${block.name}】${block.status === 'final' ? '（已定稿）' : '（草稿）'}`, block.hint]
  if (block.content.trim()) lines.push('', block.content.trim())
  const open = block.questions.filter(Boolean)
  if (open.length > 0) {
    lines.push('', '我还没想好的问题：')
    for (const question of open) lines.push(`- ${question}`)
  }
  return lines.join('\n')
}

/**
 * Render the whole outline as Markdown.
 * @param {any} project
 * @returns {string}
 */
export function outlineMarkdown(project) {
  if (!project) return ''
  const lines = [`# 《${project.title}》分章大纲`, '', '（每章标题后的 chapterId 是写回大纲/标题/状态用的稳定 id；也可以改用 chapterIndex=<序号>）']
  if (project.chapters.length === 0) lines.push('（还没有章节）')
  for (const chapter of project.chapters) {
    const mark = chapter.status === 'final' ? '✅ 成稿' : chapter.status === 'writing' ? '✍️ 写作中' : '🗒 大纲'
    lines.push(`## ${chapter.index}. ${chapter.title}　${mark}　chapterId=${chapter.id}`)
    lines.push(chapter.outline.trim() || '（大纲待写：这一步由模型先出，作者修改定稿后再写正文）')
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * The ids the panel hand-off must carry. Before this line existed the model
 * read the whole outline in the copied prompt, never saw a `chapterId`, and so
 * could not use `action=outline` / `action=chapter` to write anything back —
 * the plugin's core loop was broken by one missing string.
 * @param {any} project
 * @param {any} [chapter]
 * @returns {string}
 */
function promptRef(project, chapter) {
  const id = typeof project?.id === 'string' && project.id !== '' ? project.id : ''
  if (!id) return ''
  const parts = [`项目 projectId=${id}`]
  if (chapter) {
    parts.push(`本章 chapterId=${chapter.id}`)
    parts.push(`也可以写 chapterIndex=${chapter.index}`)
  }
  return `（${parts.join('；')}）`
}

/**
 * Build the hand-off text the panel copies into the conversation draft.
 * The exact wording is the user-visible contract of each panel button.
 *
 * @param {any} project the project document.
 * @param {string} mode one of: brief / interview / outline / write / review / custom.
 * @param {Record<string, any>} [options] extra parameters.
 * @returns {string}
 */
export function buildPrompt(project, mode, options = {}) {
  const title = project?.title ?? '这本书'
  switch (mode) {
    case 'brief': {
      const parts = [`我们先聊聊《${title}》。`, '下面是我目前的想法与设定，请先通读。']
      if (project?.premise) parts.push(`故事内核：${project.premise}`)
      for (const block of project?.blocks ?? []) {
        if (block.content.trim()) parts.push(blockMarkdown(block))
      }
      parts.push('', '请先不要急着列大纲：先指出其中最有张力的部分，再提出 3 个最需要我决定的问题，一个问题一问，等我回答后再深入。')
      return parts.join('\n')
    }
    case 'interview': {
      const block = project?.blocks?.find((entry) => entry.id === options.blockId)
      const parts = [`请你继续追问《${title}》的「${block?.name ?? '设定'}」板块。`]
      if (block) parts.push(blockMarkdown(block))
      const focus = Array.isArray(options.focus) ? options.focus.filter(Boolean) : []
      if (focus.length > 0) {
        parts.push('', '我还没想好的问题：')
        for (const question of focus) parts.push(`- ${question}`)
      }
      parts.push(
        '',
        '规则：一次只问一个问题，问题要具体、能落到情节或人物选择上；我回答后先复述你的理解，再追问下一层。如果我的回答透露了新设定，请把它记进这个板块。',
      )
      return parts.join('\n')
    }
    case 'outline': {
      const chapter = project?.chapters?.find((entry) => entry.id === options.chapterId)
      const parts = [`请为《${title}》写「${chapter ? `第 ${chapter.index} 章 ${chapter.title}` : '下一章'}」的分章大纲。`]
      const ref = promptRef(project, chapter)
      if (ref) parts.push(ref)
      parts.push(projectSummary(project))
      parts.push('', outlineMarkdown(project))
      parts.push(
        '',
        '要求：只写这一章的大纲，包含场景顺序、这一章发生的"一件事"、一个转折、结尾的钩子；不超过 8 条要点。',
        chapter
          ? '写完先用 novel action=outline 把大纲存回项目（只带 chapterId 即可），再停在回复里让我修改，不要直接写正文。'
          : '写完后停下来让我修改，不要直接写正文。',
      )
      return parts.join('\n')
    }
    case 'write': {
      const chapter = project?.chapters?.find((entry) => entry.id === options.chapterId)
      const parts = [
        `请根据下面这份已经定稿的分章大纲，写出《${title}》「${chapter ? `第 ${chapter.index} 章 ${chapter.title}` : '下一章'}」的正文。`,
      ]
      const ref = promptRef(project, chapter)
      if (ref) parts.push(ref)
      if (chapter?.outline.trim()) parts.push('', '本章大纲：', chapter.outline.trim())
      else parts.push('', '本章大纲还没有写，请先只给大纲并等我确认。')
      parts.push('', '全书概况：', projectSummary(project))
      const style = project?.blocks?.find((block) => block.id === 'style')
      if (style?.content.trim()) parts.push('', '文风要求：', style.content.trim())
      parts.push(
        '',
        '要求：严格按大纲写，不要新增设定。写好之后用 novel action=chapter 把正文写回项目（章节参数用上面给出的 chapterId），把本章 status 设为 final；写回成功后再在回复里告诉我本章字数和它承接了哪条伏笔。',
      )
      return parts.join('\n')
    }
    case 'review': {
      const chapter = project?.chapters?.find((entry) => entry.id === options.chapterId)
      return [
        `请审读《${title}》${chapter ? `「第 ${chapter.index} 章 ${chapter.title}」` : ''}这一章的正文。`,
        '从三个角度给我修改意见：1) 节奏与信息密度；2) 人物动机是否成立；3) 与大设定/伏笔是否矛盾。',
        '每条意见给出具体位置和一句改写示例，不要重写整章。',
      ].join('\n')
    }
    default:
      return typeof options.text === 'string' ? options.text : ''
  }
}

/**
 * Render the whole project as Markdown — the text the agent actually reads.
 *
 * `projectSummary` is an index, not the canon: a model that only sees it will
 * invent the details. This renders every board in full, every outline in full,
 * and a bounded amount of prose, so one `get` cannot blow up the context:
 *
 *   - every chapter heading carries `chapterId=…`, because the model has no
 *     other way to learn the id it needs for `action=chapter` / `action=outline`
 *     (this one missing string is what broke the write-back loop);
 *   - `chapterId` renders that chapter's prose in full and only lists the rest;
 *   - otherwise `context` decides how much prose is shown:
 *     `prev` (default) = the previous chapter in full plus a head/tail teaser of
 *     the most recent earlier chapters (capped at `previewLimit`, default 8, so
 *     a long book still teaches the voice without blowing the budget),
 *     `recent` = the last `recent` chapters in full, `all` = every chapter in
 *     full, `none` = lengths only;
 *   - every chapter that is not expanded still shows its outline and its size,
 *     so the model knows what exists and how to fetch it.
 *
 * @param {any} project
 * @param {{ chapterId?: string, maxDraft?: number, recent?: number, context?: string, preview?: number, previewLimit?: number }} [options]
 * @returns {string}
 */
export function projectMarkdown(project, options = {}) {
  if (!project) return ''
  const maxDraft = typeof options.maxDraft === 'number' ? options.maxDraft : 6000
  const recent = typeof options.recent === 'number' ? options.recent : 2
  const context = CONTEXT_MODES.includes(options.context) ? options.context : 'prev'
  const previewSize = typeof options.preview === 'number' ? options.preview : PROSE_PREVIEW
  const focus = typeof options.chapterId === 'string' ? options.chapterId : ''
  const focusAt = focus !== '' ? project.chapters.findIndex((chapter) => chapter.id === focus) : -1
  const proseAt = project.chapters
    .map((chapter, index) => (chapter.draft.trim() ? index : -1))
    .filter((index) => index >= 0)
  const lastProseAt = proseAt.length > 0 ? proseAt[proseAt.length - 1] : -1
  const prevAt = focusAt >= 0 ? focusAt - 1 : lastProseAt
  const recentIds = new Set(proseAt.slice(Math.max(0, proseAt.length - recent)).map((index) => project.chapters[index].id))
  const previewLimit = typeof options.previewLimit === 'number' ? Math.max(0, options.previewLimit) : PROSE_PREVIEW_LIMIT
  const olderAt = proseAt.filter((index) => index !== prevAt && index !== focusAt)
  const previewIds = new Set(
    olderAt.slice(Math.max(0, olderAt.length - previewLimit)).map((index) => project.chapters[index].id),
  )
  // The opening chapter defines the voice of the whole book; keep it even when
  // the cap would have folded it away.
  if (olderAt.length > 0) previewIds.add(project.chapters[olderAt[0]].id)
  /**
   * @param {number} index
   * @param {any} chapter
   * @returns {'full' | 'preview' | 'fold'}
   */
  const prosePolicy = (index, chapter) => {
    if (focusAt >= 0 && index === focusAt) return 'full'
    if (!chapter.draft.trim()) return 'fold'
    if (context === 'none') return 'fold'
    if (context === 'all') return 'full'
    if (context === 'recent') return chapter.status === 'writing' || recentIds.has(chapter.id) ? 'full' : 'fold'
    // 'prev': the chapter right before the one being worked on is full, so the
    // model can keep the voice; the most recent earlier chapters are head/tail
    // teasers; anything older is a length so the budget stays bounded.
    if (chapter.status === 'writing') return 'full'
    if (index === prevAt) return 'full'
    if (previewIds.has(chapter.id)) return 'preview'
    return 'fold'
  }
  const lines = [`# 《${project.title}》`, '']
  lines.push(
    `阶段：${stageLabel(project.stage)}${project.genre ? `　类型：${project.genre}` : ''}${project.chapters.length > 0 ? `　共 ${project.chapters.length} 章` : ''}`,
  )
  if (project.premise) lines.push(`一句话故事：${project.premise}`)
  const warning = projectIntegrity(project)
  if (warning) lines.push('', warning)
  lines.push('', '## 设定')
  for (const block of project.blocks) {
    lines.push('', `### ${block.name}（${block.status === 'final' ? '已定稿' : '草稿'}）`)
    lines.push(block.content.trim() || '（空白：还没有内容，不要替作者发明）')
    const open = block.questions.filter(Boolean)
    if (open.length > 0) {
      lines.push('待问问题：')
      for (const question of open) lines.push(`- ${question}`)
    }
  }
  lines.push('', '## 章节')
  if (project.chapters.length === 0) lines.push('（还没有章节）')
  else lines.push('（标题后的 chapterId 是稳定 id，写回大纲/正文时用它；也可以改用 chapterIndex=<序号>）')
  project.chapters.forEach((chapter, index) => {
    const isFocus = focus !== '' && chapter.id === focus
    if (focus !== '' && !isFocus) {
      lines.push(
        '',
        `### ${chapter.index}. ${chapter.title}（${chapter.status}）　chapterId=${chapter.id}`,
        '（本次只读取了指定章节的正文；需要它的大纲或正文时再用 action=get chapterId=…）',
      )
      return
    }
    const mark = chapter.status === 'final' ? '成稿' : chapter.status === 'writing' ? '写作中' : '仅大纲'
    lines.push('', `### ${chapter.index}. ${chapter.title}（${mark}）　chapterId=${chapter.id}`)
    lines.push('大纲：')
    lines.push(chapter.outline.trim() || '（还没有大纲）')
    const draft = chapter.draft
    if (!draft.trim()) {
      lines.push('', '正文：（还没有正文）')
      return
    }
    const policy = prosePolicy(index, chapter)
    if (policy === 'fold') {
      lines.push('', `正文：共 ${draft.length} 字（未展开；需要时用 action=get chapterId=${chapter.id} 读取）`)
      return
    }
    if (policy === 'preview') {
      lines.push('', `正文（共 ${draft.length} 字，以下为首尾各 ${previewSize} 字节选）：`)
      lines.push(draft.slice(0, previewSize))
      lines.push('……')
      lines.push(draft.slice(-previewSize))
      lines.push(`（要看完整正文：action=get chapterId=${chapter.id}）`)
      return
    }
    const clipped = !isFocus && draft.length > maxDraft
    lines.push('', `正文（共 ${draft.length} 字）：`)
    lines.push(clipped ? `${draft.slice(0, maxDraft)}\n……（后略，续读请用 action=get chapterId=${chapter.id}）` : draft)
  })
  return lines.join('\n')
}

/**
 * Search the canon: boards, chapter titles, outlines and prose.
 *
 * 「这个道具上次在哪章出现」 is a constant question in long-form writing, and
 * before this existed the only way to answer it was to `get` chapter by chapter
 * — with chapter ids the model could not even see. Results carry the id / index
 * needed for the follow-up `action=outline` / `action=chapter` call.
 *
 * @param {any} project
 * @param {string} query
 * @param {{ limit?: number, radius?: number }} [options]
 * @returns {{ markdown: string, hits: Array<{ where: string, ref: string, count: number, snippet: string }> }}
 */
export function searchProject(project, query, options = {}) {
  if (!project) return { markdown: '', hits: [] }
  const needle = String(query ?? '').trim()
  if (needle === '') return { markdown: '', hits: [] }
  const lower = needle.toLowerCase()
  const limit = typeof options.limit === 'number' && options.limit > 0 ? Math.floor(options.limit) : 20
  const radius = typeof options.radius === 'number' ? options.radius : 60
  /** @type {Array<{ where: string, ref: string, count: number, snippet: string }>} */
  const hits = []
  const countOf = (text) => {
    if (typeof text !== 'string' || text === '') return 0
    let count = 0
    let from = 0
    for (;;) {
      const at = text.toLowerCase().indexOf(lower, from)
      if (at < 0) break
      count += 1
      from = at + lower.length
      if (count > 999) break
    }
    return count
  }
  const snippetOf = (source) => {
    const at = source.toLowerCase().indexOf(lower)
    const start = Math.max(0, at - radius)
    const end = Math.min(source.length, at + needle.length + radius)
    return `${start > 0 ? '…' : ''}${source.slice(start, end).replace(/\s+/g, ' ').trim()}${end < source.length ? '…' : ''}`
  }
  const push = (where, ref, value) => {
    const count = countOf(value)
    if (count === 0) return false
    hits.push({ where, ref, count, snippet: snippetOf(value) })
    return hits.length >= limit
  }
  for (const block of project.blocks) {
    if (push(`设定 · ${block.name}`, `blockId=${block.id}`, block.content)) break
    if (hits.length >= limit) break
  }
  for (const chapter of project.chapters) {
    if (hits.length >= limit) break
    const where = `第 ${chapter.index} 章 ${chapter.title}（${chapter.status}）`
    const ref = `chapterId=${chapter.id}（或 chapterIndex=${chapter.index}）`
    if (push(`${where} · 标题`, ref, chapter.title)) break
    if (push(`${where} · 大纲`, ref, chapter.outline)) break
    if (push(`${where} · 正文`, ref, chapter.draft)) break
  }
  const lines = [`# 《${project.title}》检索「${needle}」`, '']
  if (hits.length === 0) {
    lines.push('没有命中。可以换更短的关键词（人名、道具名、地名），或先用 action=get 通读设定与大纲。')
  } else {
    lines.push(`命中 ${hits.length} 处${hits.length >= limit ? `（只列前 ${limit} 处；可加 limit 扩大）` : ''}：`)
    for (const hit of hits) {
      lines.push('', `## ${hit.where}（${hit.count} 处）`, hit.ref, hit.snippet)
    }
  }
  lines.push('', '下一步：改设定用 action=block blockId=…；改大纲/正文用 action=outline / action=chapter 并带上 chapterId。')
  return { markdown: lines.join('\n'), hits }
}

/**
 * The light shape handed to the panel list: everything the sidebar shows, none
 * of the prose. A `list` is called after every autosave, so shipping every
 * chapter's draft meant re-sending the whole library on each keystroke pause.
 * @param {any} project
 * @returns {any}
 */
export function projectIndex(project) {
  if (!project) return null
  return {
    id: project.id,
    rev: project.rev,
    title: project.title,
    genre: project.genre,
    premise: project.premise,
    stage: project.stage,
    blocks: project.blocks.map((block) => ({
      id: block.id,
      name: block.name,
      status: block.status,
      questions: block.questions,
    })),
    chapters: project.chapters.map((chapter) => ({
      id: chapter.id,
      index: chapter.index,
      title: chapter.title,
      status: chapter.status,
    })),
    // Word count travels with the index so the sidebar can show progress without
    // shipping the prose back on every autosave.
    characters: project.chapters.reduce((sum, chapter) => sum + chapter.draft.length, 0),
    damaged: projectIntegrity(project) !== '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

/**
 * Whether a project looks ready for the next stage, with a short reason.
 * @param {any} project
 * @returns {{ ok: boolean, reason: string }}
 */
export function readiness(project) {
  if (!project) return { ok: false, reason: '还没有项目' }
  const chapters = Array.isArray(project.chapters) ? project.chapters : []
  const blocks = Array.isArray(project.blocks) ? project.blocks : []
  if (project.stage === 'writing' && chapters.length === 0) {
    return { ok: false, reason: '还没有章节，先写分章大纲' }
  }
  if (project.stage === 'outline' || project.stage === 'writing' || project.stage === 'done') {
    const bare = chapters.filter((chapter) => !chapter.outline.trim())
    if (bare.length > 0) return { ok: false, reason: `${bare.length} 章还没有大纲` }
  }
  if (project.stage === 'done') {
    const open = chapters.filter((chapter) => chapter.status !== 'final')
    if (open.length > 0) return { ok: false, reason: `${open.length} 章还没有成稿` }
    const draft = blocks.filter((block) => block.status !== 'final')
    if (draft.length > 0) return { ok: false, reason: `${draft.length} 个板块仍是草稿` }
  }
  return { ok: true, reason: '' }
}
