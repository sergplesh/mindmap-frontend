import React, { useState } from 'react';
import './MapCard.css';

const MapCard = ({ map, userId, onSelect, onDelete, onEdit }) => {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const isOwner = map.ownerId === userId;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const truncateDescription = (text, maxLength = 120) => {
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleDescriptionClick = (e) => {
    e.stopPropagation();
    setShowFullDescription(true);
  };

  const handleCloseDescription = (e) => {
    e.stopPropagation();
    setShowFullDescription(false);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    onEdit(map);
  };

  return (
    <>
      <div className="map-card" onClick={() => onSelect(map)}>
        <div className="map-card-header">
          <h3 className="map-card-title">{map.title || 'Без названия'}</h3>
          {isOwner && (
            <div className="map-card-actions">
              <button 
                className="map-card-edit"
                onClick={handleEditClick}
                title="Редактировать"
              >
                <span className="material-icons">edit</span>
              </button>
              <button 
                className="map-card-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(map.id);
                }}
                title="Удалить"
              >
                <span className="material-icons">delete</span>
              </button>
            </div>
          )}
        </div>
        
        <div className="map-card-content">
          {map.description && (
            <div className="map-card-description-container">
              <p className="map-card-description">
                {truncateDescription(map.description)}
              </p>
              {map.description.length > 120 && (
                <button 
                  className="show-more-btn"
                  onClick={handleDescriptionClick}
                >
                  подробнее
                </button>
              )}
            </div>
          )}
        </div>

        <div className="map-card-footer">
          <div className="footer-left">
            {map.emoji ? (
              <div className="map-card-icon" title={
                map.emoji === 'code' ? 'Программирование' :
                map.emoji === 'functions' ? 'Математика' :
                map.emoji === 'palette' ? 'Дизайн' :
                map.emoji === 'translate' ? 'Языки' :
                map.emoji === 'science' ? 'Наука' : ''
              }>
                <span className="material-icons">{map.emoji}</span>
              </div>
            ) : (
              <div className="map-card-icon no-icon" title="Без тематики">
                <span className="material-icons">circle</span>
              </div>
            )}
            <span className="map-card-date">{formatDate(map.createdAt)}</span>
          </div>
          <div className="footer-right">
            <div className="stat" title="Узлы">
              <span className="material-icons">device_hub</span>
              <span>{map.nodesCount || 0}</span>
            </div>
            <div className="stat" title="Связи">
              <span className="material-icons">share</span>
              <span>{map.edgesCount || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно для полного описания */}
      {showFullDescription && map.description && (
        <div className="description-modal-overlay" onClick={handleCloseDescription}>
          <div className="description-modal" onClick={e => e.stopPropagation()}>
            <div className="description-modal-header">
              <h3>{map.title}</h3>
              <button className="close-btn" onClick={handleCloseDescription}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="description-modal-content">
              <p>{map.description}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MapCard;