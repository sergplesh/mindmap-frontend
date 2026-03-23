import api from './api';

export const mapsService = {
  async getAll() {
    const response = await api.get('/maps');
    return response.data;
  },

  async getById(id) {
    const response = await api.get(`/maps/${id}`);
    return response.data;
  },

  async create(title, description, emoji = '🗺️') {
    const response = await api.post('/maps', { title, description, emoji });
    return response.data;
  },

  async update(id, title, description, emoji) {
    const response = await api.put(`/maps/${id}`, { title, description, emoji });
    return response.data;
  },

  async delete(id) {
    const response = await api.delete(`/maps/${id}`);
    return response.data;
  },

  async getNodes(mapId) {
    const response = await api.get(`/maps/${mapId}/nodes`);
    return response.data;
  },

  async getEdges(mapId) {
    const response = await api.get(`/maps/${mapId}/edges`);
    return response.data;
  },

  async getFullMap(mapId) {
    const response = await api.get(`/maps/${mapId}/full`);
    return response.data;
  }
};