const fs = require('fs');
const path = require('path');

const files = [
    'c:/Users/Orb/Desktop/Проекти гитхаб/Job-Bodyguard/apps/extension/src/sidepanel/SidePanel.tsx',
    'c:/Users/Orb/Desktop/Проекти гитхаб/Job-Bodyguard/apps/extension/src/sidepanel/AnalysisPanel.tsx',
    'c:/Users/Orb/Desktop/Проекти гитхаб/Job-Bodyguard/apps/extension/src/settings/Settings.tsx',
    'c:/Users/Orb/Desktop/Проекти гитхаб/Job-Bodyguard/apps/extension/src/dashboard/Dashboard.tsx',
    'c:/Users/Orb/Desktop/Проекти гитхаб/Job-Bodyguard/apps/extension/src/content/FloatingBanner.tsx',
    'c:/Users/Orb/Desktop/Проекти гитхаб/Job-Bodyguard/apps/extension/src/popup/Popup.tsx'
];

files.forEach(f => {
    if(!fs.existsSync(f)) return;
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/CheckCircle2/g, 'CheckCircle');
    content = content.replace(/ShieldCheck/g, 'Briefcase');
    fs.writeFileSync(f, content);
});
console.log('Replaced icons successfully.');
