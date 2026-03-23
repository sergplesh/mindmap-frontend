import React, { useState, useEffect } from 'react';
import { questionsService } from '../services/questionsService';
import './QuizModal.css';

const QuizModal = ({ isOpen, onClose, node, onSuccess, mapId }) => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (isOpen && node) {
      loadQuestions();
      setAnswers({});
      setResult(null);
      setError('');
    }
  }, [isOpen, node]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await questionsService.getByNode(node.id);
      setQuestions(data || []);
    } catch (err) {
      console.error('Ошибка загрузки вопросов:', err);
      setError('Не удалось загрузить вопросы');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value, isMultiple = false) => {
    setAnswers(prev => {
      if (isMultiple) {
        const current = prev[questionId] || [];
        const newValue = current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value];
        return { ...prev, [questionId]: newValue };
      } else {
        return { ...prev, [questionId]: value };
      }
    });
  };

  const handleSubmit = async () => {
    const unanswered = questions.some(q => {
      const answer = answers[q.id];
      if (q.questionType === 'multiple_choice') {
        return !answer || answer.length === 0;
      }
      return !answer;
    });

    if (unanswered) {
      setError('Ответьте на все вопросы');
      return;
    }

    setSubmitting(true);
    setError('');

    const answersPayload = questions.map(q => {
      if (q.questionType === 'multiple_choice') {
        return {
          questionId: q.id,
          selectedOptionIds: answers[q.id] || [],
        };
      }
      return {
        questionId: q.id,
        selectedOptionId: answers[q.id],
      };
    });

    try {
      const response = await questionsService.verify(node.id, answersPayload);
      
      if (response.isPassed) {
        setResult({ success: true, message: 'Поздравляем! Вы успешно прошли викторину!' });
        setTimeout(() => {
          onSuccess(node.id);
          onClose();
        }, 2000);
      } else {
        setAttempts(prev => prev + 1);
        setResult({ 
          success: false, 
          message: `Неправильные ответы. Попробуйте еще раз. Попытка ${attempts + 1}`,
          details: response.results
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка проверки ответов');
    } finally {
      setSubmitting(false);
    }
  };

  const getOptionStatus = (questionId, optionId) => {
    if (!result?.details) return null;
    const questionResult = result.details.find(q => q.id === questionId);
    if (!questionResult) return null;
    
    const selectedOptions = answers[questionId];
    const isSelected = Array.isArray(selectedOptions) 
      ? selectedOptions.includes(optionId)
      : selectedOptions === optionId;
    
    if (isSelected && !questionResult.isCorrect) {
      return 'incorrect-selected';
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="quiz-modal-overlay" onClick={onClose}>
      <div className="quiz-modal" onClick={e => e.stopPropagation()}>
        <div className="quiz-modal-header">
          <h3>
            <span className="material-icons">quiz</span>
            Викторина: {node?.data?.label || node?.title || node?.topic || 'Узел'}
          </h3>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="quiz-modal-content">
          {loading ? (
            <div className="quiz-loading">
              <div className="spinner"></div>
              <p>Загрузка вопросов...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="quiz-empty">
              <span className="material-icons">help_outline</span>
              <p>Нет вопросов для этого узла</p>
            </div>
          ) : (
            <>
              <div className="quiz-progress">
                <span>Вопросов: {questions.length}</span>
                {attempts > 0 && <span className="attempts">Попыток: {attempts}</span>}
              </div>
              
              <div className="quiz-questions">
                {questions.map((question, index) => (
                  <div key={question.id} className="quiz-question">
                    <div className="question-header">
                      <span className="question-number">Вопрос {index + 1}</span>
                      <span className="question-type">
                        {question.questionType === 'single_choice' ? 'Выберите один ответ' : 'Выберите несколько ответов'}
                      </span>
                    </div>
                    <div className="question-text">{question.questionText}</div>
                    
                    <div className="question-options">
                      {question.answerOptions?.map(opt => {
                        const status = getOptionStatus(question.id, opt.id);
                        return (
                          <label 
                            key={opt.id} 
                            className={`quiz-option ${status === 'incorrect-selected' ? 'incorrect' : ''}`}
                          >
                            <input
                              type={question.questionType === 'single_choice' ? 'radio' : 'checkbox'}
                              name={`question-${question.id}`}
                              checked={
                                question.questionType === 'single_choice'
                                  ? answers[question.id] === opt.id
                                  : (answers[question.id] || []).includes(opt.id)
                              }
                              onChange={(e) => {
                                if (question.questionType === 'single_choice') {
                                  handleAnswerChange(question.id, opt.id);
                                } else {
                                  handleAnswerChange(question.id, opt.id, true);
                                }
                              }}
                              disabled={submitting}
                            />
                            <span className="option-text">{opt.optionText}</span>
                            {opt.isCorrect && result && !result.success && (
                              <span className="correct-badge">✓</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="quiz-error">
                  <span className="material-icons">error</span>
                  <span>{error}</span>
                </div>
              )}

              {result && (
                <div className={`quiz-result ${result.success ? 'success' : 'error'}`}>
                  <span className="material-icons">
                    {result.success ? 'check_circle' : 'error'}
                  </span>
                  <div>
                    <p>{result.message}</p>
                    {result.details && (
                      <div className="result-details">
                        {result.details.map((detail, idx) => (
                          <div key={idx} className={detail.isCorrect ? 'correct' : 'incorrect'}>
                            {detail.isCorrect ? '✓' : '✗'} {detail.questionText}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="quiz-modal-footer">
          {!loading && questions.length > 0 && !result?.success && (
            <button 
              className="submit-btn" 
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Проверка...' : 'Проверить ответы'}
            </button>
          )}
          <button className="cancel-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizModal;
