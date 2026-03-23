import api from './api';

export const questionsService = {
  // Получить все вопросы узла
  async getByNode(nodeId) {
    const response = await api.get(`/questions/node/${nodeId}`);
    return response.data;
  },

  // Создать вопрос
  async create(data) {
    const response = await api.post('/questions', data);
    return response.data;
  },

  // Обновить вопрос
  async update(id, data) {
    const response = await api.put(`/questions/${id}`, data);
    return response.data;
  },

  // Удалить вопрос
  async delete(id) {
    const response = await api.delete(`/questions/${id}`);
    return response.data;
  },

  // Проверить ответы и открыть узел
  async verify(nodeId, answers) {
    const response = await api.post('/questions/verify', {
      nodeId,
      answers
    });
    return response.data;
  }
};