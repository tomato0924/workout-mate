import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();

        // Check if requester is admin
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const fileName = file.name.toLowerCase();
        let rows: Record<string, string>[] = [];

        const buffer = Buffer.from(await file.arrayBuffer());

        if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
        } else {
            return NextResponse.json({ error: 'Unsupported file format. Use .csv or .xlsx' }, { status: 400 });
        }

        if (rows.length === 0) {
            return NextResponse.json({ error: 'File is empty' }, { status: 400 });
        }

        const validTypes = ['marathon', 'triathlon', 'granfondo', 'trail_run', 'other'];
        const results = { success: 0, errors: [] as { row: number; reason: string }[] };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // 1-indexed + header row

            // Map column names (support both Korean and English)
            const competitionType = (row['competition_type'] || row['대회유형'] || '').toLowerCase().trim();
            const name = (row['name'] || row['대회명'] || '').trim();
            const abbreviation = (row['abbreviation'] || row['약어'] || '').trim() || null;
            const startDate = (row['start_date'] || row['시작일'] || '').trim();
            const endDate = (row['end_date'] || row['종료일'] || '').trim() || startDate;
            const startTime = (row['start_time'] || row['출발시간'] || '').trim() || null;
            const location = (row['location'] || row['장소'] || '').trim();
            const homepageUrl = (row['homepage_url'] || row['홈페이지'] || '').trim() || null;
            const memo = (row['memo'] || row['메모'] || '').trim() || null;

            // Validation
            if (!competitionType || !validTypes.includes(competitionType)) {
                results.errors.push({ row: rowNum, reason: `Invalid competition_type: "${competitionType}"` });
                continue;
            }
            if (!name) {
                results.errors.push({ row: rowNum, reason: 'name is required' });
                continue;
            }
            if (!startDate) {
                results.errors.push({ row: rowNum, reason: 'start_date is required' });
                continue;
            }
            if (!location) {
                results.errors.push({ row: rowNum, reason: 'location is required' });
                continue;
            }

            // Date validation
            const parsedStart = new Date(startDate);
            const parsedEnd = new Date(endDate);
            if (isNaN(parsedStart.getTime())) {
                results.errors.push({ row: rowNum, reason: `Invalid start_date: "${startDate}"` });
                continue;
            }
            if (isNaN(parsedEnd.getTime())) {
                results.errors.push({ row: rowNum, reason: `Invalid end_date: "${endDate}"` });
                continue;
            }

            const { error } = await supabase
                .from('competitions')
                .insert({
                    competition_type: competitionType,
                    name,
                    abbreviation,
                    start_date: startDate,
                    end_date: endDate,
                    start_time: startTime,
                    location,
                    homepage_url: homepageUrl,
                    memo,
                    registered_by: user.id,
                });

            if (error) {
                results.errors.push({ row: rowNum, reason: error.message });
            } else {
                results.success++;
            }
        }

        return NextResponse.json({
            message: `${results.success}건 등록 완료${results.errors.length > 0 ? `, ${results.errors.length}건 오류` : ''}`,
            ...results,
        });
    } catch (error) {
        console.error('Bulk import error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
