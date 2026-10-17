/**
 * The demo project seeded by "载入示例" in the panel.
 *
 * Kept in its own module (and rebuilt whenever it is shown) so all the prose
 * lives in one small file: run this after any console round-trip that could
 * have mangled non-ASCII text.
 * @returns {any} a project document accepted by `normalizeProject`
 */
export function buildDemoProject(newId) {
  const seeded = {
    id: newId,
    title: '雾港钟楼（示例）',
    genre: '民国海雾悬疑',
    premise: '抄钟人林晚发现父亲的失踪与钟楼多敲的一响有关，而多出的那一声是为「还没死透的人」报时。',
    stage: 'outline',
    blocks: [
      {
        id: 'core',
        name: '故事内核',
        status: 'final',
        hint: '一句话故事：谁想要什么，谁在阻止他，失败的代价是什么。',
        content: '林晚想查清父亲失踪的真相；守护钟楼秘密的「报时人」在阻止她；失败则她会成为下一次报时。',
        questions: [],
      },
      {
        id: 'world',
        name: '世界观',
        status: 'final',
        hint: '时代、地点、规则：这个世界与我们的世界差在哪一条物理/社会法则上。',
        content: '民国二十三年，雾港终年被海雾包裹。钟楼每逢大雾会多敲一响，多出的那一声只给「还没死透的人」报时。',
        questions: [],
      },
      {
        id: 'characters',
        name: '人物小传',
        status: 'draft',
        hint: '每个人要什么、怕什么、嘴上怎么说、实际会怎么做。',
        content: '林晚：24 岁抄钟人，记性极好，怕海却住在海边。\n沈默：钟楼看门人，替父亲保守秘密三十年。',
        questions: ['沈默为什么没有阻止林晚？', '林晚的母亲在这件事里扮演什么角色？'],
      },
      {
        id: 'plot',
        name: '情节设计',
        status: 'draft',
        hint: '主线冲突与关键转折；越少越好，先要骨架。',
        content: '1) 记录本上出现陌生笔迹；2) 发现钟楼密室；3) 与「报时人」正面交锋；4) 选择替谁报时。',
        questions: ['结局是林晚报时成功，还是她接受成为下一个报时人？'],
      },
      {
        id: 'rules',
        name: '设定规则',
        status: 'draft',
        hint: '能力的边界与代价：能做什么、不能做什么、越界要付什么。',
        content: '',
        questions: ['多敲的那一响，只有林晚听得见吗？'],
      },
      {
        id: 'style',
        name: '文风与叙事',
        status: 'draft',
        hint: '人称、时态、句子长度、比喻的密度、章节长度。',
        content: '',
        questions: ['你希望读起来更像散文，还是更像悬疑推演？'],
      },
    ],
    chapters: [
      {
        id: 'chapter-demo-1',
        index: 1,
        title: '第一声',
        status: 'final',
        outline: '雾夜。林晚按惯例抄钟，钟声却在记录之外多响了一次。她在父亲的旧记录本里找到一行陌生笔迹：「今夜无死者。」',
        draft: '',
        updatedAt: 0,
      },
      {
        id: 'chapter-demo-2',
        index: 2,
        title: '多出来的一响',
        status: 'outline',
        outline: '',
        draft: '',
        updatedAt: 0,
      },
    ],
  }
  return seeded
}
