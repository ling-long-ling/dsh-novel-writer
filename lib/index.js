// @ts-check
/**
 * dsh-novel-companion Host half.
 *
 * Stores one document per novel in the Harness storage domain, exposes it to the
 * browser over Typert Remote (namespace `novels`), and gives the agent a `novel`
 * tool plus a prompt section, so the writing partner reads the real project,
 * folds the author's answers into it, and never invents canon.
 *
 * `./state.js` holds the document helpers shared with the Client half.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  STAGES,
  BLOCKS,
  emptyProject,
  normalizeProject,
  projectSummary,
  outlineMarkdown,
  stageLabel,
} = require('./state.js')
const { buildDemoProject } = require('./demo.js')

/** Storage domain that owns the project records. */
const NOVEL_DOMAIN = 'novel_companion'
const NOVEL_TABLE = 'projects'

/** Host Services the plugin needs before it can activate. */
export const inject = ['tools', 'systemPrompt', 'storageDomain']

/** Remote namespace consumed by the Client half. */
export const REMOTE_NAMESPACE = 'novels'

const PROJECT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const TITLE_MAX = 120
/**
 * Remote method descriptor key.
 *
 * `remoteMethods()` reads `Object.getOwnPropertyDescriptor(prototype, KEY)` with
 * this exact STRING key (not a symbol), and the version-1 descriptor is the only
 * thing the Gateway's source-mode discovery trusts. Getting this wrong makes
 * `remoteMethods()` return `[]`, so every Client call fails with
 * `gateway/invocation-unavailable` even though the service itself is mounted.
 */
const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods'

/**
 * Describe one Remote method for the Gateway's descriptor.
 * @param {string} method Remote method name
 * @returns {any} the frozen method marker
 */
function remoteMethodMarker(method) {
  return Object.freeze({ method, invocation: Object.freeze({ kind: 'direct' }) })
}

/**
 * Build the `novels` service: an instance exposing every Remote method, plus the
 * `typertRemote` binding the Gateway validates before dispatch.
 *
 * It deliberately does NOT extend Cordis' `Service`. That base class can only be
 * reached through `ctx.Service`, which is unreachable from a profile bundle:
 * `@deepseek-ai/cordis` is not resolvable from the linked package, so the class
 * cannot be imported, and `ctx.Service` is neither a provided service nor a
 * whitelisted verb — reading it throws `cannot get property "Service" without
 * inject` during activation, which aborts the entire Host load. `ctx.provide`
 * is the supported way to publish a service and performs the same registration
 * the `Service` constructor would.
 *
 * Layout matters for Remote discovery: `remoteMethods()` reads the descriptor
 * from `Object.getPrototypeOf(service)`, so the methods and the descriptor live
 * on a class prototype — exactly where a real `Service` subclass keeps them.
 *
 * @param {ProjectCache} cache loaded project cache
 * @returns {any} the service instance to hand to `ctx.provide`
 */
function createNovelService(cache) {
  class NovelBooks {
    constructor() {
      this.namespace = REMOTE_NAMESPACE
      this.cache = cache
      this.typertRemote = Object.freeze({
        service: this,
        serviceKey: REMOTE_NAMESPACE,
        namespace: REMOTE_NAMESPACE,
      })
    }
  }
  for (const [name, fn] of Object.entries(novelBooksMethods)) {
    Object.defineProperty(NovelBooks.prototype, name, { value: fn, writable: true, configurable: true })
  }
  // `remoteMethods()` starts from the prototype that owns this descriptor and
  // expects every name it lists to be a plain method on that same prototype.
  Object.defineProperty(NovelBooks.prototype, REMOTE_METHODS, {
    configurable: true,
    value: Object.freeze({
      version: 1,
      methods: Object.freeze(Object.keys(novelBooksMethods).map(remoteMethodMarker)),
    }),
  })
  return new NovelBooks()
}

/** Test seam: build the service exactly as `apply` does. */
export const __createNovelServiceForTest = createNovelService

/**
 * A fresh project id that always satisfies `PROJECT_ID`.
 *
 * `crypto.randomUUID()` also matches, but only by luck: it is lower-case hex and
 * hyphens, and it could in principle start with a letter outside `[a-z0-9]` once
 * the format changes. Deriving the id from the UUID makes the contract explicit
 * and keeps stored documents portable (the panel uses the id as a storage key).
 * @returns {string}
 */
