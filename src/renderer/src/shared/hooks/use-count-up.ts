import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

export function useCountUp(target: number, duration = 0.8): number {
  const [value, setValue] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const from = prevRef.current
    const controls = animate(from, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setValue(Math.round(v))
    })
    prevRef.current = target
    return () => controls.stop()
  }, [target, duration])

  return value
}
