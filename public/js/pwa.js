// Регистрируем Service Worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('SW зарегистрирован'))
      .catch(err => console.log('SW ошибка:', err));
  });
}
