import React, { useState, useEffect } from 'react';
import { questionsService } from '../services/questionsService';
import './QuestionManagerModal.css';

const buildEmptyOption = () => ({ id: null, text: '', isCorrect: false });

const QuestionManagerModal = ({ isOpen, onClose, node, onQuestionsUpdate }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [formData, setFormData] = useState({
    text: '',
    type: 'single_choice',
    options: [buildEmptyOption(), buildEmptyOption()]
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && node?.id) {
      loadQuestions();
    } else {
      setShowForm(false);
      setEditingQuestion(null);
      setError('');
    }
  }, [isOpen, node?.id]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await questionsService.getByNode(node.id);
      setQuestions(data || []);
    } catch (err) {
      console.error('Ошибка загрузки вопросов:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      text: '',
      type: 'single_choice',
      options: [buildEmptyOption(), buildEmptyOption()]
    });
    setEditingQuestion(null);
    setError('');
  };

  const handleAddClick = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditClick = (question) => {
    setEditingQuestion(question);
    setFormData({
      text: question.questionText,
      type: question.questionType,
      options: question.answerOptions.map(opt => ({
        id: opt.id ?? null,
        text: opt.optionText,
        isCorrect: opt.isCorrect
      }))
    });
    setShowForm(true);
    setError('');
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingQuestion(null);
    setError('');
  };

  const handleOptionChange = (index, value) => {
    setFormData(prev => {
      const options = prev.options.map((option, optionIndex) => (
        optionIndex === index
          ? { ...option, text: value }
          : option
      ));
      return { ...prev, options };
    });
  };

  const handleOptionCorrectChange = (index) => {
    setFormData(prev => {
      const options = prev.options.map((option, optionIndex) => {
        if (prev.type === 'single_choice') {
          return {
            ...option,
            isCorrect: optionIndex === index
          };
        }

        if (optionIndex === index) {
          return {
            ...option,
            isCorrect: !option.isCorrect
          };
        }

        return option;
      });

      return { ...prev, options };
    });
  };

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, buildEmptyOption()]
    }));
  };

  const removeOption = (index) => {
    if (formData.options.length <= 2) return;
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    if (!formData.text.trim()) {
      setError('Введите текст вопроса');
      return false;
    }

    const validOptions = formData.options.filter(opt => opt.text.trim());
    if (validOptions.length < 2) {
      setError('Добавьте минимум 2 варианта ответа');
      return false;
    }

    const hasCorrect = validOptions.some(opt => opt.isCorrect);
    if (!hasCorrect) {
      setError('Укажите правильный ответ(ы)');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const preparedOptions = formData.options
        .filter(opt => opt.text.trim())
        .map(opt => ({
          id: opt.id ?? undefined,
          optionText: opt.text.trim(),
          isCorrect: opt.isCorrect
        }));

      if (editingQuestion) {
        // Обновление существующего вопроса
        await questionsService.update(editingQuestion.id, {
          questionText: formData.text.trim(),
          questionType: formData.type,
          answerOptions: preparedOptions
        });
      } else {
        // Создание нового вопроса
        await questionsService.create({
          nodeId: node.id,
          questionText: formData.text.trim(),
          questionType: formData.type,
          answerOptions: preparedOptions
        });
      }

      await loadQuestions();
      handleCancel();
      if (onQuestionsUpdate) onQuestionsUpdate();
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка сохранения вопроса');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId) => {
    if (!window.confirm('Удалить этот вопрос?')) return;

    setLoading(true);
    try {
      await questionsService.delete(questionId);
      await loadQuestions();
      if (onQuestionsUpdate) onQuestionsUpdate();
    } catch (err) {
      alert('Ошибка удаления вопроса');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="question-manager-overlay" onClick={onClose}>
      <div className="question-manager-modal" onClick={e => e.stopPropagation()}>
        <div className="question-manager-header">
          <h3>Управление вопросами</h3>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="question-manager-content">
          {!showForm ? (
            <>
              <div className="question-manager-toolbar">
                <button className="add-question-btn" onClick={handleAddClick}>
                  <span className="material-icons">add</span>
                  Новый вопрос
                </button>
              </div>

              {loading ? (
                <div className="loading-spinner">Загрузка...</div>
              ) : questions.length === 0 ? (
                <div className="empty-state">
                  <span className="material-icons">help_outline</span>
                  <p>Нет вопросов</p>
                  <p className="empty-hint">Создайте первый вопрос для этого узла</p>
                </div>
              ) : (
                <div className="questions-list">
                  {questions.map((question, idx) => (
                    <div key={question.id} className="question-item">
                      <div className="question-item-header">
                        <span className="question-number">Вопрос {idx + 1}</span>
                        <span className="question-type-badge">
                          {question.questionType === 'single_choice' ? 'Один ответ' : 'Несколько ответов'}
                        </span>
                        <div className="question-item-actions">
                          <button 
                            className="icon-btn edit"
                            onClick={() => handleEditClick(question)}
                            title="Редактировать"
                          >
                            <span className="material-icons">edit</span>
                          </button>
                          <button 
                            className="icon-btn delete"
                            onClick={() => handleDelete(question.id)}
                            title="Удалить"
                          >
                            <span className="material-icons">delete</span>
                          </button>
                        </div>
                      </div>
                      <div className="question-text">{question.questionText}</div>
                      <div className="options-preview">
                        {question.answerOptions?.map(opt => (
                          <div 
                            key={opt.id} 
                            className={`option-preview ${opt.isCorrect ? 'correct' : ''}`}
                          >
                            <span className="material-icons">
                              {opt.isCorrect ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            <span>{opt.optionText}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="question-form">
              <h4>{editingQuestion ? 'Редактировать вопрос' : 'Новый вопрос'}</h4>
              
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label>Текст вопроса</label>
                <input
                  type="text"
                  value={formData.text}
                  onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Введите вопрос"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Тип вопроса</label>
                <select
                  value={formData.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    setFormData(prev => {
                      const options = prev.options.map(opt => ({ ...opt, isCorrect: false }));
                      return { ...prev, type, options };
                    });
                  }}
                >
                  <option value="single_choice">Один правильный ответ</option>
                  <option value="multiple_choice">Несколько правильных ответов</option>
                </select>
              </div>

              <div className="form-group">
                <label>Варианты ответов</label>
                {formData.options.map((opt, index) => (
                  <div key={index} className="option-row">
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Вариант ${index + 1}`}
                    />
                    <button
                      className={`correct-toggle ${opt.isCorrect ? 'active' : ''}`}
                      onClick={() => handleOptionCorrectChange(index)}
                      title={opt.isCorrect ? 'Правильный ответ' : 'Сделать правильным'}
                    >
                      <span className="material-icons">
                        {opt.isCorrect ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </button>
                    {formData.options.length > 2 && (
                      <button
                        className="remove-option"
                        onClick={() => removeOption(index)}
                        title="Удалить вариант"
                      >
                        <span className="material-icons">remove_circle</span>
                      </button>
                    )}
                  </div>
                ))}
                
                <button className="add-option-btn" onClick={addOption}>
                  <span className="material-icons">add</span>
                  Добавить вариант
                </button>
              </div>

              <div className="form-actions">
                <button className="cancel-btn" onClick={handleCancel}>
                  Отмена
                </button>
                <button 
                  className="save-btn" 
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? 'Сохранение...' : (editingQuestion ? 'Сохранить' : 'Создать')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionManagerModal;
