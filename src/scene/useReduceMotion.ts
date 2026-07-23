import { useAppStore } from '../app/store'

export function useReduceMotion() {
  return useAppStore((s) => s.reduceMotion)
}
