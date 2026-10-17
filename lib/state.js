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
  const chaptersInput = Array.isArray(record.chapters) ? record.chapters.slice(0, 500) : []
  const chapters = chaptersInput.map((chapter, index) => normalizeChapter(chapter, index))
  chapters.forEach((chapter, index) => {
    chapter.index = index + 1
  })
  const stage = STAGES.includes(record.stage) ? record.stage : 'interview'
  return {
    version: 1,
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
    lines.push(`章节：${project.chapters.length} 章，成稿 ${finals} 章`)
  }
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
  const lines = [`# 《${project.title}》分章大纲`, '']
  if (project.chapters.length === 0) lines.push('（还没有章节）')
  for (const chapter of project.chapters) {
    const mark = chapter.status === 'final' ? '✅ 成稿' : chapter.status === 'writing' ? '✍️ 写作中' : '🗒 大纲'
    lines.push(`## ${chapter.index}. ${chapter.title}　${mark}`)
    lines.push(chapter.outline.trim() || '（大纲待写：这一步由模型先出，作者修改定稿后再写正文）')
    lines.push('')
  }
  return lines.join('\n')
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
      parts.push(projectSummary(project))
      parts.push('', outlineMarkdown(project))
      parts.push(
        '',
        '要求：只写这一章的大纲，包含场景顺序、这一章发生的"一件事"、一个转折、结尾的钩子；不超过 8 条要点。写完后停下来让我修改，不要直接写正文。',
      )
      return parts.join('\n')
    }
    case 'write': {
      const chapter = project?.chapters?.find((entry) => entry.id === options.chapterId)
      const parts = [
        `请根据下面这份已经定稿的分章大纲，写出《${title}》「${chapter ? `第 ${chapter.index} 章 ${chapter.title}` : '下一章'}」的正文。`,
      ]
      if (chapter?.outline.trim()) parts.push('', '本章大纲：', chapter.outline.trim())
      else parts.push('', '本章大纲还没有写，请先只给大纲并等我确认。')
      parts.push('', '全书概况：', projectSummary(project))
      const style = project?.blocks?.find((block) => block.id === 'style')
      if (style?.content.trim()) parts.push('', '文风要求：', style.content.trim())
      parts.push('', '要求：严格按大纲写，不要新增设定；写完把正文贴在你回复的最后，我会决定是否定稿。')
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
 * Whether a project looks ready for the next stage, with a short reason.
 * @param {any} project
 * @returns {{ ok: boolean, reason: string }}
 */
export function readiness(project) {
  if (!project) return { ok: false, reason: '还没有项目' }
  const chapters = Array.isArray(project.chapters) ? project.chapters : []
  const blocks = Array.isArray(project.blocks) ? project.blocks : []
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
