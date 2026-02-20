import { endpoints } from '../config/api'
import { apiJson } from './http'

const base = endpoints.ai.base

export const aiApi = {
  samples: () =>
    apiJson(`${base}${endpoints.ai.samples}`),
  listChats: (limit = 50, offset = 0) =>
    apiJson(`${base}${endpoints.ai.chats}?limit=${limit}&offset=${offset}`),

  getMessages: (chatId) =>
    apiJson(`${base}${endpoints.ai.messages(chatId)}`),

  closeChat: (chatId) =>
    apiJson(`${base}${endpoints.ai.closeChat(chatId)}`, { method: 'POST' }),

  deleteChat: (chatId) =>
    apiJson(`${base}${endpoints.ai.deleteChat(chatId)}`, { method: 'DELETE' }),

  getTask: (taskId) =>
    apiJson(`${base}${endpoints.ai.task(taskId)}`),

  generatePro: (payload) => {
    // payload: { prompt, resolution, aspectRatio, chatId?, imageUrls[], files[] }
    const fd = new FormData()
    fd.append('prompt', payload.prompt)
    fd.append('resolution', payload.resolution || '1K')
    fd.append('aspectRatio', payload.aspectRatio || 'auto')

    if (payload.chatId) fd.append('chat_id', payload.chatId)

    for (const u of (payload.imageUrls || [])) fd.append('imageUrls', u)
    for (const f of (payload.files || [])) fd.append('images', f, f.name)

    return apiJson(`${base}${endpoints.ai.generate}`, { method: 'POST', body: fd })
  },
}
