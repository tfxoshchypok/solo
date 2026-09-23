// A confirmation the caller can `await`. Naive UI's dialog is callback-shaped, which forces the
// decision to be scattered across two handlers; wrapping it in a promise keeps a destructive
// action written as one sequence — ask, then act (FR-010).
import { useDialog } from 'naive-ui'

export function useConfirm() {
  const dialog = useDialog()

  /**
   * @returns {Promise<boolean>} true only when the user pressed the positive button. Dismissing
   * the dialog any other way — the mask, Escape, the close icon — resolves false, so a destructive
   * action never proceeds on an ambiguous gesture.
   */
  return function confirm({
    title,
    content,
    positiveText = 'Видалити',
    negativeText = 'Скасувати',
  }) {
    return new Promise((resolve) => {
      let settled = false
      const answer = (value) => () => {
        if (settled) return
        settled = true
        resolve(value)
      }
      dialog.warning({
        title,
        content,
        positiveText,
        negativeText,
        onPositiveClick: answer(true),
        onNegativeClick: answer(false),
        onMaskClick: answer(false),
        onClose: answer(false),
        onAfterLeave: answer(false),
      })
    })
  }
}
