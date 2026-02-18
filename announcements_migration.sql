-- 공지사항 테이블 생성
CREATE TABLE IF NOT EXISTS announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_popup BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 설정
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 활성 공지사항을 읽을 수 있음
CREATE POLICY "Authenticated users can read active announcements"
    ON announcements FOR SELECT
    TO authenticated
    USING (is_active = true);

-- 관리자만 공지사항 생성/수정/삭제 가능
CREATE POLICY "Admins can insert announcements"
    ON announcements FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admins can update announcements"
    ON announcements FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Admins can delete announcements"
    ON announcements FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- 읽음 기록 테이블 (유저가 어떤 공지를 닫았는지 추적)
CREATE TABLE IF NOT EXISTS announcement_reads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own announcement reads"
    ON announcement_reads FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own announcement reads"
    ON announcement_reads FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
