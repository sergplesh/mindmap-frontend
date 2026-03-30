import React, { useState, useEffect } from 'react';
import './MapFormModal.css';

const MapFormModal = ({ isOpen, onClose, onSave, map, mode = 'create' }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('code');
  const [noIcon, setNoIcon] = useState(true);

  const icons = [
    { name: 'code', icon: 'code', label: 'Программирование' },
    { name: 'functions', icon: 'functions', label: 'Математика' },
    { name: 'palette', icon: 'palette', label: 'Дизайн' },
    { name: 'translate', icon: 'translate', label: 'Языки' },
    { name: 'science', icon: 'science', label: 'Наука' },
  ];

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && map) {
        setTitle(map.title || '');
        setDescription(map.description || '');
        setNoIcon(!map.emoji);
        setSelectedIcon(map.emoji || 'code');
      } else {
        setTitle('');
        setDescription('');
        setNoIcon(true);
        setSelectedIcon('code');
      }
    }
  }, [isOpen, mode, map]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (title.trim()) {
      onSave({
        id: map?.id,
        title: title.trim(),
        description: description.trim(),
        emoji: noIcon ? null : selectedIcon
      });
    }
  };

  const handleNoIconChange = (e) => {
    const checked = e.target.checked;
    setNoIcon(checked);
    if (!checked && !selectedIcon) {
      setSelectedIcon('code');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="map-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'create' ? 'Новая карта' : 'Редактирование'}</h2>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-content">
            <div className="form-group">
              <label htmlFor="title">Название</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введите название карты"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Описание</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Опишите содержание карты..."
                rows="4"
              />
            </div>

            <div className="icon-toggle">
              <label className="icon-toggle-label">
                <input
                  type="checkbox"
                  checked={noIcon}
                  onChange={handleNoIconChange}
                />
                <span>Без иконки</span>
              </label>
            </div>

            {!noIcon && (
              <div className="icon-selector">
                <label>Тематика</label>
                <div className="icon-grid">
                  {icons.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      className={`icon-btn ${selectedIcon === item.name ? 'active' : ''}`}
                      onClick={() => setSelectedIcon(item.name)}
                      title={item.label}
                    >
                      <span className="material-icons">{item.icon}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className="save-btn"
              disabled={!title.trim()}
            >
              {mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MapFormModal;
