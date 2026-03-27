import React, { useEffect, useState } from 'react';
import { questionsService } from '../services/questionsService';
import { usePagination } from '../hooks/usePagination';
import './QuizModal.css';

const formatAttemptDate = (value) => {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString('ru-RU');
};

const AttemptResults = ({ attempt }) => {
  if (!attempt?.results?.length) return null;

  return (
    <div className="attempt-history-list">
      {attempt.results.map((detail, index) => (
        <div
          key={`${detail.id}-${index}`}
          className={`attempt-history-item ${detail.isCorrect ? 'correct' : 'incorrect'}`}
        >
          <div className="attempt-history-header">
            <span className="attempt-history-title">{detail.questionText}</span>
            <span className="attempt-history-badge">
              {detail.isCorrect ? 'Верно' : 'Ошибка'}
            </span>
          </div>
          <div className="attempt-history-meta">
            <span>Ваш ответ: {(detail.selectedOptionTexts || []).join(', ') || '—'}</span>
            <span>Правильный ответ: {(detail.correctOptionTexts || []).join(', ') || '—'}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const QuizModal = ({ isOpen, onClose, node, onSuccess }) => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [latestAttempt, setLatestAttempt] = useState(null);
  const [loadingLatestAttempt, setLoadingLatestAttempt] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const {
    currentPage,
    totalPages,
    pageItems: visibleQuestions,
    reset: resetQuestionsPagination,
    goNext,
    goPrev
  } = usePagination(questions, 3);
  const {
    currentPage: latestAttemptPage,
    totalPages: latestAttemptTotalPages,
    pageItems: latestAttemptResults,
    reset: resetAttemptPagination,
    goNext: goNextAttemptPage,
    goPrev: goPrevAttemptPage
  } = usePagination(latestAttempt?.results || [], 3);

  useEffect(() => {
    if (!isOpen || !node?.id) {
      return;
    }

    let isActive = true;

    const initializeQuiz = async () => {
      setLoading(true);
      setLoadingLatestAttempt(true);
      setAnswers({});
      setResult(null);
      setError('');
      resetQuestionsPagination();
      resetAttemptPagination();

      try {
        const [questionsData, latestAttemptData] = await Promise.all([
          questionsService.getByNode(node.id),
          questionsService.getLatestAttempt(node.id).catch(() => null)
        ]);

        if (!isActive) return;

        setQuestions(questionsData || []);
        setLatestAttempt(latestAttemptData || null);
      } catch (err) {
        if (!isActive) return;

        console.error('Ошибка загрузки вопросов:', err);
        setError('Не удалось загрузить вопросы');
      } finally {
        if (isActive) {
          setLoading(false);
          setLoadingLatestAttempt(false);
        }
      }
    };

    initializeQuiz();

    return () => {
      isActive = false;
    };
  }, [isOpen, node?.id, resetAttemptPagination, resetQuestionsPagination]);

  const pageStart = (currentPage - 1) * 3;

  const handleAnswerChange = (questionId, value, isMultiple = false) => {
    setAnswers(prev => {
      if (isMultiple) {
        const current = prev[questionId] || [];
        const newValue = current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value];
        return { ...prev, [questionId]: newValue };
      }

      return { ...prev, [questionId]: value };
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
      const responseResult = {
        success: response.isPassed,
        message: response.message,
        details: response.results || response.latestAttempt?.results || []
      };

      setResult(responseResult);
      setLatestAttempt(response.latestAttempt || null);
      resetAttemptPagination();

      if (response.isPassed) {
        setTimeout(() => {
          onSuccess(node.id);
          onClose();
        }, 2000);
      } else {
        setAttempts(prev => prev + 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка проверки ответов');
    } finally {
      setSubmitting(false);
    }
  };

  const getOptionStatus = (questionId, optionId) => {
    if (!result?.details?.length) return null;

    const questionResult = result.details.find(q => q.id === questionId);
    if (!questionResult) return null;

    const isSelected = (questionResult.selectedOptionIds || []).includes(optionId);
    const isCorrect = (questionResult.correctOptionIds || []).includes(optionId);

    if (isSelected && isCorrect) return 'correct-selected';
    if (isSelected && !isCorrect) return 'incorrect-selected';
    if (!isSelected && isCorrect) return 'missed-correct';

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
                <span>Страница {currentPage} из {totalPages}</span>
                {attempts > 0 && <span className="attempts">Попыток: {attempts}</span>}
              </div>

              {loadingLatestAttempt ? (
                <div className="attempt-panel loading">Загрузка последней попытки...</div>
              ) : latestAttempt ? (
                <div className="attempt-panel">
                  <div className="attempt-panel-header">
                    <div>
                      <strong>Последняя попытка</strong>
                      <div className="attempt-panel-date">{formatAttemptDate(latestAttempt.completedAt)}</div>
                    </div>
                    <span className={`attempt-panel-status ${latestAttempt.isPassed ? 'passed' : 'failed'}`}>
                      {latestAttempt.isPassed ? 'Пройдена' : 'Не пройдена'}
                    </span>
                  </div>
                  <AttemptResults attempt={{ ...latestAttempt, results: latestAttemptResults }} />
                  {latestAttemptTotalPages > 1 && (
                    <div className="attempt-pagination">
                      <button
                        className="page-btn"
                        onClick={goPrevAttemptPage}
                        disabled={latestAttemptPage === 1}
                      >
                        Назад
                      </button>
                      <span className="attempt-pagination-info">
                        Страница {latestAttemptPage} из {latestAttemptTotalPages}
                      </span>
                      <button
                        className="page-btn"
                        onClick={goNextAttemptPage}
                        disabled={latestAttemptPage === latestAttemptTotalPages}
                      >
                        Далее
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="quiz-questions">
                {visibleQuestions.map((question, index) => (
                  <div key={question.id} className="quiz-question">
                    <div className="question-header">
                      <span className="question-number">Вопрос {pageStart + index + 1}</span>
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
                            className={`quiz-option ${status || ''}`}
                          >
                            <input
                              type={question.questionType === 'single_choice' ? 'radio' : 'checkbox'}
                              name={`question-${question.id}`}
                              checked={
                                question.questionType === 'single_choice'
                                  ? answers[question.id] === opt.id
                                  : (answers[question.id] || []).includes(opt.id)
                              }
                              onChange={() => {
                                if (question.questionType === 'single_choice') {
                                  handleAnswerChange(question.id, opt.id);
                                } else {
                                  handleAnswerChange(question.id, opt.id, true);
                                }
                              }}
                              disabled={submitting}
                            />
                            <span className="option-text">{opt.optionText}</span>
                            {status === 'correct-selected' && <span className="option-badge success">Ваш верный ответ</span>}
                            {status === 'incorrect-selected' && <span className="option-badge error">Ваш ответ</span>}
                            {status === 'missed-correct' && <span className="option-badge neutral">Правильный ответ</span>}
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
                    <AttemptResults attempt={{ results: result.details }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="quiz-modal-footer">
          {!loading && questions.length > 0 && !result?.success && (
            <div className="quiz-actions">
              <button
                className="page-btn"
                onClick={goPrev}
                disabled={currentPage === 1 || submitting}
              >
                Назад
              </button>

              {currentPage < totalPages ? (
                <button
                  className="next-btn"
                  onClick={goNext}
                  disabled={submitting}
                >
                  Далее
                </button>
              ) : (
                <button
                  className="submit-btn"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Проверка...' : 'Проверить ответы'}
                </button>
              )}
            </div>
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
