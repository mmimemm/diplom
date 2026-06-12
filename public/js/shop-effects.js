// Система применения покупок магазина
// Реестр эффектов (window.AVATAR_EFFECTS) находится в app.js

async function loadShopEffects() {
  try {
    const purchases = await api('/api/shop/my') || [];
    const effects = {
      editorSkins: [],
      avatarItems: [],
      boosts: []
    };
    
    purchases.forEach(purchase => {
      const item = purchase.itemId;
      if (!item) return;
      
      switch(item.type) {
        case 'editor_skin':
          if (item.css) {
            effects.editorSkins.push({
              id: item._id,
              name: item.name,
              css: item.css
            });
          }
          break;
          
        case 'avatar':
          effects.avatarItems.push({
            id: item._id,
            name: item.name,
            icon: item.icon,
            effect: item.effect
          });
          break;
          
        case 'boost':
          const purchaseTime = new Date(purchase.purchasedAt).getTime();
          const now = Date.now();
          const duration = item.duration || 86400000; // 24 часа по умолчанию
          
          if (now - purchaseTime < duration) {
            effects.boosts.push({
              id: item._id,
              name: item.name,
              icon: item.icon,
              multiplier: item.name.includes('Двойной') ? 2 : 1
            });
          }
          break;
      }
    });
    
    applyShopEffects(effects);
    return effects;
  } catch (error) {
    console.error('Ошибка загрузки эффектов магазина:', error);
    return null;
  }
}

function applyShopEffects(effects) {
  if (!effects) return;
  
  // Сначала снимаем все классы скинов редактора с body и удаляем старые контейнеры звёзд
  document.body.classList.remove('skin-cosmic-stars');
  document.querySelectorAll('.skin-cosmic-stars-container').forEach(function(el) { el.remove(); });
  
  // Применяем скины редактора
  effects.editorSkins.forEach(skin => {
    const styleId = `shop-skin-${skin.id}`;
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `/* ${skin.name} */\n${skin.css}`;
    document.head.appendChild(style);
    
    // Если скин "Космические звёзды" — создаём контейнер внутри .sandbox-layout
    // на z-index:0, чтобы звёзды были фоном ЗА панелями редактора и превью
    if (skin.name === 'Космические звёзды') {
      // Ищем sandbox-layout (песочница) или main-content (другие страницы)
      var layout = document.querySelector('.sandbox-layout') || document.querySelector('.main-content');
      // Для страниц вне песочницы используем body как fallback
      var target = layout || document.body;
      
      // Убедимся, что target имеет position:relative (нужен для absolute позиционирования контейнера)
      var pos = window.getComputedStyle(target).position;
      if (pos === 'static') {
        target.style.position = 'relative';
      }
      
      // Создаём контейнер строго на z-index:0
      var container = document.createElement('div');
      container.className = 'skin-cosmic-stars-container';
      // Явно задаём z-index:0 в стиле (перекроет любые внешние стили)
      container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:0;';
      
      // Добавляем дополнительные звёздочки (плавные анимации)
      var extra1 = document.createElement('span');
      extra1.className = 'star-extra-1';
      extra1.textContent = '⭐';
      container.appendChild(extra1);
      var extra2 = document.createElement('span');
      extra2.className = 'star-extra-2';
      extra2.textContent = '✨';
      container.appendChild(extra2);
      
      // Вставляем контейнер ПЕРВЫМ ребёнком, чтобы все панели были поверх него
      target.insertBefore(container, target.firstChild);
    }
  });
  
  // Сохраняем эффекты в глобальной переменной
  window.shopEffects = effects;
}

// Показать элементы аватара из магазина в конструкторе
function showShopAvatarItems(containerId, currentConfig) {
  const effects = window.shopEffects;
  if (!effects || !effects.avatarItems.length) return;
  
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const unlocked = currentConfig?.unlockedItems || window.currentConfig?.unlockedItems || [];
  
  const shopSection = document.createElement('div');
  shopSection.className = 'shop-avatar-items';
  shopSection.innerHTML = '<div class="section-label" style="margin-top:16px;">🎪 Из магазина</div><div class="avatar-builder" id="shopAvatarItems"></div>';
  container.appendChild(shopSection);
  
  const itemsContainer = document.getElementById('shopAvatarItems');
  if (!itemsContainer) return;
  
  effects.avatarItems.forEach(item => {
    const opt = document.createElement('div');
    opt.className = 'avatar-opt';
    // Подсвечиваем, если эффект уже разблокирован
    if (item.effect && unlocked.includes(item.effect)) {
      opt.classList.add('selected');
    }
    opt.dataset.effect = item.effect || '';
    opt.dataset.icon = item.icon || '🎁';
    opt.title = item.name;
    opt.textContent = item.icon || '🎁';
    opt.onclick = function() {
      if (typeof window.selectShopAvatarItem === 'function') {
        window.selectShopAvatarItem(item);
      }
    };
    itemsContainer.appendChild(opt);
  });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => loadShopEffects(), 1000);
});

// Экспортируем функции для использования в других файлах
window.loadShopEffects = loadShopEffects;
window.showShopAvatarItems = showShopAvatarItems;
