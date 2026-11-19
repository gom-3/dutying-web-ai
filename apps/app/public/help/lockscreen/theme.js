try {
    document.documentElement.dataset.theme = localStorage.getItem('dutying-lockscreen-tutorial-theme') || 'system';
} catch (e) {}
