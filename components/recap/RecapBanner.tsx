'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UnstyledButton } from '@mantine/core';
import { getRecapYear, isRecapSeason } from '@/lib/recap/compute';

/** 12월~1월에만 대시보드 상단에 노출되는 연말 결산 배너 */
export function RecapBanner() {
    // 서버(UTC)와 브라우저(KST)의 날짜가 다를 수 있어 마운트 후 판단
    const [year, setYear] = useState<number | null>(null);
    useEffect(() => {
        if (isRecapSeason()) setYear(getRecapYear());
    }, []);

    if (year === null) return null;

    return (
        <UnstyledButton
            component={Link}
            href="/dashboard/recap"
            style={{
                display: 'block',
                borderRadius: 16,
                padding: '16px 20px',
                color: 'white',
                background: 'linear-gradient(120deg, #1b2a6b 0%, #6d28d9 60%, #db2777 100%)',
                boxShadow: '0 8px 24px rgba(109,40,217,0.25)',
            }}
        >
            <div style={{ fontSize: 13, opacity: 0.85 }}>❄️ {year} 연말 결산이 도착했어요</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>나의 {year}년 운동 이야기 보러 가기 →</div>
        </UnstyledButton>
    );
}
