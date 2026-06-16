import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export async function loadFixtures() {
  const files = (await readdir(FIXTURES_DIR)).filter(f => f.endsWith('.json'));
  const fixtures = [];

  for (const file of files) {
    const raw = await readFile(join(FIXTURES_DIR, file), 'utf8');
    const data = JSON.parse(raw);
    fixtures.push({ ...data, _file: file });
  }

  return fixtures.sort((a, b) => a.id.localeCompare(b.id));
}

export async function loadFixture(id) {
  const fixtures = await loadFixtures();
  const fixture = fixtures.find(f => f.id === id);
  if (!fixture) {
    throw new Error(`Unknown fixture id "${id}". Available: ${fixtures.map(f => f.id).join(', ')}`);
  }
  return fixture;
}
