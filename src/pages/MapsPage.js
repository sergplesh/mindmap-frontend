import React, { useState, useEffect, useCallback } from 'react';
import MapCard from '../components/MapCard';
import MapFormModal from '../components/MapFormModal';
import { useMapsService } from '../hooks/useMapsService';
import './MapsPage.css';

const PAGE_CONFIG = {
  owned: {
    title: 'Мои карты',
    emptyTitle: 'У вас пока нет своих карт',
    emptyDescription: 'Создайте свою первую карту знаний',
    emptyIcon: 'account_tree',
    canCreate: true,
  },
  observer: {
    title: 'Для просмотра',
    emptyTitle: 'Нет карт для просмотра',
    emptyDescription: 'Когда вам дадут доступ как наблюдателю, карты появятся здесь',
    emptyIcon: 'visibility',
    canCreate: false,
  },
  learner: {
    title: 'Для изучения',
    emptyTitle: 'Нет карт для изучения',
    emptyDescription: 'Когда вам дадут доступ как обучающемуся, карты появятся здесь',
    emptyIcon: 'school',
    canCreate: false,
  },
};

const MapsPage = ({ userId, currentPage = 'owned', onSelectMap }) => {
  const mapsService = useMapsService();
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingMap, setEditingMap] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updated');
  const [sortDirection, setSortDirection] = useState('desc');
  const loadMaps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mapsService.getAll();
      setMaps(data);
    } catch (error) {
      console.error('Ошибка загрузки карт:', error);
    } finally {
      setLoading(false);
    }
  }, [mapsService]);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  const handleCreateMap = async (mapData) => {
    try {
      await mapsService.create(mapData.title, mapData.description, mapData.emoji);
      setShowFormModal(false);
      loadMaps();
    } catch (error) {
      alert('Ошибка создания карты');
    }
  };

  const handleEditMap = (map) => {
    setEditingMap(map);
    setFormMode('edit');
    setShowFormModal(true);
  };

  const handleSaveEdit = async (mapData) => {
    try {
      await mapsService.update(mapData.id, mapData.title, mapData.description, mapData.emoji);
      setShowFormModal(false);
      setEditingMap(null);
      loadMaps();
    } catch (error) {
      alert('Ошибка обновления карты');
    }
  };

  const handleSave = (mapData) => {
    if (formMode === 'create') {
      handleCreateMap(mapData);
    } else {
      handleSaveEdit(mapData);
    }
  };

  const handleDeleteMap = async (mapId) => {
    if (!window.confirm('Удалить карту? Это действие нельзя отменить.')) return;
    
    try {
      await mapsService.delete(mapId);
      loadMaps();
    } catch (error) {
      alert('Ошибка удаления карты');
    }
  };

  const currentConfig = PAGE_CONFIG[currentPage] || PAGE_CONFIG.owned;

  const mapsByPage = maps.filter((map) => {
    if (currentPage === 'observer') {
      return map.userRole === 'observer';
    }

    if (currentPage === 'learner') {
      return map.userRole === 'learner';
    }

    return map.ownerId === userId || map.userRole === 'owner';
  });

  const filteredMaps = mapsByPage.filter((map) =>
    map.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (map.description && map.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedMaps = [...filteredMaps].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'created':
        return (new Date(a.createdAt) - new Date(b.createdAt)) * direction;
      case 'title':
        return a.title.localeCompare(b.title) * direction;
      case 'updated':
      default:
        return (new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt)) * direction;
    }
  });

  const handleCloseModal = () => {
    setShowFormModal(false);
    setEditingMap(null);
    setFormMode('create');
  };

  if (loading) {
    return (
      <div className="maps-page-loading">
        <div className="spinner-large"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="maps-page">
      <div className="maps-page-header">
        <div className="header-title">
          <h1>{currentConfig.title}</h1>
          <p className="header-subtitle">
            {mapsByPage.length} {mapsByPage.length === 1 ? 'карта' :
              mapsByPage.length >= 2 && mapsByPage.length <= 4 ? 'карты' : 'карт'}
          </p>
        </div>
        {currentConfig.canCreate && (
          <button
            className="create-map-btn"
            onClick={() => {
              setFormMode('create');
              setEditingMap(null);
              setShowFormModal(true);
            }}
          >
            <span className="material-icons">add</span>
            <span>Создать</span>
          </button>
        )}
      </div>

      <div className="maps-page-toolbar">
        <div className="search-box">
          <span className="material-icons search-icon">search</span>
          <input
            type="text"
            placeholder="Поиск карт..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="clear-search"
              onClick={() => setSearchTerm('')}
            >
              <span className="material-icons">close</span>
            </button>
          )}
        </div>

        <div className="sort-box">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="updated">По обновлению</option>
            <option value="created">По дате создания</option>
            <option value="title">По названию</option>
          </select>
          <button
            type="button"
            className="sort-direction-btn"
            onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            title={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
            aria-label={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
          >
            <span className="material-icons">
              {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
            </span>
          </button>
        </div>
      </div>

      {sortedMaps.length === 0 ? (
        <div className="empty-state">
          <span className="material-icons empty-icon">{currentConfig.emptyIcon}</span>
          <h2>{currentConfig.emptyTitle}</h2>
          <p>{currentConfig.emptyDescription}</p>
          {currentConfig.canCreate && (
            <button
              className="create-first-map"
              onClick={() => {
                setFormMode('create');
                setShowFormModal(true);
              }}
            >
              <span className="material-icons">add</span>
              <span>Создать карту</span>
            </button>
          )}
        </div>
      ) : (
        <div className="maps-grid">
          {sortedMaps.map((map) => (
            <MapCard
              key={map.id}
              map={map}
              userId={userId}
              onSelect={onSelectMap}
              onDelete={handleDeleteMap}
              onEdit={handleEditMap}
            />
          ))}
        </div>
      )}

      <MapFormModal
        isOpen={showFormModal}
        onClose={handleCloseModal}
        onSave={handleSave}
        map={editingMap}
        mode={formMode}
      />
    </div>
  );
};

export default MapsPage;
