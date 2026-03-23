import React, { useState, useEffect, useCallback, useRef } from 'react';
import MindElixir from 'mind-elixir';
import '/node_modules/mind-elixir/dist/MindElixir.css';
// import 'mind-elixir/dist/MindElixir.css';
import { mapsService } from '../services/mapsService';
import { nodesService } from '../services/nodesService';
import { edgesService } from '../services/edgesService';
import { customTypesService } from '../services/customTypesService';
import { NODE_TYPES } from '../constants';
import NodeSidebar from './NodeSidebar';
import AccessManager from './AccessManager';
import TypeManager from './TypeManager';
import QuizModal from './QuizModal';
import NodeInfoModal from './NodeInfoModal';
import './MapEditor.css';

// Функция для определения цвета текста
const getContrastColor = (hexColor) => {
  if (!hexColor) return '#333333';
  const color = hexColor.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#1a1a1a' : '#ffffff';
};

// Надёжный поиск корневого узла
const findRootNode = (nodes, edges) => {
  const targets = new Set(
    edges
      .filter(e => e.isHierarchy === true)
      .map(e => e.targetNodeId)
  );
  
  const roots = nodes.filter(n => !targets.has(n.id));
  
  if (roots.length === 0) {
    console.warn('Корневой узел не найден, используем первый узел');
    return nodes[0];
  }
  if (roots.length > 1) {
    console.warn('Найдено несколько корневых узлов:', roots.map(r => r.id));
  }
  
  return roots[0];
};

// БЕЗОПАСНАЯ версия конвертера с сохранением ID
const convertToMindElixirFormat = (nodes, edges, customNodeTypes, systemNodeTypes, unlockedNodes = new Set(), userRole = 'owner') => {
  console.log('Конвертация данных для Mind Elixir:', { nodesCount: nodes.length, edgesCount: edges.length });
  
  if (!nodes || nodes.length === 0) {
    console.error('Нет узлов, создаем фолбэк');
    return {
      nodeData: {
        id: 'fallback_root',
        topic: 'Новая карта',
        expanded: true,
        children: []
      }
    };
  }
  
  const isLearner = userRole === 'learner';
  const isNodeVisible = (node) => !isLearner || node?.isVisible !== false;
  const visibleNodes = nodes.filter(isNodeVisible);
  const visibleNodeIds = new Set(visibleNodes.map((node) => String(node.id)));
  const visibleEdges = isLearner
    ? edges.filter((edge) => (
      (visibleNodeIds.has(String(edge.sourceNodeId)) && visibleNodeIds.has(String(edge.targetNodeId)))
    ))
    : edges;
  
  let rootNode = findRootNode(
    visibleNodes.length > 0 ? visibleNodes : nodes,
    visibleEdges.length > 0 ? visibleEdges : edges
  );
  if (!rootNode) {
    console.error('Корневой узел не найден, создаем фолбэк');
    rootNode = visibleNodes[0] || nodes[0];
  }
  
  // Создаем карту узлов для быстрого доступа
  const nodeMap = new Map();
  nodes.forEach(node => {
    nodeMap.set(String(node.id), node);
  });
  
  // Создаем карту детей
  const childrenMap = new Map();
  visibleEdges.forEach(edge => {
    if (edge.isHierarchy) {
      const sourceId = String(edge.sourceNodeId);
      const targetId = String(edge.targetNodeId);
      if (!childrenMap.has(sourceId)) {
        childrenMap.set(sourceId, []);
      }
      childrenMap.get(sourceId).push(targetId);
    }
  });
  
  const visited = new Set();
  
  const buildNode = (nodeId, level = 0) => {
    const stringId = String(nodeId);
    
    if (visited.has(stringId)) {
      console.warn('Обнаружен цикл для узла:', stringId);
      return null;
    }
    visited.add(stringId);
    
      const node = nodeMap.get(stringId);
      
      if (!node) {
        console.error('Узел не найден для id:', stringId);
        return null;
      }

      if (!isNodeVisible(node)) {
        return null;
      }
    
    let nodeColor = '';
    let nodeIcon = null;
    let nodeShape = 'rect';
    const hasCustomType = node.customTypeId !== null && node.customTypeId !== undefined;
    
    if (hasCustomType && node.customTypeId) {
      const customType = customNodeTypes.find(t => t.id === node.customTypeId);
      if (customType) {
        nodeColor = customType.color;
        nodeShape = customType.shape || 'rect';
        nodeIcon = customType.icon;
      }
    } else if (node.typeId) {
      const systemType = systemNodeTypes.find(t => t.id === node.typeId);
      if (systemType) {
        nodeColor = systemType.color;
        nodeShape = systemType.shape || 'rect';
        nodeIcon = systemType.icon;
      }
    } else {
      nodeColor = '#e0e0e0';
    }
    
      const isUnlocked = isLearner
        ? (typeof node.isUnlocked === 'boolean'
          ? node.isUnlocked
          : (unlockedNodes.has(node.id) || !node.hasQuestions || level === 0))
        : true;
      const isLocked = !isUnlocked;
      
      const shouldStopAtLockedQuiz = isLearner && isLocked && node.hasQuestions;
      const childIds = shouldStopAtLockedQuiz ? [] : (childrenMap.get(stringId) || []);
      const children = childIds
        .map(childId => buildNode(childId, level + 1))
        .filter(child => child !== null && child !== undefined);
    
    // ВАЖНО: используем существующий ID узла как строку
    return {
      id: stringId, // Сохраняем оригинальный ID как строку
      topic: node.title || 'Узел',
      children: children.length > 0 ? children : undefined,
      expanded: true,
      data: {
        description: node.description || '',
        typeId: node.typeId,
        customTypeId: node.customTypeId,
        color: isLocked ? '#95a5a6' : nodeColor,
        textColor: isLocked ? '#ffffff' : getContrastColor(nodeColor),
        icon: isLocked ? 'lock' : nodeIcon,
          shape: nodeShape,
          hasQuestions: node.hasQuestions || false,
          isUnlocked: isUnlocked,
          isVisible: node.isVisible !== false,
          level: level,
          originalId: node.id // Сохраняем оригинальный ID для обратной конвертации
        }
    };
  };
  
  let root = buildNode(rootNode.id);
  
  if (!root) {
    console.error('Корень не построен, создаем фолбэк');
    root = {
      id: String(rootNode.id),
      topic: rootNode.title || 'Корневой узел',
      expanded: true,
      children: [],
      data: {
        level: 0
      }
    };
  }
  
  console.log('Построенный root узел:', root);
  balanceRootChildrenDirections(root);
  
  const arrows = visibleEdges
    .filter((edge) => !edge.isHierarchy)
    .map((edge) => {
      const edgeStyle = edge.type?.style || edge.typeStyle || 'solid';
      const edgeColor = edge.type?.color || edge.typeColor || '#666666';
      const style = {
        stroke: edgeColor,
        strokeWidth: '2',
        labelColor: edgeColor
      };

      if (edgeStyle === 'dashed') {
        style.strokeDasharray = '8 4';
      } else if (edgeStyle === 'dotted') {
        style.strokeDasharray = '2 6';
        style.strokeLinecap = 'round';
      }

      return {
        id: edge.id ? `edge_${edge.id}` : `edge_${String(edge.sourceNodeId)}_${String(edge.targetNodeId)}`,
        edgeId: edge.id,
        from: String(edge.sourceNodeId),
        to: String(edge.targetNodeId),
        label: edge.type?.label || edge.typeLabel || '',
        typeId: edge.typeId ?? null,
        customTypeId: edge.customTypeId ?? null,
        style
      };
    });

  return {
    nodeData: root,
    arrows
  };
};

