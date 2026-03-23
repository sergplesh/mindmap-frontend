import api from './api';

export const userService = {
  // Проверить существование пользователя
  async checkUserExists(username) {
    try {
      const response = await api.get(`/auth/check-user/${encodeURIComponent(username)}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return { exists: false, message: error.response.data?.message || 'Пользователь не найден' };
      }
      throw error;
    }
  },

  // Получить информацию о пользователе
  async getUserInfo(username) {
    const response = await api.get(`/auth/check-user/${encodeURIComponent(username)}`);
    return response.data;
  }
};