import { useLayoutEffect, useRef } from 'react'

/** Size only: reserve measured controls before allocating the largest readable square. */
export function useGameLayout() {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const game = ref.current!
    const shell = game.parentElement!
    const controls = [...game.children].filter(element => !element.classList.contains('board-frame'))
    const gapCount = game.children.length - 1
    let frame = 0
    const layout = () => {
      const style = getComputedStyle(shell)
      const gameStyle = getComputedStyle(game)
      const rect = shell.getBoundingClientRect()
      const width = rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const height = rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        - parseFloat(gameStyle.paddingBottom)
      const controlHeight = controls.reduce((sum, element) => sum + element.getBoundingClientRect().height, 0)
      const minGap = parseFloat(gameStyle.getPropertyValue('--game-min-gap'))
      const minBoard = Math.min(width, parseFloat(gameStyle.getPropertyValue('--game-min-board')))
      const board = Math.floor(Math.max(minBoard, Math.min(width, height - controlHeight - gapCount * minGap)))
      const gap = Math.max(minGap, (height - controlHeight - board) / gapCount)
      game.style.setProperty('--game-board-size', `${board}px`)
      game.style.setProperty('--game-gap', `${gap}px`)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(layout)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(shell)
    observer.observe(game, { box: 'border-box' })
    controls.forEach(element => observer.observe(element))
    window.addEventListener('resize', schedule)
    layout()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [])
  return ref
}
