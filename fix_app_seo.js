import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes("import { useSEO } from '@/lib/useSEO'")) {
    content = content.replace("import React", "import React\nimport { useSEO } from '@/lib/useSEO';\n");
    // Add SEO hook to specific pages that don't have their own internal useSEO logic yet
}

fs.writeFileSync('src/App.tsx', content, 'utf8');
