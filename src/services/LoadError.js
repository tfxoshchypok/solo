/**
 * A file that cannot be used. `path` is the failing element inside the file — `nodes[3].name` in a
 * project, `zones[5].name` in the reference tables — not the path on disk, because that is what the
 * user is told (FR-036, 002/FR-007). `expected` and `received` are valibot's own words for the same
 * issue.
 *
 * Shared by `ProjectFileService` and `ReferenceTablesFileService`, so a caller tells a refused file
 * from any other failure with one `instanceof`.
 */
export class LoadError extends Error {
  constructor({ path, expected, received, message, cause }) {
    super(message ?? `Файл проєкту пошкоджений: ${path}`)
    this.name = 'LoadError'
    this.path = path ?? ''
    this.expected = expected
    this.received = received
    if (cause) this.cause = cause
  }
}
