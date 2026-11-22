'use client';

import { useState, type RefObject } from 'react';
import { Button, type ButtonProps } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconShare } from '@tabler/icons-react';
import { toBlob } from 'html-to-image';

/** DOM 노드를 PNG로 만들어 공유(모바일) 또는 다운로드(데스크톱) */
export async function shareNodeAsImage(node: HTMLElement, fileName: string, title: string) {
    const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true });
    if (!blob) throw new Error('이미지 생성 실패');
    const file = new File([blob], `${fileName}.png`, { type: 'image/png' });

    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title });
            return;
        } catch (e: any) {
            if (e?.name === 'AbortError') return; // 사용자가 공유 창을 닫음
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
}

export function ShareImageButton({
    targetRef,
    fileName,
    title,
    label = '이미지로 저장·공유',
    ...props
}: { targetRef: RefObject<HTMLElement>; fileName: string; title: string; label?: string } & ButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        if (!targetRef.current) return;
        setLoading(true);
        try {
            await shareNodeAsImage(targetRef.current, fileName, title);
        } catch (e) {
            console.error(e);
            notifications.show({ color: 'red', message: '이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button leftSection={<IconShare size={16} />} loading={loading} onClick={handleClick} {...props}>
            {label}
        </Button>
    );
}

/** html-to-image 캡처 시 외부 이미지가 CORS로 막히지 않도록 crossOrigin을 지정한 아바타 */
export function RecapAvatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
    const style: React.CSSProperties = {
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        border: '2px solid rgba(255,255,255,0.7)',
    };
    if (src) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt={name} crossOrigin="anonymous" style={style} />;
    }
    return (
        <div
            style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.25)',
                color: 'white',
                fontWeight: 700,
                fontSize: size * 0.42,
            }}
        >
            {name.charAt(0).toUpperCase()}
        </div>
    );
}
