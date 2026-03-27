import React, { useState, useEffect, useCallback } from 'react';
import { useAccessService } from '../hooks/useAccessService';
import { useAuthService } from '../hooks/useAuthService';
import BulkImportModal from './BulkImportModal';
import './AccessManager.css';

const AccessManager = ({ mapId, isOwner, onClose }) => {
  const accessService = useAccessService();
  const authService = useAuthService();
  const [users, setUsers] = useState([]);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('observer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const currentUser = authService.getCurrentUser();

  const loadAccess = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await accessService.getMapAccess(mapId);

      console.log('Получены данные доступа:', data);

      let usersArray = [];

      if (Array.isArray(data)) {
        usersArray = data;
      } else if (data && typeof data === 'object') {
        if (data.users && Array.isArray(data.users)) {
          usersArray = data.users;
        } else if (data.accesses && Array.isArray(data.accesses)) {
          usersArray = data.accesses;
        } else if (data.data && Array.isArray(data.data)) {
          usersArray = data.data;
        } else {
          console.warn('Неизвестная структура ответа:', data);
          usersArray = [];
        }
      }

      const validUsers = usersArray.filter(
        user => user && (user.username || user.user?.username)
      );

      const normalizedUsers = validUsers
        .map(user => ({
          accessId: user.accessId || user.id || user.access?.id,
          userId: user.userId || user.user?.id || null,
          username: user.username || user.user?.username,
          role: user.role || user.access?.role || 'observer'
        }))
        .filter(user => user.accessId && user.username);

      console.log('Нормализованные пользователи:', normalizedUsers);
      setUsers(normalizedUsers);
    } catch (error) {
      console.error('Ошибка загрузки доступа:', error);
      setError(
        'Не удалось загрузить список доступа: ' +
          (error.response?.data?.message || error.message)
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [accessService, mapId]);

  useEffect(() => {
    if (isOwner) {
      loadAccess();
    }
  }, [isOwner, loadAccess]);

  const handleInvite = async () => {
    if (!inviteUsername.trim()) {
      setError('Введите имя пользователя');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('Приглашаем пользователя:', {
        mapId,
        username: inviteUsername.trim(),
        role: inviteRole
      });

      const result = await accessService.invite(
        mapId,
        inviteUsername.trim(),
        inviteRole
      );

      console.log('Результат приглашения:', result);

      setSuccess(
        `Пользователь ${inviteUsername} приглашён как ${
          inviteRole === 'observer' ? 'наблюдатель' : 'обучающийся'
        }`
      );
      setInviteUsername('');

      setTimeout(() => {
        loadAccess();
      }, 500);
    } catch (error) {
      console.error('Ошибка приглашения:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Ошибка приглашения пользователя';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (accessId, newRole) => {
    setLoading(true);
    setError('');

    try {
      console.log('Изменяем роль:', { accessId, newRole });
      await accessService.updateRole(accessId, newRole);
      await loadAccess();
      setSuccess('Роль пользователя обновлена');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка изменения роли:', error);
      setError(
        'Ошибка изменения роли: ' +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccess = async (accessId, username) => {
    if (!window.confirm(`Удалить доступ пользователя ${username}?`)) return;

    setLoading(true);
    setError('');

    try {
      console.log('Удаляем доступ:', { accessId, username });
      await accessService.removeAccess(accessId);
      await loadAccess();
      setSuccess(`Доступ пользователя ${username} удалён`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка удаления доступа:', error);
      setError(
        'Ошибка удаления доступа: ' +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = count => {
    setSuccess(`Успешно импортировано ${count} пользователей`);
    setTimeout(() => setSuccess(''), 3000);
    loadAccess();
    setShowBulkImport(false);
  };

  const filteredUsers = users.filter(user => {
    if (!user || !user.username) return false;
    return user.username.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const isCurrentUser = useCallback(
    user => (
      user?.userId !== undefined &&
      user?.userId !== null &&
      currentUser?.id !== undefined &&
      currentUser?.id !== null &&
      String(user.userId) === String(currentUser.id)
    ),
    [currentUser?.id]
  );

  if (!isOwner) {
    return (
      <div className="access-manager-overlay" onClick={onClose}>
        <div
          className="access-manager-modal"
          onClick={e => e.stopPropagation()}
        >
          <div className="access-manager-header">
            <h3>Доступ к карте</h3>
            <button className="close-btn" onClick={onClose}>
              <span className="material-icons">close</span>
            </button>
          </div>
          <div className="access-manager-content">
            <div className="access-denied">
              <span className="material-icons">lock</span>
              <p>Только владелец карты может управлять доступом</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="access-manager-overlay" onClick={onClose}>
        <div
          className="access-manager-modal"
          onClick={e => e.stopPropagation()}
        >
          <div className="access-manager-header">
            <h3>Управление доступом</h3>
            <button className="close-btn" onClick={onClose}>
              <span className="material-icons">close</span>
            </button>
          </div>

          <div className="access-manager-content">
            <div className="invite-section">
              <h4>Пригласить пользователя</h4>
              <div className="invite-form">
                <div className="invite-input-group">
                  <span className="material-icons">person</span>
                  <input
                    type="text"
                    placeholder="Имя пользователя"
                    value={inviteUsername}
                    onChange={e => setInviteUsername(e.target.value)}
                    disabled={loading}
                    onKeyPress={e => {
                      if (e.key === 'Enter') {
                        handleInvite();
                      }
                    }}
                  />
                </div>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  disabled={loading}
                >
                  <option value="observer">Наблюдатель</option>
                  <option value="learner">Обучающийся</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={loading || !inviteUsername.trim()}
                  className="invite-btn"
                >
                  <span className="material-icons">send</span>
                  Пригласить
                </button>
              </div>

              <div className="bulk-import-section">
                <button
                  className="bulk-import-btn"
                  onClick={() => setShowBulkImport(true)}
                  disabled={loading}
                >
                  <span className="material-icons">file_upload</span>
                  Массовый импорт
                </button>
              </div>

              <div className="roles-hint">
                <div className="role-hint">
                  <span className="role-badge observer">Наблюдатель</span>
                  <span className="role-description">
                    - может просматривать карту, все узлы открыты
                  </span>
                </div>
                <div className="role-hint">
                  <span className="role-badge learner">Обучающийся</span>
                  <span className="role-description">
                    - может открывать узлы через тесты
                  </span>
                </div>
              </div>

              {error && (
                <div className="message error">
                  <span className="material-icons">error</span>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="message success">
                  <span className="material-icons">check_circle</span>
                  <span>{success}</span>
                </div>
              )}
            </div>

            <div className="search-section">
              <div className="search-box">
                <span className="material-icons">search</span>
                <input
                  type="text"
                  placeholder="Поиск по имени..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    className="clear-search"
                    onClick={() => setSearchTerm('')}
                    title="Очистить поиск"
                  >
                    <span className="material-icons">close</span>
                  </button>
                )}
              </div>
            </div>

            <div className="users-list">
              <h4>
                Пользователи с доступом
                {users.length > 0 && (
                  <span className="users-count"> ({users.length})</span>
                )}
              </h4>

              {loading && (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <p>Загрузка...</p>
                </div>
              )}

              {!loading && filteredUsers.length === 0 && (
                <div className="empty-state">
                  <span className="material-icons">people_outline</span>
                  <p>
                    {searchTerm
                      ? 'Пользователи не найдены'
                      : 'Нет приглашённых пользователей'}
                  </p>
                  {searchTerm && (
                    <p className="empty-hint">Попробуйте изменить поиск</p>
                  )}
                  {!searchTerm && users.length === 0 && (
                    <p className="empty-hint">Пригласите первого пользователя</p>
                  )}
                </div>
              )}

              {!loading &&
                filteredUsers.map(user => (
                  <div key={user.accessId} className="user-item">
                    <div className="user-info">
                      <div className="user-avatar">
                        <span className="material-icons">account_circle</span>
                      </div>
                      <div className="user-details">
                        <span className="username">{user.username}</span>
                        {isCurrentUser(user) && (
                          <span className="current-user-badge">Это вы</span>
                        )}
                      </div>
                    </div>

                    <div className="user-actions">
                      <select
                        value={user.role}
                        onChange={e => handleRoleChange(user.accessId, e.target.value)}
                        disabled={loading}
                        className={`role-select ${user.role}`}
                      >
                        <option value="observer">Наблюдатель</option>
                        <option value="learner">Обучающийся</option>
                      </select>

                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveAccess(user.accessId, user.username)}
                        disabled={loading}
                        title="Удалить доступ"
                      >
                        <span className="material-icons">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <button
              className="refresh-btn"
              onClick={loadAccess}
              disabled={loading}
            >
              <span className="material-icons">refresh</span>
              Обновить список
            </button>
          </div>
        </div>
      </div>

      {showBulkImport && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          mapId={mapId}
          isOwner={isOwner}
        />
      )}
    </>
  );
};

export default AccessManager;