// Конвертация обратно с сохранением ID
const convertFromMindElixirFormat = (mindData, existingNodes, existingEdges, mindIdToNodeId = null) => {
  const newNodes = [];
  const newEdges = [];
  const processedIds = new Set();

  if (!mindData || !mindData.nodeData) {
    console.warn('Пустые данные Mind Elixir, конвертация не требуется');
    return { nodes: [], edges: [] };
  }
  
  const isNumericId = (value) => (
    typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))
  );

  const generateTempId = () => -(Date.now() + Math.floor(Math.random() * 10000));

  const traverse = (node, parentId = null, level = 0) => {
    if (!node) return;
    // Пытаемся получить существующий ID из данных узла
    let nodeId;
    const mindId = node?.id !== undefined && node?.id !== null ? String(node.id) : '';
    
    // Сначала проверяем, есть ли оригинальный ID в data
    if (node.data?.originalId !== undefined && node.data?.originalId !== null) {
      nodeId = node.data.originalId;
    }
    // Затем проверяем, есть ли известное соответствие mindId -> nodeId
    else if (mindIdToNodeId && mindIdToNodeId.has(mindId)) {
      nodeId = mindIdToNodeId.get(mindId);
    }
    // Затем проверяем, можно ли безопасно преобразовать ID узла в число
    else if (isNumericId(node.id)) {
      nodeId = parseInt(node.id, 10);
    }
    // Иначе генерируем новый ID
    else {
      nodeId = generateTempId();
      if (mindIdToNodeId && mindId) {
        mindIdToNodeId.set(mindId, nodeId);
      }
    }
    
    // Проверяем, не дублируется ли ID
    if (processedIds.has(nodeId)) {
      // Если ID уже использован, генерируем новый
      nodeId = generateTempId();
      if (mindIdToNodeId && mindId) {
        mindIdToNodeId.set(mindId, nodeId);
      }
    }
    processedIds.add(nodeId);
    
    newNodes.push({
      id: nodeId,
      _mindId: mindId,
      title: node.topic,
      description: node.data?.description || '',
      typeId: node.data?.typeId,
      customTypeId: node.data?.customTypeId,
      xPosition: node.data?.xPosition || 0,
      yPosition: node.data?.yPosition || 0,
      width: node.data?.width || 200,
      height: node.data?.height || 80,
      hasQuestions: node.data?.hasQuestions || false,
      isUnlocked: node.data?.isUnlocked !== false,
      level: level
    });
    
    if (parentId) {
      newEdges.push({
        sourceNodeId: parentId,
        targetNodeId: nodeId,
        isHierarchy: true
      });
    }
    
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => traverse(child, nodeId, level + 1));
    }
  };
  
  traverse(mindData.nodeData);
  
  // Добавляем неиерархические связи из старых данных
  const resolveArrowNodeId = (value) => {
    const key = String(value);
    if (mindIdToNodeId && mindIdToNodeId.has(key)) {
      return mindIdToNodeId.get(key);
    }

    if (isNumericId(value)) {
      return parseInt(value, 10);
    }

    return null;
  };

  const nonHierarchyEdges = (mindData.arrows || [])
    .map((arrow) => {
      const sourceNodeId = resolveArrowNodeId(arrow.from);
      const targetNodeId = resolveArrowNodeId(arrow.to);

      if (sourceNodeId === null || targetNodeId === null) {
        return null;
      }

      return {
        id: arrow.edgeId ?? undefined,
        sourceNodeId,
        targetNodeId,
        isHierarchy: false,
        typeId: arrow.typeId ?? null,
        customTypeId: arrow.customTypeId ?? null
      };
    })
    .filter(Boolean);
  newEdges.push(...nonHierarchyEdges);
  
  console.log('Конвертировано узлов:', newNodes.length);
  console.log('Конвертировано связей:', newEdges.length);
  
  return { nodes: newNodes, edges: newEdges };
};

