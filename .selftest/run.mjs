/**
 * Self-test for the Host half under plain Node.
 *
 * `ProjectStore`/`ProjectCache` replace the storage table with an in-memory
 * Map of the same shape, `runNovelAction` exercises every tool action, and the
 * prompt helpers are checked for the facts the agent depends on.
 */
import { ProjectStore, ProjectCache, runNovelAction, renderNovelBrief, novelTool } from './index.mjs'
import { emptyProject, buildPrompt, normalizeProject, outlineMarkdown, projectSummary, readiness } from './state.mjs'
import { buildDemoProject } from './demo.mjs'

let failures = 0
const check = (label, condition) => {
  if (condition) {
    console.log(`ok   ${label}`)
  } else {
    failures += 1
    console.error(`FAIL ${label}`)
  }
}

/** A storage table stand-in with the same surface as the domain handle. */
function memoryTable() {
  const records = new Map()
  return {
    records,
    get: (key) => records.get(key),
    put: async (key, value) => {
      records.set(key, value)
    },
    delete: async (key) => records.delete(key),
    entries: () => [...records.entries()][Symbol.iterator](),
    get size() {
      return records.size
    },
  }
}

const table = memoryTable()
const cache = new ProjectCache(new ProjectStore(table))

const created = await runNovelAction(cache, { action: 'create', title: '测试书' })
check('create returns a project id', typeof created.projectId === 'string' && created.projectId.length > 0)
const id = created.projectId
check('create seeds six blocks', table.get(id).blocks.length === 6)

const block = await runNovelAction(cache, {
  action: 'block',
  projectId: id,
  blockId: 'world',
  content: '蒸汽与雾。',
  status: 'final',
  questions: ['还有别的规则吗？'],
})
check('block writes content and status', block.status === 'final' && block.openQuestions === 1)

const chapter = await runNovelAction(cache, { action: 'appendChapter', projectId: id, title: '开局' })
check('appendChapter assigns index 1', chapter.chapter.index === 1)

const outlined = await runNovelAction(cache, {
  action: 'outline',
  projectId: id,
  chapterId: chapter.chapter.id,
  outline: '1. 开场',
})
check('outline saved', outlined.chapter.outline === '1. 开场')

const written = await runNovelAction(cache, {
  action: 'chapter',
  projectId: id,
  chapterId: chapter.chapter.id,
  draft: '正文……',
  status: 'final',
})
check('chapter draft saved and finalized', written.status === 'final')

const got = await runNovelAction(cache, { action: 'get', projectId: id })
check('get returns a brief naming the project', got.brief.includes('测试书'))
check('get returns the outline', got.outline.includes('开局'))
check('get returns the draft', got.project.chapters[0].draft === '正文……')

let rejected = false
try {
  await runNovelAction(cache, { action: 'block', projectId: id, blockId: 'nope' })
} catch {
  rejected = true
}
check('unknown block is rejected', rejected)

rejected = false
try {
  await runNovelAction(cache, { action: 'get', projectId: 'missing-project' })
} catch {
  rejected = true
}
check('unknown project is rejected', rejected)

rejected = false
try {
  await runNovelAction(cache, { action: 'get' })
} catch {
  rejected = true
}
check('missing projectId is rejected', rejected)

const listed = await runNovelAction(cache, { action: 'list' })
check('list reports the finalized chapter', listed.projects.length === 1 && listed.projects[0].chaptersFinal === 1)

const stage = await runNovelAction(cache, { action: 'stage', projectId: id, stage: 'characters' })
check('stage switches', stage.stage === 'characters')

const demo = buildDemoProject('demo-1')
const normalizedDemo = normalizeProject(demo)
check(
  'demo project survives normalization',
  normalizedDemo.id === 'demo-1' &&
    normalizedDemo.blocks.length === demo.blocks.length &&
    normalizedDemo.blocks[0].content === demo.blocks[0].content &&
    normalizedDemo.chapters.length === demo.chapters.length &&
    normalizedDemo.version === 1,
)
check('demo has final blocks', demo.blocks.filter((entry) => entry.status === 'final').length === 2)
check('demo has two chapters', demo.chapters.length === 2)
await cache.put(demo)
const demoBrief = renderNovelBrief(cache.projects)
check('prompt section lists both projects', demoBrief.includes('demo-1') && demoBrief.includes(id))
check('prompt section flags the missing outline', demoBrief.includes('还缺大纲的章节'))

const base = emptyProject('abc', 'x')
check('normalizeProject is stable', JSON.stringify(normalizeProject(base)) === JSON.stringify(base))
check('buildPrompt brief names the project', buildPrompt(base, 'brief').includes('《x》'))
check(
  'buildPrompt write names the chapter',
  buildPrompt(
    { ...base, chapters: [{ id: 'c1', index: 1, title: '雨夜', status: 'outline', outline: 'o', draft: '' }] },
    'write',
    { chapterId: 'c1' },
  ).includes('第 1 章 雨夜'),
)
check('projectSummary exposes the stage', projectSummary(base).includes('了解你'))
check(
  'outlineMarkdown renders headings',
  outlineMarkdown({ ...base, chapters: [{ id: 'c1', index: 1, title: 'A', status: 'outline', outline: 'o' }] }).includes(
    '## 1. A',
  ),
)
check(
  'readiness reports an unwritten outline',
  readiness({ ...base, stage: 'outline', chapters: [{ id: 'c', outline: '' }] }).ok === false,
)

const tool = novelTool(Promise.resolve(cache))
check(
  'tool requires action',
  tool.parameters.type === 'object' &&
    tool.parameters.properties?.action !== undefined &&
    tool.parameters.required.includes('action'),
)
const failure = await tool.execute({ action: 'get', projectId: 'nope' })
check('tool reports failures as a message', typeof failure.message === 'string' && failure.message.includes('没有找到项目'))
const rendered = tool.output.render({}, failure)
check('tool renders a text block', rendered[0].type === 'text' && rendered[0].text.length > 0)

const removed = await cache.drop(id)
check('remove drops the record', removed === true && table.get(id) === undefined)

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
