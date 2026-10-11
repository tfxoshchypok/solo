// The startup question about the copy a crash left of a project without a file (RECOVERY-01).
// Unlike the exit prompt it cannot be dismissed: until it is answered the copy stays held, and a
// question that could simply go away would hold it for the whole session.
import { h } from 'vue'
import { NButton, NSpace, useDialog } from 'naive-ui'

export function useRecoveryPrompt() {
  const dialog = useDialog()

  /**
   * @param {{ name: string }} copy what the startup check found
   * @returns {Promise<'restore'|'discard'>}
   */
  return function promptRecovery({ name }) {
    return new Promise((resolve) => {
      let instance = null
      const answer = (value) => () => {
        resolve(value)
        instance?.destroy()
      }
      instance = dialog.warning({
        title: 'Відновити незбережений проект?',
        content: `Програма закрилась, коли проект «${name}» ще не був збережений у файл. Лишилась його автозбережена копія.`,
        closable: false,
        closeOnEsc: false,
        maskClosable: false,
        action: () =>
          h(NSpace, null, {
            default: () => [
              h(NButton, { onClick: answer('discard') }, { default: () => 'Відкинути копію' }),
              h(
                NButton,
                { type: 'primary', onClick: answer('restore') },
                { default: () => 'Відновити' },
              ),
            ],
          }),
      })
    })
  }
}