function newProjectId() {
  return `novel-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`
}

/**
 * Coerce anything that arrives from storage or the browser into a document.
 * @param {unknown} raw
 * @param {string} [fallbackId]
 */
function coerceProject(raw, fallbackId) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const record = /** @type {Record<string, any>} */ (raw)
  const id = typeof record.id === 'string' && PROJECT_ID.test(record.id) ? record.id : fallbackId
  if (!id) return undefined
  return normalizeProject({ ...record, id })
}

/**
 * Project documents over one storage table: reads come from memory, writes are
 * durable before they resolve.
 */
export class ProjectStore {
  /** @param {any} table the declared storage table handle */
  constructor(table) {
    this.table = table
  }

  /** @param {string} id */
  keyOf(id) {
    if (!PROJECT_ID.test(id)) throw new Error(`not a project id: ${JSON.stringify(id)}`)
    return id
  }

  async list() {
    const projects = []
    for (const [id, raw] of this.table.entries()) {
      const project = coerceProject(raw, id)
      if (project) projects.push(project)
    }
    projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    return projects
  }

  /** @param {string} id */
  async get(id) {
    return coerceProject(this.table.get(this.keyOf(id)), id)
  }

  /** @param {any} project */
  async save(project) {
    const next = normalizeProject(project)
    await this.table.put(this.keyOf(next.id), next)
    return next
  }

  /** @param {string} id */
  async remove(id) {
    return await this.table.delete(this.keyOf(id))
  }
}

/** Index of every project so a turn never waits on storage. */
export class ProjectCache {
  /** @param {ProjectStore} store */
  constructor(store) {
    this.store = store
    /** @type {any[]} */
    this.projects = []
  }

  async refresh() {
    this.projects = await this.store.list()
    return this.projects
  }

  /** @param {string} id */
  get(id) {
    return this.projects.find((project) => project.id === id)
  }

  /** @param {any} project */
  async put(project) {
    const saved = await this.store.save(project)
    this.projects = [saved, ...this.projects.filter((entry) => entry.id !== saved.id)]
    this.projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    return saved
  }

  /** @param {string} id */
  async drop(id) {
    const removed = await this.store.remove(id)
    this.projects = this.projects.filter((entry) => entry.id !== id)
    return removed
  }
}

/**
 * The project service: every method here is a Remote method of namespace
 * `novels`, called by the panel as `ctx.remote.novels.<method>(...)`.
 */
const novelBooksMethods = {
  /** Every project, most recently edited first. */
  async list() {
    return await this.cache.refresh()
  },

  /** @param {string} id one project, or null */
  async get(id) {
    return (await this.cache.store.get(String(id))) ?? null
  },

  /** @param {Record<string, unknown>} value the whole document */
  async save(value) {
    const project = coerceProject(value, undefined)
    if (!project) throw new Error('novel.save: the project needs a valid id')
    return await this.cache.put(project)
  },

  /** @param {string} title */
  async create(title) {
    const clean = String(title ?? '').trim().slice(0, TITLE_MAX) || '未命名小说'
    const project = emptyProject(newProjectId(), clean)
    return await this.cache.put(project)
  },

  /** Seed the worked example so the panel is never empty. */
  async importDemo() {
    return await this.cache.put(normalizeProject(buildDemoProject(newProjectId())))
  },

  /** @param {string} id */
  async remove(id) {
    return await this.cache.drop(String(id))
  },
}

/**
 * Prompt section text: a short index of the author's projects, plus the rule
 * that canon lives in the project rather than in the model's memory.
 * @param {any[]} projects
 */
