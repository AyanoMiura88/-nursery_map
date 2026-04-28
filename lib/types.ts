export type VacancyStatus = 'available' | 'few' | 'full';

export interface AgeClass {
  age: number;       // 0〜5歳
  capacity: number;  // 定員
  enrolled: number;  // 在籍数
}

export interface Nursery {
  id: number;
  name: string;
  address: string;
  tel: string;
  lat: number;
  lng: number;
  classes: AgeClass[];
}

export interface FilterState {
  searchQuery: string;
  ageFilter: number | null; // null = 全クラス
}