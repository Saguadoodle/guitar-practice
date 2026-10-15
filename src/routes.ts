export const PAGES = [
  { id: 'fretboard', title: '指板与音准', description: '' },
  { id: 'scales', title: '音阶', description: '音阶探索' },
  { id: 'chords', title: '和弦', description: '和弦探索' },
  { id: 'jam', title: 'Jam Session', description: '基础轻摇滚循环伴奏' },
  { id: 'transcription', title: '扒谱', description: '筹备中，具体功能待确定。' },
  { id: 'settings', title: '设置', description: '' },
  { id: 'about', title: '简介', description: '筹备中，项目理念待补充。' },
] as const
export type PageId = typeof PAGES[number]['id']
export function pageFromHash(hash: string) {
  return PAGES.find((page) => hash === `#/${page.id}`) ?? PAGES[0]
}
