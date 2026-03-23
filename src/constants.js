// Типы узлов (соответствуют бэкенду)
export const NODE_TYPES = {
  CONCEPT: { id: 1, name: 'Понятие', color: '#3b82f6', shape: 'rect', icon: 'psychology' },
  DEFINITION: { id: 2, name: 'Определение', color: '#10b981', shape: 'rounded', icon: 'description' },
  ALGORITHM: { id: 3, name: 'Алгоритм', color: '#ef4444', shape: 'diamond', icon: 'route' },
  PROPERTY: { id: 4, name: 'Свойство', color: '#f59e0b', shape: 'oval', icon: 'star' },
  THEOREM: { id: 5, name: 'Теорема', color: '#8b5cf6', shape: 'rounded', icon: 'calculate' },
  EXAMPLE: { id: 6, name: 'Пример', color: '#6b7280', shape: 'rect', icon: 'code' },
};

// Конвертируем в массив для удобства
export const NODE_TYPES_ARRAY = Object.values(NODE_TYPES);

// Типы связей
export const EDGE_TYPES = {
  IS_A: { id: 1, name: 'is_a', label: 'является', style: 'solid' },
  USES: { id: 2, name: 'uses', label: 'использует', style: 'dashed' },
  REQUIRES: { id: 3, name: 'requires', label: 'требует', style: 'solid' },
  CONTRASTS: { id: 4, name: 'contrasts', label: 'отличие', style: 'dotted' },
  PROVES: { id: 5, name: 'proves', label: 'доказывает', style: 'dashed' },
};

// Конвертируем в массив для удобства
export const EDGE_TYPES_ARRAY = Object.values(EDGE_TYPES);