'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { isFestiveSeason } from '@/components/theme/festive';
import { getRecapYear } from '@/lib/recap/compute';
import classes from './RecapButton.module.css';

/** 운동 피드 우측 상단의 연말 결산 바로가기 (연말 테마 기간: 11/20 ~ 1/31) */
export function RecapButton() {
    // 서버(UTC)와 브라우저(KST)의 날짜가 다를 수 있어 마운트 후 판단
    const [year, setYear] = useState<number | null>(null);
    useEffect(() => {
        if (isFestiveSeason()) setYear(getRecapYear());
    }, []);

    if (year === null) return null;

    return (
        <Button
            component={Link}
            href="/dashboard/recap"
            radius="xl"
            size="sm"
            variant="gradient"
            gradient={{ from: '#6d28d9', to: '#db2777', deg: 120 }}
            leftSection={<IconSparkles size={18} />}
            className={classes.button}
        >
            &apos;{String(year).slice(2)}년 결산
        </Button>
    );
}
