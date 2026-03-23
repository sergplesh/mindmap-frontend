import React from 'react';
import './Navigation.css';

const Navigation = ({ currentPage, onNavigate, user, onLogout }) => {
  return (
    <nav className="main-nav">
      <div className="nav-brand">
        <span className="material-icons nav-logo">account_tree</span>
        <span className="nav-title">Knowledge Map</span>
      </div>
      
      <div className="nav-links">
        <button
          className={`nav-link ${currentPage === 'owned' ? 'active' : ''}`}
          onClick={() => onNavigate('owned')}
        >
          <span className="material-icons">dashboard</span>
          <span>Мои карты</span>
        </button>
        <button
          className={`nav-link ${currentPage === 'observer' ? 'active' : ''}`}
          onClick={() => onNavigate('observer')}
        >
          <span className="material-icons">visibility</span>
          <span>Для просмотра</span>
        </button>
        <button
          className={`nav-link ${currentPage === 'learner' ? 'active' : ''}`}
          onClick={() => onNavigate('learner')}
        >
          <span className="material-icons">school</span>
          <span>Для изучения</span>
        </button>
      </div>

      <div className="nav-user">
        <span className="user-name">
          <span className="material-icons">account_circle</span>
          {user?.username}
        </span>
        <button className="logout-btn" onClick={onLogout} title="Выйти">
          <span className="material-icons">exit_to_app</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
