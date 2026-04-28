import type { AgeClass, Nursery, VacancyStatus } from './types';

/**
 * 1クラスの空き状況を返す
 */
export function getClassStatus(cls: AgeClass): VacancyStatus {
  const vacancy = cls.capacity - cls.enrolled;
  if (vacancy <= 0) return 'full';
  if (vacancy === 1) return 'few';
  return 'available';
}

/**
 * 保育園全体（または指定年齢）の空き状況を返す
 */
export function getNurseryStatus(
  nursery: Nursery,
  ageFilter?: number | null
): VacancyStatus {
  const targets =
    ageFilter != null
      ? nursery.classes.filter((c) => c.age === ageFilter)
      : nursery.classes;

  if (targets.length === 0) return 'full';
  if (targets.every((c) => getClassStatus(c) === 'full')) return 'full';
  if (targets.some((c) => getClassStatus(c) === 'available')) return 'available';
  return 'few';
}

/**
 * ステータスに対応するCSSカラー（Tailwind safe-list対策で文字列で返す）
 */
export const STATUS_COLORS: Record<VacancyStatus, string> = {
  available: '#3B6D11',
  few: '#854F0B',
  full: '#A32D2D',
};

export const STATUS_BG_COLORS: Record<VacancyStatus, string> = {
  available: '#EAF3DE',
  few: '#FAEEDA',
  full: '#FCEBEB',
};

export const STATUS_LABELS: Record<VacancyStatus, string> = {
  available: '空きあり',
  few: '残り僅か',
  full: '満員',
};

export const STATUS_PIN_COLORS: Record<VacancyStatus, string> = {
  available: '#639922',
  few: '#BA7517',
  full: '#E24B4A',
};