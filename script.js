/* =====================================================================
 *  AutoSend Letters HH — авто-отклики на hh.ru (standalone-скрипт)
 *  Вставьте этот код в консоль браузера (F12) на странице с вакансиями.
 *  Репозиторий: https://github.com/nobi-k/AutoSend-Letters-HH
 *  Версия: 2.0 (актуально на 2026)
 * ===================================================================== */
(() => {
  'use strict';

  // Защита от повторного запуска
  if (window.__hhAutoSendRunning) {
    console.warn('[HH] Скрипт уже запущен. Остановите его кнопкой «Стоп».');
    return;
  }

  /* ------------------------------------------------------------------ *
   *  НАСТРОЙКИ — отредактируйте под себя
   * ------------------------------------------------------------------ */
  const CONFIG = {
    // Текст сопроводительного письма
    coverLetter:
      'Добрый день!\n' +
      'Меня заинтересовала эта позиция — мой опыт и навыки хорошо ' +
      'подходят под требования. Буду рад обсудить детали на собеседовании.\n\n' +
      'С уважением, [Ваше имя]',

    sendCoverLetter: true,        // добавлять ли сопроводительное письмо
    maxResponses: 200,            // максимум откликов за один запуск
    skipVacanciesWithTests: true, // пропускать вакансии с тестами/доп.вопросами
    confirmRelocation: true,      // подтверждать отклик на вакансии в др. странах
    autoNextPage: true,           // переходить на следующую страницу автоматически

    // Чёрный список — вакансия пропускается, если её название содержит
    // любое из этих слов (регистр не важен). Пример: ['продажи', 'ночь']
    blacklist: [],

    // Случайные паузы между откликами (мс) — имитация поведения человека
    delayMin: 1800,
    delayMax: 4200,
  };
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'hh_autosend_responded';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => Math.floor(a + Math.random() * (b - a));
  const human = () => wait(rand(CONFIG.delayMin, CONFIG.delayMax));

  // Память об уже обработанных вакансиях (переживает перезагрузку страницы)
  const responded = new Set(
    JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  );
  const remember = (id) => {
    responded.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...responded]));
  };

  const state = { running: true, sent: 0, skipped: 0 };
  window.__hhAutoSendRunning = true;

  /* ------------------------------------------------------------------ *
   *  Плавающая панель управления
   * ------------------------------------------------------------------ */
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'z-index:2147483647', 'right:20px', 'bottom:20px',
    'background:#0a0a0f', 'color:#fff',
    'font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif',
    'padding:14px 16px', 'border-radius:14px',
    'box-shadow:0 8px 30px rgba(0,0,0,.4)',
    'min-width:220px', 'border:1px solid rgba(255,255,255,.08)',
  ].join(';');
  panel.innerHTML =
    '<div style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px">' +
    '<span style="width:8px;height:8px;border-radius:50%;background:#20d335;display:inline-block"></span>' +
    'HH Авто-отклик</div>' +
    '<div id="hh-stat" style="opacity:.85;margin-bottom:10px">Запуск…</div>' +
    '<button id="hh-stop" style="width:100%;cursor:pointer;background:#20d335;color:#0a0a0f;' +
    'border:0;border-radius:9px;padding:8px;font-weight:600">Стоп</button>';
  document.body.appendChild(panel);

  const statEl = panel.querySelector('#hh-stat');
  const setStat = (msg) => {
    statEl.innerHTML =
      'Отправлено: <b>' + state.sent + '</b> · Пропущено: <b>' +
      state.skipped + '</b><br><span style="opacity:.7">' + msg + '</span>';
  };
  panel.querySelector('#hh-stop').onclick = () => stop('Остановлено вручную');

  function stop(reason) {
    state.running = false;
    window.__hhAutoSendRunning = false;
    setStat(reason);
    const btn = panel.querySelector('#hh-stop');
    btn.textContent = 'Закрыть';
    btn.onclick = () => panel.remove();
    console.log('[HH] ' + reason +
      '. Итого отправлено: ' + state.sent + ', пропущено: ' + state.skipped);
  }

  /* ------------------------------------------------------------------ *
   *  Утилиты
   * ------------------------------------------------------------------ */
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Установить значение в textarea/input так, чтобы React/Vue это заметили
  const setNativeValue = (el, value) => {
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Дождаться появления элемента (с таймаутом)
  const waitFor = (sel, timeout = 4000) =>
    new Promise((resolve) => {
      const found = q(sel);
      if (found) return resolve(found);
      const obs = new MutationObserver(() => {
        const el = q(sel);
        if (el) { obs.disconnect(); resolve(el); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    });

  const inBlacklist = (title) =>
    !!title && CONFIG.blacklist.some((w) =>
      title.toLowerCase().includes(w.toLowerCase()));

  // Карточка вакансии вокруг кнопки отклика — для названия и id
  const cardOf = (btn) =>
    btn.closest('[data-qa="vacancy-serp__vacancy"]') ||
    btn.closest('article') || btn.parentElement;

  const titleOf = (btn) => {
    const card = cardOf(btn);
    const t = card && (q('[data-qa="serp-item__title"]', card) ||
      q('[data-qa="serp-item__title-text"]', card) || q('h2 a', card));
    return t ? t.textContent.trim() : '';
  };

  const idOf = (btn) => {
    const card = cardOf(btn);
    const link = card && (q('[data-qa="serp-item__title"]', card) ||
      q('a[href*="/vacancy/"]', card));
    const href = (link && link.href) || btn.getAttribute('href') || '';
    const m = href.match(/\/vacancy\/(\d+)/);
    return m ? m[1] : href || Math.random().toString(36).slice(2);
  };

  /* ------------------------------------------------------------------ *
   *  Обработка одной кнопки отклика
   * ------------------------------------------------------------------ */
  async function processButton(btn) {
    const id = idOf(btn);
    const title = titleOf(btn);

    if (responded.has(id)) return 'dup';
    if (inBlacklist(title)) {
      console.log('[HH] Чёрный список → пропуск: ' + title);
      return 'skip';
    }

    setStat('Откликаюсь: ' + (title || 'вакансия').slice(0, 40));
    btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
    btn.click();

    // Подтверждение релокации (вакансия в другой стране)
    const reloc = await waitFor('[data-qa="relocation-warning-confirm"]', 1500);
    if (reloc) {
      if (!CONFIG.confirmRelocation) { remember(id); return 'skip'; }
      reloc.click();
      await wait(800);
    }

    // Ждём попап отклика
    const popup = await waitFor(
      '[data-qa="vacancy-response-popup-form-letter-input"],' +
      '[data-qa="vacancy-response-submit-popup"]', 3500);

    // Вакансия с тестом / доп.вопросами
    const hasTest =
      q('[data-qa="task-body"]') ||
      /\/applicant\/vacancy_response/.test(location.pathname) ||
      q('[data-qa="vacancy-response-test-name"]');

    if (!popup || (CONFIG.skipVacanciesWithTests && hasTest)) {
      remember(id);
      console.log('[HH] Пропуск (тест/нет попапа): ' + (title || id));
      const close = q('[data-qa="response-popup-close"], [data-qa="modal-close"], [data-qa="bloko-modal-close"]');
      if (close) (close.closest('button,[role="button"]') || close).click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      return 'skip';
    }

    // Сопроводительное письмо
    if (CONFIG.sendCoverLetter) {
      // HH Magritte: тумблер письма теперь data-qa="add-cover-letter"
      const toggle = q('[data-qa="add-cover-letter"]') ||
        q('[data-qa="vacancy-response-letter-toggle"]');
      if (toggle && !q('[data-qa="vacancy-response-popup-form-letter-input"]')) {
        toggle.click();
        await wait(500);
      }
      const input = q('[data-qa="vacancy-response-popup-form-letter-input"]');
      if (input) setNativeValue(input, CONFIG.coverLetter);
    }

    // Отправка
    const submit = await waitFor('[data-qa="vacancy-response-submit-popup"]', 2000);
    if (submit) {
      submit.click();
      await wait(1500);
      remember(id);
      return 'sent';
    }

    remember(id);
    return 'skip';
  }

  /* ------------------------------------------------------------------ *
   *  Главный цикл
   * ------------------------------------------------------------------ */
  async function run() {
    while (state.running) {
      // Кнопка «Показать все вакансии»
      const showAll = q('[data-qa="applicant-index-search-all-results-button"]');
      if (showAll) { showAll.click(); await wait(3000); continue; }

      const buttons = qa('[data-qa="vacancy-serp__vacancy_response"]')
        .filter((b) => !b.disabled);

      if (buttons.length === 0) { setStat('Кнопок отклика нет.'); break; }

      let didSomething = false;
      for (const btn of buttons) {
        if (!state.running) return;
        if (state.sent >= CONFIG.maxResponses) {
          return stop('Достигнут лимит (' + CONFIG.maxResponses + ')');
        }

        const res = await processButton(btn);
        if (res === 'sent') {
          state.sent++; didSomething = true; setStat('Отправлено ✔'); await human();
        } else if (res === 'skip') {
          state.skipped++; didSomething = true; await wait(600);
        }
        // 'dup' — молча пропускаем
      }

      // Следующая страница
      const next = q('[data-qa="pager-next"]');
      if (CONFIG.autoNextPage && next) {
        setStat('Следующая страница…');
        next.click();
        await wait(3500);
      } else {
        break;
      }
    }
    if (state.running) stop('Все вакансии обработаны 🎉');
  }

  console.log('[HH] Авто-отклик запущен. Управление — панелью в правом нижнем углу.');
  run().catch((e) => { console.error(e); stop('Ошибка: ' + e.message); });
})();
