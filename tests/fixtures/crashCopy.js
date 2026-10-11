// What a crash leaves behind for a project that never had a file: `unsaved.autosave.json` in the
// data directory. Written straight to the filesystem, so no autosave queue is involved.
import { getFs } from '@/services/fs/index.js'
import { UNSAVED_SIDECAR_NAME, denormalize } from '@/services/ProjectFileService.js'
import { appDataDir, join } from '@/services/PathService.js'
import { consumer, loadTypeRow, tree } from './tree.js'

export const CRASHED_NAME = 'Майстерня'

/** A named project with a consumer whose fields are not the defaults, so a restore can be compared. */
export function crashedProject() {
  return denormalize(
    tree({
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      children: [
        {
          id: 'shop',
          kind: 'panel',
          name: 'Верстати',
          children: [
            consumer('lathe', {
              name: 'Токарний',
              loadType: loadTypeRow({ ratedPowerKw: 3 }),
              cableSectionMm2: 2.5,
            }),
          ],
        },
      ],
    }),
    { name: CRASHED_NAME },
  )
}

export async function unsavedSidecarPath() {
  return join(await appDataDir(), UNSAVED_SIDECAR_NAME)
}

/**
 * @param {string} [text] the copy's contents, for a broken one
 * @returns {Promise<{ project: object, sidecarPath: string }>}
 */
export async function leaveCrashCopy(text) {
  const fs = getFs()
  const project = crashedProject()
  const sidecarPath = await unsavedSidecarPath()
  await fs.ensureDir(await appDataDir())
  await fs.writeText(sidecarPath, text ?? JSON.stringify(project))
  return { project, sidecarPath }
}
