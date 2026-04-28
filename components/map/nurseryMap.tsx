'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { Nursery, FilterState } from '../../lib/types';
import {
  getNurseryStatus,
  STATUS_PIN_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_BG_COLORS,
  getClassStatus,
} from '../../lib/vacancyUtils';
import nurseryData from '../../data/nurseries.json';

// ────────────────────────────────────────────
// 型キャスト（JSONからの読み込み）
// ────────────────────────────────────────────
const nurseries = nurseryData as Nursery[];

// ────────────────────────────────────────────
// VacancyPill — 空き状況バッジ
// ────────────────────────────────────────────
function VacancyPill({ status }: { status: ReturnType<typeof getNurseryStatus> }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: STATUS_BG_COLORS[status],
        color: STATUS_COLORS[status],
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ────────────────────────────────────────────
// NurseryDetailPanel — 選択された保育園の詳細
// ────────────────────────────────────────────
function NurseryDetailPanel({
  nursery,
  onClose,
}: {
  nursery: Nursery;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-4 right-4 z-[1000] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
        aria-label="閉じる"
      >
        ✕
      </button>

      {/* ヘッダー */}
      <div className="mb-3">
        <h2 className="text-base font-semibold text-gray-900">{nursery.name}</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {nursery.address}　TEL: {nursery.tel}
        </p>
      </div>

      {/* 年齢クラス一覧 */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400">
            <th className="pb-1 text-left font-normal">クラス</th>
            <th className="pb-1 text-center font-normal">定員</th>
            <th className="pb-1 text-center font-normal">在籍</th>
            <th className="pb-1 text-center font-normal">空き</th>
            <th className="pb-1 text-left font-normal">状況</th>
          </tr>
        </thead>
        <tbody>
          {nursery.classes.map((cls) => {
            const status = getClassStatus(cls);
            const vacancy = cls.capacity - cls.enrolled;
            return (
              <tr key={cls.age} className="border-b border-gray-50">
                <td className="py-1.5 text-gray-700">{cls.age}歳クラス</td>
                <td className="py-1.5 text-center text-gray-700">{cls.capacity}</td>
                <td className="py-1.5 text-center text-gray-700">{cls.enrolled}</td>
                <td className="py-1.5 text-center font-medium text-gray-900">{vacancy}</td>
                <td className="py-1.5">
                  <VacancyPill status={status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────
// NurseryList — サイドバー一覧
// ────────────────────────────────────────────
function NurseryList({
  nurseries,
  activeId,
  ageFilter,
  onSelect,
}: {
  nurseries: Nursery[];
  activeId: number | null;
  ageFilter: number | null;
  onSelect: (id: number) => void;
}) {
  if (nurseries.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-gray-400">
        該当する保育園がありません
      </p>
    );
  }

  return (
    <ul>
      {nurseries.map((n) => {
        const status = getNurseryStatus(n, ageFilter);
        return (
          <li
            key={n.id}
            onClick={() => onSelect(n.id)}
            className={`cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 ${
              n.id === activeId ? 'bg-green-50' : ''
            }`}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <span className="text-[13px] font-medium text-gray-900">{n.name}</span>
              <VacancyPill status={status} />
            </div>
            <p className="text-[11px] text-gray-400">{n.address}</p>

            {/* 年齢別空きサマリー（ageFilter なしのとき） */}
            {ageFilter == null && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {n.classes.map((cls) => {
                  const s = getClassStatus(cls);
                  return (
                    <span
                      key={cls.age}
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: STATUS_BG_COLORS[s], color: STATUS_COLORS[s] }}
                    >
                      {cls.age}歳 {cls.capacity - cls.enrolled}
                    </span>
                  );
                })}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ────────────────────────────────────────────
// NurseryMap — メインコンポーネント
// ────────────────────────────────────────────
export default function NurseryMap() {
  const mapRef = useRef<LeafletMap | null>(null);
  const mapElRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState<FilterState>({
    searchQuery: '',
    ageFilter: null,
  });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  // ────────────────────────────────────────
  // Leaflet 地図の初期化（SSR回避のため useEffect 内でimport）
  // ────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;

    let L: typeof import('leaflet');

    const initMap = async () => {
      L = (await import('leaflet')).default;

      // Leafletのデフォルトアイコンをリセット（Next.jsでの既知の問題対策）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // 地図を初期化（渋谷駅周辺）
      const map = L.map(mapElRef.current!, {
        center: [35.658, 139.700],
        zoom: 14,
        zoomControl: true,
      });

      // OpenStreetMapのタイルを使用（無料・商用利用可）
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // ピンを描画
      renderPins(L, map);
    };

    initMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ────────────────────────────────────────
  // ピンの描画（フィルター変更時に再描画）
  // ────────────────────────────────────────
  const markersRef = useRef<import('leaflet').Marker[]>([]);
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null);

  const renderPins = async (
    L: typeof import('leaflet'),
    map: LeafletMap,
    ageFilter: number | null = null
  ) => {
    // 既存ピンを削除
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    nurseries.forEach((nursery) => {
      const status = getNurseryStatus(nursery, ageFilter);
      const color = STATUS_PIN_COLORS[status];

      // SVGカスタムアイコン
      const iconHtml = `
        <div style="
          width: 28px; height: 28px;
          background: ${color};
          border: 2.5px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        "></div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
      });

      const marker = L.marker([nursery.lat, nursery.lng], { icon });

      // ポップアップ（簡易表示）
      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 160px;">
          <strong style="font-size: 13px;">${nursery.name}</strong><br>
          <span style="font-size: 11px; color: #666;">${nursery.address}</span>
        </div>
      `);

      marker.on('click', () => {
        setActiveId(nursery.id);
      });

      marker.addTo(map);
      markersRef.current.push(marker);
    });
  };

  // ────────────────────────────────────────
  // フィルター変更時にピンを再描画
  // ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const updatePins = async () => {
      const L = (await import('leaflet')).default;
      renderPins(L, mapRef.current!, filter.ageFilter);
    };
    updatePins();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.ageFilter]);

  // ────────────────────────────────────────
  // 現在地取得（GPS）
  // ────────────────────────────────────────
  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert('このブラウザはGeolocationに対応していません');
      return;
    }
    setGpsState('loading');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        setGpsState('done');

        if (mapRef.current) {
          const L = (await import('leaflet')).default;

          // 既存の現在地マーカーを削除
          userMarkerRef.current?.remove();

          // 現在地マーカー（青い円）
          const userIcon = L.divIcon({
            html: `<div style="
              width: 14px; height: 14px;
              background: #185FA5;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 0 5px rgba(24,95,165,0.2);
            "></div>`,
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          userMarkerRef.current = L.marker([lat, lng], { icon: userIcon })
            .addTo(mapRef.current)
            .bindPopup('現在地');

          // 現在地へ移動
          mapRef.current.setView([lat, lng], 15, { animate: true });
        }
      },
      () => {
        setGpsState('error');
        alert('位置情報の取得に失敗しました。ブラウザの設定を確認してください。');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  // ────────────────────────────────────────
  // 保育園を選択したとき地図を移動
  // ────────────────────────────────────────
  const handleSelectNursery = async (id: number) => {
    setActiveId(id);
    const nursery = nurseries.find((n) => n.id === id);
    if (!nursery || !mapRef.current) return;
    mapRef.current.setView([nursery.lat, nursery.lng], 16, { animate: true });
  };

  // ────────────────────────────────────────
  // フィルタリング
  // ────────────────────────────────────────
  const filtered = nurseries.filter((n) => {
    const q = filter.searchQuery.toLowerCase();
    const matchQ = !q || n.name.includes(q) || n.address.includes(q);
    const matchAge =
      filter.ageFilter == null ||
      n.classes.some((c) => c.age === filter.ageFilter);
    return matchQ && matchAge;
  });

  const availableCount = filtered.filter(
    (n) => getNurseryStatus(n, filter.ageFilter) !== 'full'
  ).length;

  const activeNursery = nurseries.find((n) => n.id === activeId) ?? null;

  // ────────────────────────────────────────
  // GPS ボタンのラベル
  // ────────────────────────────────────────
  const gpsLabel = {
    idle: '現在地を取得',
    loading: '取得中...',
    done: '現在地取得済み',
    error: '取得失敗',
  }[gpsState];

  // ────────────────────────────────────────
  // レンダリング
  // ────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-white font-sans">
      {/* ──── ヘッダー ──── */}
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5">
        <h1 className="mr-2 text-base font-semibold text-gray-900">保育園マップ</h1>

        {/* 検索 */}
        <input
          type="text"
          placeholder="保育園名・住所で検索..."
          value={filter.searchQuery}
          onChange={(e) =>
            setFilter((prev) => ({ ...prev, searchQuery: e.target.value }))
          }
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[13px] text-gray-900 placeholder-gray-400 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
        />

        {/* 年齢フィルター */}
        <select
          value={filter.ageFilter ?? ''}
          onChange={(e) =>
            setFilter((prev) => ({
              ...prev,
              ageFilter: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
          className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-[13px] text-gray-700 focus:border-green-400 focus:outline-none"
        >
          <option value="">全クラス</option>
          {[0, 1, 2, 3, 4, 5].map((age) => (
            <option key={age} value={age}>
              {age}歳クラス
            </option>
          ))}
        </select>

        {/* GPS ボタン */}
        <button
          onClick={handleLocate}
          disabled={gpsState === 'loading'}
          className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-60 ${
            gpsState === 'done'
              ? 'border-green-400 bg-green-50 text-green-700'
              : gpsState === 'error'
              ? 'border-red-300 bg-red-50 text-red-600'
              : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
        >
          {gpsLabel}
        </button>
      </header>

      {/* ──── メインエリア ──── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 地図 */}
        <div className="relative flex-1">
          {/* Leaflet CSS（動的読み込み） */}
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />

          <div ref={mapElRef} className="h-full w-full" />

          {/* 凡例 */}
          <div className="absolute right-3 top-3 z-[1000] rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] shadow-sm">
            {(['available', 'few', 'full'] as const).map((s) => (
              <div key={s} className="mb-1 flex items-center gap-1.5 last:mb-0">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: STATUS_PIN_COLORS[s] }}
                />
                <span className="text-gray-500">{STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>

          {/* 詳細パネル */}
          {activeNursery && (
            <NurseryDetailPanel
              nursery={activeNursery}
              onClose={() => setActiveId(null)}
            />
          )}
        </div>

        {/* サイドバー */}
        <aside className="flex w-72 flex-col border-l border-gray-200 bg-white">
          {/* サイドバーヘッダー */}
          <div className="border-b border-gray-100 px-4 py-2.5 text-[12px] text-gray-400">
            表示:{' '}
            <span className="font-medium text-gray-700">{filtered.length}</span>件　空きあり:{' '}
            <span className="font-medium text-green-700">{availableCount}</span>件
          </div>

          {/* リスト */}
          <div className="flex-1 overflow-y-auto">
            <NurseryList
              nurseries={filtered}
              activeId={activeId}
              ageFilter={filter.ageFilter}
              onSelect={handleSelectNursery}
            />
          </div>

          {/* フッター */}
          <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-300">
            データ更新: 2025年4月28日 9:00
            {userLocation && (
              <span className="ml-2 text-blue-400">
                GPS取得済み
              </span>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}