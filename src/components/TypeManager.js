import React, { useCallback, useEffect, useState } from 'react';
import { useCustomTypesService } from '../hooks/useCustomTypesService';
import './TypeManager.css';

const NODE_ICON_OPTIONS = [
  { value: '', label: 'Без иконки' },
  { value: 'psychology', label: 'Психология' },
  { value: 'description', label: 'Документ' },
  { value: 'functions', label: 'Формула' },
  { value: 'route', label: 'Маршрут' },
  { value: 'code', label: 'Код' },
  { value: 'link', label: 'Ссылка' },
  { value: 'school', label: 'Обучение' },
  { value: 'science', label: 'Наука' },
  { value: 'lightbulb', label: 'Идея' },
  { value: 'article', label: 'Статья' },
  { value: 'menu_book', label: 'Книга' },
  { value: 'star', label: 'Звезда' },
  { value: 'calculate', label: 'Теорема' }
];

function TypeManager({ mapId, isOwner, category, onClose, onTypesChange }) {
  const customTypesService = useCustomTypesService();
  const [customTypes, setCustomTypes] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [newType, setNewType] = useState({
    name: '',
    color: category === 'node' ? '#3b82f6' : '#666666',
    shape: 'rect',
    style: 'solid',
    label: '',
    isBidirectional: false,
    icon: '',
    size: 'medium',
    customFields: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [fieldForm, setFieldForm] = useState({
    name: '',
    type: 'text',
    required: false,
    defaultValue: '',
    placeholder: '',
    validation: ''
  });

  const isNodeCategory = category === 'node';
  
  // Шаблоны типов узлов
  const loadTypes = useCallback(async () => {
    try {
      const data = await customTypesService.getTypes(mapId, category);
      setCustomTypes(data.custom || []);
    } catch (error) {
      console.error('Ошибка загрузки типов:', error);
      setError('Не удалось загрузить типы');
    }
  }, [category, customTypesService, mapId]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const handleCreateType = async () => {
    if (!newType.name.trim()) {
      setError('Введите название типа');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const typeData = {
        ...newType,
        icon: newType.icon || null,
        customFields: newType.customFields.map(field => ({
          ...field,
          options: field.options ? field.options.split(',').map(o => o.trim()) : undefined
        }))
      };

      if (editingType) {
        await customTypesService.updateType(mapId, category, editingType.id, typeData);
      } else {
        await customTypesService.createType(mapId, category, typeData);
      }
      
      setShowCreateForm(false);
      setEditingType(null);
      resetForm();
      
      await loadTypes();
      if (onTypesChange) await onTypesChange(category);
    } catch (error) {
      setError(error.response?.data?.message || 'Ошибка создания типа');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteType = async (typeId) => {
    const confirmMessage = isNodeCategory
      ? 'Удалить этот тип? Он исчезнет из всех узлов, где используется.'
      : 'Удалить этот тип? Он исчезнет из всех связей, где используется.';
    if (!window.confirm(confirmMessage)) return;

    try {
      await customTypesService.deleteType(mapId, category, typeId);
      await loadTypes();
      if (onTypesChange) await onTypesChange(category);
    } catch (error) {
      alert(error.response?.data?.message || 'Ошибка удаления типа');
    }
  };

  const startEditing = (type) => {
    setEditingType(type);
    setNewType({
      name: type.name,
      color: type.color || (isNodeCategory ? '#3b82f6' : '#666666'),
      shape: type.shape || 'rect',
      style: type.style || 'solid',
      label: type.label || '',
      isBidirectional: Boolean(type.isBidirectional),
      icon: type.icon || '',
      size: type.size || 'medium',
      customFields: type.customFields || []
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setNewType({
      name: '',
      color: isNodeCategory ? '#3b82f6' : '#666666',
      shape: 'rect',
      style: 'solid',
      label: '',
      isBidirectional: false,
      icon: '',
      size: 'medium',
      customFields: []
    });
    setError('');
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingType(null);
    resetForm();
  };

  const addCustomField = () => {
    if (!fieldForm.name.trim()) {
      alert('Введите название поля');
      return;
    }
    
    const newField = {
      id: Date.now(),
      name: fieldForm.name,
      type: fieldForm.type,
      required: fieldForm.required,
      defaultValue: fieldForm.defaultValue,
      placeholder: fieldForm.placeholder,
      validation: fieldForm.validation,
      options: fieldForm.type === 'select' ? fieldForm.options?.split(',') : undefined
    };
    
    setNewType(prev => ({
      ...prev,
      customFields: [...prev.customFields, newField]
    }));
    
    setShowFieldModal(false);
    resetFieldForm();
  };

  const editCustomField = (field) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      type: field.type,
      required: field.required,
      defaultValue: field.defaultValue || '',
      placeholder: field.placeholder || '',
      validation: field.validation || '',
      options: field.options ? field.options.join(', ') : ''
    });
    setShowFieldModal(true);
  };

  const removeCustomField = (fieldId) => {
    setNewType(prev => ({
      ...prev,
      customFields: prev.customFields.filter(f => f.id !== fieldId)
    }));
  };

  const resetFieldForm = () => {
    setFieldForm({
      name: '',
      type: 'text',
      required: false,
      defaultValue: '',
      placeholder: '',
      validation: ''
    });
    setEditingField(null);
  };

  const getShapeStyle = (shape, size = 'medium') => {
    const sizes = {
      small: { width: '100px', height: '60px', fontSize: '12px' },
      medium: { width: '140px', height: '80px', fontSize: '14px' },
      large: { width: '180px', height: '100px', fontSize: '16px' }
    };
    
    const baseSize = sizes[size] || sizes.medium;
    
    switch(shape) {
      case 'oval':
        return { 
          borderRadius: '50%', 
          width: baseSize.width, 
          height: baseSize.height,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        };
      case 'diamond':
        return {
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          width: baseSize.width,
          height: baseSize.width,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        };
      case 'rounded':
        return { 
          borderRadius: '12px', 
          width: baseSize.width, 
          height: baseSize.height,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        };
      default:
        return { 
          borderRadius: '4px', 
          width: baseSize.width, 
          height: baseSize.height,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        };
    }
  };

  const getEdgeTypeIcon = (type) => {
    if (type?.isBidirectional) return 'sync_alt';
    if (type?.style === 'dashed') return 'trending_flat';
    if (type?.style === 'dotted') return 'keyboard_double_arrow_right';
    return 'arrow_right_alt';
  };

  const renderForm = () => (
    <div className="create-type-form">
      <h5>{editingType ? 'Редактировать тип' : 'Создать новый тип'}</h5>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group">
        <label>Название типа *</label>
        <input
          type="text"
          value={newType.name}
          onChange={(e) => setNewType({...newType, name: e.target.value})}
          placeholder={`Например: ${isNodeCategory ? 'Важное понятие' : 'связано с'}`}
          autoFocus
        />
      </div>

      {isNodeCategory ? (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Цвет</label>
              <div className="color-input-group">
                <input
                  type="color"
                  value={newType.color}
                  onChange={(e) => setNewType({...newType, color: e.target.value})}
                />
                <input
                  type="text"
                  value={newType.color}
                  onChange={(e) => setNewType({...newType, color: e.target.value})}
                  placeholder="#3b82f6"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Форма</label>
              <select
                value={newType.shape}
                onChange={(e) => setNewType({...newType, shape: e.target.value})}
              >
                <option value="rect">Прямоугольник</option>
                <option value="rounded">Скругленный</option>
                <option value="oval">Овал</option>
                <option value="diamond">Ромб</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Иконка</label>
            <div className="icon-input-group">
              <select
                value={newType.icon || ''}
                onChange={(e) => setNewType({ ...newType, icon: e.target.value })}
              >
                {NODE_ICON_OPTIONS.map((iconOption) => (
                  <option key={iconOption.value || 'none'} value={iconOption.value}>
                    {iconOption.label}
                  </option>
                ))}
              </select>
              <span className="icon-preview">
                {newType.icon ? (
                  <span className="material-icons">{newType.icon}</span>
                ) : (
                  <span className="icon-preview-empty">-</span>
                )}
              </span>
            </div>
          </div>

          {/* Кастомные поля */}
          <div className="custom-fields-section">
            <div className="section-header">
              <label>Кастомные поля</label>
              <button
                type="button"
                className="add-field-btn"
                onClick={() => setShowFieldModal(true)}
              >
                <span className="material-icons">add</span>
                Добавить поле
              </button>
            </div>
            
            {newType.customFields.length === 0 ? (
              <div className="empty-fields">
                <span className="material-icons">add_box</span>
                <p>Добавьте кастомные поля для этого типа узлов</p>
                <small>Например: "Определение", "Примеры", "Сложность"</small>
              </div>
            ) : (
              <div className="fields-list">
                {newType.customFields.map(field => (
                  <div key={field.id} className="field-item">
                    <div className="field-info">
                      <span className="field-name">{field.name}</span>
                      <span className="field-type">{field.type}</span>
                      {field.required && <span className="required-badge">Обязательное</span>}
                    </div>
                    <div className="field-actions">
                      <button
                        className="edit-field"
                        onClick={() => editCustomField(field)}
                        title="Редактировать"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                      <button
                        className="remove-field"
                        onClick={() => removeCustomField(field.id)}
                        title="Удалить"
                      >
                        <span className="material-icons">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Цвет линии</label>
              <div className="color-input-group">
                <input
                  type="color"
                  value={newType.color}
                  onChange={(e) => setNewType({...newType, color: e.target.value})}
                />
                <input
                  type="text"
                  value={newType.color}
                  onChange={(e) => setNewType({...newType, color: e.target.value})}
                  placeholder="#666666"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Стиль линии</label>
              <select
                value={newType.style}
                onChange={(e) => setNewType({...newType, style: e.target.value})}
              >
                <option value="solid">Сплошная ————</option>
                <option value="dashed">Пунктирная - - - -</option>
                <option value="dotted">Точечная · · · ·</option>
              </select>
            </div>

            <div className="form-group">
              <label>Направление</label>
              <select
                value={newType.isBidirectional ? 'bidirectional' : 'unidirectional'}
                onChange={(e) => setNewType({
                  ...newType,
                  isBidirectional: e.target.value === 'bidirectional'
                })}
              >
                <option value="unidirectional">Однонаправленная</option>
                <option value="bidirectional">Двунаправленная</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Подпись на связи</label>
            <input
              type="text"
              value={newType.label}
              onChange={(e) => setNewType({...newType, label: e.target.value})}
              placeholder="например: связано с"
            />
            <small className="field-hint">Текст, который будет отображаться на связи</small>
          </div>
        </>
      )}

      <div className="preview-section">
        <h6>Предпросмотр:</h6>
        {isNodeCategory ? (
          <div 
            className="node-preview"
            style={{ 
              ...getShapeStyle(newType.shape),
              backgroundColor: newType.color,
              color: getContrastColor(newType.color),
              gap: '8px',
              margin: '10px auto'
            }}
          >
            {newType.icon && <span className="material-icons">{newType.icon}</span>}
            <span>{newType.name || 'Название типа'}</span>
          </div>
        ) : (
          <div className="edge-preview">
            <div 
              style={{
                borderBottom: `3px ${newType.style} ${newType.color}`,
                width: '150px',
                marginBottom: '8px'
              }}
            />
            <span style={{ color: newType.color, fontSize: '14px', marginBottom: '4px' }}>
              {newType.isBidirectional ? '↔' : '→'}
            </span>
            {newType.label && (
              <span style={{ color: newType.color, fontSize: '12px' }}>
                {newType.label}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="form-actions">
        <button 
          className="save-btn"
          onClick={handleCreateType}
          disabled={loading}
        >
          {loading ? 'Сохранение...' : (editingType ? 'Сохранить' : 'Создать')}
        </button>
        <button 
          className="cancel-btn"
          onClick={cancelForm}
        >
          Отмена
        </button>
      </div>
    </div>
  );

  const renderFieldModal = () => (
    <div className="field-modal-overlay" onClick={() => setShowFieldModal(false)}>
      <div className="field-modal" onClick={e => e.stopPropagation()}>
        <div className="field-modal-header">
          <h4>{editingField ? 'Редактировать поле' : 'Добавить поле'}</h4>
          <button className="close-btn" onClick={() => setShowFieldModal(false)}>
            <span className="material-icons">close</span>
          </button>
        </div>
        
        <div className="field-modal-content">
          <div className="form-group">
            <label>Название поля *</label>
            <input
              type="text"
              value={fieldForm.name}
              onChange={(e) => setFieldForm({...fieldForm, name: e.target.value})}
              placeholder="Например: Определение"
            />
          </div>
          
          <div className="form-group">
            <label>Тип поля</label>
            <select
              value={fieldForm.type}
              onChange={(e) => setFieldForm({...fieldForm, type: e.target.value})}
            >
              <option value="text">Текст (одна строка)</option>
              <option value="textarea">Текст (много строк)</option>
              <option value="number">Число</option>
              <option value="date">Дата</option>
              <option value="url">Ссылка</option>
              <option value="select">Выпадающий список</option>
              <option value="checkbox">Чекбокс</option>
            </select>
          </div>
          
          {fieldForm.type === 'select' && (
            <div className="form-group">
              <label>Варианты (через запятую)</label>
              <input
                type="text"
                value={fieldForm.options}
                onChange={(e) => setFieldForm({...fieldForm, options: e.target.value})}
                placeholder="Вариант 1, Вариант 2, Вариант 3"
              />
            </div>
          )}
          
          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={fieldForm.required}
                onChange={(e) => setFieldForm({...fieldForm, required: e.target.checked})}
              />
              Обязательное поле
            </label>
          </div>
          
          <div className="form-group">
            <label>Плейсхолдер</label>
            <input
              type="text"
              value={fieldForm.placeholder}
              onChange={(e) => setFieldForm({...fieldForm, placeholder: e.target.value})}
              placeholder="Подсказка для ввода"
            />
          </div>
          
          <div className="form-group">
            <label>Значение по умолчанию</label>
            <input
              type="text"
              value={fieldForm.defaultValue}
              onChange={(e) => setFieldForm({...fieldForm, defaultValue: e.target.value})}
              placeholder="Значение по умолчанию"
            />
          </div>
        </div>
        
        <div className="field-modal-footer">
          <button className="cancel-btn" onClick={() => setShowFieldModal(false)}>
            Отмена
          </button>
          <button className="save-btn" onClick={addCustomField}>
            {editingField ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="type-manager">
        <div className="type-manager-header">
          <h3>
            {isNodeCategory ? (
              <>
                <span className="material-icons">category</span>
                Типы узлов
              </>
            ) : (
              <>
                <span className="material-icons">timeline</span>
                Типы связей
              </>
            )}
          </h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="type-manager-content">
          {!isNodeCategory && (
            <div className="info-message">
              <span className="material-icons">auto_awesome</span>
              <span>Создавайте свои связи.</span>
            </div>
          )}

          {/* Пользовательские типы */}
          {isOwner && (
            <div className="types-section">
              <div className="section-header">
                <h4>Мои типы</h4>
                <button 
                  className="add-type-btn"
                  onClick={() => setShowCreateForm(true)}
                >
                  <span className="material-icons">add</span>
                  Создать тип
                </button>
              </div>

              {showCreateForm && renderForm()}

              <div className="types-grid">
                {customTypes.length === 0 && !showCreateForm ? (
                  <div className="empty-types">
                    <span className="material-icons">{isNodeCategory ? 'category' : 'timeline'}</span>
                    <p>У вас пока нет своих типов</p>
                    <button 
                      className="create-first-btn"
                      onClick={() => setShowCreateForm(true)}
                    >
                      Создать первый тип
                    </button>
                  </div>
                ) : (
                  customTypes.map(type => (
                    <div key={type.id} className="type-card custom">
                      {isNodeCategory ? (
                        <>
                          <div 
                            className="color-preview"
                            style={{ backgroundColor: type.color, ...getShapeStyle(type.shape) }}
                          />
                          <div className="type-info">
                            <span className="type-name">{type.name}</span>
                            {type.icon && (
                              <span className="material-icons type-icon">{type.icon}</span>
                            )}
                            {type.customFields && type.customFields.length > 0 && (
                              <span className="fields-count" title={`${type.customFields.length} кастомных полей`}>
                                {type.customFields.length} поля
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="edge-type-badge" style={{ backgroundColor: type.color || '#666666' }}>
                            <span className="material-icons">{getEdgeTypeIcon(type)}</span>
                          </div>
                          <div className="type-info">
                            <span className="type-name">{type.name}</span>
                            {type.label && <span className="type-label">{type.label}</span>}
                            <span className="type-label">
                              {type.isBidirectional ? 'двунаправленная' : 'однонаправленная'}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="type-actions">
                        <button 
                          className="edit-type"
                          onClick={() => startEditing(type)}
                          title="Редактировать"
                        >
                          <span className="material-icons">edit</span>
                        </button>
                        <button 
                          className="delete-type"
                          onClick={() => handleDeleteType(type.id)}
                          title="Удалить"
                        >
                          <span className="material-icons">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {!isOwner && (
            <div className="info-message">
              <span className="material-icons">info</span>
              <span>Только владелец карты может создавать свои типы</span>
            </div>
          )}
        </div>
      </div>

      {showFieldModal && renderFieldModal()}
    </>
  );
}

function getContrastColor(hexColor) {
  if (!hexColor) return '#333333';
  const color = hexColor.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#1a1a1a' : '#ffffff';
}

export default TypeManager;