export function renderNovelBrief(projects) {
  if (!projects || projects.length === 0) return ''
  const lines = [
    '## 小说创作档案（novel 工具）',
    '作者在「小说」面板里和我一起写长篇。设定、大纲、正文的权威副本在这些项目里；动笔前先用 novel 工具读取，涉及具体设定时不要凭记忆或想象补全，缺的就问作者。',
  ]
  for (const project of projects) {
    const finals = project.blocks.filter((block) => block.status === 'final').length
    const drafts = project.blocks.filter((block) => block.content.trim() && block.status !== 'final')
    const finalChapters = project.chapters.filter((chapter) => chapter.status === 'final').length
    const bare = project.chapters.filter((chapter) => !chapter.outline.trim())
    lines.push(
      `- 《${project.title}》projectId=${project.id}　阶段：${stageLabel(project.stage)}　设定 ${finals}/${project.blocks.length} 定稿　章节 ${finalChapters}/${project.chapters.length} 成稿`,
    )
    if (project.premise) lines.push(`  一句话故事：${project.premise}`)
    if (drafts.length > 0) lines.push(`  待定稿板块：${drafts.map((block) => block.name).join('、')}`)
    if (bare.length > 0) lines.push(`  还缺大纲的章节：${bare.map((chapter) => `第 ${chapter.index} 章 ${chapter.title}`).join('、')}`)
  }
  lines.push(
    '用法：novel action=get 读全文；作者回答问题后立刻用 block 写回该板块并把 status 设为 final；作者改完一章大纲后用 outline 存回；正文写完后用 chapter 存回并标记 final。一次只推进一件事：问一个问题、改一个板块、写一章大纲，写回之后再说下一步。',
  )
  return lines.join('\n')
}

/**
 * Execute one `novel` tool call.
 * @param {ProjectCache} cache
 * @param {Record<string, any>} args
 */
