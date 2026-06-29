import Database from 'better-sqlite3';
import { XMLParser } from 'fast-xml-parser';
import { assertValidFeedUrl } from '../rss/url';
import { createFeed } from './dao/feedsDao';
import { assignFeedToSection, createSection, listFeedsForSection, listSections, type Section } from './dao/sectionsDao';

type ImportedFeed = { url: string; title?: string; sectionName?: string };

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function collectOutlines(node: unknown, inheritedSection?: string, result: ImportedFeed[] = []) {
  if (!node || typeof node !== 'object') return result;
  const outline = node as Record<string, unknown>;
  const sectionName = typeof outline.text === 'string' ? outline.text : typeof outline.title === 'string' ? outline.title : inheritedSection;
  if (typeof outline.xmlUrl === 'string') {
    result.push({
      url: outline.xmlUrl,
      title: typeof outline.title === 'string' ? outline.title : typeof outline.text === 'string' ? outline.text : undefined,
      sectionName: inheritedSection,
    });
  }
  for (const child of asArray(outline.outline)) collectOutlines(child, sectionName, result);
  return result;
}

export function exportOpml(db: Database.Database) {
  const sections = listSections(db);
  const body = sections.map((section) => {
    const feeds = listFeedsForSection(db, section.id) as Array<{ url: string; title?: string | null; site_url?: string | null }>;
    const children = feeds.map((feed) =>
      '      <outline type="rss" text="' + xmlEscape(feed.title || feed.url) + '" title="' + xmlEscape(feed.title || feed.url) +
      '" xmlUrl="' + xmlEscape(feed.url) + '"' + (feed.site_url ? ' htmlUrl="' + xmlEscape(feed.site_url) + '"' : '') + ' />'
    ).join('\n');
    return '    <outline text="' + xmlEscape(section.name) + '" title="' + xmlEscape(section.name) + '">\n' + children + '\n    </outline>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>READIT subscriptions</title></head>\n  <body>\n' + body + '\n  </body>\n</opml>\n';
}

export function parseOpml(opml: string) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', processEntities: false });
  const parsed = parser.parse(opml) as Record<string, any>;
  const roots = asArray(parsed?.opml?.body?.outline);
  if (roots.length === 0) throw new Error('OPML contains no outlines');
  const feeds: ImportedFeed[] = [];
  for (const root of roots) collectOutlines(root, undefined, feeds);
  return feeds;
}

export function importOpml(db: Database.Database, opml: string, targetSectionId?: number) {
  const candidates = parseOpml(opml);
  const existingSections = listSections(db);
  if (targetSectionId && !existingSections.some((section) => section.id === targetSectionId)) {
    throw new Error('Target section does not exist');
  }

  return db.transaction(() => {
    let imported = 0;
    let skipped = 0;
    const sectionsByName = new Map<string, Section>(listSections(db).map((section) => [section.name.toLowerCase(), section]));
    for (const candidate of candidates) {
      let url: string;
      try {
        url = assertValidFeedUrl(candidate.url);
      } catch {
        skipped += 1;
        continue;
      }
      let sectionId = targetSectionId;
      if (!sectionId) {
        const name = candidate.sectionName?.trim() || 'Imported';
        let section = sectionsByName.get(name.toLowerCase());
        if (!section) {
          section = createSection(db, name);
          sectionsByName.set(name.toLowerCase(), section);
        }
        sectionId = section.id;
      }
      const feed = createFeed(db, url);
      const before = db.prepare('SELECT 1 FROM feed_sections WHERE feed_id=? AND section_id=?').get(feed.id, sectionId);
      assignFeedToSection(db, feed.id, sectionId);
      if (before) skipped += 1;
      else imported += 1;
    }
    return { imported, skipped };
  })();
}