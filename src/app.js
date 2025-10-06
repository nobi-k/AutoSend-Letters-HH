/**
 * Frontend Application for HeadHunter Automation
 * Handles UI interactions and script generation
 */

(function() {
    'use strict';

    // DOM Elements
    const elements = {
        coverLetter: document.getElementById('coverLetter'),
        waitTime: document.getElementById('waitTime'),
        generateBtn: document.getElementById('generateBtn'),
        copyBtn: document.getElementById('copyBtn'),
        copyBtn2: document.getElementById('copyBtn2'),
        copyBtnText: document.getElementById('copyBtnText'),
        scriptCode: document.getElementById('scriptCode')
    };

    // Load saved configuration from localStorage
    function loadSavedConfig() {
        try {
            const savedCoverLetter = localStorage.getItem('hh_coverLetter');
            const savedWaitTime = localStorage.getItem('hh_waitTime');

            if (savedCoverLetter) {
                elements.coverLetter.value = savedCoverLetter;
            }
            if (savedWaitTime) {
                elements.waitTime.value = savedWaitTime;
            }
        } catch (error) {
            console.warn('Failed to load saved configuration:', error);
        }
    }

    // Save configuration to localStorage
    function saveConfig() {
        try {
            localStorage.setItem('hh_coverLetter', elements.coverLetter.value);
            localStorage.setItem('hh_waitTime', elements.waitTime.value);
        } catch (error) {
            console.warn('Failed to save configuration:', error);
        }
    }

    // Generate the automation script
    function generateScript() {
        const coverLetter = elements.coverLetter.value.trim();
        const waitTime = parseInt(elements.waitTime.value) || 1000;

        if (!coverLetter) {
            alert('⚠️ Пожалуйста, введите текст сопроводительного письма!');
            elements.coverLetter.focus();
            return null;
        }

        // Escape special characters in cover letter
        const escapedCoverLetter = coverLetter
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');

        // Save configuration
        saveConfig();

        // Generate the script
        const script = `// HeadHunter Auto Response Script
// Generated: ${new Date().toLocaleString('ru-RU')}
// Author: nobi-k

class HHAutoResponder {
    constructor(coverLetterText, config = {}) {
        this.coverLetterText = coverLetterText;
        this.respondedVacancies = new Set();
        this.config = {
            waitModalTime: config.waitModalTime || 2000,
            waitBetweenActions: config.waitBetweenActions || 500,
            waitBetweenVacancies: config.waitBetweenVacancies || ${waitTime},
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

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    triggerInputChange(element, value) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 
            'value'
        ).set;
        nativeInputValueSetter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('ru-RU');
        const prefix = {
            info: '📘',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        }[type] || '📘';
        
        console.log(\`[\${timestamp}] \${prefix} \${message}\`);
    }

    async processVacancy(button, index, total) {
        const vacancyLink = button.href;

        if (this.respondedVacancies.has(vacancyLink)) {
            this.log(\`Пропуск вакансии \${index + 1}/\${total} - уже откликнулись\`, 'warning');
            this.statistics.skipped++;
            return false;
        }

        this.log(\`Обработка вакансии \${index + 1}/\${total}\`, 'info');
        this.statistics.processed++;

        try {
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

            button.click();
            await this.wait(this.config.waitModalTime);

            const relocationWarningButton = document.querySelector('[data-qa="relocation-warning-confirm"]');
            if (relocationWarningButton) {
                relocationWarningButton.click();
                this.log('Подтверждено: вакансия в другой стране', 'info');
                await this.wait(this.config.waitBetweenActions);
            }

            if (modalOpened) {
                modalObserver.disconnect();

                await this.addCoverLetter();

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
            this.log(\`Ошибка при обработке вакансии: \${error.message}\`, 'error');
            this.statistics.errors++;
        }

        return false;
    }

    async addCoverLetter() {
        const addLetterButton = document.querySelector('[data-qa="vacancy-response-letter-toggle"]');
        if (addLetterButton && !document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]')) {
            addLetterButton.click();
            await this.wait(this.config.waitBetweenActions);
        }

        const coverLetterInput = document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]');
        if (coverLetterInput) {
            this.triggerInputChange(coverLetterInput, this.coverLetterText);
            this.log('Сопроводительное письмо добавлено', 'success');
        }
    }

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

    async run() {
        this.log('🚀 Запуск автоматизации откликов HeadHunter', 'info');
        
        const buttons = document.querySelectorAll('[data-qa="vacancy-serp__vacancy_response"]');

        if (buttons.length === 0) {
            this.log('Кнопки откликов не найдены', 'warning');
            return;
        }

        this.log(\`Найдено \${buttons.length} вакансий на странице\`, 'info');

        for (let i = 0; i < buttons.length; i++) {
            await this.processVacancy(buttons[i], i, buttons.length);
            await this.wait(this.config.waitBetweenVacancies);
        }

        const hasNextPage = await this.goToNextPage();
        
        if (hasNextPage) {
            await this.run();
        } else {
            this.log('✨ Все вакансии обработаны!', 'success');
            this.log(\`📊 Статистика:
                - Обработано: \${this.statistics.processed}
                - Отправлено откликов: \${this.statistics.responded}
                - Пропущено: \${this.statistics.skipped}
                - Ошибок: \${this.statistics.errors}
            \`, 'info');
        }
    }
}

// Запуск автоматизации
const coverLetterText = \`${escapedCoverLetter}\`;
const responder = new HHAutoResponder(coverLetterText);
responder.run();

console.log('✅ Скрипт успешно запущен! Проверьте консоль для отслеживания прогресса.');`;

        return script;
    }

    // Display generated script
    function displayScript(script) {
        elements.scriptCode.textContent = script;
        elements.scriptCode.style.maxHeight = '500px';
        
        // Scroll to script
        elements.scriptCode.parentElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
        });
    }

    // Copy script to clipboard
    async function copyToClipboard() {
        const script = elements.scriptCode.textContent;

        if (script === '// Нажмите "Сгенерировать скрипт" для создания кода') {
            alert('⚠️ Сначала сгенерируйте скрипт!');
            return;
        }

        try {
            await navigator.clipboard.writeText(script);
            
            // Update button state
            const originalText = elements.copyBtnText.textContent;
            elements.copyBtnText.textContent = '✅ Скопировано!';
            elements.copyBtn.classList.add('copied');
            
            // Reset button after 2 seconds
            setTimeout(() => {
                elements.copyBtnText.textContent = originalText;
                elements.copyBtn.classList.remove('copied');
            }, 2000);
            
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = script;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                alert('✅ Скрипт скопирован в буфер обмена!');
            } catch (err) {
                alert('❌ Не удалось скопировать скрипт. Пожалуйста, скопируйте вручную.');
            }
            
            document.body.removeChild(textArea);
        }
    }

    // Event Listeners
    elements.generateBtn.addEventListener('click', () => {
        elements.generateBtn.classList.add('loading');
        
        setTimeout(() => {
            const script = generateScript();
            if (script) {
                displayScript(script);
            }
            elements.generateBtn.classList.remove('loading');
        }, 300);
    });

    elements.copyBtn.addEventListener('click', copyToClipboard);
    elements.copyBtn2.addEventListener('click', copyToClipboard);

    // Auto-generate on page load if there's saved config
    window.addEventListener('load', () => {
        loadSavedConfig();
        
        // Auto-generate if cover letter exists
        if (elements.coverLetter.value.trim()) {
            const script = generateScript();
            if (script) {
                displayScript(script);
            }
        }
    });

    // Add input event listeners to save on change
    elements.coverLetter.addEventListener('input', () => {
        // Clear script display when text changes
        elements.scriptCode.textContent = '// Нажмите "Сгенерировать скрипт" для обновления кода';
    });

    elements.waitTime.addEventListener('input', () => {
        // Clear script display when settings change
        elements.scriptCode.textContent = '// Нажмите "Сгенерировать скрипт" для обновления кода';
    });

    // Add keyboard shortcut for generating (Ctrl/Cmd + Enter in textarea)
    elements.coverLetter.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            elements.generateBtn.click();
        }
    });

    console.log('%c🚀 HeadHunter Auto Response', 'font-size: 20px; font-weight: bold; color: #d6001c;');
    console.log('%cИнтерфейс готов к работе!', 'font-size: 14px; color: #0088cc;');
})();
