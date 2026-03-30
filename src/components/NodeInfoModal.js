import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuestionsService } from '../hooks/useQuestionsService';
import { useNodesService } from '../hooks/useNodesService';
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
            {result.isCorrect && (
              <span>Правильный ответ: {(result.correctOptionTexts || []).join(', ') || '—'}</span>
            )}
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

const ATTEMPTS_PAGE_SIZE = 3;
const TITLE_MAX_LENGTH = 120;
const FIELD_MAX_LENGTH = 180;

const normalizeTypeName = (typeName) => {
  const value = typeof typeName === 'string' ? typeName.trim() : '';
  if (!value || value === 'Неизвестно' || value === 'Unknown' || value === 'Без типа') {
    return 'Нет типа';
  }
  return value;
};

const toDisplayText = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const ExpandableText = ({ value, maxLength = FIELD_MAX_LENGTH, className = '', placeholder = '—' }) => {
  const text = useMemo(() => toDisplayText(value), [value]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [text, maxLength]);

  if (!text) {
    return <span className={className}>{placeholder}</span>;
  }

  const isLong = text.length > maxLength;
  const visibleText = isLong && !expanded
    ? `${text.slice(0, maxLength)}...`
    : text;

  return (
    <div className={`expandable-text ${className}`.trim()}>
      <span className="expandable-text-content">{visibleText}</span>
      {isLong && (
        <button
          type="button"
          className="expandable-text-toggle"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Скрыть' : 'Подробнее'}
        </button>
      )}
    </div>
  );
};

const NodeInfoModal = ({ isOpen, onClose, node, userRole }) => {
  const questionsService = useQuestionsService();
  const nodesService = useNodesService();
  const [resolvedNode, setResolvedNode] = useState(() => normalizeNodeInfo(node));
  const [latestAttempt, setLatestAttempt] = useState(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const successfulLatestAttempt = latestAttempt?.isPassed ? latestAttempt : null;

  const attemptResults = useMemo(() => successfulLatestAttempt?.results ?? [], [successfulLatestAttempt]);
  const totalPages = Math.max(1, Math.ceil(attemptResults.length / ATTEMPTS_PAGE_SIZE));
  const pagedAttemptResults = useMemo(() => {
    const startIndex = (currentPage - 1) * ATTEMPTS_PAGE_SIZE;
    return attemptResults.slice(startIndex, startIndex + ATTEMPTS_PAGE_SIZE);
  }, [attemptResults, currentPage]);

  const resetAttemptPagination = useCallback(() => setCurrentPage(1), []);
  const goNext = useCallback(() => {
    setCurrentPage((prevPage) => Math.min(prevPage + 1, totalPages));
  }, [totalPages]);
  const goPrev = useCallback(() => {
    setCurrentPage((prevPage) => Math.max(prevPage - 1, 1));
  }, []);

  useEffect(() => {
    setCurrentPage((prevPage) => Math.min(prevPage, totalPages));
  }, [totalPages]);

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
  }, [isOpen, node, nodesService]);

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
  }, [isOpen, node?.id, questionsService, resolvedNode?.hasQuestions, resetAttemptPagination, userRole]);

  if (!isOpen || !resolvedNode) return null;

  const getTypeColor = () => resolvedNode.typeColor || '#3b82f6';

  return (
    <div className="node-info-overlay" onClick={onClose}>
      <div className="node-info-modal" onClick={(e) => e.stopPropagation()}>
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
            <ExpandableText
              value={resolvedNode.title}
              maxLength={TITLE_MAX_LENGTH}
              className="info-value"
            />
          </div>

          <div className="info-section">
            <label>Описание</label>
            <ExpandableText
              value={resolvedNode.description}
              maxLength={FIELD_MAX_LENGTH}
              className="info-value description"
            />
          </div>

          <div className="info-section">
            <label>Тип узла</label>
            <div className="info-value">
              <span
                className="type-badge"
                style={{ backgroundColor: getTypeColor() }}
              >
                {normalizeTypeName(resolvedNode.typeName)}
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
                    <ExpandableText
                      value={value}
                      maxLength={FIELD_MAX_LENGTH}
                      className="field-value"
                    />
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
              <label>Последняя успешная попытка</label>
              {loadingAttempt ? (
                <div className="attempt-placeholder">Загрузка результатов...</div>
              ) : successfulLatestAttempt ? (
                <div className="attempt-card">
                  <div className="attempt-card-header">
                    <span className="attempt-status passed">
                      Тест пройден
                    </span>
                    <span className="attempt-date">{formatAttemptDate(successfulLatestAttempt.completedAt)}</span>
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
                <div className="attempt-placeholder">Успешных попыток пока нет</div>
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
