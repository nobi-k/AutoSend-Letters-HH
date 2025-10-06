/**
 * HeadHunter Auto Response Script
 * Автоматизация откликов на вакансии HeadHunter
 * @author nobi-k
 * @version 2.0
 */

class HHAutoResponder {
    constructor(coverLetterText, config = {}) {
        this.coverLetterText = coverLetterText;
        this.respondedVacancies = new Set();
        this.config = {
            waitModalTime: config.waitModalTime || 2000,
            waitBetweenActions: config.waitBetweenActions || 500,
            waitBetweenVacancies: config.waitBetweenVacancies || 1000,
            waitPageLoad: config.waitPageLoad || 4000,
            ...config
        };
        this.statistics = {
            processed: 0,
            responded: 0,
            skipped: 0,
            errors: 0
        };
    }

    /**
     * Утилита для ожидания
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Триггер изменения значения в textarea для React
     */
    triggerInputChange(element, value) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 
            'value'
        ).set;
        nativeInputValueSetter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * Логирование с временной меткой
     */
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('ru-RU');
        const prefix = {
            info: '📘',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        }[type] || '📘';
        
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    /**
     * Получение статистики
     */
    getStatistics() {
        return { ...this.statistics };
    }

    /**
     * Обработка одной вакансии
     */
    async processVacancy(button, index, total) {
        const vacancyLink = button.href;

        // Проверяем, отправляли ли уже отклик
        if (this.respondedVacancies.has(vacancyLink)) {
            this.log(`Пропуск вакансии ${index + 1}/${total} - уже откликнулись`, 'warning');
            this.statistics.skipped++;
            return false;
        }

        this.log(`Обработка вакансии ${index + 1}/${total}`, 'info');
        this.statistics.processed++;

        try {
            // Создаем наблюдатель за модальным окном
            let modalOpened = false;
            const modalObserver = new MutationObserver((mutations) => {
                for (let mutation of mutations) {
                    if (mutation.type === 'childList' && 
                        document.querySelector('[data-qa="vacancy-response-submit-popup"]')) {
                        modalOpened = true;
                        break;
                    }
                }
            });

            modalObserver.observe(document.body, { childList: true, subtree: true });

            // Нажимаем на кнопку отклика
            button.click();
            await this.wait(this.config.waitModalTime);

            // Проверяем предупреждение о другой стране
            const relocationWarningButton = document.querySelector('[data-qa="relocation-warning-confirm"]');
            if (relocationWarningButton) {
                relocationWarningButton.click();
                this.log('Подтверждено: вакансия в другой стране', 'info');
                await this.wait(this.config.waitBetweenActions);
            }

            // Если модалка появилась
            if (modalOpened) {
                modalObserver.disconnect();

                // Добавляем сопроводительное письмо
                await this.addCoverLetter();

                // Отправляем отклик
                const modalSubmitButton = document.querySelector('[data-qa="vacancy-response-submit-popup"]');
                if (modalSubmitButton) {
                    modalSubmitButton.click();
                    this.log('Отклик отправлен успешно', 'success');
                    this.statistics.responded++;
                    
                    await this.wait(this.config.waitModalTime);
                    this.respondedVacancies.add(vacancyLink);
                    return true;
                } else {
                    this.log('Кнопка отправки не найдена', 'error');
                    this.statistics.errors++;
                }
            } else {
                this.log('Модальное окно не появилось', 'warning');
                this.statistics.skipped++;
            }

            modalObserver.disconnect();
        } catch (error) {
            this.log(`Ошибка при обработке вакансии: ${error.message}`, 'error');
            this.statistics.errors++;
        }

        return false;
    }

    /**
     * Добавление сопроводительного письма
     */
    async addCoverLetter() {
        // Проверяем, нужно ли открыть поле для письма
        const addLetterButton = document.querySelector('[data-qa="vacancy-response-letter-toggle"]');
        if (addLetterButton && !document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]')) {
            addLetterButton.click();
            await this.wait(this.config.waitBetweenActions);
        }

        // Вводим текст письма
        const coverLetterInput = document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]');
        if (coverLetterInput) {
            this.triggerInputChange(coverLetterInput, this.coverLetterText);
            this.log('Сопроводительное письмо добавлено', 'success');
        }
    }

    /**
     * Переход на следующую страницу
     */
    async goToNextPage() {
        const nextPageButton = document.querySelector('[data-qa="pager-next"]');
        if (nextPageButton) {
            this.log('Переход на следующую страницу...', 'info');
            nextPageButton.click();
            await this.wait(this.config.waitPageLoad);
            return true;
        }
        return false;
    }

    /**
     * Основной метод запуска
     */
    async run() {
        this.log('🚀 Запуск автоматизации откликов HeadHunter', 'info');
        
        const buttons = document.querySelectorAll('[data-qa="vacancy-serp__vacancy_response"]');

        if (buttons.length === 0) {
            this.log('Кнопки откликов не найдены', 'warning');
            return;
        }

        this.log(`Найдено ${buttons.length} вакансий на странице`, 'info');

        // Обрабатываем все вакансии на странице
        for (let i = 0; i < buttons.length; i++) {
            await this.processVacancy(buttons[i], i, buttons.length);
            await this.wait(this.config.waitBetweenVacancies);
        }

        // Пытаемся перейти на следующую страницу
        const hasNextPage = await this.goToNextPage();
        
        if (hasNextPage) {
            // Рекурсивно запускаем на новой странице
            await this.run();
        } else {
            // Выводим финальную статистику
            this.log('✨ Все вакансии обработаны!', 'success');
            this.log(`📊 Статистика:
                - Обработано: ${this.statistics.processed}
                - Отправлено откликов: ${this.statistics.responded}
                - Пропущено: ${this.statistics.skipped}
                - Ошибок: ${this.statistics.errors}
            `, 'info');
        }
    }

    /**
     * Остановка работы скрипта
     */
    stop() {
        this.log('🛑 Остановка скрипта...', 'warning');
        // Можно добавить дополнительную логику остановки
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HHAutoResponder;
}

// Глобальный экземпляр для быстрого запуска из консоли
window.HHAutoResponder = HHAutoResponder;

// Быстрый запуск (для обратной совместимости)
window.startHHAutomation = (coverLetterText = 'Добрый день! Посмотрите резюме!') => {
    const responder = new HHAutoResponder(coverLetterText);
    responder.run();
    return responder;
};
