function cloneErrorLike(source, message, fallback = 'Не удалось выполнить запрос.') {
  const err = new Error(message || fallback)
  if (source && typeof source === 'object') {
    if ('status' in source) err.status = source.status
    if ('payload' in source) err.payload = source.payload
  }
  return err
}

export function normalizeClientError(error, fallback = 'Не удалось выполнить запрос.') {
  const message = String(error?.message || '').trim()
  const normalized = message.toLowerCase()

  if (
    error?.name === 'AbortError' ||
    normalized.includes('aborted')
  ) {
    return cloneErrorLike(error, 'Запрос был прерван. Попробуйте еще раз.', fallback)
  }

  if (
    !message ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed') ||
    normalized.includes('network error') ||
    normalized.includes('internet connection appears to be offline')
  ) {
    return cloneErrorLike(
      error,
      'Не удалось подключиться к серверу. Проверьте интернет-соединение и повторите попытку.',
      fallback
    )
  }

  if (error instanceof Error) return error
  return cloneErrorLike(error, fallback, fallback)
}
