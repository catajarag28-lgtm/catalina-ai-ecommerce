import { writeFileSync } from 'node:fs'
import { skillsMarkdown } from '../worker/carolinaSkills.js'
writeFileSync(new URL('../docs/CAROLINA_SKILLS.md', import.meta.url), skillsMarkdown())
