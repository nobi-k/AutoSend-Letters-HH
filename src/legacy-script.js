// Храним ссылки на вакансии, на которые уже отправлен отклик
let respondedVacancies = new Set();
// Сделано nobi-k
// Текст сопроводительного письма
const coverLetterText = `Добрый день! Посмотрите резюме!.`;

const triggerInputChange = (element, value) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
};

const wait = (ms) => new Promise(res => setTimeout(res, ms));

const runTasks = async () => {
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
        // Сделано nobi-k
        // Проверяем наличие модалки с предупреждением о другой стране
        const relocationWarningButton = document.querySelector('[data-qa="relocation-warning-confirm"]');
        if (relocationWarningButton) {
            relocationWarningButton.click();
            console.log('Подтвердили отклик на вакансию в другой стране.');
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
            } else {
                console.log('Кнопка "Откликнуться" в модальном окне не найдена');
            }
            // Сделано nobi-k
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

        // Ждем загрузки новой страницы
        await wait(4000);
        // Сделано nobi-k
        // После загрузки продолжаем обработку с новой страницы
        runTasks();
    } else {
        console.log('Все вакансии обработаны.');
    }
};

// Запуск задачи
runTasks();