export async function runNovelAction(cache, args) {
  const action = typeof args?.action === 'string' ? args.action : ''
  const id = typeof args?.projectId === 'string' ? args.projectId : ''
  const actions = ['list', 'get', 'create', 'stage', 'block', 'outline', 'chapter', 'appendChapter']
  if (!actions.includes(action)) {
    throw new Error(`novel: 未知 action ${JSON.stringify(action)}；可用：${actions.join(' / ')}`)
  }
  if (action !== 'list' && action !== 'create' && !id) {
    throw new Error('novel: projectId 必填（先用 action=list 查看项目 id）')
  }

  const load = async () => {
    const project = cache.get(id)
    if (!project) throw new Error(`novel: 没有找到项目 ${JSON.stringify(id)}`)
    return project
  }
  const saveChapter = async (project, position, changes) => {
    const chapters = project.chapters.map((entry, index) =>
      index === position ? { ...entry, ...changes, updatedAt: Date.now() } : entry,
    )
    return await cache.put({ ...project, chapters, updatedAt: Date.now() })
  }

  switch (action) {
    case 'list': {
      await cache.refresh()
      return {
        projects: cache.projects.map((project) => ({
          projectId: project.id,
          title: project.title,
          genre: project.genre,
          stage: project.stage,
          stageLabel: stageLabel(project.stage),
          blocksFinal: `${project.blocks.filter((block) => block.status === 'final').length}/${project.blocks.length}`,
          chapters: project.chapters.length,
          chaptersFinal: project.chapters.filter((chapter) => chapter.status === 'final').length,
        })),
      }
    }
    case 'get': {
      const project = await load()
      return {
        projectId: project.id,
        project,
        brief: projectSummary(project),
        outline: outlineMarkdown(project),
      }
    }
    case 'create': {
      const title = String(args.title ?? '').trim().slice(0, TITLE_MAX) || '未命名小说'
      const project = emptyProject(newProjectId(), title)
      if (typeof args.genre === 'string') project.genre = args.genre.trim().slice(0, 120)
      if (typeof args.premise === 'string') project.premise = args.premise.trim()
      const saved = await cache.put(project)
      return { projectId: saved.id, title: saved.title, stage: saved.stage, brief: projectSummary(saved) }
    }
    case 'stage': {
      const project = await load()
      const stage = String(args.stage ?? '')
      if (!STAGES.includes(/** @type {any} */ (stage))) {
        throw new Error(`novel: stage 必须是 ${STAGES.join(' / ')} 之一`)
      }
      const saved = await cache.put({ ...project, stage, updatedAt: Date.now() })
      return { projectId: saved.id, stage: saved.stage, stageLabel: stageLabel(saved.stage), brief: projectSummary(saved) }
    }
    case 'block': {
      const project = await load()
      const blockId = String(args.blockId ?? '')
      if (!project.blocks.some((block) => block.id === blockId)) {
        throw new Error(
          `novel: 没有板块 ${JSON.stringify(blockId)}；可用：${project.blocks.map((b) => `${b.id}(${b.name})`).join('、')}`,
        )
      }
      const blocks = project.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              content: typeof args.content === 'string' ? args.content : block.content,
              status: args.status === 'final' || args.status === 'draft' ? args.status : block.status,
              questions: Array.isArray(args.questions)
                ? args.questions.map((question) => String(question).slice(0, 500)).slice(0, 12)
                : block.questions,
            }
          : block,
      )
      const saved = await cache.put({ ...project, blocks, updatedAt: Date.now() })
      const block = saved.blocks.find((entry) => entry.id === blockId)
      return {
        projectId: saved.id,
        blockId,
        name: block.name,
        status: block.status,
        openQuestions: block.questions.length,
        brief: projectSummary(saved),
      }
    }
    case 'outline': {
      const project = await load()
      const position = project.chapters.findIndex((chapter) => chapter.id === String(args.chapterId ?? ''))
      if (position < 0) {
        throw new Error(
          `novel: 没有章节 ${JSON.stringify(args.chapterId)}；可用：${project.chapters.map((c) => `${c.id}(第 ${c.index} 章 ${c.title})`).join('、') || '（还没有章节，先用 appendChapter）'}`,
        )
      }
      const chapter = project.chapters[position]
      const status = args.status === 'final' || args.status === 'writing' ? args.status : chapter.status
      const saved = await saveChapter(project, position, {
        outline: typeof args.outline === 'string' ? args.outline : chapter.outline,
        title: typeof args.title === 'string' && args.title.trim() ? args.title.trim().slice(0, TITLE_MAX) : chapter.title,
        status,
      })
      return { projectId: saved.id, chapter: saved.chapters[position], brief: outlineMarkdown(saved) }
    }
    case 'chapter': {
      const project = await load()
      const position = project.chapters.findIndex((chapter) => chapter.id === String(args.chapterId ?? ''))
      if (position < 0) throw new Error(`novel: 没有章节 ${JSON.stringify(args.chapterId)}`)
      const chapter = project.chapters[position]
      const status = ['outline', 'writing', 'final'].includes(String(args.status)) ? String(args.status) : chapter.status
      const saved = await saveChapter(project, position, {
        status,
        draft: typeof args.draft === 'string' ? args.draft : chapter.draft,
        title: typeof args.title === 'string' && args.title.trim() ? args.title.trim().slice(0, TITLE_MAX) : chapter.title,
      })
      const next = saved.chapters[position]
      return {
        projectId: saved.id,
        chapterId: next.id,
        title: next.title,
        status: next.status,
        characters: next.draft.length,
        brief: outlineMarkdown(saved),
      }
    }
    case 'appendChapter': {
      const project = await load()
      const title = String(args.title ?? '').trim().slice(0, TITLE_MAX) || `第 ${project.chapters.length + 1} 章`
      const chapter = {
        id: newProjectId(),
        index: project.chapters.length + 1,
        title,
        status: 'outline',
        outline: typeof args.outline === 'string' ? args.outline : '',
        draft: '',
        updatedAt: Date.now(),
      }
      const saved = await cache.put({ ...project, chapters: [...project.chapters, chapter], updatedAt: Date.now() })
      return {
        projectId: saved.id,
        chapter: saved.chapters[saved.chapters.length - 1],
        brief: outlineMarkdown(saved),
      }
    }
    default:
      throw new Error(`novel: unsupported action ${JSON.stringify(action)}`)
  }
}

/**
 * Tool result presentation: the refreshed project summary when the action has
 * one, a project roster for `list`, otherwise a one-line confirmation of the
 * fields that changed.
 * @param {unknown} value
 */
