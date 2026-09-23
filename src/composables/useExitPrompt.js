// The three-way question asked when a dirty project is being closed. `useConfirm` only knows yes
// and no; here "no" splits into "don't save" and "don't close", and mixing those up loses work.
import { h } from 'vue'
import { NButton, NSpace, useDialog } from 'naive-ui'

export function useExitPrompt() {
  const dialog = useDialog()

  /**
   * @returns {Promise<'save'|'discard'|'cancel'>} Any dismissal other than a button — the mask,
   * Escape, the close icon — is 'cancel': closing is the one step that cannot be taken back.
   */
  return function promptExit() {
    return new Promise((resolve) => {
      let settled = false
      let instance = null
      const answer = (value) => () => {
        if (settled) return
        settled = true
        resolve(value)
        instance?.destroy()
      }
      instance = dialog.warning({
        title: 'Зберегти зміни перед закриттям?',
        content: 'Якщо не зберегти, незбережені зміни зникнуть.',
        action: () =>
          h(NSpace, null, {
            default: () => [
              h(NButton, { onClick: answer('cancel') }, { default: () => 'Скасувати' }),
              h(NButton, { onClick: answer('discard') }, { default: () => 'Не зберігати' }),
              h(
                NButton,
                { type: 'primary', onClick: answer('save') },
                { default: () => 'Зберегти' },
              ),
            ],
          }),
        onMaskClick: answer('cancel'),
        onClose: answer('cancel'),
        onAfterLeave: answer('cancel'),
      })
    })
  }
}