// Панель прогресса
const ProgressPanel = ({ unlockedNodes, totalNodes, userRole }) => {
  if (userRole !== 'learner') return null;
  
  const progress = totalNodes > 0 ? Math.round((unlockedNodes.size / totalNodes) * 100) : 0;
  
  return (
    <div className="progress-panel">
      <div className="progress-header">
        <span className="material-icons">school</span>
        <span>Мой прогресс</span>
      </div>
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-stats">
        <span>Открыто узлов: {unlockedNodes.size} / {totalNodes}</span>
        <span className="progress-percent">{progress}%</span>
      </div>
    </div>
  );
};

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const createMindElixirNode = (topic) => ({
  id: `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  topic,
});

const balanceRootChildrenDirections = (rootNode) => {
  if (!rootNode?.children?.length) return false;

  let leftCount = 0;
  let rightCount = 0;
  let changed = false;

  rootNode.children.forEach((child) => {
    const nextDirection = leftCount <= rightCount ? MindElixir.LEFT : MindElixir.RIGHT;
    if (child.direction !== nextDirection) {
      child.direction = nextDirection;
      changed = true;
    }

    if (nextDirection === MindElixir.LEFT) {
      leftCount += 1;
    } else {
      rightCount += 1;
    }
  });

  return changed;
};

function MapEditor({ map, userId, onClose }) {
  const containerRef = useRef(null);
  const mindMapRef = useRef(null);
  const mindIdToNodeIdRef = useRef(new Map());
  const saveChangesRef = useRef(null);
  const isInitializingRef = useRef(false);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const isBalancingRootBranchesRef = useRef(false);
  const allNodesRef = useRef([]);
  const allEdgesRef = useRef([]);
  const userRoleRef = useRef(map.ownerId === userId ? 'owner' : (map.userRole || 'observer'));
  const isOwnerRef = useRef(map.ownerId === userId || map.userRole === 'owner');
  const inlineEditCleanupRef = useRef(null);
  const connectionDraftRef = useRef({ active: false, sourceMindId: null, sourceTitle: '' });
  const [selectedNode, setSelectedNode] = useState(null);
  const [userRole, setUserRole] = useState(map.ownerId === userId ? 'owner' : (map.userRole || 'observer'));
  const [showAccessManager, setShowAccessManager] = useState(false);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [typeManagerCategory, setTypeManagerCategory] = useState('node');
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [selectedNodeForQuiz, setSelectedNodeForQuiz] = useState(null);
  const [showLockedNodePrompt, setShowLockedNodePrompt] = useState(false);
  const [lockedNodePromptData, setLockedNodePromptData] = useState(null);
  const [connectionDraft, setConnectionDraft] = useState({ active: false, sourceMindId: null, sourceTitle: '' });
  const [showNodeInfoModal, setShowNodeInfoModal] = useState(false);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState(null);
  const [unlockedNodes, setUnlockedNodes] = useState(new Set());
  const [totalNodesCount, setTotalNodesCount] = useState(0);
  const [systemNodeTypes, setSystemNodeTypes] = useState([]);
  const [customNodeTypes, setCustomNodeTypes] = useState([]);
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const isOwner = map.ownerId === userId || userRole === 'owner';
  const isSameNodeId = (left, right) => (
    left !== undefined &&
    left !== null &&
    right !== undefined &&
    right !== null &&
    String(left) === String(right)
  );

  const cleanupInlineEditSync = useCallback(() => {
    if (inlineEditCleanupRef.current) {
      inlineEditCleanupRef.current();
      inlineEditCleanupRef.current = null;
    }
  }, []);

  const updateConnectionDraft = useCallback((nextDraft) => {
    connectionDraftRef.current = nextDraft;
    setConnectionDraft(nextDraft);
  }, []);

  const resetConnectionDraft = useCallback(() => {
    updateConnectionDraft({ active: false, sourceMindId: null, sourceTitle: '' });
  }, [updateConnectionDraft]);

  const createSidebarNodeFromMindNode = useCallback((mindNode) => {
    if (!mindNode) return null;

    const resolvedId = (
      mindNode.data?.originalId ??
      mindIdToNodeIdRef.current.get(String(mindNode.id)) ??
      mindNode.id
    );

    const existingNode = allNodesRef.current.find((node) => isSameNodeId(node.id, resolvedId));
    if (existingNode) {
      return existingNode;
    }

    return {
      id: resolvedId,
      title: mindNode.topic || 'Узел',
      description: mindNode.data?.description || '',
      typeId: mindNode.data?.typeId,
      customTypeId: mindNode.data?.customTypeId,
      hasQuestions: mindNode.data?.hasQuestions || false,
      isUnlocked: mindNode.data?.isUnlocked !== false,
      level: mindNode.data?.level,
      mapId: map.id
    };
  }, [map.id]);

  const syncSelectedNodeTitle = useCallback((nodeId, title) => {
    if (title === undefined || title === null) return;

    setSelectedNode((prev) => {
      if (!prev || !isSameNodeId(prev.id, nodeId)) {
        return prev;
      }

      return {
        ...prev,
        title
      };
    });
  }, []);

  useEffect(() => {
    allNodesRef.current = allNodes;
  }, [allNodes]);

  useEffect(() => {
    allEdgesRef.current = allEdges;
  }, [allEdges]);

  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);

  useEffect(() => {
    isOwnerRef.current = isOwner;
  }, [isOwner]);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        setSystemNodeTypes(Object.values(NODE_TYPES));

        const nodeTypesData = await customTypesService.getTypes(map.id, 'node');
        setCustomNodeTypes(nodeTypesData.custom);
      } catch (error) {
        console.error('Ошибка загрузки типов:', error);
      }
    };

    loadTypes();
  }, [map.id]);

  const applyCustomStyles = useCallback(() => {
    if (!mindMapRef.current) return;
    
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const nodes = containerRef.current.querySelectorAll('[data-nodeid], .node');
      const root = mindMapRef.current.nodeData;
      if (!root) return;
      
      const findNode = (tree, id) => {
        if (!tree) return null;
        if (String(tree.id) === String(id)) return tree;
        if (tree.children) {
          for (const child of tree.children) {
            const found = findNode(child, id);
            if (found) return found;
          }
        }
        return null;
      };
      
      nodes.forEach(node => {
        const rawId = node.getAttribute('data-nodeid') || node.getAttribute('data-id') || '';
        const nodeId = rawId.startsWith('me') ? rawId.slice(2) : rawId;
        const mindNode = findNode(root, nodeId);
        
        if (mindNode) {
          node.classList.add('node');
          node.setAttribute('data-id', nodeId);
          if (mindNode.data?.level !== undefined) {
            node.setAttribute('data-level', String(mindNode.data.level));
          }

          if (mindNode.id === root.id) {
            node.style.border = '3px solid #f39c12';
            node.style.boxShadow = '0 4px 12px rgba(243, 156, 18, 0.3)';
            node.style.fontWeight = 'bold';
          }
          
          if (mindNode.data?.color) {
            node.style.backgroundColor = mindNode.data.color;
            node.style.color = mindNode.data.textColor || '#333333';
          }
          
          const shape = mindNode.data?.shape || 'rect';
          if (shape === 'circle') {
            node.style.borderRadius = '50%';
          } else if (shape === 'oval') {
            node.style.borderRadius = '50%';
            node.style.padding = '12px 24px';
          } else if (shape === 'rounded') {
            node.style.borderRadius = '12px';
          } else if (shape === 'diamond') {
            node.style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
          }
          
          const oldIcon = node.querySelector('.node-icon');
          if (oldIcon) oldIcon.remove();
          
          if (mindNode.data?.icon && mindNode.data.icon !== 'lock') {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'node-icon material-icons';
            iconSpan.style.fontSize = '20px';
            iconSpan.style.marginRight = '8px';
            iconSpan.style.color = mindNode.data.textColor || '#333333';
            iconSpan.textContent = mindNode.data.icon;
            node.insertBefore(iconSpan, node.firstChild);
          }
          
          if (mindNode.data?.hasQuestions && mindNode.data?.isUnlocked !== false) {
            const oldIndicator = node.querySelector('.node-quiz-indicator');
            if (oldIndicator) oldIndicator.remove();
            
            const quizIndicator = document.createElement('div');
            quizIndicator.className = 'node-quiz-indicator';
            quizIndicator.innerHTML = '<span class="material-icons">quiz</span>';
            node.appendChild(quizIndicator);
          }
        }
      });
    });
  }, []);

  const cleanupMindMapListeners = useCallback(() => {
    const mind = mindMapRef.current;
    const container = containerRef.current;
    cleanupInlineEditSync();
    if (!mind) return;
    const options = mind.clickHandlerOptions || false;
    
    if (container && mind.clickHandler) {
      container.removeEventListener('click', mind.clickHandler, options);
      mind.clickHandler = null;
    }
    if (container && mind.dblClickHandler) {
      container.removeEventListener('dblclick', mind.dblClickHandler, options);
      mind.dblClickHandler = null;
    }
    mind.clickHandlerOptions = null;
    if (mind.operationHandler && mind.bus?.removeListener) {
      mind.bus.removeListener('operation', mind.operationHandler);
      mind.operationHandler = null;
    }
    if (mind.selectNewNodeHandler && mind.bus?.removeListener) {
      mind.bus.removeListener('selectNewNode', mind.selectNewNodeHandler);
      mind.selectNewNodeHandler = null;
    }
    if (mind.observer) {
      mind.observer.disconnect();
      mind.observer = null;
    }
  }, [cleanupInlineEditSync]);

  const rebalanceRootBranches = useCallback((mind = mindMapRef.current) => {
    if (!mind || isBalancingRootBranchesRef.current) return;

    const selectedNodeId = mind.currentNode?.nodeObj?.id
      ? String(mind.currentNode.nodeObj.id)
      : null;
    const hasChanges = balanceRootChildrenDirections(mind.nodeData);

    if (!hasChanges) return;

    isBalancingRootBranchesRef.current = true;
    try {
      mind.refresh();
      if (selectedNodeId) {
        try {
          const selectedTopic = mind.findEle(selectedNodeId);
          if (selectedTopic) {
            mind.selectNode(selectedTopic);
          }
        } catch (error) {
          console.warn('Не удалось восстановить выделение после балансировки ветвей:', error);
        }
      }
      applyCustomStyles();
    } catch (error) {
      console.error('Ошибка балансировки ветвей первого уровня:', error);
    } finally {
      isBalancingRootBranchesRef.current = false;
    }
  }, [applyCustomStyles]);

  const patchMindMapMethods = useCallback((mind = mindMapRef.current) => {
    if (!mind || mind.__rootBalancePatched) return;

    const originalInsertSibling = mind.insertSibling?.bind(mind);
    if (originalInsertSibling) {
      mind.insertSibling = async (type, el, node) => {
        const targetNode = el || mind.currentNode;
        const isTopLevelNode = Boolean(
          targetNode?.nodeObj?.parent && !targetNode.nodeObj.parent.parent
        );

        if (mind.direction === MindElixir.SIDE && isTopLevelNode && mind.addChild) {
          const rootTopic = mind.findEle(String(mind.nodeData.id));
          if (rootTopic) {
            return mind.addChild(rootTopic, node);
          }
        }

        return originalInsertSibling(type, el, node);
      };
    }

    const wrapWithRebalance = (methodName) => {
      const originalMethod = mind[methodName]?.bind(mind);
      if (!originalMethod) return;

      mind[methodName] = async (...args) => {
        const result = await originalMethod(...args);
        rebalanceRootBranches(mind);
        return result;
      };
    };

    wrapWithRebalance('removeNodes');
    wrapWithRebalance('moveNodeBefore');
    wrapWithRebalance('moveNodeAfter');
    wrapWithRebalance('moveNodeIn');

    mind.__rootBalancePatched = true;
  }, [rebalanceRootBranches]);

  const loadMap = useCallback(async () => {
    isInitializingRef.current = true;
    setIsLoading(true);
    try {
      console.log('Загрузка карты...');
      const fullMap = await mapsService.getFullMap(map.id);
      console.log('Получены данные карты:', { nodes: fullMap.nodes.length, edges: fullMap.edges.length });
      
      const nextUserRole = fullMap.userRole;
      const nextIsOwner = map.ownerId === userId || nextUserRole === 'owner';
      userRoleRef.current = nextUserRole;
      isOwnerRef.current = nextIsOwner;
      allNodesRef.current = fullMap.nodes;
      allEdgesRef.current = fullMap.edges;
      resetConnectionDraft();

      setUserRole(fullMap.userRole);
      setAllNodes(fullMap.nodes);
      setAllEdges(fullMap.edges);
      setTotalNodesCount(fullMap.totalNodesCount || fullMap.nodes.length);

      // Сопоставление id узлов MindElixir -> id узлов в базе
      mindIdToNodeIdRef.current = new Map();
      fullMap.nodes.forEach(n => {
        mindIdToNodeIdRef.current.set(String(n.id), n.id);
      });
      
      const unlocked = new Set(
        fullMap.nodes
          .filter(n => n.isUnlocked === true)
          .map(n => n.id)
      );
      setUnlockedNodes(unlocked);
      
      const mindData = convertToMindElixirFormat(
        fullMap.nodes, 
        fullMap.edges, 
        customNodeTypes, 
        systemNodeTypes,
        unlocked,
        fullMap.userRole
      );
      
      console.log('Данные для Mind Elixir:', mindData);
      
      if (mindData && mindData.nodeData && containerRef.current) {
        if (mindMapRef.current) {
          cleanupMindMapListeners();
          mindMapRef.current.destroy();
        }
        
        containerRef.current.innerHTML = '';
        
        console.log('Создаем экземпляр Mind Elixir...');
        mindMapRef.current = new MindElixir({
          el: containerRef.current,
          direction: MindElixir.SIDE,
          draggable: true,
          contextMenu: isOwner,
          toolBar: false,
          nodeMenu: false,
          keypress: true,
          locale: 'ru'
        });
        
        mindMapRef.current.init(mindData);
        patchMindMapMethods(mindMapRef.current);
        rebalanceRootBranches(mindMapRef.current);
        console.log('Карта создана успешно');
        
        setTimeout(() => {
          applyCustomStyles();
        }, 500);
        
        setupEventListeners();
      } else {
        console.error('Нет данных для отображения');
        createDemoMap();
      }
    } catch (error) {
      console.error('Ошибка загрузки карты:', error);
      createDemoMap();
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        isInitializingRef.current = false;
      }, 0);
    }
  }, [map.id, customNodeTypes, systemNodeTypes, isOwner, applyCustomStyles, cleanupMindMapListeners, patchMindMapMethods, rebalanceRootBranches]);

  const createDemoMap = () => {
    if (!containerRef.current) return;
    
    console.log('Создаем демо-карту');
    
    const demoData = {
      nodeData: {
        id: 'root',
        topic: map.title || 'Карта знаний',
        expanded: true,
        children: [
          {
            id: 'child1',
            topic: 'Тема 1',
            expanded: true,
            children: [
              { id: 'child1_1', topic: 'Подтема 1.1', expanded: true },
              { id: 'child1_2', topic: 'Подтема 1.2', expanded: true }
            ]
          },
          {
            id: 'child2',
            topic: 'Тема 2',
            expanded: true,
            children: [
              { id: 'child2_1', topic: 'Подтема 2.1', expanded: true }
            ]
          },
          {
            id: 'child3',
            topic: 'Тема 3',
            expanded: true
          }
        ]
      }
    };
    
    if (mindMapRef.current) {
      cleanupMindMapListeners();
      mindMapRef.current.destroy();
    }
    
    isInitializingRef.current = true;
    mindMapRef.current = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.SIDE,
      draggable: true,
      contextMenu: isOwner,
      toolBar: false,
      nodeMenu: false,
      keypress: true,
      locale: 'ru'
    });
    
    mindMapRef.current.init(demoData);
    patchMindMapMethods(mindMapRef.current);
    rebalanceRootBranches(mindMapRef.current);
    console.log('Демо-карта создана');
    setTimeout(() => {
      isInitializingRef.current = false;
    }, 0);
    
    setTimeout(() => {
      applyCustomStyles();
    }, 500);
    
    setupEventListeners();
  };

  const setupEventListeners = useCallback(() => {
    if (!mindMapRef.current || !containerRef.current) return;
    
    const container = containerRef.current;
    const mind = mindMapRef.current;

    const findNodeElementFromEvent = (event) => {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : null;
      if (path && Array.isArray(path)) {
        for (const el of path) {
          if (!el || !el.getAttribute) continue;
          if (el.getAttribute('data-nodeid') || el.getAttribute('data-id') || el.classList?.contains('node')) {
            return el;
          }
        }
      }
      
      let current = event.target;
      while (current) {
        if (current.getAttribute) {
          if (current.getAttribute('data-nodeid') || current.getAttribute('data-id') || current.classList?.contains('node')) {
            return current;
          }
        }
        current = current.parentNode;
      }
      return null;
    };
    
    const findNodeInTree = (tree, id) => {
      if (!tree) return null;
      if (String(tree.id) === String(id)) return tree;
      if (tree.children) {
        for (const child of tree.children) {
          const found = findNodeInTree(child, id);
          if (found) return found;
        }
      }
      return null;
    };

    const startInlineEditSync = (mindNode) => {
      if (!mindNode) return;

      const sidebarNode = createSidebarNodeFromMindNode(mindNode);
      if (sidebarNode) {
        setSelectedNode(sidebarNode);
      }

      cleanupInlineEditSync();

      requestAnimationFrame(() => {
        const inputBox = container.querySelector('#input-box');
        if (!inputBox) return;

        const syncTitle = () => {
          const nextTitle = inputBox.textContent?.trim() || '';
          syncSelectedNodeTitle(sidebarNode?.id ?? mindNode.id, nextTitle);
        };

        inputBox.addEventListener('input', syncTitle);
        syncTitle();

        inlineEditCleanupRef.current = () => {
          inputBox.removeEventListener('input', syncTitle);
        };
      });
    };

    const openViewerNode = (nodeId, mindNode = null) => {
      const currentAllNodes = allNodesRef.current;
      const currentUserRole = userRoleRef.current;
      const nodeData = currentAllNodes.find(n => String(n.id) === String(nodeId));
      const nodeHasQuestions = nodeData?.hasQuestions ?? mindNode?.data?.hasQuestions;
      const nodeIsUnlocked = nodeData?.isUnlocked ?? mindNode?.data?.isUnlocked;
      const openNodeInfo = (data) => {
        if (!data) return;
        setSelectedNodeInfo(data);
        setShowNodeInfoModal(true);
      };
      
      if (
        currentUserRole === 'learner' &&
        nodeHasQuestions &&
        nodeIsUnlocked === false
      ) {
        setLockedNodePromptData(nodeData || {
          id: nodeId,
          title: mindNode?.topic || 'Узел',
          hasQuestions: nodeHasQuestions,
          isUnlocked: false,
        });
        setShowLockedNodePrompt(true);
        return;
      }
      
      if (nodeData) {
        openNodeInfo(nodeData);
      } else {
        openNodeInfo({ id: nodeId, title: mindNode?.topic || 'Узел' });
      }
      
      const numericId = /^\d+$/.test(String(nodeId)) ? parseInt(String(nodeId), 10) : nodeId;
      nodesService.getById(numericId)
        .then((freshNode) => {
          if (freshNode) {
            openNodeInfo(freshNode);
          }
        })
        .catch((error) => {
          console.error('Ошибка загрузки данных узла для просмотра:', error);
        });
    };
    
    const isNumericId = (value) => (
      typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))
    );

    const resolveNodeId = async (mindId, mindNode) => {
      if (mindNode?.data?.originalId !== undefined && mindNode?.data?.originalId !== null) {
        return mindNode.data.originalId;
      }
      if (isNumericId(mindId)) return parseInt(mindId, 10);
      const mapped = mindIdToNodeIdRef.current.get(String(mindId));
      if (mapped) return mapped;
      await saveChangesRef.current?.();
      return mindIdToNodeIdRef.current.get(String(mindId)) || null;
    };

    const handleNodeClick = async (e) => {
      const nodeElement = findNodeElementFromEvent(e);
      if (!nodeElement) return;
      
      const rawId = nodeElement.getAttribute('data-nodeid') || nodeElement.getAttribute('data-id') || '';
      const nodeId = rawId.startsWith('me') ? rawId.slice(2) : rawId;
      if (!nodeId) return;
      
      const foundNode = findNodeInTree(mindMapRef.current.nodeData, nodeId);
      
      if (foundNode) {
        console.log('Клик по узлу:', nodeId, foundNode);
        
        if (isOwnerRef.current && connectionDraftRef.current.active) {
          e.preventDefault();
          e.stopPropagation();

          const { sourceMindId } = connectionDraftRef.current;

          if (!sourceMindId) {
            updateConnectionDraft({
              active: true,
              sourceMindId: String(foundNode.id),
              sourceTitle: foundNode.topic || 'РЈР·РµР»'
            });
            setSelectedNode(null);
            return;
          }

          if (String(sourceMindId) === String(foundNode.id)) {
            updateConnectionDraft({
              active: true,
              sourceMindId: null,
              sourceTitle: ''
            });
            return;
          }

          const sourceMindNode = findNodeInTree(mindMapRef.current.nodeData, sourceMindId);
          const sourceElement = sourceMindNode ? mind.findEle(String(sourceMindNode.id)) : null;
          const targetElement = mind.findEle(String(foundNode.id));

          if (!sourceMindNode || !sourceElement || !targetElement || !mind.createArrow) {
            resetConnectionDraft();
            return;
          }

          const sourceResolvedId = await resolveNodeId(sourceMindId, sourceMindNode);
          const targetResolvedId = await resolveNodeId(foundNode.id, foundNode);

          if (
            sourceResolvedId === null ||
            targetResolvedId === null ||
            String(sourceResolvedId) === String(targetResolvedId)
          ) {
            resetConnectionDraft();
            return;
          }

          const edgeExists = allEdgesRef.current.some((edge) => (
            !edge.isHierarchy &&
            String(edge.sourceNodeId) === String(sourceResolvedId) &&
            String(edge.targetNodeId) === String(targetResolvedId)
          ));

          if (edgeExists) {
            resetConnectionDraft();
            return;
          }

          mind.createArrow(sourceElement, targetElement, {
            label: '',
            typeId: null,
            customTypeId: null,
            style: {
              stroke: '#666666',
              strokeWidth: '2',
              labelColor: '#666666'
            }
          });

          resetConnectionDraft();
          setTimeout(() => {
            saveChangesRef.current?.();
          }, 0);
          return;
        }

        if (isOwnerRef.current) {
          // Для владельца - открываем редактирование
          const resolvedId = await resolveNodeId(nodeId, foundNode);
          let nodeData = resolvedId
            ? allNodesRef.current.find(n => n.id === resolvedId)
            : null;
          
          if (!nodeData && resolvedId) {
            try {
              nodeData = await nodesService.getById(resolvedId);
            } catch (error) {
              console.error('Ошибка загрузки узла для редактирования:', error);
            }
          }
          
          if (nodeData) {
            setSelectedNode(nodeData);
          } else {
            setSelectedNode({
              id: resolvedId ?? nodeId,
              title: foundNode.topic,
              description: foundNode.data?.description || '',
              typeId: foundNode.data?.typeId,
              customTypeId: foundNode.data?.customTypeId,
              hasQuestions: foundNode.data?.hasQuestions || false,
              isUnlocked: foundNode.data?.isUnlocked !== false,
              mapId: map.id
            });
          }
        } else {
          // Для обучающегося или наблюдателя - открываем информацию или викторину
          openViewerNode(nodeId, foundNode);
        }
      }
    };
    
    const handleNodeDoubleClick = (e) => {
      if (!isOwnerRef.current) return;
      if (connectionDraftRef.current.active) return;

      const mindInstance = mindMapRef.current;
      if (!mindInstance) return;
      
      const nodeElement = findNodeElementFromEvent(e);
      if (!nodeElement) return;
      
      const rawId = nodeElement.getAttribute('data-nodeid') || nodeElement.getAttribute('data-id') || '';
      const nodeId = rawId.startsWith('me') ? rawId.slice(2) : rawId;
      if (!nodeId) return;
      
      const foundNode = findNodeInTree(mindInstance.nodeData, nodeId);
      
      if (foundNode) {
        console.log('Двойной клик по узлу, редактирование:', nodeId);
        const topicElement = mindInstance.findEle(String(foundNode.id));
        if (!topicElement) return;

        e.preventDefault();
        e.stopPropagation();

        const sidebarNode = createSidebarNodeFromMindNode(foundNode);
        if (sidebarNode) {
          setSelectedNode(sidebarNode);
        }

        mindInstance.selectNode?.(topicElement);
        mindInstance.beginEdit?.(topicElement);
      }
    };
    
    const handleMapChange = async () => {
      if (!isOwnerRef.current || !mindMapRef.current || isInitializingRef.current) return;
      console.log('Карта изменена, сохраняем...');
      await saveChangesRef.current?.();
    };
    
    const debouncedMapChange = debounce(handleMapChange, 1000);
    
    const listenerOptions = { capture: true };
    container.addEventListener('click', handleNodeClick, listenerOptions);
    container.addEventListener('dblclick', handleNodeDoubleClick, listenerOptions);
    
    const handleOperation = (operation) => {
      if (!isOwnerRef.current || isInitializingRef.current) return;

      if (operation?.name === 'beginEdit') {
        startInlineEditSync(operation.obj);
        return;
      }

      if (operation?.name === 'finishEdit') {
        cleanupInlineEditSync();
        const resolvedId = (
          operation.obj?.data?.originalId ??
          mindIdToNodeIdRef.current.get(String(operation.obj?.id)) ??
          operation.obj?.id
        );
        syncSelectedNodeTitle(resolvedId, operation.obj?.topic || '');
      }

      if (operation?.name === 'removeNodes' || operation?.name === 'removeNode') {
        cleanupInlineEditSync();
        resetConnectionDraft();
        setSelectedNode(null);
        requestAnimationFrame(() => {
          mind.clearSelection?.();
        });
      }

      debouncedMapChange();
      applyCustomStyles();
    };
    
    if (mind?.bus?.addListener) {
      mind.bus.addListener('operation', handleOperation);
      mind.operationHandler = handleOperation;

      const handleSelectNewNode = (nodeObj) => {
        if (!nodeObj) return;
        if (isOwnerRef.current) {
          const sidebarNode = createSidebarNodeFromMindNode(nodeObj);
          if (sidebarNode) {
            setSelectedNode(sidebarNode);
          }
          return;
        }
        console.log('Выбран узел:', nodeObj.id, nodeObj);
        openViewerNode(nodeObj.id, nodeObj);
      };
      mind.bus.addListener('selectNewNode', handleSelectNewNode);
      mind.selectNewNodeHandler = handleSelectNewNode;
    }
    
    mind.clickHandler = handleNodeClick;
    mind.dblClickHandler = handleNodeDoubleClick;
    mind.clickHandlerOptions = listenerOptions;
    
    console.log('Обработчики событий настроены');
  }, [applyCustomStyles, cleanupInlineEditSync, createSidebarNodeFromMindNode, map.id, syncSelectedNodeTitle]);

  const saveChanges = useCallback(async () => {
    if (!mindMapRef.current || !isOwner || isInitializingRef.current) return;
    
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    
    const mindData = mindMapRef.current.getData();
    if (!mindData || !mindData.nodeData) {
      console.warn('Нет данных для сохранения');
      return;
    }
    
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      console.log('Сохранение данных:', mindData);
      
      const { nodes: convertedNodes, edges: convertedEdges } = convertFromMindElixirFormat(
        mindData,
        allNodes,
        allEdges,
        mindIdToNodeIdRef.current
      );
      
      console.log('Сохранение узлов:', convertedNodes.length);
      console.log('Сохранение связей:', convertedEdges.length);
      
      const tempIdToNewId = new Map();
      
      // Обновляем или создаем узлы
      for (const node of convertedNodes) {
        const existingNode = allNodes.find(n => n.id === node.id);
        const mindId = node._mindId;
        const { _mindId, ...createPayload } = node;
        
        if (existingNode) {
          await nodesService.update(node.id, {
            title: node.title,
            description: node.description,
            typeId: node.typeId,
            customTypeId: node.customTypeId,
            width: node.width,
            height: node.height
          });
          if (mindId) {
            mindIdToNodeIdRef.current.set(String(mindId), node.id);
          }
          console.log('Обновлен узел:', node.id, node.title);
        } else {
          const tempNodeId = node.id;
          const newNode = await nodesService.create(map.id, createPayload);
          tempIdToNewId.set(node.id, newNode.id);
          node.id = newNode.id;
          if (mindId) {
            mindIdToNodeIdRef.current.set(String(mindId), newNode.id);
          }
          setSelectedNode((prev) => {
            if (!prev || !isSameNodeId(prev.id, tempNodeId)) {
              return prev;
            }

            return {
              ...prev,
              id: newNode.id,
              mapId: map.id,
              title: node.title,
              description: node.description,
              typeId: node.typeId,
              customTypeId: node.customTypeId,
              hasQuestions: node.hasQuestions || false
            };
          });
          console.log('Создан новый узел:', newNode.id, node.title);
        }
      }

      const persistedNodeIds = new Set(convertedNodes.map((node) => String(node.id)));

      const remappedEdges = convertedEdges.map(edge => ({
        ...edge,
        sourceNodeId: tempIdToNewId.get(edge.sourceNodeId) ?? edge.sourceNodeId,
        targetNodeId: tempIdToNewId.get(edge.targetNodeId) ?? edge.targetNodeId
      })).filter((edge) => (
        persistedNodeIds.has(String(edge.sourceNodeId)) &&
        persistedNodeIds.has(String(edge.targetNodeId))
      ));

      const edgeKey = (edge) => {
        const sourceId = String(edge.sourceNodeId);
        const targetId = String(edge.targetNodeId);
        const hierarchyFlag = edge.isHierarchy ? '1' : '0';
        if (edge.isHierarchy) {
          return `${sourceId}|${targetId}|${hierarchyFlag}`;
        }
        const relationType = edge.customTypeId !== undefined && edge.customTypeId !== null
          ? `custom:${edge.customTypeId}`
          : `system:${edge.typeId ?? ''}`;
        return `${sourceId}|${targetId}|${hierarchyFlag}|${relationType}`;
      };

      const existingEdgeByKey = new Map();
      allEdges.forEach(edge => {
        existingEdgeByKey.set(edgeKey(edge), edge);
      });

      const normalizedEdges = remappedEdges.map(edge => {
        const key = edgeKey(edge);
        const existing = existingEdgeByKey.get(key);
        if (existing) {
          return { ...existing, ...edge, id: existing.id };
        }
        return edge;
      });

      const createdEdgesByKey = new Map();
      for (const edge of normalizedEdges) {
        if (edge.id) continue;
        const payload = {
          mapId: map.id,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          isHierarchy: edge.isHierarchy
        };
        if (edge.typeId !== undefined && edge.typeId !== null) {
          payload.typeId = edge.typeId;
        }
        if (edge.customTypeId !== undefined && edge.customTypeId !== null) {
          payload.customTypeId = edge.customTypeId;
        }
        const createdEdge = await edgesService.create(payload);
        edge.id = createdEdge.id;
        createdEdgesByKey.set(edgeKey(edge), createdEdge);
      }

      const finalEdgesByKey = new Map();
      normalizedEdges.forEach(edge => {
        const key = edgeKey(edge);
        const created = createdEdgesByKey.get(key);
        finalEdgesByKey.set(key, created || edge);
      });

      const cleanedNodes = convertedNodes.map(({ _mindId, ...rest }) => rest);
      const finalEdges = Array.from(finalEdgesByKey.values());
      const finalEdgeKeys = new Set(finalEdgesByKey.keys());
      const existingNodeIds = new Set(cleanedNodes.map((node) => String(node.id)));

      const edgesToDelete = allEdges.filter((edge) => !finalEdgeKeys.has(edgeKey(edge)));
      for (const edge of edgesToDelete) {
        if (!edge?.id) continue;
        await edgesService.delete(edge.id);
      }

      const nodesToDelete = allNodes.filter((node) => !existingNodeIds.has(String(node.id)));
      for (const node of nodesToDelete) {
        await nodesService.delete(node.id);
      }
      
      // Обновляем локальные данные
      setAllNodes(cleanedNodes);
      allNodesRef.current = cleanedNodes;
      setTotalNodesCount(cleanedNodes.length);
      setAllEdges(finalEdges);
      allEdgesRef.current = finalEdges;
      
      console.log('Изменения сохранены успешно');
    } catch (error) {
      console.error('Ошибка сохранения:', error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        setTimeout(() => {
          saveChangesRef.current?.();
        }, 0);
      }
    }
  }, [isOwner, map.id, allNodes, allEdges]);

  useEffect(() => {
    saveChangesRef.current = saveChanges;
  }, [saveChanges]);

  const handleQuizSuccess = useCallback(async (nodeId) => {
    setUnlockedNodes(prev => new Set([...prev, nodeId]));
    setShowQuizModal(false);
    setSelectedNodeForQuiz(null);
    setShowLockedNodePrompt(false);
    setLockedNodePromptData(null);
    await loadMap();
    
    try {
      const nodeData = await nodesService.getById(nodeId);
      if (nodeData) {
        setSelectedNodeInfo(nodeData);
        setShowNodeInfoModal(true);
      }
    } catch (error) {
      console.error('Ошибка загрузки узла после викторины:', error);
    }
  }, [loadMap]);

  const handleStartQuizForLockedNode = useCallback(() => {
    if (!lockedNodePromptData) return;
    setShowLockedNodePrompt(false);
    setSelectedNodeForQuiz(lockedNodePromptData);
    setShowQuizModal(true);
  }, [lockedNodePromptData]);

  // Исправленная версия добавления темы
  const handleAddTopic = useCallback(() => {
    const mind = mindMapRef.current;
    if (!mind || !isOwner) return;
    
    const currentNode = mind.currentNode;
    const isRootSelected = !currentNode || !currentNode.nodeObj?.parent;
    const isTopLevelSelected = Boolean(
      currentNode?.nodeObj?.parent && !currentNode.nodeObj.parent.parent
    );
    
    console.log('handleAddTopic - currentNode:', currentNode?.id, 'rootNode:', mind.nodeData?.id);
    
    try {
      const rootTopic = mind.findEle(String(mind.nodeData.id));
      if (rootTopic && mind.addChild && (isRootSelected || isTopLevelSelected)) {
        console.log('Добавляем тему через центральный узел, чтобы она равномерно распределялась по сторонам');
        mind.addChild(rootTopic, createMindElixirNode('Новая тема'));
      } else if (currentNode && mind.insertSibling) {
        console.log('Добавляем тему как соседа для узла:', currentNode.id);
        mind.insertSibling('after', currentNode, createMindElixirNode('Новая тема'));
      } else {
        console.error('Методы добавления узлов не найдены');
      }
      
      // Сохраняем изменения после добавления узла
      setTimeout(() => {
        saveChanges();
        applyCustomStyles();
      }, 500);
    } catch (error) {
      console.error('Ошибка при добавлении темы:', error);
    }
  }, [isOwner, saveChanges, applyCustomStyles]);

  // Исправленная версия добавления подтемы
  const handleAddSubtopic = useCallback(() => {
    const mind = mindMapRef.current;
    if (!mind || !isOwner) return;
    
    try {
      const currentNode = mind.currentNode || mind.findEle(String(mind.nodeData.id));
      
      console.log('handleAddSubtopic - currentNode:', currentNode?.id);
      
      if (mind.addChild && currentNode) {
        console.log('Добавляем подтему для узла:', currentNode.id);
        mind.addChild(currentNode, createMindElixirNode('Новая подтема'));
      } else {
        console.error('Метод addChild не найден или нет текущего узла');
      }
      
      // Сохраняем изменения после добавления узла
      setTimeout(() => {
        saveChanges();
        applyCustomStyles();
      }, 500);
    } catch (error) {
      console.error('Ошибка при добавлении подтемы:', error);
    }
  }, [isOwner, saveChanges, applyCustomStyles]);

  // Удаление узла
  const handleDeleteNode = useCallback(async () => {
    if (!selectedNode) return;

    const selectedNodeId = selectedNode.id;
    const isValidNodeId = (
      selectedNodeId !== undefined &&
      selectedNodeId !== null &&
      (typeof selectedNodeId === 'number' || (typeof selectedNodeId === 'string' && /^\d+$/.test(selectedNodeId)))
    );

    if (!isValidNodeId) {
      alert('Узел еще не сохранен и не может быть удален.');
      return;
    }

    const selectedNodeKey = String(selectedNodeId);
    const rootNode = allNodes.find((node) => (
      !allEdges.some((edge) => edge.isHierarchy === true && String(edge.targetNodeId) === String(node.id))
    ));
    
    if (rootNode && String(rootNode.id) === selectedNodeKey) {
      alert('Нельзя удалить центральный узел');
      return;
    }
    
    if (!window.confirm('Удалить этот узел и все связанные с ним подтемы? Это действие нельзя отменить.')) return;
    
    setIsSaving(true);
    try {
      const hierarchyChildren = new Map();
      const nodeIdsByKey = new Map(allNodes.map((node) => [String(node.id), node.id]));

      allEdges
        .filter((edge) => edge.isHierarchy === true)
        .forEach((edge) => {
          const sourceKey = String(edge.sourceNodeId);
          const children = hierarchyChildren.get(sourceKey) || [];
          children.push(String(edge.targetNodeId));
          hierarchyChildren.set(sourceKey, children);
        });

      const nodeKeysToDelete = new Set();
      const nodeIdsToDelete = [];

      const collectSubtree = (nodeKey) => {
        if (nodeKeysToDelete.has(nodeKey)) return;
        nodeKeysToDelete.add(nodeKey);

        const childKeys = hierarchyChildren.get(nodeKey) || [];
        childKeys.forEach(collectSubtree);

        const actualNodeId = nodeIdsByKey.get(nodeKey);
        if (actualNodeId !== undefined) {
          nodeIdsToDelete.push(actualNodeId);
        }
      };

      collectSubtree(selectedNodeKey);
      
      // Удаляем все связи, связанные с этими узлами
      const edgesToDelete = allEdges.filter((edge) => 
        nodeKeysToDelete.has(String(edge.sourceNodeId)) || nodeKeysToDelete.has(String(edge.targetNodeId))
      );
      
      for (const edge of edgesToDelete) {
        await edgesService.delete(edge.id);
      }
      
      // Удаляем узлы
      for (const nodeId of nodeIdsToDelete) {
        await nodesService.delete(nodeId);
      }
      
      setSelectedNode(null);
      await loadMap();
    } catch (error) {
      console.error('Ошибка удаления узла:', error);
      alert('Ошибка удаления узла');
    } finally {
      setIsSaving(false);
    }
  }, [selectedNode, allNodes, allEdges, loadMap]);

  // Обновление узла после редактирования
  const handleNodeUpdate = useCallback(async () => {
    await loadMap();
    setSelectedNode(null);
  }, [loadMap]);

  // Экспорт в PNG
  const handleToggleConnectionMode = useCallback(() => {
    if (connectionDraftRef.current.active) {
      resetConnectionDraft();
      return;
    }

    setSelectedNode(null);
    updateConnectionDraft({ active: true, sourceMindId: null, sourceTitle: '' });
  }, [resetConnectionDraft, updateConnectionDraft]);

  const handleExportPNG = useCallback(() => {
    if (mindMapRef.current) {
      mindMapRef.current.export();
    }
  }, []);

  // Экспорт в JSON
  const handleExportJSON = useCallback(() => {
    if (mindMapRef.current) {
      const data = mindMapRef.current.getData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${map.title || 'карта'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [map.title]);

  useEffect(() => {
    return () => {
      if (mindMapRef.current) {
        cleanupMindMapListeners();
        mindMapRef.current.destroy();
      }
    };
  }, [cleanupMindMapListeners]);

  useEffect(() => {
    loadMap();
  }, []);

  return (
    <div className="map-editor">
      {isLoading && (
        <div className="map-editor-loading map-editor-loading-overlay">
          <div className="spinner-large"></div>
          <p>Загрузка карты...</p>
        </div>
      )}
      {isOwner && (
        <div className="left-toolbar">
          <div className="toolbar-section">
            <button
              onClick={handleAddTopic}
              className="toolbar-btn"
              data-tooltip="Добавить тему (того же уровня)"
            >
              <span className="material-icons">note_add</span>
            </button>
            <button
              onClick={handleAddSubtopic}
              className="toolbar-btn"
              data-tooltip="Добавить подтему [Tab]"
            >
              <span className="material-icons">playlist_add</span>
            </button>
            <button
              onClick={handleToggleConnectionMode}
              className={`toolbar-btn ${connectionDraft.active ? 'active' : ''}`}
              data-tooltip={connectionDraft.active ? 'Режим создания связи' : 'Создать связь между узлами'}
            >
              <span className="material-icons">device_hub</span>
            </button>
            
            <button
              onClick={() => setShowTypeManager(true)}
              className="toolbar-btn"
              data-tooltip="Типы узлов"
            >
              <span className="material-icons">category</span>
            </button>
            <button
              onClick={() => {
                setTypeManagerCategory('edge');
                setShowTypeManager(true);
              }}
              className="toolbar-btn"
              data-tooltip="Типы связей"
            >
              <span className="material-icons">timeline</span>
            </button>
          </div>
        </div>
      )}

      <div className="right-top-toolbar">
        <button
          onClick={() => setShowAccessManager(true)}
          className="toolbar-btn"
          title="Управление доступом"
        >
          <span className="material-icons">people</span>
          <span>Доступ</span>
        </button>
        
        <div className="export-dropdown">
          <button
            className="toolbar-btn"
            title="Экспорт"
          >
            <span className="material-icons">download</span>
            <span>Экспорт</span>
          </button>
          <div className="export-menu">
            <button onClick={handleExportPNG} className="export-menu-item">
              <span className="material-icons">image</span>
              <span>PNG</span>
            </button>
            <button onClick={handleExportJSON} className="export-menu-item">
              <span className="material-icons">code</span>
              <span>JSON</span>
            </button>
          </div>
        </div>
        
        <button
          className="toolbar-btn back-btn"
          onClick={onClose}
          title="Вернуться к списку карт"
        >
          <span className="material-icons">close</span>
          <span>Выход</span>
        </button>
      </div>

      <div ref={containerRef} className="mind-map-container" />

      {isSaving && (
        <div className="saving-indicator">
          <span className="material-icons">save</span>
          <span>Сохранение...</span>
        </div>
      )}

      {selectedNode && isOwner && (
        <NodeSidebar
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onDelete={handleDeleteNode}
          isOwner={isOwner}
          userRole={userRole}
          systemNodeTypes={systemNodeTypes}
          customNodeTypes={customNodeTypes}
          onTypesUpdate={loadMap}
          onRefreshMap={handleNodeUpdate}
          startEditing={false}
          onDetach={() => {}}
          isDraggable={false}
          onAddSubtopic={handleAddSubtopic}
        />
      )}

      {showAccessManager && (
        <AccessManager
          mapId={map.id}
          isOwner={isOwner}
          onClose={() => setShowAccessManager(false)}
        />
      )}
      
      {showTypeManager && (
        <TypeManager
          mapId={map.id}
          isOwner={isOwner}
          category={typeManagerCategory}
          onClose={() => setShowTypeManager(false)}
          onTypesChange={loadMap}
        />
      )}
      
      {showQuizModal && selectedNodeForQuiz && (
        <QuizModal
          isOpen={showQuizModal}
          onClose={() => {
            setShowQuizModal(false);
            setSelectedNodeForQuiz(null);
          }}
          node={selectedNodeForQuiz}
          onSuccess={handleQuizSuccess}
          mapId={map.id}
        />
      )}

      {showLockedNodePrompt && lockedNodePromptData && (
        <div
          className="locked-node-modal-overlay"
          onClick={() => {
            setShowLockedNodePrompt(false);
            setLockedNodePromptData(null);
          }}
        >
          <div
            className="locked-node-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="locked-node-modal-header">
              <span className="material-icons">lock</span>
              <h3>Узел закрыт</h3>
            </div>
            <div className="locked-node-modal-content">
              <p>
                Узел <strong>{lockedNodePromptData.title || 'Без названия'}</strong> пока закрыт.
              </p>
              <p>Чтобы открыть его и посмотреть информацию, нужно пройти викторину.</p>
            </div>
            <div className="locked-node-modal-footer">
              <button
                className="locked-node-secondary-btn"
                onClick={() => {
                  setShowLockedNodePrompt(false);
                  setLockedNodePromptData(null);
                }}
              >
                Позже
              </button>
              <button
                className="locked-node-primary-btn"
                onClick={handleStartQuizForLockedNode}
              >
                Пройти викторину
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showNodeInfoModal && selectedNodeInfo && (
        <NodeInfoModal
          isOpen={showNodeInfoModal}
          onClose={() => setShowNodeInfoModal(false)}
          node={selectedNodeInfo}
          userRole={userRole}
        />
      )}
      
      <ProgressPanel 
        unlockedNodes={unlockedNodes} 
        totalNodes={totalNodesCount} 
        userRole={userRole} 
      />
    </div>
  );
}

export default MapEditor;
