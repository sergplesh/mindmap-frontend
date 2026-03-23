import api from './api';

export const accessService = {
  // Пригласить пользователя на карту
  async invite(mapId, username, role) {
    const response = await api.post('/access/invite', {
      mapId,
      username,
      role
    });
    return response.data;
  },

  // Получить список пользователей с доступом
  async getMapAccess(mapId) {
    const response = await api.get(`/access/map/${mapId}`);
    return response.data;
  },

  // Изменить роль пользователя
  async updateRole(accessId, role) {
    const response = await api.put(`/access/${accessId}/role`, { role });
    return response.data;
  },

  // Удалить доступ пользователя
  async removeAccess(accessId) {
    const response = await api.delete(`/access/${accessId}`);
    return response.data;
  }
};