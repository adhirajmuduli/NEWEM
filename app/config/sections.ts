export type SectionConfig = {
  key: string;
  name: string;
  position: number;
  feeds: string[];
  fetchIntervalMinutes?: number; // optional per-feed default
  enabled?: boolean; // default true
};

export const SECTION_CONFIG: SectionConfig[] = [
  {
    key: 'tech',
    name: 'Tech',
    position: 0,
    feeds: ['https://hnrss.org/frontpage'],
    fetchIntervalMinutes: 30,
    enabled: true,
  },
  {
    key: 'world',
    name: 'World',
    position: 1,
    feeds: ['http://feeds.bbci.co.uk/news/world/rss.xml'],
    fetchIntervalMinutes: 30,
    enabled: true,
  },
  {
    key: 'sports',
    name: 'Sports',
    position: 2,
    feeds: ['https://www.espn.com/espn/rss/news', 'https://timesofindia.indiatimes.com/rssfeeds/54829575.cms'],
    fetchIntervalMinutes: 30,
    enabled: true,
  },
  {
    key: 'bhubaneswar',
    name: 'Bhubaneswar',
    position: 3,
    feeds: ['https://timesofindia.indiatimes.com/rssfeeds/4118235.cms' ],
    fetchIntervalMinutes: 30,
    enabled: true,
  },
];