import React, { useState, useEffect } from 'react';
import { useAuthService } from './hooks/useAuthService';
import Navigation from './components/Navigation';
import MapsPage from './pages/MapsPage';
import MapEditor from './components/MapEditor';
import './App.css';

const SELECTED_MAP_STORAGE_KEY = 'mindmap:selectedMap';
const AUTH_EXPIRED_EVENT = 'mindmap:auth-expired';

function App() {
  const authService = useAuthService();
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('owned');
  const [selectedMap, setSelectedMap] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      const storedMap = sessionStorage.getItem(SELECTED_MAP_STORAGE_KEY);
      if (storedMap) {
        try {
          setSelectedMap(JSON.parse(storedMap));
        } catch {
          sessionStorage.removeItem(SELECTED_MAP_STORAGE_KEY);
        }
      }
    } else {
      sessionStorage.removeItem(SELECTED_MAP_STORAGE_KEY);
    }
  }, [authService]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setSelectedMap(null);
      setCurrentPage('owned');
      sessionStorage.removeItem(SELECTED_MAP_STORAGE_KEY);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (!username.trim()) {
        alert('Введите логин');
        return;
      }
      if (!isLogin) {
        if (username.trim().length < 3) {
          alert('Логин должен быть не короче 3 символов');
          return;
        }
        if (password.length < 6) {
          alert('Пароль должен быть не короче 6 символов');
          return;
        }
      }
      let response;
      if (isLogin) {
        response = await authService.login(username, password);
      } else {
        response = await authService.register(username, password);
      }
      setUser(response.user);
      setCurrentPage('owned');
    } catch (error) {
      const responseData = error.response?.data;
      const validationErrors = responseData?.errors ? Object.values(responseData.errors).flat().join('; ') : null;
      alert('Ошибка: ' + (responseData?.message || validationErrors || 'Неизвестная ошибка'));
    }
  };
  
  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setSelectedMap(null);
    setCurrentPage('owned');
    sessionStorage.removeItem(SELECTED_MAP_STORAGE_KEY);
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
    setSelectedMap(null);
    sessionStorage.removeItem(SELECTED_MAP_STORAGE_KEY);
  };

  const handleSelectMap = (map) => {
    setSelectedMap(map);
    sessionStorage.setItem(SELECTED_MAP_STORAGE_KEY, JSON.stringify(map));
  };

  const handleBackToMaps = () => {
    setSelectedMap(null);
    sessionStorage.removeItem(SELECTED_MAP_STORAGE_KEY);
  };

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="material-icons" style={{ fontSize: '48px' }}>account_tree</span>
          </div>
          <h2>{isLogin ? 'Вход' : 'Регистрация'}</h2>
          <form onSubmit={handleAuth}>
            <input
              type="text"
              placeholder="Логин"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">{isLogin ? 'Войти' : 'Зарегистрироваться'}</button>
          </form>
          <button className="auth-switch" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Navigation
        currentPage={currentPage}
        onNavigate={handleNavigate}
        user={user}
        onLogout={handleLogout}
      />
      
      <main className="main-content">
        {selectedMap ? (
          <MapEditor
            map={selectedMap}
            userId={user.id}
            onClose={handleBackToMaps}
          />
        ) : (
          <MapsPage
            userId={user.id}
            currentPage={currentPage}
            onSelectMap={handleSelectMap}
          />
        )}
      </main>
    </div>
  );
}

export default App;
