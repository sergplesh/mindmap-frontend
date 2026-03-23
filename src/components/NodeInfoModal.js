import React from 'react';
import './NodeInfoModal.css';

const NodeInfoModal = ({ isOpen, onClose, node, userRole }) => {
  if (!isOpen || !node) return null;

  const getTypeColor = () => {
    if (node.typeColor) return node.typeColor;
    return '#3b82f6';
  };

  return (
    <div className="node-info-overlay" onClick={onClose}>
      <div className="node-info-modal" onClick={e => e.stopPropagation()}>
        <div className="node-info-header" style={{ backgroundColor: getTypeColor() }}>
          <h3>
            <span className="material-icons">info</span>
            Информация об узле
          </h3>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="node-info-content">
          <div className="info-section">
            <label>Название</label>
            <div className="info-value">{node.title || '—'}</div>
          </div>

          {node.description && (
            <div className="info-section">
              <label>Описание</label>
              <div className="info-value description">{node.description}</div>
            </div>
          )}

          <div className="info-section">
            <label>Тип узла</label>
            <div className="info-value">
              <span 
                className="type-badge"
                style={{ backgroundColor: getTypeColor() }}
              >
                {node.typeName || 'Без типа'}
              </span>
            </div>
          </div>

          {node.customFields && Object.keys(node.customFields).length > 0 && (
            <div className="info-section">
              <label>Дополнительная информация</label>
              <div className="custom-fields">
                {Object.entries(node.customFields).map(([key, value]) => (
                  <div key={key} className="custom-field">
                    <span className="field-name">{key}:</span>
                    <span className="field-value">{value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {userRole === 'learner' && node.isUnlocked && (
            <div className="info-section completed-badge">
              <span className="material-icons">check_circle</span>
              <span>Узел успешно открыт</span>
            </div>
          )}
        </div>

        <div className="node-info-footer">
          <button className="close-button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default NodeInfoModal;