function renderNovelResult(value) {
  const result = /** @type {Record<string, any>} */ (value ?? {})
  if (typeof result.brief === 'string' && result.brief) return [{ type: 'text', text: result.brief }]
  // `list` has no single project to summarise. Without this branch it fell into
  // the generic one and claimed "小说项目已更新：projects=…" — a lie that also
  // dumped raw JSON at the model, which only showed up on a real tool call.
  if (Array.isArray(result.projects)) {
    if (result.projects.length === 0) {
      return [
        {
          type: 'text',
          text: '还没有任何小说项目。用 novel action=create 新建一本；也可以让作者在「小说」面板里建，或点「载入示例」。',
        },
      ]
    }
    const lines = [`共有 ${result.projects.length} 本小说项目：`]
    for (const project of result.projects) {
      lines.push(
        `- 《${project.title}》projectId=${project.projectId}　阶段：${project.stageLabel ?? project.stage}　设定 ${project.blocksFinal} 定稿　章节 ${project.chaptersFinal}/${project.chapters} 成稿`,
      )
    }
    lines.push('下一步：novel action=get 读取整本（设定+大纲+正文）。')
    return [{ type: 'text', text: lines.join('\n') }]
  }
  const fields = Object.entries(result)
    .filter(([key]) => key !== 'project')
    .map(([key, entry]) => `${key}=${typeof entry === 'object' ? JSON.stringify(entry) : String(entry)}`)
  return [{ type: 'text', text: fields.length > 0 ? `小说项目已更新：${fields.join('、')}` : '小说项目未变化' }]
}

/**
 * Compile the author-facing parameter map into the raw JSON Schema that
 * `ctx.tools.register` forwards to the model unchanged.
 *
 * `register()` is the low-level entry point: unlike `defineTool`, it does not
 * compile `parameters`, it ships the value as the tool's `input_schema` as-is.
 * A map of `{ name: spec }` is not itself a JSON Schema — a parameter named
 * `title` lands where the meta-schema expects the `title` keyword (a string),
 * so the provider rejects every request that carries the tool with
 * `Invalid schema for function 'novel': {...} is not of type "string"`, and the
 * turn dies before the model can even answer. `@deepseek-ai/dsh-tools` is not
 * resolvable from a linked profile package (same reason `ctx.Service` is not),
 * so the conversion lives here: an object root, `properties` from the map, and
 * the per-parameter `required` flags lifted into the root `required` array.
 *
 * @param {Record<string, any>} spec per-parameter definitions
 * @returns {any} object-rooted raw JSON Schema
 */
function parameterJsonSchema(spec) {
  /** @type {Record<string, any>} */
  const properties = {}
  /** @type {string[]} */
  const required = []
  for (const [name, definition] of Object.entries(spec)) {
    const { required: isRequired, ...schema } = definition
    properties[name] = schema
    if (isRequired) required.push(name)
  }
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) }
}

/**
 * The `novel` tool definition. `cacheReady` is the promise of the loaded cache,
 * so a call waits for the store instead of failing on activation order.
 * @param {Promise<ProjectCache | undefined>} cacheReady
 */
