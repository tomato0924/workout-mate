const fs = require('fs');

const path = 'app/dashboard/competitions/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Normalize newlines to \n
content = content.replace(/\\r\\n/g, '\\n');

const panelIdx = content.indexOf('className={styles.detailPanel}');
const detailPanelStart = content.lastIndexOf('{selectedCompetition && (', panelIdx);

if (detailPanelStart === -1) {
    console.error("Could not find detailPanelStart");
    process.exit(1);
}

const detailPanelEndStr = '            {/* Create / Edit Modal */}';
const detailPanelEnd = content.indexOf(detailPanelEndStr, detailPanelStart);

if (detailPanelEnd === -1) {
    console.error("Could not find detailPanelEnd");
    process.exit(1);
}

const blockEnd = content.lastIndexOf('\\n', detailPanelEnd);

const detailPanelBlockStr = content.substring(detailPanelStart, blockEnd);

let modifiedDetailPanelBlock = detailPanelBlockStr
    .replace('<Paper shadow="sm" radius="md" p="sm" mt="sm" className={styles.detailPanel} pos="relative">',
        `<Paper shadow={viewMode === 'calendar' ? "sm" : "none"} radius="md" p={viewMode === 'calendar' ? "sm" : 0} mt={viewMode === 'calendar' ? "sm" : 0} className={viewMode === 'calendar' ? styles.detailPanel : ''} pos="relative">`);

modifiedDetailPanelBlock = modifiedDetailPanelBlock.trim();

if (modifiedDetailPanelBlock.startsWith('{selectedCompetition && (')) {
    modifiedDetailPanelBlock = modifiedDetailPanelBlock.substring('{selectedCompetition && ('.length).trim();
}
if (modifiedDetailPanelBlock.endsWith(')}')) {
    modifiedDetailPanelBlock = modifiedDetailPanelBlock.substring(0, modifiedDetailPanelBlock.length - 2).trim();
}

const returnStart = content.indexOf('    return (\\n        <Container');
if (returnStart === -1) {
    console.error("Could not find return start");
    process.exit(1);
}

let newContent = content.substring(0, returnStart) + 
    '    const detailPanelContent = selectedCompetition && (\\n        ' + modifiedDetailPanelBlock + '\\n    );\\n\\n' +
    content.substring(returnStart, detailPanelStart) +
    `            {viewMode === 'calendar' && detailPanelContent}\\n` +
    content.substring(blockEnd);

fs.writeFileSync(path, newContent);
console.log("Extraction successful");
