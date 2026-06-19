import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const originalsDir = path.join(root, 'src', 'data', 'madlib-originals');
export const bundlePath = path.join(root, 'src', 'data', 'madlibs-templates.json');

function titleFromFile(file) {
  return path.basename(file, '.json').replace(/-/g, ' ');
}

export function listTemplateFolders() {
  if (!fs.existsSync(originalsDir)) return [];
  return fs.readdirSync(originalsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort((a, b) => a.localeCompare(b));
}

export function readOriginalTemplates() {
  const files = [];
  const seen = new Map();

  for (const folder of listTemplateFolders()) {
    const dir = path.join(originalsDir, folder);
    for (const file of fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
      const filePath = path.join(dir, file);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        throw new Error(`${path.relative(root, filePath)}: invalid JSON: ${err.message}`);
      }

      const title = data.title || titleFromFile(file);
      if (seen.has(title)) {
        throw new Error(`Duplicate template title "${title}" in ${path.relative(root, filePath)} and ${seen.get(title)}`);
      }
      seen.set(title, path.relative(root, filePath));
      files.push({
        folder,
        file,
        filePath,
        relativePath: path.relative(root, filePath),
        title,
        data
      });
    }
  }

  return files;
}

export function readBundledTemplates() {
  return JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
}

export function countBlanks(text) {
  return (String(text).match(/\{[^}]+\}/g) || []).length;
}

export function countWords(text) {
  return (String(text).match(/\b[\w''-]+\b/g) || []).length;
}

export function countsByFolder(files = readOriginalTemplates()) {
  return files.reduce((counts, file) => {
    counts[file.folder] = (counts[file.folder] || 0) + 1;
    return counts;
  }, {});
}
