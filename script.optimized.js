// Оптимизированная версия скрипта авто-отклика на HH
// Автор: nobi-k (оптимизировано для производительности)

(function() {
    'use strict';
    
    // ============= КОНСТАНТЫ И КОНФИГУРАЦИЯ =============
    const CONFIG = {
        MODAL_TIMEOUT: 3000,
        RELOCATION_TIMEOUT: 1500,
        LETTER_TOGGLE_TIMEOUT: 500,
        SUBMIT_TIMEOUT: 2000,
        NEXT_VACANCY_DELAY: 800,
        PAGE_LOAD_TIMEOUT: 4000,
        MAX_STORED_VACANCIES: 1000 // Предотвращение утечки памяти
    };
    
    const SELECTORS = Object.freeze({
        RESPONSE_BUTTON: '[data-qa="vacancy-serp__vacancy_response"]',
        MODAL_POPUP: '[data-qa="vacancy-response-submit-popup"]',
        RELOCATION_WARNING: '[data-qa="relocation-warning-confirm"]',
        LETTER_TOGGLE: '[data-qa="vacancy-response-letter-toggle"]',
        LETTER_INPUT: '[data-qa="vacancy-response-popup-form-letter-input"]',
        NEXT_PAGE: '[data-qa="pager-next"]'
    });
    
    const coverLetterText = `Добрый день! Посмотрите резюме!.`;
    
    // ============= ХРАНИЛИЩЕ С ОГРАНИЧЕНИЕМ ПАМЯТИ =============
    class LimitedSet {
        constructor(maxSize = 1000) {
            this.items = new Set();
            this.maxSize = maxSize;
        }
        
        add(item) {
            if (this.items.size >= this.maxSize) {
                // Удаляем первый элемент (FIFO)
                const firstItem = this.items.values().next().value;
                this.items.delete(firstItem);
            }
            this.items.add(item);
        }
        
        has(item) {
            return this.items.has(item);
        }
        
        get size() {
            return this.items.size;
        }
    }
    
    const respondedVacancies = new LimitedSet(CONFIG.MAX_STORED_VACANCIES);
    
    // ============= УТИЛИТЫ =============
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Оптимизированная функция установки значения в textarea
    const setInputValue = (element, value) => {
        if (!element) return false;
        
        try {
            const descriptor = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 
                'value'
            );
            
            if (descriptor && descriptor.set) {
                descriptor.set.call(element, value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
        } catch (error) {
            console.error('Ошибка установки значения:', error);
        }
        
        return false;
    };
    
    // Ожидание появления элемента (вместо фиксированных таймаутов)
    const waitForElement = (selector, timeout = 3000, parent = document) => {
        return new Promise((resolve) => {
            const element = parent.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            let timeoutId;
            const observer = new MutationObserver(() => {
                const el = parent.querySelector(selector);
                if (el) {
                    clearTimeout(timeoutId);
                    observer.disconnect();
                    resolve(el);
                }
            });
            
            observer.observe(parent, {
                childList: true,
                subtree: true
            });
            
            timeoutId = setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    };
    
    // Ожидание исчезновения элемента
    const waitForElementRemoval = (selector, timeout = 3000, parent = document) => {
        return new Promise((resolve) => {
            const element = parent.querySelector(selector);
            if (!element) {
                resolve(true);
                return;
            }
            
            let timeoutId;
            const observer = new MutationObserver(() => {
                const el = parent.querySelector(selector);
                if (!el) {
                    clearTimeout(timeoutId);
                    observer.disconnect();
                    resolve(true);
                }
            });
            
            observer.observe(parent, {
                childList: true,
                subtree: true
            });
            
            timeoutId = setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, timeout);
        });
    };
    
    // ============= ОСНОВНАЯ ЛОГИКА =============
    
    // Обработка одной вакансии
    const processVacancy = async (button, index, total) => {
        const vacancyLink = button.href;
        
        // Проверка на дубликат
        if (respondedVacancies.has(vacancyLink)) {
            console.log(`[${index + 1}/${total}] Пропуск: отклик уже отправлен`);
            return false;
        }
        
        console.log(`[${index + 1}/${total}] Обработка вакансии: ${vacancyLink}`);
        
        try {
            // Клик по кнопке отклика
            button.click();
            
            // Ждем появления модального окна или предупреждения о релокации
            const modal = await waitForElement(SELECTORS.MODAL_POPUP, CONFIG.MODAL_TIMEOUT);
            
            if (!modal) {
                console.log(`[${index + 1}/${total}] Модальное окно не появилось`);
                return false;
            }
            
            // Проверка предупреждения о релокации
            const relocationWarning = document.querySelector(SELECTORS.RELOCATION_WARNING);
            if (relocationWarning) {
                relocationWarning.click();
                console.log(`[${index + 1}/${total}] Подтверждение релокации`);
                await wait(CONFIG.RELOCATION_TIMEOUT);
            }
            
            // Проверка и добавление сопроводительного письма
            let letterInput = document.querySelector(SELECTORS.LETTER_INPUT);
            
            if (!letterInput) {
                const toggleButton = document.querySelector(SELECTORS.LETTER_TOGGLE);
                if (toggleButton) {
                    toggleButton.click();
                    letterInput = await waitForElement(
                        SELECTORS.LETTER_INPUT, 
                        CONFIG.LETTER_TOGGLE_TIMEOUT
                    );
                }
            }
            
            if (letterInput) {
                setInputValue(letterInput, coverLetterText);
                console.log(`[${index + 1}/${total}] Сопроводительное письмо добавлено`);
            }
            
            // Отправка отклика
            const submitButton = document.querySelector(SELECTORS.MODAL_POPUP);
            if (submitButton) {
                submitButton.click();
                console.log(`[${index + 1}/${total}] Отклик отправлен`);
                
                // Ждем исчезновения модального окна
                await waitForElementRemoval(SELECTORS.MODAL_POPUP, CONFIG.SUBMIT_TIMEOUT);
                
                // Добавляем в обработанные
                respondedVacancies.add(vacancyLink);
                return true;
            }
            
            console.log(`[${index + 1}/${total}] Кнопка отправки не найдена`);
            return false;
            
        } catch (error) {
            console.error(`[${index + 1}/${total}] Ошибка обработки:`, error);
            return false;
        }
    };
    
    // Обработка текущей страницы
    const processCurrentPage = async () => {
        const buttons = Array.from(
            document.querySelectorAll(SELECTORS.RESPONSE_BUTTON)
        );
        
        if (buttons.length === 0) {
            console.log('Кнопки для отклика не найдены');
            return false;
        }
        
        console.log(`Найдено вакансий: ${buttons.length}`);
        
        let processedCount = 0;
        
        for (let i = 0; i < buttons.length; i++) {
            const success = await processVacancy(buttons[i], i, buttons.length);
            if (success) processedCount++;
            
            // Небольшая пауза между вакансиями
            await wait(CONFIG.NEXT_VACANCY_DELAY);
        }
        
        console.log(`Обработано откликов на странице: ${processedCount}`);
        return true;
    };
    
    // Переход на следующую страницу (итеративно, без рекурсии)
    const processAllPages = async () => {
        let pageNumber = 1;
        let hasMorePages = true;
        
        while (hasMorePages) {
            console.log(`\n=== Страница ${pageNumber} ===`);
            
            await processCurrentPage();
            
            // Проверка наличия следующей страницы
            const nextPageButton = document.querySelector(SELECTORS.NEXT_PAGE);
            
            if (nextPageButton) {
                console.log(`Переход на страницу ${pageNumber + 1}...`);
                nextPageButton.click();
                
                // Ждем загрузки новой страницы
                await wait(CONFIG.PAGE_LOAD_TIMEOUT);
                
                pageNumber++;
            } else {
                hasMorePages = false;
                console.log('\n=== Все страницы обработаны ===');
                console.log(`Всего обработано вакансий: ${respondedVacancies.size}`);
            }
        }
    };
    
    // ============= ЗАПУСК =============
    console.log('🚀 Запуск оптимизированного скрипта авто-отклика HH');
    console.log('Автор: nobi-k | Оптимизация производительности');
    
    processAllPages().catch(error => {
        console.error('Критическая ошибка:', error);
    });
    
})();
