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
check('stage reports readiness', staged.readiness === undefined || typeof staged.readiness.ok === 'boolean')

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
// The render is the only text the model sees. If it carries just the summary,
// the model writes from memory and invents canon — the exact failure this
// plugin exists to prevent.
check('get hands the boards to the model in full', getText.includes('主角：未命名'), getText.slice(0, 200))
check('get hands the outline and the prose to the model', getText.includes('1. 改过的起') && getText.includes('正文开始。'))
const scopedText = render({ action: 'get', chapterId }, await run({ action: 'get', projectId, chapterId }))
check('get chapterId= returns that chapter prose', scopedText.includes('正文开始。'))

// A failure must read as a failure. Returning `{message}` used to render as
// 「小说项目已更新：…message=没有板块…」, i.e. success with an odd field.
const failed = await tool.execute({ action: 'block', projectId, blockId: 'nope', content: 'x' })
const failedText = render({ action: 'block' }, failed)
check('a failed action is not reported as a successful update', !failedText.includes('已更新'), failedText)
check('a failed action says so', /失败/.test(failedText) && /没有板块/.test(failedText), failedText)

// Drafts are budgeted: a 100-chapter book must not arrive in one result.
const multi = await run({ action: 'create', title: '多章' })
for (let index = 0; index < 5; index += 1) {
  const added = await run({ action: 'appendChapter', projectId: multi.projectId, title: `第 ${index + 1} 章`, outline: `大纲 ${index + 1}` })
  await run({ action: 'chapter', projectId: multi.projectId, chapterId: added.chapter.id, draft: `正文 ${index + 1}。`, status: 'final' })
}
const multiText = render({ action: 'get' }, await run({ action: 'get', projectId: multi.projectId }))
check('get expands only the last chapters by default', multiText.includes('正文 5。') && multiText.includes('正文 4。') && !multiText.includes('正文 1。'))
check('get says how to fetch the rest', multiText.includes('chapterId=') && multiText.includes('未展开'), multiText.slice(0, 200))
check('every outline is still present', (multiText.match(/大纲 [1-5]/g) ?? []).length === 5)

// Silent truncation is data loss: refuse the write and say why.
let refusedLong = ''
try {
  await run({ action: 'create', title: '超长', premise: 'x'.repeat(200_000 + 1) })
  const over = await run({ action: 'appendChapter', projectId, title: '超长章' })
  await run({ action: 'chapter', projectId, chapterId: over.chapter.id, draft: 'y'.repeat(200_001), status: 'final' })
} catch (error) {
  refusedLong = String(error.message)
}
check('an over-long field is refused, not silently truncated', /超过/.test(refusedLong), refusedLong)
check(
  'the refused write did not shorten the stored prose',
  (await run({ action: 'get', projectId })).project.chapters[0].draft === '正文开始。',
)

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
