import sys

with open('app/dashboard/competitions/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find return start
return_idx = -1
for i, line in enumerate(lines):
    if line.startswith('    return (') and lines[i+1].strip().startswith('<Container'):
        return_idx = i
        break

# find detail panel start
panel_start = -1
for i, line in enumerate(lines):
    if line.strip() == '{selectedCompetition && (' and lines[i+1].strip().startswith('<Paper shadow="sm"'):
        panel_start = i
        break

# find detail panel end
panel_end = -1
for i in range(panel_start, len(lines)):
    if line.strip() == '{/* Create / Edit Modal */}':
        pass
    if '            {/* Create / Edit Modal */}' in lines[i]:
        panel_end = i
        # backtrack to `            )}` 
        while not lines[panel_end-1].strip() == ')}':
            panel_end -= 1
        panel_end -= 1 # The line with `            )}`
        break

if return_idx == -1 or panel_start == -1 or panel_end == -1:
    print(return_idx, panel_start, panel_end)
    sys.exit(1)

# we will create a function const DetailPanelComponent = () => { ... }
# taking the block from panel_start+1 to panel_end-1
# Wait, panel_start is `{selectedCompetition && (`. The actual JSX is panel_start+1 to panel_end-1
jsx_lines = lines[panel_start+1:panel_end]

# Change the wrapping Paper
for i, l in enumerate(jsx_lines):
    if l.strip().startswith('<Paper shadow="sm" radius="md"'):
        jsx_lines[i] = '            <Paper shadow={viewMode === \\'calendar\\' ? "sm" : "none"} radius="md" p={viewMode === \\'calendar\\' ? "sm" : 0} mt={viewMode === \\'calendar\\' ? "sm" : 0} className={viewMode === \\'calendar\\' ? styles.detailPanel : \\'\\'} pos="relative">\\n'
        break

detail_component_lines = [
    '    const DetailPanelComponent = () => {\\n',
    '        if (!selectedCompetition) return null;\\n',
    '        return (\\n',
    '            <Box>\\n' # Wrap in fragment just in case
] + jsx_lines + [
    '            </Box>\\n',
    '        );\\n',
    '    };\\n\\n'
]

# Delete competition detail header
header_start = -1
header_end = -1
for i in range(return_idx, panel_start):
    if lines[i].strip() == '{/* Competition Detail Section */}':
        header_start = i
        for j in range(i, panel_start):
            if lines[j].strip() == ')}':
                header_end = j + 1
                break
        break

# Reassemble
new_lines = lines[:return_idx] + detail_component_lines + lines[return_idx:header_start] + [
    '            {viewMode === \\'calendar\\' && <DetailPanelComponent />}\\n'
] + lines[panel_end+1:]

with open('app/dashboard/competitions/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("SUCCESS")
