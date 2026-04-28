'use client';

import dynamic from 'next/dynamic';

// Leafletはサーバーサイドで動かないため dynamic import + ssr: false が必須
const NurseryMap = dynamic(
  () => import('@/components/map/nurseryMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent mx-auto" />
          <p className="text-sm text-gray-400">地図を読み込み中...</p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return <NurseryMap />;
}
