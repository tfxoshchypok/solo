import { MemoryFs } from '@/services/fs/index.js'

/**
 * MemoryFs whose next write waits until the test lets it through. Slow I/O, without timing guesses:
 * the test decides exactly when a write finishes, and edits the tree while it is still running.
 */
export class GatedFs extends MemoryFs {
  constructor(options) {
    super(options)
    this.gates = []
  }

  /**
   * Holds the next write whose path `matches`. Only that one: a later write to the same path goes
   * straight through, which is what lets a test catch two writes running at once.
   *
   * @param {(path: string) => boolean} [matches]
   * @returns {{ release: () => void, reached: Promise<string> }} `reached` resolves with the path
   *   once the held write has started
   */
  hold(matches = () => true) {
    let release
    let arrive
    const opened = new Promise((resolve) => (release = resolve))
    const reached = new Promise((resolve) => (arrive = resolve))
    this.gates.push({ matches, opened, arrive })
    return { release, reached }
  }

  async writeText(path, text) {
    const index = this.gates.findIndex((gate) => gate.matches(path))
    if (index !== -1) {
      const [gate] = this.gates.splice(index, 1)
      gate.arrive(path)
      await gate.opened
    }
    return super.writeText(path, text)
  }
}

export const isTmp = (path) => path.endsWith('.tmp')
export const isSidecar = (path) => path.endsWith('.autosave.json')
