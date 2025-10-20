// Глобальный обработчик ошибок
window.onerror = function (message, source, lineno, colno, error) {
  // Используем StackTrace для парсинга стека ошибок
  StackTrace.fromError(error).then(stackframes => {
    // Формируем читаемый стек вызовов
    const stackString = stackframes
      .map(sf => `${sf.fileName || 'unknown'}:${sf.lineNumber || '?'}:${sf.columnNumber || '?'}`)
      .join('\n');

    // Формируем объект с данными об ошибке
    const errorData = {
      type: 'error',
      message: message,
      source: source,
      lineno: lineno,
      colno: colno,
      stack: stackString,
      timestamp: new Date().toISOString()
    };

    // Логируем в консоль
    console.error('Глобальная ошибка:', errorData);

    // Отправляем в родительский контекст (для iframe)
    window.parent.postMessage(errorData, '*');
  }).catch(err => {
    // Если не удалось распарсить стек
    console.error('Ошибка при парсинге стека:', err);
    const fallbackErrorData = {
      type: 'error',
      message: message,
      source: source,
      lineno: lineno,
      colno: colno,
      stack: error?.stack || 'Нет данных о стеке',
      timestamp: new Date().toISOString()
    };
    console.error('Глобальная ошибка (запасной вариант):', fallbackErrorData);
    window.parent.postMessage(fallbackErrorData, '*');
  });

  return true; // Предотвращаем стандартный вывод ошибки в консоль
};

// Обработчик необработанных промисов
window.addEventListener('unhandledrejection', function (event) {
  const reason = event.reason;
  // Парсим стек ошибки промиса
  StackTrace.fromError(reason).then(stackframes => {
    const stackString = stackframes
      .map(sf => `${sf.fileName || 'unknown'}:${sf.lineNumber || '?'}:${sf.columnNumber || '?'}`)
      .join('\n');

    const errorData = {
      type: 'promiseError',
      message: reason?.message || 'Необработанная ошибка промиса',
      stack: stackString,
      timestamp: new Date().toISOString()
    };

    // Логируем в консоль
    console.error('Необработанная ошибка промиса:', errorData);

    // Отправляем в родительский контекст
    window.parent.postMessage(errorData, '*');
  }).catch(err => {
    // Если не удалось распарсить стек
    console.error('Ошибка при парсинге стека промиса:', err);
    const fallbackErrorData = {
      type: 'promiseError',
      message: reason?.message || 'Необработанная ошибка промиса',
      stack: reason?.stack || 'Нет данных о стеке',
      timestamp: new Date().toISOString()
    };
    console.error('Необработанная ошибка промиса (запасной вариант):', fallbackErrorData);
    window.parent.postMessage(fallbackErrorData, '*');
  });

  event.preventDefault(); // Предотвращаем стандартный вывод
});

window.handleRoutes = function(pages) {
  console.log('window.handleRoutes', {pages});
  const pagesData = {
    type: 'handlePages',
    timestamp: new Date().toISOString(),
    pages: pages,
  };
  window.parent.postMessage(pagesData, '*');
};

// Добавляем этот код в iframe
document.addEventListener('DOMContentLoaded', function() {
  // Обработчик сообщений
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'enableEasyEditMode') {
      document.body.classList.add('easy-mode-edit');
      console.log('✅ Easy edit mode enabled');
    }
    
    if (event.data && event.data.type === 'disableEasyEditMode') {
      document.body.classList.remove('easy-mode-edit');
      console.log('❌ Easy edit mode disabled');
    }
  });
});

document.addEventListener('DOMContentLoaded', function() {
  // Функция для инициализации обработчиков событий
  function initEasyTagHandlers() {
    const elements = document.querySelectorAll('[data-easytag]');
    
    elements.forEach(element => {
      // Удаляем существующие обработчики, чтобы избежать дублирования
      element.removeEventListener('click', handleEasyTagClick);
      // Добавляем новый обработчик
      element.addEventListener('click', handleEasyTagClick);
    });
  }

  // Обработчик клика по элементам с data-easytag
  function handleEasyTagClick(event) {
    const editModeElement = document.getElementsByClassName('easy-mode-edit');

    if (editModeElement.length === 0) {
      // Если режим редактирования не активен, ничего не делаем
      return;
    }

    event.stopPropagation();
    const easyTagData = this.getAttribute('data-easytag');
    console.log({easyTagData});
    
    // Отправляем данные наверх
    window.parent.postMessage({
      type: 'easyTagClick',
      timestamp: new Date().toISOString(),
      data: easyTagData
    }, '*');

    event.preventDefault();
  }

  // Инициализация при загрузке DOM
  initEasyTagHandlers();

  // Наблюдатель за изменениями DOM для обработки динамического контента
  const observer = new MutationObserver(function(mutations) {
    let shouldInit = false;
    
    mutations.forEach(function(mutation) {
      // Проверяем добавленные узлы
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) { // ELEMENT_NODE
          // Проверяем сам элемент или его потомков на наличие data-easytag
          if (node.hasAttribute('data-easytag') || 
              node.querySelector('[data-easytag]')) {
            shouldInit = true;
          }
        }
      });
    });
    
    if (shouldInit) {
      // Небольшая задержка для гарантии, что DOM полностью обновлен
      setTimeout(initEasyTagHandlers, 10);
    }
  });

  // Начинаем наблюдение
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return true;
});
