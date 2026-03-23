import api from './api';

export const customTypesService = {
  // Получить все типы (системные и пользовательские)
  async getTypes(mapId, category) {
    const response = await api.get(`/maps/${mapId}/customtypes/${category}-types`);
    return response.data;
  },

  // Получить детали конкретного типа
  async getTypeDetails(mapId, category, typeId) {
    const response = await api.get(`/maps/${mapId}/customtypes/${category}-types/${typeId}`);
    return response.data;
  },

  // Создать пользовательский тип
  async createType(mapId, category, typeData) {
    const response = await api.post(`/maps/${mapId}/customtypes/${category}-types`, typeData);
    return response.data;
  },

  // Обновить пользовательский тип
  async updateType(mapId, category, typeId, typeData) {
    const response = await api.put(`/maps/${mapId}/customtypes/${category}-types/${typeId}`, typeData);
    return response.data;
  },

  // Удалить пользовательский тип
  async deleteType(mapId, category, typeId) {
    const response = await api.delete(`/maps/${mapId}/customtypes/${category}-types/${typeId}`);
    return response.data;
  }
};