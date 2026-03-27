import React, { useEffect, useState } from 'react';
import { questionsService } from '../services/questionsService';
import { nodesService } from '../services/nodesService';
import { usePagination } from '../hooks/usePagination';
import './NodeInfoModal.css';

const formatAttemptDate = (value) => {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString('ru-RU');
};

const renderAttemptResults = (results) => {
  if (!results?.length) return null;

  return (
    <div className="attempt-result-list">
      {results.map((result, index) => (
        <div
          key={`${result.id}-${index}`}
          className={`attempt-result-item ${result.isCorrect ? 'correct' : 'incorrect'}`}
        >
          <div className="attempt-result-header">
            <span className="attempt-result-title">{result.questionText}</span>
            <span className="attempt-result-status">
              {result.isCorrect ? 'Верно' : 'Ошибка'}
            </span>
          </div>
          <div className="attempt-result-meta">
            <span>Ваш ответ: {(result.selectedOptionTexts || []).join(', ') || '—'}</span>
            <span>Правильный ответ: {(result.correctOptionTexts || []).join(', ') || '—'}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const normalizeNodeInfo = (source, fallback = {}) => ({
  ...fallback,
  ...source,
  id: source?.id ?? fallback?.id ?? null,
  title: source?.title ?? source?.Title ?? fallback?.title ?? fallback?.Title ?? '',
  description: source?.description
    ?? source?.Description
    ?? source?.data?.description
    ?? fallback?.description
    ?? '',
  hasQuestions: source?.hasQuestions
    ?? source?.HasQuestions
    ?? source?.data?.hasQuestions
    ?? fallback?.hasQuestions
    ?? false,
  isUnlocked: source?.isUnlocked
    ?? source?.IsUnlocked
    ?? fallback?.isUnlocked
    ?? false,
  typeName: source?.typeName ?? source?.TypeName ?? fallback?.typeName ?? '',
  typeColor: source?.typeColor ?? source?.TypeColor ?? fallback?.typeColor ?? '#3b82f6',
  customFields: source?.customFields ?? source?.CustomFields ?? fallback?.customFields ?? null
});

const NodeInfoModal = ({ isOpen, onClose, node, userRole }) => {
  const [resolvedNode, setResolvedNode] = useState(() => normalizeNodeInfo(node));
  const [latestAttempt, setLatestAttempt] = useState(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const {
    currentPage,
    totalPages,
    pageItems: pagedAttemptResults,
    reset: resetAttemptPagination,
    goNext,
    goPrev
  } = usePagination(latestAttempt?.results || [], 3);

  useEffect(() => {
    setResolvedNode(normalizeNodeInfo(node));
  }, [node]);

  useEffect(() => {
    if (!isOpen || !node?.id) {
      return;
    }

    let isActive = true;

    const loadNodeInfo = async () => {
      try {
        const freshNode = await nodesService.getById(node.id);
        if (isActive && freshNode) {
          setResolvedNode((prevNode) => normalizeNodeInfo(freshNode, prevNode));
        }
      } catch (error) {
        if (isActive) {
          setResolvedNode((prevNode) => normalizeNodeInfo(node, prevNode));
        }
      }
    };

    loadNodeInfo();

    return () => {
      isActive = false;
    };
  }, [isOpen, node]);

  useEffect(() => {
    if (!isOpen || !node?.id || userRole !== 'learner' || !resolvedNode?.hasQuestions) {
      setLatestAttempt(null);
      setLoadingAttempt(false);
      resetAttemptPagination();
      return;
    }

    let isActive = true;

    const loadLatestAttempt = async () => {
      setLoadingAttempt(true);
      resetAttemptPagination();

      try {
        const attempt = await questionsService.getLatestAttempt(node.id);
        if (isActive) {
          setLatestAttempt(attempt || null);
        }
      } catch (error) {
        if (isActive) {
          setLatestAttempt(null);
        }
      } finally {
        if (isActive) {
          setLoadingAttempt(false);
        }
      }
    };

    loadLatestAttempt();

    return () => {
      isActive = false;
    };
  }, [isOpen, node?.id, resolvedNode?.hasQuestions, resetAttemptPagination, userRole]);

  if (!isOpen || !resolvedNode) return null;

  const getTypeColor = () => resolvedNode.typeColor || '#3b82f6';

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
            <div className="info-value">{resolvedNode.title || '—'}</div>
          </div>

          <div className="info-section">
            <label>Описание</label>
            <div className="info-value description">{resolvedNode.description || '—'}</div>
          </div>

          <div className="info-section">
            <label>Тип узла</label>
            <div className="info-value">
              <span
                className="type-badge"
                style={{ backgroundColor: getTypeColor() }}
              >
                {resolvedNode.typeName || 'Без типа'}
              </span>
            </div>
          </div>

          {resolvedNode.customFields && Object.keys(resolvedNode.customFields).length > 0 && (
            <div className="info-section">
              <label>Дополнительная информация</label>
              <div className="custom-fields">
                {Object.entries(resolvedNode.customFields).map(([key, value]) => (
                  <div key={key} className="custom-field">
                    <span className="field-name">{key}:</span>
                    <span className="field-value">{value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {userRole === 'learner' && resolvedNode.isUnlocked && resolvedNode.hasQuestions && (
            <div className="info-section completed-badge">
              <span className="material-icons">check_circle</span>
              <span>Узел успешно открыт</span>
            </div>
          )}

          {userRole === 'learner' && resolvedNode.hasQuestions && (
            <div className="info-section">
              <label>Последняя попытка</label>
              {loadingAttempt ? (
                <div className="attempt-placeholder">Загрузка результатов...</div>
              ) : latestAttempt ? (
                <div className="attempt-card">
                  <div className="attempt-card-header">
                    <span className={`attempt-status ${latestAttempt.isPassed ? 'passed' : 'failed'}`}>
                      {latestAttempt.isPassed ? 'Тест пройден' : 'Тест не пройден'}
                    </span>
                    <span className="attempt-date">{formatAttemptDate(latestAttempt.completedAt)}</span>
                  </div>
                  {renderAttemptResults(pagedAttemptResults)}
                  {totalPages > 1 && (
                    <div className="attempt-pagination">
                      <button className="pagination-btn" onClick={goPrev} disabled={currentPage === 1}>
                        Назад
                      </button>
                      <span className="pagination-info">Страница {currentPage} из {totalPages}</span>
                      <button className="pagination-btn" onClick={goNext} disabled={currentPage === totalPages}>
                        Далее
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="attempt-placeholder">Попыток пока нет</div>
              )}
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
