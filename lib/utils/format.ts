import dayjs from 'dayjs';
import { WorkoutType } from '@/types';

export const formatWorkoutDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (h > 0) {
        return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${m}:${pad(s)}`;
};

export const formatWorkoutDistance = (meters: number, type: WorkoutType): string => {
    if (type === 'swimming') {
        return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
};

/** 분(소수) → m'ss'' 표기. 초가 60으로 반올림되면 분으로 올린다 (예: 7.999분 → 8'00'') */
const formatPace = (paceDec: number): string => {
    const totalSec = Math.round(paceDec * 60);
    const pM = Math.floor(totalSec / 60);
    const pS = totalSec % 60;
    return `${pM}'${pS.toString().padStart(2, '0')}''`;
};

export const formatWorkoutMetric = (meters: number, seconds: number, type: WorkoutType): { value: string, label: string } => {
    if (seconds === 0 || meters === 0) return { value: '-', label: '-' };

    if (type === 'swimming') {
        // Pace per 100m
        // minutes per 100m = (seconds / 60) / (meters / 100)
        const paceDec = (seconds / 60) / (meters / 100);
        return {
            value: formatPace(paceDec),
            label: '100m 페이스'
        };
    } else if (type === 'running') {
        // Pace per km
        // minutes per km = (seconds / 60) / (meters / 1000)
        const paceDec = (seconds / 60) / (meters / 1000);
        return {
            value: formatPace(paceDec),
            label: '1km 페이스'
        };
    } else {
        // Speed km/h
        // km/h = (meters / 1000) / (seconds / 3600)
        const speed = (meters / 1000) / (seconds / 3600);
        return {
            value: `${speed.toFixed(1)} km/h`,
            label: '평균 속도'
        };
    }
};
