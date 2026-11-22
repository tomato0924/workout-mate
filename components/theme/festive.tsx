'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import dayjs from 'dayjs';
import classes from './Snowfall.module.css';

const STORAGE_KEY = 'festive_snow_off';

/** 연말 테마 기간: 11월 20일 ~ 1월 31일 */
export function isFestiveSeason(now = dayjs()): boolean {
    const m = now.month();
    return m === 11 || m === 0 || (m === 10 && now.date() >= 20);
}

type FestiveState = { active: boolean; snowOn: boolean; setSnowOn: (on: boolean) => void };
const FestiveContext = createContext<FestiveState>({ active: false, snowOn: false, setSnowOn: () => {} });
export const useFestive = () => useContext(FestiveContext);

/** 연말 테마 상태 제공 + 눈 내리는 효과. 서버/브라우저 날짜 차이를 피하려고 마운트 후 판단 */
export function FestiveProvider({ children }: { children: ReactNode }) {
    const [active, setActive] = useState(false);
    const [snowOn, setSnowOnState] = useState(true);

    useEffect(() => {
        setActive(isFestiveSeason());
        try {
            if (localStorage.getItem(STORAGE_KEY) === '1') setSnowOnState(false);
        } catch { /* localStorage 사용 불가 */ }
    }, []);

    const setSnowOn = (on: boolean) => {
        setSnowOnState(on);
        try {
            if (on) localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, '1');
        } catch { /* 무시 */ }
    };

    return (
        <FestiveContext.Provider value={{ active, snowOn, setSnowOn }}>
            {children}
            {active && snowOn && <Snowfall />}
        </FestiveContext.Provider>
    );
}

function Snowfall() {
    // 화면이 좁으면 눈송이 수를 줄인다
    const flakes = useMemo(() => {
        const count = typeof window !== 'undefined' && window.innerWidth < 600 ? 22 : 40;
        return Array.from({ length: count }, (_, i) => {
            const size = 3 + Math.random() * 5;
            return {
                key: i,
                left: Math.random() * 100,
                size,
                opacity: 0.35 + Math.random() * 0.45,
                duration: 9 + Math.random() * 10,
                delay: -Math.random() * 18, // 처음부터 화면 곳곳에 흩어져 있도록
                drift: `${(Math.random() - 0.5) * 80}px`,
            };
        });
    }, []);

    return (
        <div className={classes.layer} aria-hidden>
            {flakes.map(f => (
                <span
                    key={f.key}
                    className={classes.flake}
                    style={{
                        left: `${f.left}%`,
                        width: f.size,
                        height: f.size,
                        opacity: f.opacity,
                        animationDuration: `${f.duration}s`,
                        animationDelay: `${f.delay}s`,
                        ['--drift' as string]: f.drift,
                    }}
                />
            ))}
        </div>
    );
}

/** 로고 옆 연말 장식 */
export function FestiveLogoBadge() {
    const { active } = useFestive();
    if (!active) return null;
    return (
        <span aria-hidden style={{ fontSize: 20, lineHeight: 1, marginLeft: 2 }} title="Happy Holidays">
            🎄
        </span>
    );
}

/** 헤더 아래 얇은 연말 색 띠 */
export function FestiveHeaderStrip() {
    const { active } = useFestive();
    if (!active) return null;
    return (
        <div
            aria-hidden
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -1,
                height: 3,
                background: 'repeating-linear-gradient(90deg, #c92a2a 0 24px, #ffffff 24px 32px, #2b8a3e 32px 56px, #ffffff 56px 64px)',
            }}
        />
    );
}
