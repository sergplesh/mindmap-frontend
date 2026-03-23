import api from './api';

export const edgesService = {
  async create(mapIdOrData, sourceNodeId, targetNodeId, typeId) {
    const payload = typeof mapIdOrData === 'object' && mapIdOrData !== null
      ? mapIdOrData
      : {
          mapId: mapIdOrData,
          sourceNodeId,
          targetNodeId,
          typeId
        };
    const response = await api.post('/edges', payload);
    return response.data;
  },

  async update(id, updateData) {
    const payload = typeof updateData === 'object' && updateData !== null
      ? updateData
      : { typeId: updateData };
    const response = await api.put(`/edges/${id}`, payload);
    return response.data;
  },

  async delete(id) {
    const response = await api.delete(`/edges/${id}`);
    return response.data;
  },

  async getById(id) {
    const response = await api.get(`/edges/${id}`);
    return response.data;
  }
};
