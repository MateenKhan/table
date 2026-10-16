import React from 'react'

export function useDebouncedCommit<T>(
  value: T,
  committed: T,
  delay: number,
  commit: (value: T) => void,
) {
  const commitRef = React.useRef(commit)
  commitRef.current = commit
  React.useEffect(() => {
    if (Object.is(value, committed)) return
    const timer = setTimeout(() => commitRef.current(value), delay)
    return () => clearTimeout(timer)
  }, [value, committed, delay])
}
