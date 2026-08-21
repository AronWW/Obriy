import {
  CircleDot,
  Grid2X2Check,
  Image,
  ListChecks,
  ListOrdered,
  Map,
  MapPinned,
  MousePointer2,
  PenLine,
  Rows3,
  SplitSquareVertical,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AssignmentType } from '../model/assignment.types'
import { AssignmentDialog } from './AssignmentDialog'
import styles from '../Assignments.module.css'

interface TypeOption {
  icon: LucideIcon
  type: AssignmentType
}

const typeOptions: TypeOption[] = [
  { type: 'WRITTEN', icon: PenLine },
  { type: 'SINGLE_CHOICE', icon: CircleDot },
  { type: 'MULTIPLE_CHOICE', icon: ListChecks },
  { type: 'MATCHING', icon: SplitSquareVertical },
  { type: 'ORDERING', icon: ListOrdered },
  { type: 'CATEGORIZATION', icon: Grid2X2Check },
  { type: 'FILL_BLANKS', icon: Rows3 },
  { type: 'IMAGE_HOTSPOT', icon: Image },
  { type: 'MAP_POINT', icon: MousePointer2 },
  { type: 'MAP_REGION', icon: MapPinned },
  { type: 'MAP_MULTI_REGION', icon: Map },
]

export function AssignmentTypeDialog({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (type: AssignmentType) => void
}) {
  const { t } = useTranslation()

  return (
    <AssignmentDialog
      closeLabel={t('assignments.common.close')}
      description={t('assignments.typePicker.description')}
      onClose={onClose}
      title={t('assignments.typePicker.title')}
      wide
    >
      <div className={styles.typeGrid}>
        {typeOptions.map(({ icon: Icon, type }) => {
          const isAvailable =
            type === 'WRITTEN' ||
            type === 'SINGLE_CHOICE' ||
            type === 'MULTIPLE_CHOICE' ||
            type === 'MATCHING' ||
            type === 'ORDERING'

          return (
            <button
              className={styles.typeCard}
              disabled={!isAvailable}
              key={type}
              onClick={() => onSelect(type)}
              type="button"
            >
              <span className={styles.typeCardIcon} aria-hidden="true">
                <Icon size={24} />
              </span>
              <span className={styles.typeCardCopy}>
                <strong>{t(`assignments.types.${type}.title`)}</strong>
                <span>{t(`assignments.types.${type}.description`)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </AssignmentDialog>
  )
}
