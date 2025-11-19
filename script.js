// ====== Яндекс Метрика ======
(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=105410389', 'ym');

ym(105410389, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});

// Отслеживаем запуск скрипта
ym(105410389, 'reachGoal', 'script_started');
console.log('Яндекс Метрика инициализирована');
// ====== /Яндекс Метрика ======

// Храним ссылки на вакансии, на которые уже отправлен отклик
let respondedVacancies = new Set();

// Текст сопроводительного письма
const coverLetterText = `Добрый день!Я заинтересован(а) в этой позиции и уверен(а), что мой опыт и навыки соответствуют требованиям вакансии. Буду рад(а) обсудить детали на собеседовании.С уважением, [Ваше имя]`;

const triggerInputChange = (element, value) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
};

const wait = (ms) => new Promise(res => setTimeout(res, ms));

const runTasks = async () => {
    // Проверяем наличие кнопки "Показать ещё"
    const showMoreButton = document.querySelector('[data-qa="applicant-index-search-all-results-button"]');
    if (showMoreButton) {
        console.log('Найдена кнопка "Показать ещё". Нажимаем...');
        showMoreButton.click();
        // Ждем загрузки новых вакансий
        await wait(4000);
        // Повторяем функцию после обновления страницы
        runTasks();
        return; // Выходим из текущей функции, чтобы избежать дальнейшего выполнения
    }

    const buttons = document.querySelectorAll('[data-qa="vacancy-serp__vacancy_response"]');

    if (buttons.length === 0) {
        console.log('Не найдено кнопок для отклика.');
        return;
    }

    for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const vacancyLink = button.href; // Получаем ссылку на вакансию

        // Проверяем, отправляли ли мы уже отклик на эту вакансию
        if (respondedVacancies.has(vacancyLink)) {
            console.log(`Пропускаем вакансию ${vacancyLink}, отклик уже был отправлен.`);
            continue; // Пропускаем, если уже был отклик
        }

        console.log(`Обработка кнопки ${i + 1} из ${buttons.length}`, button);

        // Подключаем слушатель для определения открытия модального окна
        let modalOpened = false;

        const modalObserver = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                if (mutation.type === 'childList' && document.querySelector('[data-qa="vacancy-response-submit-popup"]')) {
                    modalOpened = true;
                    console.log('Модальное окно появилось.');
                    break;
                }
            }
        });

        // Наблюдаем за изменениями в теле документа (для отслеживания появления модалки)
        modalObserver.observe(document.body, { childList: true, subtree: true });

        // Нажимаем на кнопку отклика
        button.click();

        // Ждем 2 секунды, чтобы проверить результат
        await wait(2000);

        // Проверяем наличие модалки с предупреждением о другой стране
        const relocationWarningButton = document.querySelector('[data-qa="relocation-warning-confirm"]');
        if (relocationWarningButton) {
            relocationWarningButton.click();
            console.log('Подтвердили отклик на вакансию в другой стране.');
            // Отслеживаем отклик на вакансию за границей
            ym(105410389, 'reachGoal', 'relocation_vacancy');
            await wait(1000); // Ждем для завершения подтверждения
        }

        // Если модалка появилась, продолжаем обработку
        if (modalOpened) {
            modalObserver.disconnect();

            // Проверяем наличие кнопки для добавления сопроводительного письма
            const addLetterButton = document.querySelector('[data-qa="vacancy-response-letter-toggle"]');
            if (addLetterButton && !document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]')) {
                addLetterButton.click(); // Нажимаем "Добавить сопроводительное письмо"
                await wait(500); // Ждем открытия поля
            }

            // Находим поле для ввода сопроводительного письма
            const coverLetterInput = document.querySelector('[data-qa="vacancy-response-popup-form-letter-input"]');
            if (coverLetterInput) {
                triggerInputChange(coverLetterInput, coverLetterText);
                console.log('Добавлено сопроводительное письмо.');
            }

            // Нажимаем кнопку "Откликнуться" в модалке, если она есть
            const modalSubmitButton = document.querySelector('[data-qa="vacancy-response-submit-popup"]');
            if (modalSubmitButton) {
                modalSubmitButton.click();
                console.log('Нажали кнопку "Откликнуться" в модалке');
                // Отслеживаем отклик в Яндекс Метрике
                ym(105410389, 'reachGoal', 'vacancy_response_sent');
            } else {
                console.log('Кнопка "Откликнуться" в модальном окне не найдена');
            }

            // Ждем окончания отправки
            await wait(2000);

            // Добавляем вакансию в список уже откликнутых
            respondedVacancies.add(vacancyLink);
        } else {
            console.log('Модальное окно не появилось, пропускаем эту вакансию.');
        }

        modalObserver.disconnect();
        await wait(1000); // Пауза перед следующей ваканцией
    }

    // Проверяем, есть ли следующая страница
    const nextPageButton = document.querySelector('[data-qa="pager-next"]');
    if (nextPageButton) {
        console.log('Переход на следующую страницу...');
        nextPageButton.click();
        // Отслеживаем переход на следующую страницу
        ym(105410389, 'reachGoal', 'next_page');

        // Ждем загрузки новой страницы
        await wait(4000);

        // После загрузки продолжаем обработку с новой страницы
        runTasks();
    } else {
        console.log('Все вакансии обработаны.');
        // Отслеживаем завершение работы скрипта
        ym(105410389, 'reachGoal', 'script_completed');
    }
};

// Запуск задачи
runTasks();
