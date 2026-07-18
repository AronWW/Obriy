import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  uk: {
    translation: {
      brand: {
        name: 'Obriy',
        tagline: 'Історія, яку хочеться досліджувати',
      },
      navigation: {
        label: 'Основна навігація',
        overview: 'Головна',
        journey: 'Квести',
        map: 'Мапа',
        codex: 'Кодекс',
        badges: 'Відзнаки',
        leaderboard: 'Рейтинг',
        classes: 'Клас',
        profile: 'Профіль',
        settings: 'Налаштування',
        openMenu: 'Відкрити меню',
        closeMenu: 'Закрити меню',
      },
      quote: {
        text: 'Минуле — твій компас. Майбутнє — твій квест.',
      },
      profile: {
        open: 'Відкрити профіль',
        demoName: 'Арія Косміна',
        initials: 'АК',
      },
      actions: {
        continue: 'Продовжити подорож',
        openLesson: 'Відкрити урок',
      },
      theme: {
        day: 'День',
        night: 'Ніч',
        switchToDay: 'Увімкнути денну тему',
        switchToNight: 'Увімкнути нічну тему',
      },
      language: {
        label: 'Мова інтерфейсу',
        short: 'UA',
      },
      greeting: {
        eyebrow: 'Твоя історична експедиція',
        title: 'Доброго дня, мандрівнику',
        description:
          'Продовжуй досліджувати події, постаті та місця, що формували наш світ.',
      },
      progress: {
        title: 'Шлях дослідника',
        level: 'Рівень 7',
        xp: '2 480 / 3 000 XP',
        value: '83',
      },
      lesson: {
        label: 'Наступна зупинка',
        title: 'Київська Русь: міста та торгові шляхи',
        meta: '12 хв · 120 XP',
      },
      badge: {
        unlocked: 'Нова відзнака',
        name: 'Хранитель літопису',
      },
    },
  },
  en: {
    translation: {
      brand: {
        name: 'Obriy',
        tagline: 'History worth exploring',
      },
      navigation: {
        label: 'Primary navigation',
        overview: 'Home',
        journey: 'Quests',
        map: 'Map',
        codex: 'Codex',
        badges: 'Badges',
        leaderboard: 'Leaderboard',
        classes: 'Class',
        profile: 'Profile',
        settings: 'Settings',
        openMenu: 'Open menu',
        closeMenu: 'Close menu',
      },
      quote: {
        text: 'The past is your compass. The future is your quest.',
      },
      profile: {
        open: 'Open profile',
        demoName: 'Aria Kosmina',
        initials: 'AK',
      },
      actions: {
        continue: 'Continue the journey',
        openLesson: 'Open lesson',
      },
      theme: {
        day: 'Day',
        night: 'Night',
        switchToDay: 'Switch to day theme',
        switchToNight: 'Switch to night theme',
      },
      language: {
        label: 'Interface language',
        short: 'EN',
      },
      greeting: {
        eyebrow: 'Your history expedition',
        title: 'Good day, explorer',
        description:
          'Keep exploring the events, people, and places that shaped our world.',
      },
      progress: {
        title: 'Explorer path',
        level: 'Level 7',
        xp: '2,480 / 3,000 XP',
        value: '83',
      },
      lesson: {
        label: 'Next stop',
        title: 'Kyivan Rus: cities and trade routes',
        meta: '12 min · 120 XP',
      },
      badge: {
        unlocked: 'New achievement',
        name: 'Chronicle Keeper',
      },
    },
  },
} as const

const storedLanguage = localStorage.getItem('obriy-language')
const initialLanguage = storedLanguage === 'en' ? 'en' : 'uk'

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
})

export default i18n
