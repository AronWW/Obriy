import {
  ArrowRight,
  Check,
  GraduationCap,
  HeartHandshake,
  Presentation,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { RegistrableRole } from '../../features/auth/model/auth.types'
import styles from './HomePage.module.css'

interface RoleOption {
  icon: LucideIcon
  id: 'student' | 'teacher' | 'parent'
  position: 'roleStudent' | 'roleTeacher' | 'roleParent'
  role: RegistrableRole
  rotation: number
}

const roles: RoleOption[] = [
  {
    icon: GraduationCap,
    id: 'student',
    position: 'roleStudent',
    role: 'STUDENT',
    rotation: -90,
  },
  {
    icon: Presentation,
    id: 'teacher',
    position: 'roleTeacher',
    role: 'TEACHER',
    rotation: 0,
  },
  {
    icon: HeartHandshake,
    id: 'parent',
    position: 'roleParent',
    role: 'PARENT',
    rotation: 90,
  },
]

export function RoleAstrolabe() {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [activeRole, setActiveRole] = useState<RegistrableRole>('STUDENT')
  const selectedRole = roles.find((role) => role.role === activeRole) ?? roles[0]
  const SelectedIcon = selectedRole.icon

  return (
    <section id="roles" className={styles.rolesSection} aria-labelledby="roles-title">
      <div className={styles.rolesHeader}>
        <p className={styles.sectionKicker}>{t('home.roles.eyebrow')}</p>
        <h2 id="roles-title">{t('home.roles.title')}</h2>
        <p>{t('home.roles.description')}</p>
      </div>

      <div className={styles.rolesLayout}>
        <div className={styles.roleDial} aria-label={t('home.roles.selectorLabel')}>
          <div className={styles.dialOuter} aria-hidden="true" />
          <div className={styles.dialMiddle} aria-hidden="true" />
          <div className={styles.dialInner} aria-hidden="true" />
          <div className={styles.dialCross} aria-hidden="true" />
          <motion.div
            className={styles.dialNeedle}
            animate={{ rotate: selectedRole.rotation }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 22, stiffness: 150 }
            }
            aria-hidden="true"
          />
          <span className={styles.dialCore} aria-hidden="true">
            <Sparkles size={22} />
          </span>

          {roles.map(({ icon: Icon, id, position, role }) => {
            const isActive = role === activeRole

            return (
              <button
                className={`${styles.roleButton} ${styles[position]} ${
                  isActive ? styles.roleButtonActive : ''
                }`}
                type="button"
                key={role}
                data-role-option={id}
                aria-pressed={isActive}
                aria-controls="role-details"
                onClick={() => setActiveRole(role)}
              >
                <Icon size={20} />
                <span>{t(`home.roles.${id}.label`)}</span>
              </button>
            )
          })}
        </div>

        <div
          id="role-details"
          className={styles.roleDetails}
          data-active-role={selectedRole.id}
          aria-live="polite"
        >
          <AnimatePresence initial={false} mode="sync">
            <motion.div
              className={styles.roleDetailContent}
              key={selectedRole.role}
              data-role-content={selectedRole.id}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{
                duration: reduceMotion ? 0 : 0.42,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span className={styles.roleDetailIcon} aria-hidden="true">
                <SelectedIcon size={25} />
              </span>
              <p className={styles.roleCounter}>
                {t('home.roles.path', {
                  current: roles.indexOf(selectedRole) + 1,
                  total: roles.length,
                })}
              </p>
              <h3>{t(`home.roles.${selectedRole.id}.title`)}</h3>
              <p className={styles.roleDescription}>
                {t(`home.roles.${selectedRole.id}.description`)}
              </p>
              <ul>
                {[1, 2, 3].map((benefit) => (
                  <li key={benefit}>
                    <Check size={17} />
                    <span>{t(`home.roles.${selectedRole.id}.benefit${benefit}`)}</span>
                  </li>
                ))}
              </ul>
              <Link
                className={styles.roleAction}
                to={`/auth/register/${selectedRole.id}`}
              >
                {t(`home.roles.${selectedRole.id}.action`)}
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.rolesClosure} aria-hidden="true">
        <span className={styles.rolesClosureLine} />
        <span className={styles.rolesClosureSeal}>
          <Sparkles size={15} />
        </span>
      </div>
    </section>
  )
}