export function novelTool(cacheReady) {
  return {
    name: 'novel',
    description:
      '读写「小说」面板里的长篇小说项目：作者定稿的故事内核、世界观、人物、情节、分章大纲与章节正文。写小说任务中用它读取真实设定、把作者的回答/大纲修改/正文写回项目、推进章节状态。',
    parameters: parameterJsonSchema({
      action: {
        type: 'string',
        required: true,
        enum: ['list', 'get', 'create', 'stage', 'block', 'outline', 'chapter', 'appendChapter'],
        description:
          'list 列出项目；get 读取整个项目（设定+大纲+正文）；create 新建；stage 切换阶段；block 更新设定板块；outline 保存某一章大纲；chapter 保存某一章正文；appendChapter 追加一章。',
      },
      projectId: { type: 'string', description: '项目 id；除 list / create 外必填。' },
      title: { type: 'string', description: 'create 或 appendChapter 的章节标题。' },
      genre: { type: 'string', description: 'create 时的题材。' },
      premise: { type: 'string', description: 'create 时的一句话故事。' },
      stage: {
        type: 'string',
        enum: [...STAGES],
        description:
          'stage 动作的目标阶段：interview 了解作者 / world 世界观 / characters 人物 / plot 情节 / outline 分章大纲 / writing 写正文 / done 收尾。',
      },
      blockId: {
        type: 'string',
        enum: BLOCKS.map((block) => block.id),
        description:
          'block 动作的板块：core 故事内核 / world 世界观 / characters 人物小传 / plot 情节设计 / rules 设定规则 / style 文风与叙事。',
      },
      questions: {
        type: 'array',
        items: { type: 'string' },
        description: 'block 动作：替换该板块的待问问题清单（作者已经回答的就去掉）。',
      },
      status: {
        type: 'string',
        enum: ['draft', 'final', 'outline', 'writing'],
        description: '板块用 draft / final；章节用 outline / writing / final。',
      },
      chapterId: { type: 'string', description: 'outline / chapter 动作的目标章节 id。' },
      outline: { type: 'string', description: 'outline 动作或 appendChapter 的分章大纲。' },
      draft: { type: 'string', description: 'chapter 动作的章节正文。' },
    }),
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          brief: { type: 'string', description: '更新后的项目概览或分章大纲。' },
          projectId: { type: 'string' },
          message: { type: 'string', description: '失败原因（仅出错时给出）。' },
        },
      },
      render: (_args, value) => renderNovelResult(value),
    },
    async execute(args) {
      const cache = await cacheReady
      if (cache === undefined) throw new Error('novel: 项目存储尚未就绪，请稍后再试')
      try {
        return await runNovelAction(cache, /** @type {any} */ (args))
      } catch (error) {
        return {
          projectId: typeof args?.projectId === 'string' ? args.projectId : undefined,
          message: error?.message ?? String(error),
        }
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: `小说项目 · ${String(args?.action ?? '')}`,
      kind: 'other',
      rawInput: args,
    }),
  }
}

/**
 * The table value schema: `normalizeProject` is the only validator, so a stored
 * document that has drifted from the current shape is repaired on load instead
 * of failing the whole open.
 */
const PROJECT_SCHEMA = {
  parse(raw) {
    const id = raw && typeof raw === 'object' && typeof raw.id === 'string' ? raw.id : ''
    if (!PROJECT_ID.test(id)) {
      throw new Error(`novel-companion: stored project id ${JSON.stringify(id)} is not a project id`)
    }
    return normalizeProject(raw)
  },
}

/**
 * Declare the storage domain: one JSON unit holding one record per novel.
 * `layout: 'single'` keeps the whole project set in one readable file that the
 * author can back up or diff.
 */
function novelDomainSpec() {
  return {
    name: NOVEL_DOMAIN,
    version: 1,
    layout: 'single',
    tables: { [NOVEL_TABLE]: { valueSchema: PROJECT_SCHEMA } },
  }
}

/**
 * Host plugin body.
 * @param {any} ctx
 */
export function apply(ctx) {
  /** Resolves with the cache, or `undefined` when storage could not open. */
  let settle = /** @type {(cache: ProjectCache | undefined) => void} */ (() => {})
  const ready = new Promise((resolve) => {
    settle = resolve
  })
  /** @type {ProjectCache | undefined} */
  let cache

  const loading = (async () => {
    const domain = await ctx.storageDomain.open(novelDomainSpec())
    ctx.effect(() => () => domain.close(), 'novel-companion: close the storage domain')
    cache = new ProjectCache(new ProjectStore(domain.table(NOVEL_TABLE)))
    await cache.refresh()
    settle(cache)
    return cache
  })()
  loading.catch((error) => {
    ctx.logger?.error?.(`novel-companion: 无法打开项目存储：${error?.message ?? error}`)
    settle(undefined)
  })
  ctx.effect(() => () => settle(undefined), 'novel-companion: release the store')

  // The `novels` Remote service, published as soon as the documents load.
  // `ctx.provide` is a fiber effect, so the service unregisters with the plugin.
  ctx.effect(
    () => {
      let dispose
      let live = true
      ready.then((store) => {
        if (!live || store === undefined) return
        dispose = ctx.provide(REMOTE_NAMESPACE, createNovelService(store))
      })
      return () => {
        live = false
        dispose?.()
      }
    },
    'novel-companion: novels Remote service',
  )

  ctx.effect(() => ctx.tools.register(novelTool(loading)), 'novel-companion: novel tool')

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'novel-companion',
        order: 3050,
        text: () => renderNovelBrief(cache === undefined ? [] : cache.projects),
      }),
    'novel-companion: prompt section',
  )
}
