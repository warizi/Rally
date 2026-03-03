import { toTabOptions } from '../to-tab-options'

describe('toTabOptions', () => {
  it("todo → type='todo-detail', pathname='/todo/{id}', title=전달값", () => {
    expect(toTabOptions('todo', 'td-1', '내 할일')).toEqual({
      type: 'todo-detail',
      pathname: '/todo/td-1',
      title: '내 할일'
    })
  })

  it("note → type='note', pathname='/folder/note/{id}', title=전달값", () => {
    expect(toTabOptions('note', 'n-1', '메모')).toEqual({
      type: 'note',
      pathname: '/folder/note/n-1',
      title: '메모'
    })
  })

  it("pdf → type='pdf', pathname='/folder/pdf/{id}', title=전달값", () => {
    expect(toTabOptions('pdf', 'p-1', '문서.pdf')).toEqual({
      type: 'pdf',
      pathname: '/folder/pdf/p-1',
      title: '문서.pdf'
    })
  })

  it("csv → type='csv', pathname='/folder/csv/{id}', title=전달값", () => {
    expect(toTabOptions('csv', 'c-1', '데이터.csv')).toEqual({
      type: 'csv',
      pathname: '/folder/csv/c-1',
      title: '데이터.csv'
    })
  })

  it("schedule → type='calendar', pathname='/calendar', 전달 title 무시 → 고정 '캘린더'", () => {
    const result = toTabOptions('schedule', 's-1', '내 일정')
    expect(result).toEqual({
      type: 'calendar',
      pathname: '/calendar',
      title: '캘린더'
    })
  })

  it("image → type='image', pathname='/folder/image/{id}', title=전달값", () => {
    expect(toTabOptions('image', 'i-1', '사진.png')).toEqual({
      type: 'image',
      pathname: '/folder/image/i-1',
      title: '사진.png'
    })
  })
})
