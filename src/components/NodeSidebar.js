import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNodesService } from '../hooks/useNodesService';
import { useQuestionsService } from '../hooks/useQuestionsService';
import { useCustomTypesService } from '../hooks/useCustomTypesService';
import QuestionManagerModal from './QuestionManagerModal';
import './NodeSidebar.css';

function NodeSidebar({
  node: initialNode,
  onClose,
  onDelete,
  isOwner,
  userRole,
  systemNodeTypes = [],
  customNodeTypes = [],
  onTypesUpdate,
  onRefreshMap,
  onEnsureNodeSaved,
  startEditing = false,
  onDetach,
  isDraggable,
  onAddSubtopic,
}) {
  const nodesService = useNodesService();
  const questionsService = useQuestionsService();
  const customTypesService = useCustomTypesService();
  const [node, setNode] = useState(initialNode);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [typeSelection, setTypeSelection] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showQuestionManager, setShowQuestionManager] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState(null);
  const [testAnswers, setTestAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [customFields, setCustomFields] = useState({});
  const [selectedTypeDetails, setSelectedTypeDetails] = useState(null);
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [activeFieldsTab, setActiveFieldsTab] = useState('description');
  const titleInputRef = useRef(null);

  const isLearner = userRole === 'learner';
  const isValidNodeId = useCallback((value) => (
    value !== undefined &&
    value !== null &&
    (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))
  ), []);
  const isRootNode = (initialNode?.level ?? node?.level) === 0;
  const canDeleteNode = isOwner && !isRootNode && isValidNodeId(node?.id) && !saving;

  const loadTypeDetails = useCallback(async (typeId, isCustom) => {
    try {
      if (isCustom) {
        if (!node?.mapId) {
          console.warn('mapId не найден, пропускаем загрузку деталей типа');
          return;
        }
        const typeDetails = await customTypesService.getTypeDetails(node.mapId, 'node', typeId);
        setSelectedTypeDetails(typeDetails);
      } else {
        const systemType = systemNodeTypes.find((type) => type.id === typeId);
        setSelectedTypeDetails(systemType);
      }
    } catch (loadError) {
      console.error('Ошибка загрузки деталей типа:', loadError);
    }
  }, [customTypesService, node?.mapId, systemNodeTypes]);

  useEffect(() => {
    const loadNodeData = async () => {
      if (!initialNode) {
        setLoading(false);
        return;
      }

      if (!isValidNodeId(initialNode.id)) {
        setNode(initialNode);
        setTitle(initialNode.title || '');
        setDescription(initialNode.description || '');
        const selection = initialNode?.customTypeId
          ? `custom-${initialNode.customTypeId}`
          : initialNode?.typeId
            ? `sys-${initialNode.typeId}`
            : '';
        setTypeSelection(selection);

        if (initialNode.customFields) {
          setCustomFields(initialNode.customFields);
        }

        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const freshNode = await nodesService.getById(initialNode.id);
        setNode(freshNode);

        setTitle(freshNode.title || '');
        setDescription(freshNode.description || '');
        const selection = freshNode?.customTypeId
          ? `custom-${freshNode.customTypeId}`
          : freshNode?.typeId
            ? `sys-${freshNode.typeId}`
            : '';
        setTypeSelection(selection);

        if (freshNode?.customTypeId && freshNode?.mapId) {
          await loadTypeDetails(freshNode.customTypeId, true);
        } else if (freshNode?.typeId) {
          await loadTypeDetails(freshNode.typeId, false);
        }

        if (freshNode.customFields) {
          setCustomFields(freshNode.customFields);
        }
      } catch (loadError) {
        console.error('Ошибка загрузки данных узла:', loadError);
      } finally {
        setLoading(false);
      }
    };

    loadNodeData();
  }, [initialNode, isValidNodeId, loadTypeDetails, nodesService]);

  useEffect(() => {
    if (!initialNode) return;

    setNode((prev) => {
      if (!prev || String(prev.id) !== String(initialNode.id)) {
        return prev;
      }

      return {
        ...prev,
        ...initialNode
      };
    });

    setTitle((prev) => {
      if (document.activeElement === titleInputRef.current) {
        return prev;
      }

      return initialNode.title ?? prev;
    });

    setDescription((prev) => (
      initialNode.description !== undefined
        ? initialNode.description
        : prev
    ));

    if (initialNode.customFields) {
      setCustomFields(initialNode.customFields);
    }
  }, [
    initialNode,
    initialNode?.id,
    initialNode?.title,
    initialNode?.description,
    initialNode?.customFields
  ]);

  useEffect(() => {
    if (startEditing && titleInputRef.current && !loading) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [startEditing, loading]);

  const loadQuestions = useCallback(async () => {
    if (!node?.id || !isValidNodeId(node.id)) {
      setQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    try {
      const data = await questionsService.getByNode(node.id);
      setQuestions(data || []);
    } catch (loadError) {
      console.error('Ошибка загрузки вопросов:', loadError);
    } finally {
      setLoadingQuestions(false);
    }
  }, [isValidNodeId, node?.id, questionsService]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    const loadTypeOnSelection = async () => {
      if (!typeSelection) {
        setSelectedTypeDetails(null);
        return;
      }

      const [source, id] = typeSelection.split('-');
      const typeId = parseInt(id, 10);

      if (source === 'custom') {
        await loadTypeDetails(typeId, true);
      } else {
        await loadTypeDetails(typeId, false);
      }
    };

    loadTypeOnSelection();
  }, [typeSelection, loadTypeDetails]);

  const typeLabel = useMemo(() => {
    if (node?.customTypeId) {
      const custom = customNodeTypes.find((type) => type.id === node.customTypeId);
      return custom?.name || 'Без типа';
    }
    if (node?.typeId) {
      const system = systemNodeTypes.find((type) => type.id === node.typeId);
      return system?.name || 'Без типа';
    }
    return 'Без типа';
  }, [node?.customTypeId, node?.typeId, customNodeTypes, systemNodeTypes]);

  const handleSave = async () => {
    if (!isOwner) return;
    if (!title.trim()) {
      setError('Введите название узла');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let persistedNode = node;

      if (!isValidNodeId(node?.id)) {
        if (!onEnsureNodeSaved) {
          setError('Не удалось сохранить новый узел. Попробуйте еще раз.');
          return;
        }

        persistedNode = await onEnsureNodeSaved(node);
        if (!persistedNode?.id || !isValidNodeId(persistedNode.id)) {
          setError('Не удалось сохранить новый узел. Попробуйте еще раз.');
          return;
        }

        setNode((prev) => ({
          ...prev,
          ...persistedNode
        }));
      }

      const payload = {
        title: title.trim(),
        description: description?.trim() || '',
        customFields
      };

      if (typeSelection) {
        const [source, id] = typeSelection.split('-');
        if (source === 'custom') {
          payload.customTypeId = parseInt(id, 10);
          payload.typeId = null;
        } else {
          payload.typeId = parseInt(id, 10);
          payload.customTypeId = null;
        }
      } else {
        payload.typeId = null;
        payload.customTypeId = null;
      }

      await nodesService.update(persistedNode.id, payload);

      const updatedNode = {
        ...persistedNode,
        title: title.trim(),
        description: description?.trim() || '',
        typeId: payload.typeId,
        customTypeId: payload.customTypeId,
        customFields
      };
      setNode(updatedNode);

      if (onTypesUpdate) onTypesUpdate();
      if (onRefreshMap) await onRefreshMap({ preserveView: true });
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Ошибка сохранения узла');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setCustomFields((prev) => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const renderCustomFieldsForm = () => {
    if (!selectedTypeDetails?.customFields || selectedTypeDetails.customFields.length === 0) {
      return <p className="empty-message">Дополнительные поля отсутствуют</p>;
    }

    return selectedTypeDetails.customFields.map((field, index) => (
      <div key={index} className="field">
        <label>
          {field.name}
          {field.required && <span className="required">*</span>}
        </label>

        {field.type === 'text' && (
          <input
            type="text"
            value={customFields[field.name] || field.defaultValue || ''}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            value={customFields[field.name] || field.defaultValue || ''}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            rows="3"
            required={field.required}
          />
        )}

        {field.type === 'number' && (
          <input
            type="number"
            value={customFields[field.name] || field.defaultValue || ''}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        )}

        {field.type === 'date' && (
          <input
            type="date"
            value={customFields[field.name] || field.defaultValue || ''}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            required={field.required}
          />
        )}

        {field.type === 'url' && (
          <input
            type="url"
            value={customFields[field.name] || field.defaultValue || ''}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        )}

        {field.type === 'select' && (
          <select
            value={customFields[field.name] || field.defaultValue || ''}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            required={field.required}
          >
            <option value="">Выберите...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        )}

        {field.type === 'checkbox' && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={customFields[field.name] || field.defaultValue === 'true' || false}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.checked)}
            />
            {field.placeholder || 'Да'}
          </label>
        )}

        {field.validation && (
          <small className="field-hint">{field.validation}</small>
        )}
      </div>
    ));
  };

  const renderQuestionsSummary = () => {
    if (loadingQuestions) {
      return <p className="loading-text">Загрузка вопросов...</p>;
    }

    if (questions.length === 0) {
      return (
        <div className="empty-questions">
          <span className="material-icons">help_outline</span>
          <p>Нет вопросов</p>
          <button
            className="create-first-question-btn"
            onClick={() => setShowQuestionManager(true)}
          >
            <span className="material-icons">add</span>
            Создать первый вопрос
          </button>
        </div>
      );
    }

    return (
      <div className="questions-summary">
        <p>Всего вопросов: {questions.length}</p>
        <button
          className="view-questions-link"
          onClick={() => setShowQuestionManager(true)}
        >
          <span className="material-icons">visibility</span>
          Изменить
        </button>
      </div>
    );
  };

  const handleVerify = async () => {
    if (!node?.id) return;
    if (!questions.length) return;

    const unanswered = questions.some((question) => {
      const answer = testAnswers[question.id];
      if (question.questionType === 'multiple_choice') {
        return !answer || answer.length === 0;
      }
      return !answer;
    });

    if (unanswered) {
      setVerifyMessage({ type: 'error', text: 'Ответьте на все вопросы' });
      return;
    }

    const answersPayload = questions.map((question) => {
      if (question.questionType === 'multiple_choice') {
        return {
          questionId: question.id,
          selectedOptionIds: testAnswers[question.id] || [],
        };
      }
      return {
        questionId: question.id,
        selectedOptionId: testAnswers[question.id],
      };
    });

    try {
      const result = await questionsService.verify(node.id, answersPayload);
      setVerifyMessage({
        type: result.isPassed ? 'success' : 'error',
        text: result.message || (result.isPassed ? 'Узел открыт' : 'Есть ошибки'),
      });
      if (result.isPassed && onRefreshMap) {
        await onRefreshMap();
      }
    } catch (verifyError) {
      setVerifyMessage({ type: 'error', text: 'Ошибка проверки ответов' });
    }
  };

  const renderTestSection = () => {
    if (!questions.length) {
      return <p className="empty-message">Нет вопросов для прохождения</p>;
    }

    return (
      <>
        {questions.map((question) => (
          <div key={question.id} className="test-question">
            <div className="test-question-header">
              <span className="material-icons">help</span>
              <strong>{question.questionText}</strong>
            </div>
            <div className="test-options">
              {question.answerOptions?.map((option) => {
                const isMultiple = question.questionType === 'multiple_choice';
                const current = testAnswers[question.id] || (isMultiple ? [] : null);
                const checked = isMultiple
                  ? current.includes(option.id)
                  : current === option.id;
                return (
                  <label key={option.id} className="test-option">
                    <input
                      type={isMultiple ? 'checkbox' : 'radio'}
                      name={`question-${question.id}`}
                      checked={checked}
                      onChange={(e) => {
                        setTestAnswers((prev) => {
                          const next = { ...prev };
                          if (isMultiple) {
                            const existing = new Set(next[question.id] || []);
                            if (e.target.checked) {
                              existing.add(option.id);
                            } else {
                              existing.delete(option.id);
                            }
                            next[question.id] = Array.from(existing);
                          } else {
                            next[question.id] = option.id;
                          }
                          return next;
                        });
                      }}
                    />
                    <span className="material-icons">
                      {isMultiple
                        ? (checked ? 'check_box' : 'check_box_outline_blank')
                        : (checked ? 'radio_button_checked' : 'radio_button_unchecked')
                      }
                    </span>
                    <span>{option.optionText}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        <div className="test-actions">
          <button className="verify-btn" onClick={handleVerify}>
            <span className="material-icons">check_circle</span>
            Проверить ответы
          </button>
        </div>
        {verifyMessage && (
          <div className={`verify-message ${verifyMessage.type}`}>
            <span className="material-icons">
              {verifyMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{verifyMessage.text}</span>
          </div>
        )}
      </>
    );
  };

  const renderTypePreview = () => {
    if (!selectedTypeDetails) return null;

    const getBorderRadius = () => {
      const shape = selectedTypeDetails.shape || 'rect';
      if (shape === 'circle' || shape === 'oval') return '50%';
      if (shape === 'rounded') return '12px';
      if (shape === 'diamond') return '0';
      return '8px';
    };

    const getClipPath = () => {
      if (selectedTypeDetails.shape === 'diamond') {
        return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      }
      return 'none';
    };

    const getSize = () => {
      const size = selectedTypeDetails.size || 'medium';
      switch (size) {
        case 'small':
          return { width: '100px', height: '60px', fontSize: '12px', padding: '8px' };
        case 'large':
          return { width: '180px', height: '100px', fontSize: '16px', padding: '16px' };
        default:
          return { width: '140px', height: '80px', fontSize: '14px', padding: '12px' };
      }
    };

    const size = getSize();

    return (
      <div className="type-preview">
        <label className="type-preview-label">Предпросмотр:</label>
        <div
          className="type-preview-node"
          style={{
            backgroundColor: selectedTypeDetails.color || '#3b82f6',
            color: getContrastColor(selectedTypeDetails.color || '#3b82f6'),
            borderRadius: getBorderRadius(),
            clipPath: getClipPath(),
            ...size,
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            margin: '10px auto'
          }}
        >
          {selectedTypeDetails.icon && (
            <span className="material-icons" style={{ fontSize: size.fontSize * 1.2 }}>
              {selectedTypeDetails.icon}
            </span>
          )}
          <span>{selectedTypeDetails.name}</span>
        </div>
      </div>
    );
  };

  const getContrastColor = (hexColor) => {
    if (!hexColor) return '#333333';
    const color = hexColor.replace('#', '');
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#1a1a1a' : '#ffffff';
  };

  if (loading) {
    return (
      <div className="node-sidebar">
        <div className="sidebar-header">
          <h3>Загрузка...</h3>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="sidebar-content">
          <p className="empty-message">Загрузка данных узла...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="node-sidebar">
        <div className="sidebar-header">
          <h3>{node?.title || 'Узел'}</h3>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="sidebar-content">
          {!isOwner && (
            <div className={`node-status ${node?.isUnlocked ? 'unlocked' : 'locked'}`}>
              <span className="material-icons">
                {node?.isUnlocked ? 'lock_open' : 'lock'}
              </span>
              <span>{node?.isUnlocked ? 'Узел открыт' : 'Узел закрыт'}</span>
            </div>
          )}

          {isOwner && (
            <>
              <div className="field">
                <label>Название</label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Введите название узла"
                />
              </div>

              <div className="field">
                <label>Тип узла</label>
                <select
                  value={typeSelection}
                  onChange={(e) => setTypeSelection(e.target.value)}
                >
                  <option value="">Без типа</option>
                  <optgroup label="Системные типы">
                    {systemNodeTypes.map((type) => (
                      <option key={`sys-${type.id}`} value={`sys-${type.id}`}>
                        {type.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Мои типы">
                    {customNodeTypes.map((type) => (
                      <option key={`custom-${type.id}`} value={`custom-${type.id}`}>
                        {type.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <button
                className="edit-fields-btn"
                onClick={() => {
                  setActiveFieldsTab('description');
                  setShowFieldsModal(true);
                }}
              >
                <span className="material-icons">tune</span>
                Редактировать поля узла
              </button>

              {renderTypePreview()}

              {error && <div className="error-message">{error}</div>}

              <div className="questions-section">
                <div className="section-header">
                  <h4>Тестовые вопросы</h4>
                  <button
                    className="manage-questions-btn"
                    onClick={() => setShowQuestionManager(true)}
                  >
                    <span className="material-icons">quiz</span>
                    Изменить
                  </button>
                </div>
                {renderQuestionsSummary()}
              </div>
            </>
          )}

          {!isOwner && node?.isUnlocked && (
            <>
              <div className="field">
                <label>Описание</label>
                <div className="field-value">{node.description || '—'}</div>
              </div>
              <div className="field">
                <label>Тип узла</label>
                <div className="field-value">{typeLabel}</div>
              </div>

              {selectedTypeDetails?.customFields && selectedTypeDetails.customFields.length > 0 && (
                <div className="custom-fields-display">
                  <h4>Дополнительная информация</h4>
                  {selectedTypeDetails.customFields.map((field, index) => (
                    <div key={index} className="field">
                      <label>{field.name}</label>
                      <div className="field-value">
                        {node.customFields?.[field.name] || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!isOwner && isLearner && !node?.isUnlocked && node?.hasQuestions && (
            <div className="test-section">
              <h4>Пройти тест</h4>
              {renderTestSection()}
            </div>
          )}
        </div>

        {isOwner && (
          <div className="sidebar-footer">
            <button className="save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              className="delete"
              onClick={onDelete}
              disabled={!canDeleteNode}
              title={
                isRootNode
                  ? 'Центральный узел нельзя удалить'
                  : !isValidNodeId(node?.id)
                    ? 'Узел еще не сохранен'
                    : 'Удалить узел'
              }
            >
              Удалить
            </button>
          </div>
        )}
      </div>

      {showQuestionManager && (
        <QuestionManagerModal
          isOpen={showQuestionManager}
          onClose={() => setShowQuestionManager(false)}
          node={node}
          onQuestionsUpdate={async () => {
            await loadQuestions();
            if (onRefreshMap) {
              await onRefreshMap({
                preserveView: true,
                keepSidebarOpen: true,
                nodeId: node?.id
              });
            }
          }}
        />
      )}

      {showFieldsModal && (
        <div className="node-fields-overlay" onClick={() => setShowFieldsModal(false)}>
          <div className="node-fields-modal" onClick={(e) => e.stopPropagation()}>
            <div className="node-fields-header">
              <h3>Поля узла</h3>
              <button className="close-btn" onClick={() => setShowFieldsModal(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="node-fields-tabs">
              <button
                className={`node-fields-tab ${activeFieldsTab === 'description' ? 'active' : ''}`}
                onClick={() => setActiveFieldsTab('description')}
              >
                Описание
              </button>
              <button
                className={`node-fields-tab ${activeFieldsTab === 'fields' ? 'active' : ''}`}
                onClick={() => setActiveFieldsTab('fields')}
              >
                Поля
              </button>
            </div>

            <div className="node-fields-content">
              {activeFieldsTab === 'description' && (
                <div className="field">
                  <label>Описание</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Введите описание узла"
                    rows="6"
                  />
                </div>
              )}

              {activeFieldsTab === 'fields' && (
                <div className="node-fields-section">
                  {renderCustomFieldsForm()}
                </div>
              )}
            </div>

            <div className="node-fields-footer">
              <button className="close-button" onClick={() => setShowFieldsModal(false)}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default NodeSidebar;
