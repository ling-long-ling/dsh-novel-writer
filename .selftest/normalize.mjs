/**
 * Regression tests for `normalizeProject` (the one validator both halves share)
 * and for the tool-side mutations that depend on it.
 *
 * These used to be missing: the demo project was silently re-ordered by block
 * index, which is exactly the class of bug a validator test catches.
 *
 * Run: node .selftest/normalize.mjs
 */
import { repoUrl } from '../scripts/lib/env.mjs'

const base = repoUrl('.selftest')
const { normalizeProject, emptyProject, BLOCKS } = await import(`${base}/state.mjs`)
const { buildDemoProject } = await import(`${base}/demo.mjs`)

let failures = 0
const check = (label, condition, detail) => {
  if (condition) console.log(`ok   ${label}`)
  else {
    failures += 1
    console.error(`FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

const fresh = emptyProject('p1', '测试')
check('empty project keeps the six canonical blocks', fresh.blocks.map((b) => b.id).join(',') === BLOCKS.map((b) => b.id).join(','))
check('empty project starts in interview', fresh.stage === 'interview')
check('empty project has no chapters', fresh.chapters.length === 0)

// Blocks supplied out of order still land on their own ids.
const shuffled = normalizeProject({
  id: 'p2',
  title: '乱序',
  blocks: [
    { id: 'style', content: '文风' },
    { id: 'core', content: '内核' },
    { id: 'characters', content: '人物' },
  ],
})
check(
  'shuffled blocks keep content on their own ids',
  shuffled.blocks.find((b) => b.id === 'core').content === '内核' &&
    shuffled.blocks.find((b) => b.id === 'style').content === '文风' &&
    shuffled.blocks.find((b) => b.id === 'characters').content === '人物',
)
check('no unknown block ids survive', shuffled.blocks.every((b) => BLOCKS.some((k) => k.id === b.id)))
check('missing blocks are recreated empty', shuffled.blocks.find((b) => b.id === 'world').content === '')

// Chapter indexes are always 1..n.
const indexed = normalizeProject({
  id: 'p3',
  chapters: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
})
check('chapter indexes are renumbered', indexed.chapters.map((c) => c.index).join(',') === '1,2,3')

// Unknown statuses degrade instead of throwing.
const degraded = normalizeProject({
  id: 'p4',
  blocks: [{ id: 'core', status: 'weird' }],
  chapters: [{ id: 'x', status: 'weird' }],
})
check('unknown block status becomes draft', degraded.blocks[0].status === 'draft')
check('unknown chapter status becomes outline', degraded.chapters[0].status === 'outline')

// The demo document is the shape the panel shows on first open.
const demo = normalizeProject(buildDemoProject('demo-x'))
check('demo keeps its title', demo.title.includes('雾港钟楼'), demo.title)
check('demo stage survives', demo.stage === 'outline', demo.stage)
check(
  'demo blocks keep their own prose',
  demo.blocks.find((b) => b.id === 'world').content.includes('雾港'),
  demo.blocks.find((b) => b.id === 'world').content,
)
check('demo has two chapters', demo.chapters.length === 2)
check('second demo chapter has no outline yet', demo.chapters[1].outline === '')

// Non-object input is repaired, never thrown on.
const junk = normalizeProject(null)
check('null input still produces a document', junk.id === '' && junk.blocks.length === 6)

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
