import api from './api';

export const nodesService = {
  async create(mapId, nodeData) {
    const response = await api.post('/nodes', {
      mapId,
      ...nodeData
    });
    return response.data;
  },

  async update(id, nodeData) {
    const response = await api.put(`/nodes/${id}`, nodeData);
    return response.data;
  },

  async updatePosition(id, x, y) {
    const response = await api.patch(`/nodes/${id}/position`, { xPosition: x, yPosition: y });
    return response.data;
  },

  async delete(id) {
    const response = await api.delete(`/nodes/${id}`);
    return response.data;
  },

  async getById(id) {
    const response = await api.get(`/nodes/${id}`);
    return response.data;
  }
};