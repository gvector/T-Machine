/** localStorage that never throws (private windows, blocked storage). */
export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(`tm.${key}`) } catch { return null }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(`tm.${key}`, value) } catch { /* not available */ }
  },
}
