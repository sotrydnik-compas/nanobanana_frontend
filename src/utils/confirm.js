import { reactive } from 'vue'

export const confirmState = reactive({
  open: false,
  title: '',
  text: '',
  yesText: 'Да',
  noText: 'Отмена',
  danger: false,
  _resolve: null,
})

export function confirm(opts = {}) {
  // если внезапно вызвали confirm пока уже открыт — прошлый считаем "нет"
  if (confirmState.open && typeof confirmState._resolve === 'function') {
    try { confirmState._resolve(false) } catch {}
  }

  confirmState.title = opts.title || 'Подтвердите действие'
  confirmState.text = opts.text || ''
  confirmState.yesText = opts.yesText || 'Да'
  confirmState.noText = opts.noText || 'Отмена'
  confirmState.danger = !!opts.danger
  confirmState.open = true

  return new Promise((resolve) => {
    confirmState._resolve = resolve
  })
}

export function resolveConfirm(value) {
  confirmState.open = false
  const r = confirmState._resolve
  confirmState._resolve = null
  if (typeof r === 'function') r(!!value)
}