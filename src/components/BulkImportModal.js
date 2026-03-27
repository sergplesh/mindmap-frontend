import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { useAccessService } from '../hooks/useAccessService';
import { useUserService } from '../hooks/useUserService';
import './BulkImportModal.css';

const getRoleLabel = role =>
  role === 'learner' ? 'Обучающийся' : 'Наблюдатель';

const getRoleChangeMessage = (currentRole, nextRole) =>
  `Имеет доступ как ${getRoleLabel(currentRole).toLowerCase()}, будет изменено на ${getRoleLabel(nextRole).toLowerCase()}`;

const getRoleMatchMessage = role =>
  `Уже имеет доступ (${getRoleLabel(role).toLowerCase()}) - роль совпадает`;

const getInviteReadyMessage = role =>
  `Готов к приглашению как ${getRoleLabel(role).toLowerCase()}`;

const BulkImportModal = ({ isOpen, onClose, onImport, mapId, isOwner }) => {
  const accessService = useAccessService();
  const userService = useUserService();
  const [previewData, setPreviewData] = useState([]);
  const [selectedRole, setSelectedRole] = useState('learner');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('upload');
  const [importResult, setImportResult] = useState(null);
  const [checkingUsers, setCheckingUsers] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen || !isOwner) return null;

  const handleFileUpload = e => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setError('');

    const fileExtension = uploadedFile.name.split('.').pop().toLowerCase();

    if (fileExtension === 'csv') {
      parseCSV(uploadedFile);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      parseExcel(uploadedFile);
    } else {
      setError('Поддерживаются только файлы .xlsx, .xls и .csv');
    }
  };

  const parseCSV = file => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        if (results.data && results.data.length > 0) {
          processData(results.data);
        } else {
          setError('Файл пуст или имеет неправильный формат');
        }
      },
      error: parseError => {
        setError('Ошибка парсинга CSV: ' + parseError.message);
      }
    });
  };

  const parseExcel = file => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData && jsonData.length > 0) {
          processData(jsonData);
        } else {
          setError('Файл пуст или имеет неправильный формат');
        }
      } catch (parseError) {
        setError('Ошибка парсинга Excel: ' + parseError.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processData = data => {
    const firstRow = data[0];
    const possibleUsernameFields = [
      'username',
      'login',
      'user',
      'name',
      'логин',
      'пользователь'
    ];

    let usernameField = null;
    for (const field of possibleUsernameFields) {
      if (firstRow[field] !== undefined) {
        usernameField = field;
        break;
      }
    }

    if (!usernameField) {
      usernameField = Object.keys(firstRow)[0];
    }

    const usernames = data
      .map(row => row[usernameField]?.toString().trim())
      .filter(username => username && username.length > 0);

    if (usernames.length === 0) {
      setError('Не найдено логинов в файле');
      return;
    }

    const uniqueUsernames = [...new Set(usernames)];

    setPreviewData(
      uniqueUsernames.map(username => ({
        username,
        status: 'checking',
        message: 'Проверка...',
        currentRole: null,
        canUpdate: false,
        userId: null,
        selectedRole
      }))
    );
    setStep('preview');

    checkUsers(uniqueUsernames);
  };

  const checkUsers = async usernames => {
    setCheckingUsers(true);

    let existingUsers = [];
    try {
      const accessData = await accessService.getMapAccess(mapId);
      existingUsers = Array.isArray(accessData) ? accessData : [];
    } catch (loadError) {
      console.error('Ошибка загрузки существующих пользователей:', loadError);
    }

    const existingUsersMap = new Map();
    existingUsers.forEach(user => {
      existingUsersMap.set(user.username?.toLowerCase(), {
        role: user.role,
        accessId: user.id,
        userId: user.userId || user.id
      });
    });

    const checkedData = [];

    for (const username of usernames) {
      let status = 'pending';
      let message = '';
      let currentRole = null;
      let canUpdate = false;
      let userId = null;

      const existingUser = existingUsersMap.get(username.toLowerCase());

      if (existingUser) {
        currentRole = existingUser.role;

        if (currentRole !== selectedRole) {
          status = 'exists';
          message = getRoleChangeMessage(currentRole, selectedRole);
          canUpdate = true;
        } else {
          status = 'exists_same';
          message = getRoleMatchMessage(currentRole);
          canUpdate = false;
        }
        userId = existingUser.userId;
      } else {
        try {
          const userCheck = await userService.checkUserExists(username);

          if (userCheck.exists) {
            status = 'valid';
            message = getInviteReadyMessage(selectedRole);
            canUpdate = true;
            userId = userCheck.userId;
          } else {
            status = 'not_found';
            message = userCheck.message || 'Пользователь не найден';
            canUpdate = false;
          }
        } catch (checkError) {
          console.error('Ошибка проверки пользователя:', checkError);
          status = 'error';
          message =
            checkError.response?.data?.message || 'Ошибка проверки пользователя';
          canUpdate = false;
        }
      }

      checkedData.push({
        username,
        status,
        message,
        currentRole,
        canUpdate,
        userId,
        selectedRole
      });
    }

    setPreviewData(checkedData);
    setCheckingUsers(false);
  };

  const updateAllRoles = newRole => {
    setSelectedRole(newRole);
    setPreviewData(prev =>
      prev.map(user => {
        let newStatus = user.status;
        let newMessage = user.message;
        let newCanUpdate = user.canUpdate;

        if (user.currentRole) {
          if (user.currentRole !== newRole) {
            newStatus = 'exists';
            newMessage = getRoleChangeMessage(user.currentRole, newRole);
            newCanUpdate = true;
          } else {
            newStatus = 'exists_same';
            newMessage = getRoleMatchMessage(user.currentRole);
            newCanUpdate = false;
          }
        } else if (user.status === 'valid') {
          newMessage = getInviteReadyMessage(newRole);
          newCanUpdate = true;
        }

        return {
          ...user,
          selectedRole: newRole,
          status: newStatus,
          message: newMessage,
          canUpdate: newCanUpdate
        };
      })
    );
  };

  const updateUserRole = (index, newRole) => {
    setPreviewData(prev => {
      const updated = [...prev];
      const user = updated[index];
      user.selectedRole = newRole;

      if (user.currentRole) {
        if (user.currentRole !== newRole) {
          user.status = 'exists';
          user.message = getRoleChangeMessage(user.currentRole, newRole);
          user.canUpdate = true;
        } else {
          user.status = 'exists_same';
          user.message = getRoleMatchMessage(user.currentRole);
          user.canUpdate = false;
        }
      } else if (user.status === 'valid') {
        user.message = getInviteReadyMessage(newRole);
        user.canUpdate = true;
      }

      return updated;
    });
  };

  const handleImport = async () => {
    const usersToImport = previewData.filter(
      user => user.status === 'valid' || (user.status === 'exists' && user.canUpdate)
    );

    if (usersToImport.length === 0) {
      setError('Нет пользователей для импорта');
      return;
    }

    setLoading(true);
    setStep('importing');

    let successCount = 0;
    let errorCount = 0;
    let updateCount = 0;
    let newCount = 0;

    for (const user of usersToImport) {
      try {
        if (user.status === 'exists') {
          const accessData = await accessService.getMapAccess(mapId);
          const existingUser = accessData.find(
            current => current.username?.toLowerCase() === user.username.toLowerCase()
          );

          if (existingUser && existingUser.role !== user.selectedRole) {
            await accessService.updateRole(existingUser.id, user.selectedRole);
            updateCount++;

            const index = previewData.findIndex(item => item.username === user.username);
            if (index !== -1) {
              previewData[index].status = 'success';
              previewData[index].message = `Роль изменена на ${getRoleLabel(
                user.selectedRole
              ).toLowerCase()}`;
            }
          }
          successCount++;
        } else if (user.status === 'valid') {
          await accessService.invite(mapId, user.username, user.selectedRole);

          const index = previewData.findIndex(item => item.username === user.username);
          if (index !== -1) {
            previewData[index].status = 'success';
            previewData[index].message = `Приглашён как ${getRoleLabel(
              user.selectedRole
            ).toLowerCase()}`;
          }
          newCount++;
          successCount++;
        }
      } catch (importError) {
        console.error('Ошибка при импорте:', importError);
        const index = previewData.findIndex(item => item.username === user.username);
        if (index !== -1) {
          previewData[index].status = 'error';
          previewData[index].message =
            importError.response?.data?.message ||
            importError.message ||
            'Ошибка операции';
        }
        errorCount++;
      }

      setPreviewData([...previewData]);
    }

    setImportResult({
      total: usersToImport.length,
      success: successCount,
      error: errorCount,
      updated: updateCount,
      new: newCount,
      skipped: previewData.filter(
        user => user.status === 'exists_same' || user.status === 'not_found'
      ).length
    });

    setLoading(false);

    if (successCount > 0) {
      onImport(successCount);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { username: 'ivanov' },
      { username: 'petrov' },
      { username: 'sidorov' }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
    XLSX.writeFile(wb, 'template_users.xlsx');
  };

  const resetAndClose = () => {
    setPreviewData([]);
    setStep('upload');
    setError('');
    setImportResult(null);
    setSelectedRole('learner');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'valid':
        return <span className="material-icons status-icon valid">check_circle</span>;
      case 'exists':
        return <span className="material-icons status-icon exists">update</span>;
      case 'exists_same':
        return (
          <span className="material-icons status-icon exists-same">
            check_circle
          </span>
        );
      case 'not_found':
        return <span className="material-icons status-icon not-found">error</span>;
      case 'success':
        return <span className="material-icons status-icon success">check_circle</span>;
      case 'error':
        return <span className="material-icons status-icon error">error</span>;
      case 'skipped':
        return <span className="material-icons status-icon skipped">skip_next</span>;
      case 'checking':
        return <span className="material-icons status-icon checking">schedule</span>;
      default:
        return null;
    }
  };

  const getStatusText = (status, message) => {
    switch (status) {
      case 'valid':
        return <span className="status-text valid">{message || 'Готов к приглашению'}</span>;
      case 'exists':
        return <span className="status-text exists">{message || 'Будет обновлена роль'}</span>;
      case 'exists_same':
        return (
          <span className="status-text exists-same">
            {message || 'Роль уже соответствует'}
          </span>
        );
      case 'not_found':
        return <span className="status-text not-found">{message || 'Пользователь не найден'}</span>;
      case 'success':
        return <span className="status-text success">{message || 'Успешно'}</span>;
      case 'error':
        return <span className="status-text error">{message || 'Ошибка'}</span>;
      case 'skipped':
        return <span className="status-text skipped">{message || 'Пропущен'}</span>;
      case 'checking':
        return <span className="status-text checking">{message || 'Проверка...'}</span>;
      default:
        return <span className="status-text">{message}</span>;
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'upload':
        return (
          <>
            <div className="upload-area">
              <div className="upload-icon">
                <span className="material-icons">cloud_upload</span>
              </div>
              <p>Перетащите файл сюда или нажмите для выбора</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="file-input"
              />
              <button className="template-btn" onClick={downloadTemplate}>
                <span className="material-icons">file_download</span>
                Скачать шаблон
              </button>
            </div>

            <div className="import-options">
              <h4>Настройки импорта</h4>
              <div className="role-selector">
                <label>Роль для всех пользователей:</label>
                <select value={selectedRole} onChange={e => updateAllRoles(e.target.value)}>
                  <option value="learner">Обучающийся</option>
                  <option value="observer">Наблюдатель</option>
                </select>
              </div>
            </div>

            <div className="info-box">
              <span className="material-icons">info</span>
              <div>
                <strong>Формат файла:</strong>
                <p>Excel (.xlsx, .xls) или CSV файл с колонкой "username" (логин).</p>
                <p>
                  Поддерживаются также названия колонок: login, user, name, логин,
                  пользователь
                </p>
              </div>
            </div>
          </>
        );

      case 'preview':
        return (
          <>
            <div className="preview-header">
              <h4>
                Предпросмотр ({previewData.length} пользователей)
                {checkingUsers && <span className="checking-badge">Проверка...</span>}
              </h4>
              <div className="preview-actions">
                <button className="back-btn" onClick={() => setStep('upload')}>
                  <span className="material-icons">arrow_back</span>
                  Назад
                </button>
              </div>
            </div>

            <div className="role-batch-update">
              <label>Изменить роль для всех:</label>
              <select
                value={selectedRole}
                onChange={e => updateAllRoles(e.target.value)}
                className="batch-role-select"
              >
                <option value="learner">Обучающийся</option>
                <option value="observer">Наблюдатель</option>
              </select>
            </div>

            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Логин</th>
                    <th>Текущая роль</th>
                    <th>Новая роль</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 50).map((user, index) => (
                    <tr key={index} className={`status-row ${user.status}`}>
                      <td>{index + 1}</td>
                      <td className="username-cell">{user.username}</td>
                      <td className="current-role-cell">
                        {user.currentRole ? (
                          <span className={`role-badge ${user.currentRole}`}>
                            {getRoleLabel(user.currentRole)}
                          </span>
                        ) : (
                          <span className="role-badge none">-</span>
                        )}
                      </td>
                      <td className="new-role-cell">
                        {user.canUpdate || user.status === 'valid' ? (
                          <select
                            value={user.selectedRole}
                            onChange={e => updateUserRole(index, e.target.value)}
                            className={`role-select-small editable ${
                              user.status === 'exists' ? 'update-mode' : ''
                            }`}
                          >
                            <option value="learner">Обучающийся</option>
                            <option value="observer">Наблюдатель</option>
                          </select>
                        ) : (
                          <span className="role-select-small disabled">
                            {user.status === 'exists_same'
                              ? getRoleLabel(user.selectedRole)
                              : '-'}
                          </span>
                        )}
                      </td>
                      <td className="status-cell">
                        <div className="status-wrapper">
                          {getStatusIcon(user.status)}
                          {getStatusText(user.status, user.message)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 50 && (
                <p className="preview-note">
                  Показано первых 50 из {previewData.length} пользователей
                </p>
              )}
            </div>

            <div className="import-stats">
              <div className="stat-item valid">
                <span className="material-icons">person_add</span>
                <span>Новые: {previewData.filter(user => user.status === 'valid').length}</span>
              </div>
              <div className="stat-item exists">
                <span className="material-icons">edit</span>
                <span>
                  Обновить роль:{' '}
                  {previewData.filter(user => user.status === 'exists' && user.canUpdate).length}
                </span>
              </div>
              <div className="stat-item exists-same">
                <span className="material-icons">check_circle</span>
                <span>
                  Роль совпадает:{' '}
                  {previewData.filter(user => user.status === 'exists_same').length}
                </span>
              </div>
              <div className="stat-item not-found">
                <span className="material-icons">error_outline</span>
                <span>
                  Не найдены:{' '}
                  {previewData.filter(user => user.status === 'not_found').length}
                </span>
              </div>
            </div>

            <div className="import-actions">
              <button
                className="import-btn"
                onClick={handleImport}
                disabled={
                  loading ||
                  previewData.filter(
                    user =>
                      user.status === 'valid' ||
                      (user.status === 'exists' && user.canUpdate)
                  ).length === 0
                }
              >
                {loading
                  ? 'Импорт...'
                  : `Импортировать (${
                      previewData.filter(
                        user =>
                          user.status === 'valid' ||
                          (user.status === 'exists' && user.canUpdate)
                      ).length
                    })`}
              </button>
            </div>
          </>
        );

      case 'importing':
        return (
          <div className="importing-progress">
            <div className="spinner-large"></div>
            <h4>Импорт пользователей...</h4>
            <p>Пожалуйста, подождите</p>
            <div className="progress-stats">
              <div>Успешно: {previewData.filter(user => user.status === 'success').length}</div>
              <div>
                Обновлено:{' '}
                {previewData.filter(user => user.message?.includes('Роль изменена')).length}
              </div>
              <div>Ошибок: {previewData.filter(user => user.status === 'error').length}</div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bulk-import-overlay" onClick={resetAndClose}>
      <div className="bulk-import-modal" onClick={e => e.stopPropagation()}>
        <div className="bulk-import-header">
          <h3>
            <span className="material-icons">file_upload</span>
            Массовый импорт пользователей
          </h3>
          <button className="close-btn" onClick={resetAndClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="bulk-import-content">
          {error && (
            <div className="error-message">
              <span className="material-icons">error</span>
              <span>{error}</span>
            </div>
          )}

          {importResult && step !== 'importing' && (
            <div className="import-result">
              <div
                className={`result-icon ${
                  importResult.error === 0 ? 'success' : 'partial'
                }`}
              >
                <span className="material-icons">
                  {importResult.error === 0 ? 'check_circle' : 'warning'}
                </span>
              </div>
              <h4>Импорт завершён</h4>
              <div className="result-stats">
                <p>
                  Успешно: {importResult.success} / {importResult.total}
                </p>
                {importResult.new > 0 && (
                  <p>Новых пользователей: {importResult.new}</p>
                )}
                {importResult.updated > 0 && (
                  <p>Обновлено ролей: {importResult.updated}</p>
                )}
                {importResult.error > 0 && (
                  <p className="error-count">Ошибок: {importResult.error}</p>
                )}
                {importResult.skipped > 0 && (
                  <p className="skipped-count">Пропущено: {importResult.skipped}</p>
                )}
              </div>
              <button className="done-btn" onClick={resetAndClose}>
                Готово
              </button>
            </div>
          )}

          {!importResult && renderContent()}
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;
