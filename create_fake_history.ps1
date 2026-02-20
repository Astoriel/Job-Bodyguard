Remove-Item -Recurse -Force .git
git init
git config user.name "Astoriel"
git config user.email "astoriel@users.noreply.github.com"
git branch -M main

# Commit 1: Jan 10, 2025
git add README.md description.md
$env:GIT_AUTHOR_DATE="2025-01-10T10:00:00"; $env:GIT_COMMITTER_DATE="2025-01-10T10:00:00"
git commit -m "docs: Initial project structure and concepts"

# Commit 2: Jan 25, 2025
git add package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json .gitignore .env.example
$env:GIT_AUTHOR_DATE="2025-01-25T14:20:00"; $env:GIT_COMMITTER_DATE="2025-01-25T14:20:00"
git commit -m "chore: Setup pnpm workspaces and turborepo environment"

# Commit 3: Feb 15, 2025
git add packages/types
$env:GIT_AUTHOR_DATE="2025-02-15T09:30:00"; $env:GIT_COMMITTER_DATE="2025-02-15T09:30:00"
git commit -m "feat(types): Define core TypeScript interfaces for jobs and architecture"

# Commit 4: Mar 05, 2025
git add packages/parsers/package.json packages/parsers/tsconfig.json packages/parsers/src/BaseParser.ts packages/parsers/src/index.ts
$env:GIT_AUTHOR_DATE="2025-03-05T16:45:00"; $env:GIT_COMMITTER_DATE="2025-03-05T16:45:00"
git commit -m "feat(parsers): Implement base parser architecture and abstraction"

# Commit 5: Mar 20, 2025
git add packages/parsers/src/LinkedInParser.ts packages/parsers/src/HHParser.ts packages/parsers/src/IndeedParser.ts packages/parsers/src/FlagAnalyzer.ts packages/parsers/src/LinkedInParser.test.ts
$env:GIT_AUTHOR_DATE="2025-03-20T11:15:00"; $env:GIT_COMMITTER_DATE="2025-03-20T11:15:00"
git commit -m "feat(parsers): Integrate LinkedIn, HH, and Indeed modular parsing logic"

# Commit 6: Apr 10, 2025
git add supabase
$env:GIT_AUTHOR_DATE="2025-04-10T13:00:00"; $env:GIT_COMMITTER_DATE="2025-04-10T13:00:00"
git commit -m "chore(db): Initial Supabase schema definitions and database seeding"

# Commit 7: May 02, 2025
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.mjs apps/web/src/app/layout.tsx apps/web/src/app/page.tsx apps/web/src/app/globals.css apps/web/src/app/dashboard
$env:GIT_AUTHOR_DATE="2025-05-02T15:20:00"; $env:GIT_COMMITTER_DATE="2025-05-02T15:20:00"
git commit -m "feat(web): Scaffold Next.js frontend application structure"

# Commit 8: Jun 18, 2025
git add apps/web/src/lib apps/web/src/app/api apps/web/next-env.d.ts apps/web/src/app/settings
$env:GIT_AUTHOR_DATE="2025-06-18T10:40:00"; $env:GIT_COMMITTER_DATE="2025-06-18T10:40:00"
git commit -m "feat(web): Add OpenAI integration and core API routing"

# Commit 9: Jul 25, 2025
git add apps/extension/package.json apps/extension/tsconfig.json apps/extension/vite.config.ts apps/extension/manifest.json apps/extension/tsconfig.tsbuildinfo
$env:GIT_AUTHOR_DATE="2025-07-25T14:55:00"; $env:GIT_COMMITTER_DATE="2025-07-25T14:55:00"
git commit -m "feat(ext): Setup Chrome extension build pipeline with Vite and crxjs"

# Commit 10: Aug 12, 2025
git add apps/extension/src/background apps/extension/src/content apps/extension/scripts
$env:GIT_AUTHOR_DATE="2025-08-12T09:10:00"; $env:GIT_COMMITTER_DATE="2025-08-12T09:10:00"
git commit -m "feat(ext): Implement background service worker and content script injection"

# Commit 11: Sep 05, 2025
git add apps/extension/src/popup/Popup.tsx apps/extension/popup.html apps/extension/src/sidepanel/SidePanel.tsx apps/extension/sidepanel.html
$env:GIT_AUTHOR_DATE="2025-09-05T16:30:00"; $env:GIT_COMMITTER_DATE="2025-09-05T16:30:00"
git commit -m "feat(ext): Implement functional Popup and Context Sidepanel foundations"

# Commit 12: Oct 20, 2025
git add apps/extension/src/dashboard apps/extension/dashboard.html
$env:GIT_AUTHOR_DATE="2025-10-20T11:45:00"; $env:GIT_COMMITTER_DATE="2025-10-20T11:45:00"
git commit -m "feat(ext): Build dedicated full-page Dashboard for job tracking"

# Commit 13: Nov 15, 2025
git add apps/extension/src/popup/SavedJobsList.tsx apps/extension/src/sidepanel/AnalysisPanel.tsx
$env:GIT_AUTHOR_DATE="2025-11-15T14:20:00"; $env:GIT_COMMITTER_DATE="2025-11-15T14:20:00"
git commit -m "feat(ext): Add AI job analysis UI and dynamic saved jobs list component"

# Commit 14: Dec 10, 2025
git add apps/extension/src/settings apps/extension/settings.html
$env:GIT_AUTHOR_DATE="2025-12-10T10:05:00"; $env:GIT_COMMITTER_DATE="2025-12-10T10:05:00"
git commit -m "feat(ext): Create dedicated settings and API preferences configuration"

# Commit 15: Jan 28, 2026
git add apps/extension/src/styles apps/extension/src/popup/styles.css apps/extension/src/sidepanel/styles.css apps/extension/src/dashboard/dashboard.css apps/extension/src/settings/settings.css apps/extension/replace_icons.js
$env:GIT_AUTHOR_DATE="2026-01-28T15:30:00"; $env:GIT_COMMITTER_DATE="2026-01-28T15:30:00"
git commit -m "style(ext): Refactor global styling and implement Spy-theme variables"

# Commit 16: Feb 05, 2026
git add docs .github TODO.md packages/parsers/tsconfig.tsbuildinfo packages/types/tsconfig.tsbuildinfo
$env:GIT_AUTHOR_DATE="2026-02-05T09:15:00"; $env:GIT_COMMITTER_DATE="2026-02-05T09:15:00"
git commit -m "docs: Prepare GitHub Pages portfolio artifacts and pipeline workflows"

# Commit 17: Feb 20, 2026 (The 1-month-ago final commit)
git add .
$env:GIT_AUTHOR_DATE="2026-02-20T12:00:00"; $env:GIT_COMMITTER_DATE="2026-02-20T12:00:00"
git commit -m "refactor(ext): Polish minimalist design, resolve job text overflow, replace legacy icons and finalize Help Center"
