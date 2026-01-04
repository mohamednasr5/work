/* Toast Notifications */
.toast-notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    min-width: 300px;
    max-width: 400px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xl);
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    z-index: 10000;
    animation: slideInRight 0.5s ease;
    border-right: 4px solid;
}

.toast-notification.success {
    border-right-color: var(--success-color);
}

.toast-notification.error {
    border-right-color: var(--accent-color);
}

.toast-notification.warning {
    border-right-color: var(--warning-color);
}

.toast-notification.info {
    border-right-color: var(--info-color);
}

.toast-icon {
    font-size: 1.5rem;
}

.toast-content {
    flex: 1;
}

.toast-close {
    background: none;
    border: none;
    color: var(--text-light);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background 0.3s ease;
}

.toast-close:hover {
    background: rgba(0, 0, 0, 0.1);
}

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}
