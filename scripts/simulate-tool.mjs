/**
 * Exercise every `novel` tool action against an in-memory store, the way the
 * Agent drives the plugin mid-conversation.
 *
 * Run: node scripts/simulate-tool.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ROOT } from './lib/env.mjs'
writeFileSync(`${ROOT}/.selftest/state.mjs`, readFileSync(`${ROOT}/lib/state.js`, 'utf8'))
writeFileSync(`${ROOT}/.selftest/demo.mjs`, readFileSync(`${ROOT}/lib/demo.js`, 'utf8'))
writeFileSync(
  `${ROOT}/.selftest/tool-index.mjs`,
  readFileSync(`${ROOT}/lib/index.js`, 'utf8')
    .replace("require('./state.js')", "require('./state.mjs')")
    .replace("require('./demo.js')", "require('./demo.mjs')"),
  'utf8',
)

const host = await import(pathToFileURL(`${ROOT}/.selftest/tool-index.mjs`).href)

let failures = 0
const check = (label, condition, detail) => {
  if (condition) console.log(`ok   ${label}`)
  else {
    failures += 1
    console.error(`FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

/** In-memory stand-in for the storage table. */
function memoryTable() {
  const rows = new Map()
  return {
    get: (key) => rows.get(key),
    entries: () => rows.entries(),
    keys: () => rows.keys(),
    async put(key, value) {
      rows.set(key, JSON.parse(JSON.stringify(value)))
    },
    async update(key, mutator) {
      const next = mutator(rows.get(key))
      rows.set(key, JSON.parse(JSON.stringify(next)))
      return next
    },
    async delete(key) {
      return rows.delete(key)
    },
  }
}

const cache = new host.ProjectCache(new host.ProjectStore(memoryTable()))
await cache.refresh()

// `runNovelAction` is the tool's executor; `arg` is the schema-validated input.
const run = (arg) => host.runNovelAction(cache, arg)

// The rendered text is what the model actually reads. Asserting only on the
// returned object let a wrong message ("小说项目已更新：projects=[]") ship, so
// rendering gets its own checks here.
const tool = host.novelTool(Promise.resolve(cache))
const render = (arg, value) => {
  const blocks = tool.output.render(arg, value)
  return Array.isArray(blocks) ? blocks.map((block) => block.text ?? '').join('\n') : String(blocks)
}

const listed = await run({ action: 'list' })
check('list works on an empty store', Array.isArray(listed.projects) && listed.projects.length === 0)

const emptyListText = render({ action: 'list' }, listed)
check(
  'an empty list says there are no projects',
  emptyListText.includes('还没有任何小说项目'),
  emptyListText,
)
check(
  'an empty list does not claim something was updated',
  !emptyListText.includes('已更新'),
  emptyListText,
)

const created = await run({ action: 'create', title: '长夜', genre: '科幻', premise: '一句话' })
check('create returns a projectId', typeof created.projectId === 'string' && created.projectId.length > 0)
check('create returns a brief', typeof created.brief === 'string' && created.brief.length > 0)
const projectId = created.projectId

const got = await run({ action: 'get', projectId })
check('get returns the whole document', got.project?.id === projectId)
check('get returns a rendered outline', typeof got.outline === 'string')

const staged = await run({ action: 'stage', projectId, stage: 'characters' })
check('stage moves the project', staged.stage === 'characters', staged.stage)

let rejectedStage = false
try {
  await run({ action: 'stage', projectId, stage: 'nowhere' })
} catch {
  rejectedStage = true
}
check('stage rejects an unknown stage', rejectedStage)

const blocked = await run({
  action: 'block',
  projectId,
  blockId: 'characters',
  content: '主角：未命名',
  status: 'final',
  questions: ['他为什么离开？', '他最怕什么？'],
})
check('block writes content', blocked.ok !== false)
const afterBlock = await run({ action: 'get', projectId })
const characterBlock = afterBlock.project.blocks.find((block) => block.id === 'characters')
check('block content persisted', characterBlock.content === '主角：未命名')
check('block status persisted', characterBlock.status === 'final')
check('block questions replaced', characterBlock.questions.length === 2, JSON.stringify(characterBlock.questions))

let rejectedBlock = false
try {
  await run({ action: 'block', projectId, blockId: 'nope', content: 'x' })
} catch (error) {
  rejectedBlock = /没有板块/.test(String(error.message))
}
check('block rejects an unknown block with a readable message', rejectedBlock)

const appended = await run({ action: 'appendChapter', projectId, title: '第一章', outline: '1. 起\n2. 承' })
check('appendChapter returns the new chapter', appended.chapter?.title === '第一章')
const chapterId = appended.chapter.id

const outlined = await run({ action: 'outline', projectId, chapterId, outline: '1. 改过的起\n2. 改过的承' })
check('outline saves author edits', outlined.ok !== false)
const afterOutline = await run({ action: 'get', projectId })
check(
  'outline persisted',
  afterOutline.project.chapters[0].outline === '1. 改过的起\n2. 改过的承',
  afterOutline.project.chapters[0].outline,
)

const written = await run({ action: 'chapter', projectId, chapterId, draft: '正文开始。', status: 'final' })
check('chapter saves the prose', written.ok !== false)
const afterChapter = await run({ action: 'get', projectId })
check('prose persisted', afterChapter.project.chapters[0].draft === '正文开始。')
check('chapter status persisted', afterChapter.project.chapters[0].status === 'final')

let missingId = false
try {
  await run({ action: 'get' })
} catch (error) {
  missingId = /projectId/.test(String(error.message))
}
check('a missing projectId is reported clearly', missingId)

let unknownAction = false
try {
  await run({ action: 'explode', projectId })
} catch (error) {
  unknownAction = /action/.test(String(error.message))
}
check('an unknown action is reported clearly', unknownAction)

let unknownProject = false
try {
  await run({ action: 'get', projectId: 'novel-missing0000000000000' })
} catch (error) {
  unknownProject = /没有找到项目/.test(String(error.message))
}
check('an unknown project is reported clearly', unknownProject)

// ---- rendered text -------------------------------------------------------
const populatedListText = render({ action: 'list' }, await run({ action: 'list' }))
check('a populated list reports the count', populatedListText.includes('1 本小说项目'), populatedListText)
check('a populated list shows the title', populatedListText.includes('《长夜》'), populatedListText)
check('a populated list shows the projectId', populatedListText.includes(projectId), populatedListText)
check(
  'a populated list points at the next step',
  populatedListText.includes('action=get'),
  populatedListText,
)

const createText = render({ action: 'create' }, created)
check('create renders its project brief, not the roster', createText.includes('长夜') && !createText.includes('共有'), createText)
check('create does not use the roster wording', !createText.includes('本小说项目'), createText)

const getText = render({ action: 'get' }, afterChapter)
check('get renders the project summary', getText.length > 0 && !getText.includes('已更新'), getText.slice(0, 80))

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
