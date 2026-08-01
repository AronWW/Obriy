import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  uk: {
    translation: {
      brand: {
        name: 'Obriy',
        tagline: 'Історія, яку хочеться досліджувати',
      },
      global: {
        controls: 'Глобальні налаштування',
      },
      home: {
        openHome: 'На головну Obriy',
        eyebrow: 'Історичний квест',
        title: 'Ласкаво просимо до Obriy',
        description: 'Твоя подорож крізь історію починається тут.',
        signIn: 'Увійти',
        register: 'Зареєструватися',
        continue: 'Продовжити',
        hero: {
          titleLine1: 'Вивчай історію,',
          titleLine2: 'граючи й досліджуючи',
          description:
            'Проходь уроки, виконуй інтерактивні завдання, перевіряй знання та стеж за прогресом.',
          actionsLabel: 'Основні дії',
          start: 'Почати навчання',
          explore: 'Перейти до наступного розділу',
        },
        journey: {
          eyebrow: 'Шлях крізь час',
          titleLine1: 'Не просто запам’ятовуй.',
          titleLine2: 'Досліджуй.',
          description:
            'Obriy поєднує історію з дією: кожна тема стає маршрутом, а кожне завдання наближає до нового відкриття.',
          steps: {
            discover: {
              title: 'Навчайся у власному темпі',
              description:
                'Проходь двомовні уроки, виконуй інтерактивні завдання та закріплюй знання у зручному темпі.',
            },
            interact: {
              title: 'Створюй матеріали для класу',
              description:
                'Готуй уроки й завдання, об’єднуй учнів у класи та керуй навчанням в одному місці.',
            },
            grow: {
              title: 'Відстежуй прогрес і досягнення',
              description:
                'Стеж за уроками, XP і відзнаками. Вчителі та батьки бачать доступну їм динаміку навчання.',
            },
          },
          atlas: {
            start: 'Точка відліку',
            finish: 'Новий обрій',
          },
        },
        roles: {
          eyebrow: 'Один простір, різні маршрути',
          title: 'Знайди свій шлях в Obriy',
          description:
            'Обери роль, щоб побачити, як платформа працюватиме саме для тебе.',
          selectorLabel: 'Вибір ролі користувача',
          path: 'Шлях {{current}} із {{total}}',
          student: {
            label: 'Учень',
            title: 'Досліджуй історію через дію',
            description:
              'Рухайся від теми до теми у власному темпі й бач, як кожна відповідь формує твій прогрес.',
            benefit1: 'Інтерактивні уроки, квести та завдання на карті',
            benefit2: 'XP, рівні, бейджі й особистий маршрут навчання',
            benefit3: 'Прогрес класу, рейтинг і спільна робота',
            action: 'Стати дослідником',
          },
          teacher: {
            label: 'Вчитель',
            title: 'Створюй маршрути для класу',
            description:
              'Перетворюй навчальну програму на послідовність зрозумілих завдань і бач реальну картину прогресу.',
            benefit1: 'Конструктор уроків, тестів і запитань на карті',
            benefit2: 'Керування класом та доступом учнів',
            benefit3: 'Аналітика результатів без ручного зведення',
            action: 'Створити шлях класу',
          },
          parent: {
            label: 'Батьки',
            title: 'Бачте шлях дитини без зайвого контролю',
            description:
              'Під’єднайте одну або кількох дітей за безпечним запрошенням і переглядайте лише їхній навчальний прогрес.',
            benefit1: 'Read-only огляд уроків і виконаних завдань',
            benefit2: 'Динаміка XP, рівнів і відкритих досягнень',
            benefit3: 'Окремий простір для кожної прив’язаної дитини',
            action: 'Створити акаунт батьків',
          },
        },
        footer: {
          tagline: 'Історія, яку хочеться досліджувати',
          copyright: '© {{year}} Obriy',
        },
      },
      auth: {
        common: {
          backHome: 'На головну',
        },
        layout: {
          eyebrow: 'Твій шлях крізь історію',
          title: 'Кожна епоха залишає дороговказ.',
          description: 'Повернися до своєї подорожі та продовжуй відкривати минуле.',
          formRegion: 'Форма автентифікації',
        },
        session: {
          checking: 'Перевіряємо сесію…',
          logout: 'Вийти з акаунта',
        },
        login: {
          eyebrow: 'Вхід до Obriy',
          title: 'З поверненням',
          subtitle: 'Увійдіть, щоб продовжити свою історичну подорож.',
          email: 'Електронна пошта',
          emailPlaceholder: 'name@example.com',
          password: 'Пароль',
          showPassword: 'Показати пароль',
          hidePassword: 'Приховати пароль',
          submit: 'Увійти',
          submitting: 'Входимо…',
          forgotPassword: 'Забули пароль?',
          noAccount: 'Ще не маєте акаунта?',
          createAccount: 'Зареєструватися',
        },
        roles: {
          title: 'Оберіть свою роль',
          subtitle: 'Ми налаштуємо Obriy відповідно до вашого шляху в навчанні.',
          STUDENT: {
            name: 'Учень',
            description: 'Проходьте квести, здобувайте XP і досліджуйте історію.',
          },
          TEACHER: {
            name: 'Вчитель',
            description: 'Створюйте уроки, керуйте класом і стежте за прогресом.',
          },
          PARENT: {
            name: 'Батьки',
            description: 'Переглядайте прогрес і досягнення своїх дітей.',
          },
        },
        register: {
          eyebrow: 'Новий шлях в Obriy',
          title: 'Створення акаунта',
          subtitle: 'Заповніть дані, щоб розпочати історичну подорож.',
          hasAccount: 'Вже маєте акаунт?',
          signIn: 'Увійти',
          changeRole: 'Змінити роль',
          displayName: 'Ім’я для відображення',
          passwordHint: 'Щонайменше 10 символів, одна літера та одна цифра.',
          confirmPassword: 'Повторіть пароль',
          submit: 'Зареєструватися',
          submitting: 'Створюємо акаунт…',
        },
        checkEmail: {
          title: 'Перевірте пошту',
          description: 'Ми надіслали посилання для підтвердження на',
          resendIn: 'Надіслати повторно через {{time}}',
          resend: 'Надіслати посилання ще раз',
          sending: 'Надсилаємо…',
          sentAgain: 'Нове посилання надіслано. Попереднє вже недійсне.',
          backToLogin: 'Повернутися до входу',
          alreadyVerifiedTitle: 'Пошту вже підтверджено',
          alreadyVerifiedDescription: 'Ваш акаунт активний. Тепер можна увійти.',
          goToLogin: 'Перейти до входу',
        },
        verify: {
          invalidTitle: 'Посилання недійсне',
          invalidDescription: 'Термін дії посилання минув або його вже використано.',
          goToLogin: 'Перейти до входу',
          successTitle: 'Пошту підтверджено',
          successDescription: 'Ваш акаунт активовано. Ласкаво просимо до Obriy.',
          signIn: 'Увійти в акаунт',
          checkingTitle: 'Перевіряємо посилання',
          checkingDescription: 'Це триватиме лише мить.',
        },
        forgot: {
          backToLogin: 'Повернутися до входу',
          eyebrow: 'Відновлення доступу',
          title: 'Забули пароль?',
          subtitle: 'Вкажіть пошту акаунта, і ми надішлемо посилання для відновлення.',
          submit: 'Надіслати посилання',
          submitting: 'Надсилаємо…',
          sentTitle: 'Перевірте пошту',
          sentDescription: 'Якщо акаунт із такою адресою існує, лист для відновлення вже в дорозі.',
        },
        reset: {
          invalidTitle: 'Посилання недійсне',
          invalidDescription: 'Термін дії посилання минув або його вже використано.',
          requestAgain: 'Отримати нове посилання',
          successTitle: 'Пароль оновлено',
          successDescription: 'Новий пароль збережено, а попередні сесії завершено.',
          signIn: 'Увійти з новим паролем',
          eyebrow: 'Новий пароль',
          title: 'Відновіть доступ',
          subtitle: 'Створіть новий надійний пароль для свого акаунта.',
          password: 'Новий пароль',
          submit: 'Зберегти новий пароль',
          submitting: 'Зберігаємо…',
        },
        google: {
          continueLogin: 'Продовжити з Google',
          continueRegistration: 'Зареєструватися через Google',
          orEmail: 'або через пошту',
          completingTitle: 'Завершуємо вхід',
          completingDescription: 'Безпечно створюємо вашу сесію Obriy.',
          verifiedEyebrow: 'Google-акаунт підтверджено',
          chooseRoleTitle: 'Оберіть свою роль',
          chooseRoleDescription: 'Акаунта з цією поштою ще немає. Оберіть, як ви користуватиметеся Obriy.',
          cancelledTitle: 'Вхід скасовано',
          errorTitle: 'Не вдалося увійти через Google',
          tryAgain: 'Спробувати Google ще раз',
          chooseRegistration: 'Обрати спосіб реєстрації',
        },
        validation: {
          emailRequired: 'Вкажіть електронну пошту.',
          emailInvalid: 'Введіть коректну електронну адресу.',
          passwordRequired: 'Вкажіть пароль.',
          displayNameMin: 'Ім’я має містити щонайменше 2 символи.',
          displayNameMax: 'Ім’я не може бути довшим за 80 символів.',
          passwordMin: 'Пароль має містити щонайменше 10 символів.',
          passwordMax: 'Пароль не може бути довшим за 72 символи.',
          passwordPattern: 'Додайте до пароля щонайменше одну літеру та одну цифру.',
          confirmPasswordRequired: 'Повторіть пароль.',
          passwordsMismatch: 'Паролі не збігаються.',
        },
        errors: {
          INVALID_CREDENTIALS: 'Невірна пошта або пароль.',
          USER_SUSPENDED: 'Цей акаунт призупинено.',
          EMAIL_VERIFICATION_REQUIRED: 'Спочатку підтвердьте електронну пошту.',
          NETWORK_ERROR: 'Не вдалося з’єднатися із сервером. Спробуйте ще раз.',
          UNEXPECTED_API_ERROR: 'Не вдалося виконати вхід. Спробуйте ще раз.',
          EMAIL_ALREADY_REGISTERED: 'Акаунт із цією поштою вже існує. Спробуйте увійти.',
          REGISTRATION_FAILED: 'Не вдалося створити акаунт. Спробуйте ще раз.',
          EMAIL_VERIFICATION_COOLDOWN: 'Нове посилання можна буде надіслати після завершення таймера.',
          RESEND_FAILED: 'Не вдалося надіслати посилання. Спробуйте ще раз.',
          PASSWORD_RESET_REQUEST_FAILED: 'Не вдалося надіслати лист. Спробуйте ще раз.',
          PASSWORD_RESET_FAILED: 'Не вдалося оновити пароль. Спробуйте ще раз.',
          GOOGLE_OAUTH_CANCELLED: 'Ви скасували вхід через Google.',
          GOOGLE_EMAIL_NOT_VERIFIED: 'Google не підтвердив електронну адресу цього акаунта.',
          GOOGLE_ACCOUNT_CONFLICT: 'Цей Google-акаунт уже пов’язаний з іншим профілем Obriy.',
          INVALID_OAUTH_STATE: 'Спроба входу протермінована або почалася в іншому браузері.',
          INVALID_OAUTH_EXCHANGE_CODE: 'Посилання для завершення входу недійсне або вже використане.',
          INVALID_OAUTH_REGISTRATION_TICKET: 'Час на завершення реєстрації минув. Почніть вхід через Google ще раз.',
          GOOGLE_OAUTH_NOT_CONFIGURED: 'Вхід через Google тимчасово недоступний.',
          GOOGLE_OAUTH_FAILED: 'Google-вхід не завершено. Спробуйте ще раз.',
        },
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
        studentOverview: 'Огляд',
        studentClasses: 'Мої класи',
        studentTasks: 'Мої завдання',
        studentAchievements: 'Досягнення',
        studentLeaderboard: 'Рейтинг',
        studentProfile: 'Профіль',
        teacherOverview: 'Огляд',
        teacherClasses: 'Мої класи',
        teacherLessons: 'Мої уроки',
        teacherTasks: 'Завдання',
        teacherAnalytics: 'Аналітика',
        teacherProfile: 'Профіль',
      },
      studentOverview: {
        eyebrow: 'Твоя навчальна подорож',
        title: 'Огляд',
        description:
          'Тут зібрано те, що допомагає продовжити навчання й бачити власний поступ.',
        unavailable: 'Дані огляду тимчасово недоступні.',
        profile: {
          label: 'Профіль дослідника',
          open: 'Відкрити профіль',
          grade: '{{grade}} клас',
          gradeUnavailable: 'Клас не вказано',
        },
        progress: {
          eyebrow: 'Навчальний огляд',
          title: 'Твій прогрес',
          emptyTitle: 'Перші результати ще попереду',
          emptyDescription:
            'Завдання, досягнення й активні дні з’являться після початку навчання.',
          summaryLabel: 'Короткий підсумок навчання',
          tasks: 'Завдання',
          achievements: 'Досягнення',
          activeDays: 'Активні дні',
          unavailable: 'Ще немає даних',
        },
        learning: {
          title: 'Зараз у навчанні',
          description: 'Поточний урок або тема.',
          empty: 'Активний навчальний матеріал ще не з’явився.',
          action: 'Перейти до класів',
        },
        tasks: {
          title: 'Найближчі завдання',
          description: 'Те, що потребуватиме уваги.',
          empty: 'Нових завдань поки немає.',
          action: 'Мої завдання',
        },
        achievements: {
          title: 'Останні досягнення',
          description: 'Нові відкриття й отримані значки.',
          empty: 'Перші досягнення ще попереду.',
          action: 'Усі досягнення',
        },
      },
      studentProfile: {
        title: 'Профіль учня',
        unavailable: 'Дані профілю тимчасово недоступні.',
        eyebrow: 'Профіль дослідника',
        customize: 'Налаштувати профіль',
        titleEmpty: 'Титул ще не обрано',
        grade: '{{grade}} клас',
        gradeUnavailable: 'Клас не вказано',
        saved: 'Профіль оновлено.',
        editor: {
          eyebrow: 'Налаштування',
          title: 'Оновити профіль',
          close: 'Закрити налаштування профілю',
          displayName: 'Ім’я у профілі',
          bio: 'Коротко про себе',
          bioPlaceholder:
            'Розкажіть, які історичні теми вам цікаві.',
          avatarHint:
            'Аватар, рамки, обкладинки й титули додамо разом із системою оформлення.',
          cancel: 'Скасувати',
          save: 'Зберегти',
          saving: 'Зберігаємо…',
        },
        about: {
          title: 'Про дослідника',
          description: 'Коротка розповідь про інтереси учня.',
          empty:
            'Опис ще не додано. Його можна заповнити в налаштуваннях профілю.',
        },
        showcase: {
          title: 'Вибрані значки',
          description:
            'Тут будуть значки, які учень вибере для демонстрації.',
          label: 'Місця для вибраних значків',
          empty: 'Поки не вибрано жодного значка.',
        },
        collection: {
          title: 'Колекція досягнень',
          description: 'Усі зароблені значки та особливі відзнаки.',
          empty:
            'Колекція з’явиться після запуску завдань і системи досягнень.',
        },
        appearance: {
          title: 'Оформлення',
          description:
            'Обкладинка, рамка аватара, кольорова тема й декоративний символ.',
          unavailable:
            'Вибір оформлення стане доступним разом із колекцією нагород.',
        },
        visibility: {
          title: 'Хто бачить профіль',
          description:
            'Профіль доступний лише учням вашого класу. Доступ перевіряється сервером.',
        },
        validation: {
          displayNameRequired: 'Вкажіть ім’я.',
          displayNameMin: 'Ім’я має містити щонайменше 2 символи.',
          displayNameMax: 'Ім’я не може бути довшим за 80 символів.',
          bioMax: 'Опис не може бути довшим за 500 символів.',
        },
        errors: {
          network:
            'Не вдалося з’єднатися із сервером. Спробуйте ще раз.',
          save: 'Не вдалося зберегти профіль. Спробуйте ще раз.',
        },
      },
      classes: {
        common: {
          grade: '{{grade}} клас',
          gradeUnknown: 'Клас не вказано',
          students: 'Учнів у класі: {{count}}',
          retry: 'Спробувати ще раз',
          cancel: 'Скасувати',
          close: 'Закрити',
        },
        teacher: {
          eyebrow: 'Навчальний простір',
          title: 'Мої класи',
          description:
            'Створюйте класи, запрошуйте учнів і переглядайте склад кожного класу.',
          open: 'Відкрити клас',
          states: {
            loading: 'Завантажуємо класи…',
            error: 'Не вдалося завантажити класи.',
          },
          empty: {
            title: 'Класів ще немає',
            description:
              'Створіть перший клас, щоб отримати код запрошення для учнів.',
          },
          create: {
            action: 'Створити клас',
            eyebrow: 'Новий клас',
            title: 'Основна інформація',
            name: 'Назва класу',
            namePlaceholder: 'Наприклад, 8-А',
            grade: 'Рік навчання',
            submit: 'Створити й отримати код',
            creating: 'Створюємо…',
          },
          edit: {
            action: 'Редагувати',
            eyebrow: 'Налаштування класу',
            title: 'Оновити клас',
            save: 'Зберегти',
            saving: 'Зберігаємо…',
            error: 'Не вдалося оновити клас.',
          },
          detail: {
            back: 'До всіх класів',
            eyebrow: 'Клас учителя',
            notFoundTitle: 'Клас не знайдено',
            notFound:
              'Цей клас не існує або не належить вашому обліковому запису.',
          },
          members: {
            title: 'Учні класу',
            description: 'Усі учні, які приєдналися за кодом.',
            loading: 'Завантажуємо список учнів…',
            error: 'Не вдалося завантажити список учнів.',
            empty:
              'Поки ніхто не приєднався. Створіть код і передайте його учням.',
          },
          invite: {
            title: 'Код запрошення',
            description:
              'Передайте код учням цього класу. Код діє сім днів.',
            copy: 'Копіювати',
            copied: 'Скопійовано',
            expires: 'Діє до {{date}}',
            hidden:
              'З міркувань безпеки повний код не зберігається. Створіть новий код, коли будете готові його передати.',
            refresh: 'Створити новий код',
            refreshing: 'Створюємо…',
            error: 'Не вдалося створити код. Спробуйте ще раз.',
          },
        },
        student: {
          eyebrow: 'Навчальний простір',
          title: 'Мій клас',
          description:
            'Приєднайтеся за кодом учителя, щоб бачити свій клас і профілі однокласників.',
          current: 'Ваш поточний клас',
          teacher: 'Учитель: {{name}}',
          states: {
            loading: 'Завантажуємо ваш клас…',
            errorTitle: 'Не вдалося відкрити клас',
            error: 'Перевірте з’єднання та спробуйте ще раз.',
          },
          join: {
            title: 'Приєднатися до класу',
            description:
              'Введіть код із восьми символів, який надав учитель.',
            label: 'Код запрошення',
            action: 'Приєднатися',
            joining: 'Приєднуємо…',
            invalid: 'Код недійсний або строк його дії завершився.',
            alreadyJoined: 'Ви вже приєднані до класу.',
          },
          classmates: {
            title: 'Однокласники',
            description:
              'Ви можете відкрити публічний профіль учня лише зі свого класу.',
            loading: 'Завантажуємо однокласників…',
            error: 'Не вдалося завантажити однокласників.',
            empty: 'Інші учні ще не приєдналися до цього класу.',
            open: 'Відкрити профіль',
          },
          profile: {
            back: 'Назад до класу',
            loading: 'Завантажуємо профіль…',
            notFoundTitle: 'Профіль недоступний',
            notFound:
              'Учень не належить до вашого класу або профіль більше недоступний.',
            aboutEmpty: 'Учень ще не додав розповідь про себе.',
            visibility:
              'Цей профіль бачать лише учні того самого класу.',
          },
        },
        validation: {
          nameRequired: 'Вкажіть назву класу.',
          nameMin: 'Назва має містити щонайменше 2 символи.',
          nameMax: 'Назва не може бути довшою за 80 символів.',
          codeRequired: 'Введіть код запрошення.',
          codeInvalid: 'Перевірте формат коду.',
        },
        errors: {
          network: 'Не вдалося з’єднатися із сервером.',
          unexpected: 'Щось пішло не так. Спробуйте ще раз.',
        },
      },
      studentWorkspace: {
        placeholderLabel: 'Розділ у розробці',
        pages: {
          overview: {
            title: 'Огляд',
            description:
              'Тут з’явиться короткий огляд навчання, найближчих завдань і прогресу.',
          },
          classes: {
            title: 'Мої класи',
            description:
              'Тут з’явиться інформація про навчальний клас і його учасників.',
          },
          tasks: {
            title: 'Мої завдання',
            description:
              'Тут з’являться доступні, поточні та завершені навчальні завдання.',
          },
          achievements: {
            title: 'Досягнення',
            description:
              'Тут з’являться здобуті відзнаки, рівень і навчальний прогрес.',
          },
          leaderboard: {
            title: 'Рейтинг',
            description:
              'Тут з’явиться рейтинг учасників класу після запуску системи прогресу.',
          },
          profile: {
            title: 'Профіль',
            description:
              'Тут можна буде переглядати й редагувати особисті дані профілю.',
          },
        },
      },
      teacherWorkspace: {
        placeholderLabel: 'Розділ у розробці',
        pages: {
          overview: {
            title: 'Огляд',
            description:
              'Тут з’явиться короткий огляд класів, матеріалів і навчальної активності.',
          },
          classes: {
            title: 'Мої класи',
            description:
              'Тут можна буде створювати класи та керувати їхніми учасниками.',
          },
          lessons: {
            title: 'Мої уроки',
            description:
              'Тут можна буде створювати, редагувати й публікувати навчальні матеріали.',
          },
          tasks: {
            title: 'Завдання',
            description:
              'Тут можна буде готувати завдання та переглядати результати учнів.',
          },
          analytics: {
            title: 'Аналітика',
            description:
              'Тут з’явиться прогрес і навчальна активність власних класів.',
          },
          profile: {
            title: 'Профіль',
            description:
              'Тут можна буде переглядати й редагувати особисті дані вчителя.',
          },
        },
      },
      teacherProfile: {
        eyebrow: 'Особисті дані',
        title: 'Профіль учителя',
        description:
          'Інформація, яку ви використовуватимете у своєму робочому просторі Obriy.',
        unavailable: 'Дані профілю тимчасово недоступні.',
        identityLabel: 'Поточний профіль',
        avatarHint:
          'Завантаження нового фото додамо окремим наступним кроком.',
        formLegend: 'Основна інформація',
        displayName: 'Ім’я та прізвище',
        subjectArea: 'Предмет або спеціалізація',
        subjectAreaPlaceholder: 'Наприклад, історія України',
        bio: 'Коротко про себе',
        bioPlaceholder:
          'Розкажіть про свій досвід або підхід до навчання.',
        email: 'Електронна пошта',
        emailHint:
          'Пошта прив’язана до акаунта й не редагується на цій сторінці.',
        saved: 'Зміни збережено.',
        reset: 'Скасувати зміни',
        save: 'Зберегти зміни',
        saving: 'Зберігаємо…',
        validation: {
          displayNameRequired: 'Вкажіть ім’я.',
          displayNameMin: 'Ім’я має містити щонайменше 2 символи.',
          displayNameMax: 'Ім’я не може бути довшим за 80 символів.',
          subjectAreaMax:
            'Назва предмета не може бути довшою за 80 символів.',
          bioMax: 'Опис не може бути довшим за 500 символів.',
        },
        errors: {
          network:
            'Не вдалося з’єднатися із сервером. Спробуйте ще раз.',
          save: 'Не вдалося зберегти профіль. Спробуйте ще раз.',
        },
      },
      parentHub: {
        homeAriaLabel: 'Батьківський простір Obriy',
        header: {
          title: 'Простір для батьків',
        },
        states: {
          loading: 'Завантажуємо дані про дітей…',
          errorTitle: 'Не вдалося завантажити огляд',
          errorDescription:
            'Перевірте з’єднання та спробуйте завантажити дані ще раз.',
        },
        actions: {
          retry: 'Спробувати ще раз',
          allChildren: 'Огляд сім’ї',
          openProgress: 'Докладний прогрес',
          backToOverview: 'До огляду дитини',
          backToHome: 'На головну',
        },
        empty: {
          eyebrow: 'Перший крок',
          title: 'Підключіть дитину',
          description:
            'Навчальний огляд з’явиться тут після підключення через захищене запрошення.',
          action: 'Підключити дитину',
        },
        family: {
          eyebrow: 'Огляд сім’ї',
          title: 'Навчання ваших дітей',
          description:
            'Кожна дитина має окремий огляд — без порівнянь і рейтингів між ними.',
          listLabel: 'Підключені діти',
          quietNote:
            'Тут показуємо лише інформацію, яка допомагає підтримати навчання дитини.',
          openChild: 'Відкрити огляд',
        },
        child: {
          gradeUnavailable: 'Клас не вказано',
          grade: '{{grade}} клас',
          switcherLabel: 'Переглянути дитину',
          eyebrow: 'Навчальний огляд',
        },
        attention: {
          title: 'Варто перевірити',
          unavailable:
            'Сигнали з’являться, коли в дитини будуть навчальні завдання та результати.',
        },
        weekly: {
          title: 'Цей тиждень',
          description:
            'Короткий підсумок з’явиться після початку навчальної активності.',
          learningTime: 'Час навчання',
          completed: 'Завершено',
          progress: 'Прогрес',
        },
        common: {
          unavailable: 'Ще немає даних',
        },
        learningNow: {
          title: 'Зараз у навчанні',
          description: 'Поточні теми й завдання дитини.',
          empty: 'Активні навчальні матеріали ще не з’явилися.',
        },
        activity: {
          title: 'Остання активність',
          description: 'Недавні завершені уроки та завдання.',
          empty: 'Історія навчальної активності поки порожня.',
        },
        progress: {
          eyebrow: 'Докладний звіт',
          title: 'Прогрес: {{name}}',
          description:
            'Тут буде хронологія навчання, виконання уроків і динаміка результатів.',
          emptyTitle: 'Дані прогресу ще формуються',
          emptyDescription:
            'Перші результати з’являться після виконання навчальних завдань.',
        },
        connect: {
          eyebrow: 'Захищене підключення',
          title: 'Підключення дитини',
          description:
            'Дитина підключатиметься до вашого акаунта через персональне запрошення.',
          unavailable:
            'Механізм запрошень реалізуємо окремим наступним кроком.',
        },
      },
      parentLinks: {
        student: {
          title: 'Батьки та опікуни',
          description:
            'Керуйте дорослими, які мають доступ до вашого сімейного огляду.',
          loading: 'Завантажуємо підключених дорослих…',
          loadError: 'Не вдалося завантажити список.',
          empty: 'До профілю ще не підключено жодного дорослого.',
          linkedAt: 'Підключено {{date}}',
          remove: 'Від’єднати {{name}}',
          confirmRemove: 'Від’єднати',
          cancelRemove: 'Скасувати від’єднання',
          invitationTitle: 'Запросити дорослого',
          invitationDescription:
            'Створіть одноразове посилання та передайте його батькам або опікуну.',
          linkLabel: 'Посилання-запрошення',
          copy: 'Копіювати',
          copied: 'Скопійовано',
          revealWarning:
            'Збережіть посилання зараз: після оновлення сторінки повний токен більше не показуватиметься.',
          activeUntil: 'Активне запрошення діє до {{date}}.',
          createInvitation: 'Створити запрошення',
          replaceInvitation: 'Створити нове посилання',
          revokeInvitation: 'Відкликати запрошення',
          limitReached:
            'Досягнуто ліміту: до профілю можна підключити не більше чотирьох дорослих.',
        },
        landing: {
          eyebrow: 'Захищене сімейне запрошення',
          title: 'Вас запросили до Obriy',
          description:
            'Увійдіть або створіть обліковий запис батька, щоб переглянути запрошення та підтвердити зв’язок.',
          login: 'Увійти',
          register: 'Створити профіль батька',
          privacy:
            'Дані дитини з’являться тільки після входу з роллю батька та окремого підтвердження.',
          invalidTitle: 'Посилання недійсне',
          invalidDescription:
            'Перевірте адресу або попросіть дитину створити нове запрошення.',
          wrongRoleTitle: 'Потрібен профіль батька',
          wrongRoleDescription:
            'Це запрошення не можна прийняти з профілю учня, учителя або адміністратора.',
          home: 'На головну',
          workspace: 'До свого простору',
        },
        connect: {
          eyebrow: 'Підтвердження зв’язку',
          noInvitationTitle: 'Немає активного запрошення',
          noInvitationDescription:
            'Відкрийте особисте посилання, яке створила дитина.',
          loadingTitle: 'Перевіряємо запрошення',
          loadingDescription: 'Це займе лише мить.',
          invalidTitle: 'Запрошення недійсне',
          invalidDescription:
            'Посилання вже використано, відкликано або строк його дії завершився.',
          confirmDescription:
            'Підтвердіть, що хочете підключити цю дитину до свого сімейного огляду.',
          confirm: 'Підключити дитину',
          connecting: 'Підключаємо…',
          alreadyLinked: 'Ця дитина вже підключена до вашого профілю.',
          openOverview: 'Відкрити сімейний огляд',
          privacy:
            'Після підтвердження ви бачитимете лише дозволену інформацію цієї дитини.',
          limitReached:
            'До профілю дитини вже підключено максимальну кількість дорослих.',
        },
        parent: {
          unlink: 'Від’єднатися від дитини',
          confirmUnlink: 'Підтвердити від’єднання',
          cancelUnlink: 'Скасувати',
          unlinkError: 'Не вдалося від’єднати профіль. Спробуйте ще раз.',
        },
        errors: {
          network: 'Не вдалося з’єднатися із сервером.',
          unexpected: 'Щось пішло не так. Спробуйте ще раз.',
        },
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
        description: 'Продовжуй досліджувати події, постаті та місця, що формували наш світ.',
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
      global: {
        controls: 'Global settings',
      },
      home: {
        openHome: 'Go to the Obriy home page',
        eyebrow: 'Historical quest',
        title: 'Welcome to Obriy',
        description: 'Your journey through history begins here.',
        signIn: 'Sign in',
        register: 'Register',
        continue: 'Continue',
        hero: {
          titleLine1: 'Learn history',
          titleLine2: 'by playing and exploring',
          description:
            'Complete lessons and interactive challenges, test your knowledge, and track your progress.',
          actionsLabel: 'Primary actions',
          start: 'Start learning',
          explore: 'Go to the next section',
        },
        journey: {
          eyebrow: 'A path through time',
          titleLine1: 'Do more than memorize.',
          titleLine2: 'Explore.',
          description:
            'Obriy connects history with action: every topic becomes a route, and every challenge moves you toward a new discovery.',
          steps: {
            discover: {
              title: 'Learn at your own pace',
              description:
                'Complete bilingual lessons, solve interactive activities, and reinforce knowledge at a comfortable pace.',
            },
            interact: {
              title: 'Create materials for your class',
              description:
                'Build lessons and activities, organize students into classes, and manage learning in one place.',
            },
            grow: {
              title: 'Track progress and achievements',
              description:
                'Track lessons, XP, and badges. Teachers and parents see the learning progress available to them.',
            },
          },
          atlas: {
            start: 'Starting point',
            finish: 'New horizon',
          },
        },
        roles: {
          eyebrow: 'One space, different routes',
          title: 'Find your path in Obriy',
          description:
            'Choose a role to see how the platform will work specifically for you.',
          selectorLabel: 'Choose a user role',
          path: 'Path {{current}} of {{total}}',
          student: {
            label: 'Student',
            title: 'Explore history through action',
            description:
              'Move from topic to topic at your own pace and see how every answer shapes your progress.',
            benefit1: 'Interactive lessons, quests, and map challenges',
            benefit2: 'XP, levels, badges, and a personal learning route',
            benefit3: 'Class progress, leaderboard, and collaboration',
            action: 'Become an explorer',
          },
          teacher: {
            label: 'Teacher',
            title: 'Create routes for your class',
            description:
              'Turn the curriculum into a clear sequence of challenges and see the real picture of class progress.',
            benefit1: 'A builder for lessons, quizzes, and map questions',
            benefit2: 'Class management and controlled student access',
            benefit3: 'Result analytics without manual spreadsheets',
            action: 'Create a class route',
          },
          parent: {
            label: 'Parent',
            title: 'See your child’s path without overstepping',
            description:
              'Connect one or more children through a secure invitation and view only their learning progress.',
            benefit1: 'Read-only overview of lessons and completed work',
            benefit2: 'XP, level, and achievement development',
            benefit3: 'A separate view for every connected child',
            action: 'Create a parent account',
          },
        },
        footer: {
          tagline: 'History worth exploring',
          copyright: '© {{year}} Obriy',
        },
      },
      auth: {
        common: {
          backHome: 'Back home',
        },
        layout: {
          eyebrow: 'Your path through history',
          title: 'Every era leaves a wayfinder.',
          description: 'Return to your journey and continue discovering the past.',
          formRegion: 'Authentication form',
        },
        session: {
          checking: 'Checking your session…',
          logout: 'Sign out',
        },
        login: {
          eyebrow: 'Sign in to Obriy',
          title: 'Welcome back',
          subtitle: 'Sign in to continue your journey through history.',
          email: 'Email',
          emailPlaceholder: 'name@example.com',
          password: 'Password',
          showPassword: 'Show password',
          hidePassword: 'Hide password',
          submit: 'Sign in',
          submitting: 'Signing in…',
          forgotPassword: 'Forgot password?',
          noAccount: 'New to Obriy?',
          createAccount: 'Create an account',
        },
        roles: {
          title: 'Choose your role',
          subtitle: 'We will tailor Obriy to your path through learning.',
          STUDENT: {
            name: 'Student',
            description: 'Complete quests, earn XP, and explore history.',
          },
          TEACHER: {
            name: 'Teacher',
            description: 'Create lessons, manage a class, and follow progress.',
          },
          PARENT: {
            name: 'Parent',
            description: 'Follow the progress and achievements of your children.',
          },
        },
        register: {
          eyebrow: 'A new path in Obriy',
          title: 'Create your account',
          subtitle: 'Enter your details to begin the journey through history.',
          hasAccount: 'Already have an account?',
          signIn: 'Sign in',
          changeRole: 'Change role',
          displayName: 'Display name',
          passwordHint: 'At least 10 characters with one letter and one number.',
          confirmPassword: 'Confirm password',
          submit: 'Create account',
          submitting: 'Creating account…',
        },
        checkEmail: {
          title: 'Check your email',
          description: 'We sent a verification link to',
          resendIn: 'Resend in {{time}}',
          resend: 'Send another link',
          sending: 'Sending…',
          sentAgain: 'A new link was sent. The previous one is no longer valid.',
          backToLogin: 'Back to sign in',
          alreadyVerifiedTitle: 'Email already verified',
          alreadyVerifiedDescription: 'Your account is active. You can now sign in.',
          goToLogin: 'Go to sign in',
        },
        verify: {
          invalidTitle: 'This link is invalid',
          invalidDescription: 'The link has expired or has already been used.',
          goToLogin: 'Go to sign in',
          successTitle: 'Email verified',
          successDescription: 'Your account is now active. Welcome to Obriy.',
          signIn: 'Sign in to your account',
          checkingTitle: 'Checking your link',
          checkingDescription: 'This will only take a moment.',
        },
        forgot: {
          backToLogin: 'Back to sign in',
          eyebrow: 'Account recovery',
          title: 'Forgot your password?',
          subtitle: 'Enter your account email and we will send you a recovery link.',
          submit: 'Send recovery link',
          submitting: 'Sending…',
          sentTitle: 'Check your email',
          sentDescription: 'If an account with that address exists, a recovery email is on its way.',
        },
        reset: {
          invalidTitle: 'This link is invalid',
          invalidDescription: 'The link has expired or has already been used.',
          requestAgain: 'Request another link',
          successTitle: 'Password updated',
          successDescription: 'Your new password is saved and previous sessions have ended.',
          signIn: 'Sign in with new password',
          eyebrow: 'New password',
          title: 'Restore your access',
          subtitle: 'Create a new secure password for your account.',
          password: 'New password',
          submit: 'Save new password',
          submitting: 'Saving…',
        },
        google: {
          continueLogin: 'Continue with Google',
          continueRegistration: 'Sign up with Google',
          orEmail: 'or use email',
          completingTitle: 'Completing sign in',
          completingDescription: 'Securely creating your Obriy session.',
          verifiedEyebrow: 'Google account verified',
          chooseRoleTitle: 'Choose your role',
          chooseRoleDescription: 'No account uses this email yet. Choose how you will use Obriy.',
          cancelledTitle: 'Sign in cancelled',
          errorTitle: 'Could not sign in with Google',
          tryAgain: 'Try Google again',
          chooseRegistration: 'Choose a registration method',
        },
        validation: {
          emailRequired: 'Enter your email address.',
          emailInvalid: 'Enter a valid email address.',
          passwordRequired: 'Enter your password.',
          displayNameMin: 'Your name must contain at least 2 characters.',
          displayNameMax: 'Your name cannot be longer than 80 characters.',
          passwordMin: 'Your password must contain at least 10 characters.',
          passwordMax: 'Your password cannot be longer than 72 characters.',
          passwordPattern: 'Include at least one letter and one number.',
          confirmPasswordRequired: 'Confirm your password.',
          passwordsMismatch: 'The passwords do not match.',
        },
        errors: {
          INVALID_CREDENTIALS: 'Incorrect email or password.',
          USER_SUSPENDED: 'This account has been suspended.',
          EMAIL_VERIFICATION_REQUIRED: 'Verify your email address before signing in.',
          NETWORK_ERROR: 'Could not connect to the server. Try again.',
          UNEXPECTED_API_ERROR: 'Could not sign in. Try again.',
          EMAIL_ALREADY_REGISTERED: 'An account with this email already exists. Try signing in.',
          REGISTRATION_FAILED: 'Could not create your account. Try again.',
          EMAIL_VERIFICATION_COOLDOWN: 'You can request another link when the timer finishes.',
          RESEND_FAILED: 'Could not send the link. Try again.',
          PASSWORD_RESET_REQUEST_FAILED: 'Could not send the email. Try again.',
          PASSWORD_RESET_FAILED: 'Could not update your password. Try again.',
          GOOGLE_OAUTH_CANCELLED: 'You cancelled Google sign in.',
          GOOGLE_EMAIL_NOT_VERIFIED: 'Google did not verify this account email.',
          GOOGLE_ACCOUNT_CONFLICT: 'This Google account is already linked to another Obriy profile.',
          INVALID_OAUTH_STATE: 'This sign-in attempt expired or started in another browser.',
          INVALID_OAUTH_EXCHANGE_CODE: 'The sign-in link is invalid or has already been used.',
          INVALID_OAUTH_REGISTRATION_TICKET: 'The registration window expired. Start Google sign in again.',
          GOOGLE_OAUTH_NOT_CONFIGURED: 'Google sign in is temporarily unavailable.',
          GOOGLE_OAUTH_FAILED: 'Google sign in could not be completed. Try again.',
        },
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
        studentOverview: 'Overview',
        studentClasses: 'My classes',
        studentTasks: 'My assignments',
        studentAchievements: 'Achievements',
        studentLeaderboard: 'Leaderboard',
        studentProfile: 'Profile',
        teacherOverview: 'Overview',
        teacherClasses: 'My classes',
        teacherLessons: 'My lessons',
        teacherTasks: 'Assignments',
        teacherAnalytics: 'Analytics',
        teacherProfile: 'Profile',
      },
      studentOverview: {
        eyebrow: 'Your learning journey',
        title: 'Overview',
        description:
          'Everything that helps you continue learning and see your own progress is gathered here.',
        unavailable: 'Overview information is temporarily unavailable.',
        profile: {
          label: 'Explorer profile',
          open: 'Open profile',
          grade: 'Grade {{grade}}',
          gradeUnavailable: 'Grade not provided',
        },
        progress: {
          eyebrow: 'Learning overview',
          title: 'Your progress',
          emptyTitle: 'Your first results are still ahead',
          emptyDescription:
            'Assignments, achievements, and active days will appear after learning begins.',
          summaryLabel: 'Learning summary',
          tasks: 'Assignments',
          achievements: 'Achievements',
          activeDays: 'Active days',
          unavailable: 'No data yet',
        },
        learning: {
          title: 'Learning now',
          description: 'Your current lesson or topic.',
          empty: 'No active learning material is available yet.',
          action: 'Go to classes',
        },
        tasks: {
          title: 'Upcoming assignments',
          description: 'What may need your attention next.',
          empty: 'There are no new assignments yet.',
          action: 'My assignments',
        },
        achievements: {
          title: 'Recent achievements',
          description: 'New discoveries and earned badges.',
          empty: 'Your first achievements are still ahead.',
          action: 'All achievements',
        },
      },
      studentProfile: {
        title: 'Student profile',
        unavailable: 'Profile information is temporarily unavailable.',
        eyebrow: 'Explorer profile',
        customize: 'Customize profile',
        titleEmpty: 'No title selected yet',
        grade: 'Grade {{grade}}',
        gradeUnavailable: 'Grade not provided',
        saved: 'Profile updated.',
        editor: {
          eyebrow: 'Settings',
          title: 'Update profile',
          close: 'Close profile settings',
          displayName: 'Profile name',
          bio: 'About you',
          bioPlaceholder:
            'Share which historical topics interest you.',
          avatarHint:
            'Avatars, frames, covers, and titles will arrive with profile appearance.',
          cancel: 'Cancel',
          save: 'Save',
          saving: 'Saving…',
        },
        about: {
          title: 'About the explorer',
          description: 'A short introduction to the student’s interests.',
          empty:
            'No introduction has been added yet. You can add one in profile settings.',
        },
        showcase: {
          title: 'Featured badges',
          description:
            'Badges selected by the student will be shown here.',
          label: 'Featured badge slots',
          empty: 'No badges have been selected yet.',
        },
        collection: {
          title: 'Achievement collection',
          description: 'All earned badges and special awards.',
          empty:
            'The collection will appear after assignments and achievements are available.',
        },
        appearance: {
          title: 'Appearance',
          description:
            'Cover, avatar frame, colour theme, and decorative symbol.',
          unavailable:
            'Appearance choices will become available with the reward collection.',
        },
        visibility: {
          title: 'Who can view this profile',
          description:
            'Only students in your class can view this profile. Access is checked by the server.',
        },
        validation: {
          displayNameRequired: 'Enter your name.',
          displayNameMin: 'Your name must contain at least 2 characters.',
          displayNameMax: 'Your name cannot be longer than 80 characters.',
          bioMax: 'The description cannot be longer than 500 characters.',
        },
        errors: {
          network: 'Could not connect to the server. Try again.',
          save: 'Could not save the profile. Try again.',
        },
      },
      classes: {
        common: {
          grade: 'Grade {{grade}}',
          gradeUnknown: 'Grade not provided',
          students: 'Students: {{count}}',
          retry: 'Try again',
          cancel: 'Cancel',
          close: 'Close',
        },
        teacher: {
          eyebrow: 'Learning space',
          title: 'My classes',
          description:
            'Create classes, invite students, and view the members of each class.',
          open: 'Open class',
          states: {
            loading: 'Loading classes…',
            error: 'Could not load classes.',
          },
          empty: {
            title: 'No classes yet',
            description:
              'Create your first class to receive an invitation code for students.',
          },
          create: {
            action: 'Create class',
            eyebrow: 'New class',
            title: 'Basic information',
            name: 'Class name',
            namePlaceholder: 'For example, 8-A',
            grade: 'Grade level',
            submit: 'Create and get code',
            creating: 'Creating…',
          },
          edit: {
            action: 'Edit',
            eyebrow: 'Class settings',
            title: 'Update class',
            save: 'Save',
            saving: 'Saving…',
            error: 'Could not update the class.',
          },
          detail: {
            back: 'Back to all classes',
            eyebrow: 'Teacher class',
            notFoundTitle: 'Class not found',
            notFound:
              'This class does not exist or does not belong to your account.',
          },
          members: {
            title: 'Class students',
            description: 'All students who joined using the code.',
            loading: 'Loading students…',
            error: 'Could not load the student list.',
            empty:
              'Nobody has joined yet. Create a code and share it with your students.',
          },
          invite: {
            title: 'Invitation code',
            description:
              'Share the code with students in this class. It is valid for seven days.',
            copy: 'Copy',
            copied: 'Copied',
            expires: 'Valid until {{date}}',
            hidden:
              'For security, the full code is not stored. Create a new code when you are ready to share it.',
            refresh: 'Create new code',
            refreshing: 'Creating…',
            error: 'Could not create a code. Try again.',
          },
        },
        student: {
          eyebrow: 'Learning space',
          title: 'My class',
          description:
            'Join with your teacher’s code to see your class and your classmates’ profiles.',
          current: 'Your current class',
          teacher: 'Teacher: {{name}}',
          states: {
            loading: 'Loading your class…',
            errorTitle: 'Could not open the class',
            error: 'Check your connection and try again.',
          },
          join: {
            title: 'Join a class',
            description:
              'Enter the eight-character code provided by your teacher.',
            label: 'Invitation code',
            action: 'Join class',
            joining: 'Joining…',
            invalid: 'The code is invalid or has expired.',
            alreadyJoined: 'You already belong to a class.',
          },
          classmates: {
            title: 'Classmates',
            description:
              'You can open a student’s public profile only when they are in your class.',
            loading: 'Loading classmates…',
            error: 'Could not load classmates.',
            empty: 'No other students have joined this class yet.',
            open: 'Open profile',
          },
          profile: {
            back: 'Back to class',
            loading: 'Loading profile…',
            notFoundTitle: 'Profile unavailable',
            notFound:
              'The student is not in your class or their profile is no longer available.',
            aboutEmpty: 'This student has not added an introduction yet.',
            visibility:
              'This profile is visible only to students in the same class.',
          },
        },
        validation: {
          nameRequired: 'Enter a class name.',
          nameMin: 'The name must contain at least 2 characters.',
          nameMax: 'The name cannot be longer than 80 characters.',
          codeRequired: 'Enter an invitation code.',
          codeInvalid: 'Check the code format.',
        },
        errors: {
          network: 'Could not connect to the server.',
          unexpected: 'Something went wrong. Try again.',
        },
      },
      studentWorkspace: {
        placeholderLabel: 'Section in development',
        pages: {
          overview: {
            title: 'Overview',
            description:
              'A concise overview of learning, upcoming assignments, and progress will appear here.',
          },
          classes: {
            title: 'My classes',
            description:
              'Information about the learning class and its members will appear here.',
          },
          tasks: {
            title: 'My assignments',
            description:
              'Available, active, and completed learning assignments will appear here.',
          },
          achievements: {
            title: 'Achievements',
            description:
              'Earned badges, level, and learning progress will appear here.',
          },
          leaderboard: {
            title: 'Leaderboard',
            description:
              'The class leaderboard will appear here after the progress system is available.',
          },
          profile: {
            title: 'Profile',
            description:
              'Personal profile information will be available to view and edit here.',
          },
        },
      },
      teacherWorkspace: {
        placeholderLabel: 'Section in development',
        pages: {
          overview: {
            title: 'Overview',
            description:
              'A concise overview of classes, materials, and learning activity will appear here.',
          },
          classes: {
            title: 'My classes',
            description:
              'Classes and their members will be created and managed here.',
          },
          lessons: {
            title: 'My lessons',
            description:
              'Learning materials will be created, edited, and published here.',
          },
          tasks: {
            title: 'Assignments',
            description:
              'Assignments will be prepared and student results reviewed here.',
          },
          analytics: {
            title: 'Analytics',
            description:
              'Progress and learning activity for owned classes will appear here.',
          },
          profile: {
            title: 'Profile',
            description:
              'Teacher profile information will be available to view and edit here.',
          },
        },
      },
      teacherProfile: {
        eyebrow: 'Personal details',
        title: 'Teacher profile',
        description:
          'Information you will use throughout your Obriy workspace.',
        unavailable: 'Profile information is temporarily unavailable.',
        identityLabel: 'Current profile',
        avatarHint: 'We will add photo uploads as a separate next step.',
        formLegend: 'Basic information',
        displayName: 'Full name',
        subjectArea: 'Subject or specialisation',
        subjectAreaPlaceholder: 'For example, Ukrainian history',
        bio: 'About you',
        bioPlaceholder:
          'Share a little about your experience or teaching approach.',
        email: 'Email address',
        emailHint:
          'Your email is tied to the account and cannot be changed here.',
        saved: 'Changes saved.',
        reset: 'Discard changes',
        save: 'Save changes',
        saving: 'Saving…',
        validation: {
          displayNameRequired: 'Enter your name.',
          displayNameMin: 'Your name must contain at least 2 characters.',
          displayNameMax: 'Your name cannot be longer than 80 characters.',
          subjectAreaMax:
            'The subject name cannot be longer than 80 characters.',
          bioMax: 'The description cannot be longer than 500 characters.',
        },
        errors: {
          network: 'Could not connect to the server. Try again.',
          save: 'Could not save the profile. Try again.',
        },
      },
      parentHub: {
        homeAriaLabel: 'Obriy parent space',
        header: {
          title: 'Parent space',
        },
        states: {
          loading: 'Loading your children…',
          errorTitle: 'Could not load the overview',
          errorDescription:
            'Check your connection and try loading the information again.',
        },
        actions: {
          retry: 'Try again',
          allChildren: 'Family overview',
          openProgress: 'Detailed progress',
          backToOverview: 'Back to child overview',
          backToHome: 'Back home',
        },
        empty: {
          eyebrow: 'First step',
          title: 'Connect a child',
          description:
            'The learning overview will appear here after you connect through a secure invitation.',
          action: 'Connect a child',
        },
        family: {
          eyebrow: 'Family overview',
          title: 'Your children’s learning',
          description:
            'Each child has a separate overview, with no comparisons or rankings between them.',
          listLabel: 'Connected children',
          quietNote:
            'This space only shows information that helps you support your child’s learning.',
          openChild: 'Open overview',
        },
        child: {
          gradeUnavailable: 'Grade not provided',
          grade: 'Grade {{grade}}',
          switcherLabel: 'View child',
          eyebrow: 'Learning overview',
        },
        attention: {
          title: 'Worth checking',
          unavailable:
            'Signals will appear when the child has learning assignments and results.',
        },
        weekly: {
          title: 'This week',
          description:
            'A short summary will appear after learning activity begins.',
          learningTime: 'Learning time',
          completed: 'Completed',
          progress: 'Progress',
        },
        common: {
          unavailable: 'No data yet',
        },
        learningNow: {
          title: 'Learning now',
          description: 'The child’s current topics and assignments.',
          empty: 'No active learning materials are available yet.',
        },
        activity: {
          title: 'Recent activity',
          description: 'Recently completed lessons and assignments.',
          empty: 'The learning activity history is empty for now.',
        },
        progress: {
          eyebrow: 'Detailed report',
          title: 'Progress: {{name}}',
          description:
            'The learning timeline, lesson completion, and result trends will appear here.',
          emptyTitle: 'Progress data is still being prepared',
          emptyDescription:
            'The first results will appear after learning assignments are completed.',
        },
        connect: {
          eyebrow: 'Secure connection',
          title: 'Connect a child',
          description:
            'A child will connect to your account through a personal invitation.',
          unavailable:
            'We will implement the invitation flow as a separate next step.',
        },
      },
      parentLinks: {
        student: {
          title: 'Parents and guardians',
          description:
            'Manage the adults who can access your family learning overview.',
          loading: 'Loading connected adults…',
          loadError: 'Could not load the list.',
          empty: 'No adult is connected to this profile yet.',
          linkedAt: 'Connected {{date}}',
          remove: 'Disconnect {{name}}',
          confirmRemove: 'Disconnect',
          cancelRemove: 'Cancel disconnection',
          invitationTitle: 'Invite an adult',
          invitationDescription:
            'Create a one-time link and share it with a parent or guardian.',
          linkLabel: 'Invitation link',
          copy: 'Copy',
          copied: 'Copied',
          revealWarning:
            'Save the link now: the full token will not be shown again after the page reloads.',
          activeUntil: 'The active invitation is valid until {{date}}.',
          createInvitation: 'Create invitation',
          replaceInvitation: 'Create a new link',
          revokeInvitation: 'Revoke invitation',
          limitReached:
            'Limit reached: no more than four adults can be connected to a profile.',
        },
        landing: {
          eyebrow: 'Secure family invitation',
          title: 'You were invited to Obriy',
          description:
            'Sign in or create a parent account to review the invitation and confirm the connection.',
          login: 'Sign in',
          register: 'Create parent profile',
          privacy:
            'The child’s details appear only after signing in as a parent and confirming separately.',
          invalidTitle: 'Invalid link',
          invalidDescription:
            'Check the address or ask the child to create a new invitation.',
          wrongRoleTitle: 'A parent profile is required',
          wrongRoleDescription:
            'This invitation cannot be accepted from a student, teacher, or administrator profile.',
          home: 'Back home',
          workspace: 'Open my workspace',
        },
        connect: {
          eyebrow: 'Confirm connection',
          noInvitationTitle: 'No active invitation',
          noInvitationDescription:
            'Open the personal link created by the child.',
          loadingTitle: 'Checking invitation',
          loadingDescription: 'This will only take a moment.',
          invalidTitle: 'Invalid invitation',
          invalidDescription:
            'The link was already used, revoked, or has expired.',
          confirmDescription:
            'Confirm that you want to connect this child to your family overview.',
          confirm: 'Connect child',
          connecting: 'Connecting…',
          alreadyLinked: 'This child is already connected to your profile.',
          openOverview: 'Open family overview',
          privacy:
            'After confirmation, you will see only the information permitted for this child.',
          limitReached:
            'The maximum number of adults is already connected to this child.',
        },
        parent: {
          unlink: 'Disconnect from child',
          confirmUnlink: 'Confirm disconnection',
          cancelUnlink: 'Cancel',
          unlinkError: 'Could not disconnect the profile. Try again.',
        },
        errors: {
          network: 'Could not connect to the server.',
          unexpected: 'Something went wrong. Try again.',
        },
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
        description: 'Keep exploring the events, people, and places that shaped our world.',
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

document.documentElement.lang = initialLanguage

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
})

export default i18n
