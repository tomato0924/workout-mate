'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { IconSparkles, IconTrophy } from '@tabler/icons-react';
import { isFestiveSeason } from '@/components/theme/festive';
import { getRecapYear } from '@/lib/recap/compute';
import classes from './RecapButton.module.css';

/**
 * 연말 결산 바로가기 버튼 (연말 테마 기간: 11/20 ~ 1/31)
 * - 기본: 나의 결산 (운동 피드 우측 상단)
 * - groupId 지정 시: 해당 크루의 연말 시상식 (크루 화면 명칭 옆)
 */
export function RecapButton({ groupId }: { groupId?: string }) {
    // 서버(UTC)와 브라우저(KST)의 날짜가 다를 수 있어 마운트 후 판단
    const [year, setYear] = useState<number | null>(null);
    useEffect(() => {
        if (isFestiveSeason()) setYear(getRecapYear());
    }, []);

    if (year === null) return null;

    const isCrew = !!groupId;

    return (
        <Button
            component={Link}
            href={isCrew ? `/dashboard/groups/${groupId}/awards` : '/dashboard/recap'}
            radius="xl"
            size="sm"
            variant="gradient"
            gradient={isCrew ? { from: '#4338ca', to: '#d97706', deg: 120 } : { from: '#6d28d9', to: '#db2777', deg: 120 }}
            leftSection={isCrew ? <IconTrophy size={18} /> : <IconSparkles size={18} />}
            className={classes.button}
        >
            &apos;{String(year).slice(2)}년 {isCrew ? '크루 결산' : '결산'}
        </Button>
    );
}
