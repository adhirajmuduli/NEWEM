export const CATALOG_VERSION = 1;

export type FeedConfig = {
  title: string;
  url: string;
};

export type SectionConfig = {
  key: string;
  name: string;
  position: number;
  legacyKeys: string[];
  legacyNames: string[];
  feeds: FeedConfig[];
  fetchIntervalMinutes: number;
  enabled: boolean;
};

export const SECTION_CONFIG: SectionConfig[] =[
    {
        "key":  "world",
        "name":  "World",
        "position":  0,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "BBC News - World",
                          "url":  "https://feeds.bbci.co.uk/news/world/rss.xml"
                      },
                      {
                          "title":  "BBC News - Asia",
                          "url":  "https://feeds.bbci.co.uk/news/world/asia/rss.xml"
                      },
                      {
                          "title":  "Reuters - World News",
                          "url":  "https://feeds.reuters.com/Reuters/worldNews"
                      },
                      {
                          "title":  "Hindustan Times - World News",
                          "url":  "https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml"
                      },
                      {
                          "title":  "NDTV - World",
                          "url":  "https://feeds.feedburner.com/ndtvnews-world-news"
                      },
                      {
                          "title":  "India Today - World",
                          "url":  "https://www.indiatoday.in/rss/1206577"
                      },
                      {
                          "title":  "Times of India - World News",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms"
                      },
                      {
                          "title":  "News18 - World",
                          "url":  "https://www.news18.com/rss/world.xml"
                      },
                      {
                          "title":  "Fox News - World",
                          "url":  "https://moxie.foxnews.com/google-publisher/world.xml"
                      },
                      {
                          "title":  "The Hindu - International",
                          "url":  "https://www.thehindu.com/news/international/feeder/default.rss"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "india",
        "name":  "India",
        "position":  1,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "BBC News - India",
                          "url":  "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml"
                      },
                      {
                          "title":  "Hindustan Times - India News",
                          "url":  "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"
                      },
                      {
                          "title":  "NDTV - India",
                          "url":  "https://feeds.feedburner.com/ndtvnews-india-news"
                      },
                      {
                          "title":  "India Today - India",
                          "url":  "https://www.indiatoday.in/rss/1206578"
                      },
                      {
                          "title":  "India Today - Nation",
                          "url":  "https://www.indiatoday.in/rss/1206514"
                      },
                      {
                          "title":  "Times of India - India News",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms"
                      },
                      {
                          "title":  "News18 - India",
                          "url":  "https://www.news18.com/rss/india.xml"
                      },
                      {
                          "title":  "News18 - India Alternate",
                          "url":  "https://www.news18.com/commonfeeds/v1/eng/rss/india.xml"
                      },
                      {
                          "title":  "The Hindu - National",
                          "url":  "https://www.thehindu.com/news/national/feeder/default.rss"
                      },
                      {
                          "title":  "PIB - Press Releases",
                          "url":  "https://pib.gov.in/RssMain.aspx?ModId=6\u0026Lang=1\u0026Regid=1"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "odisha",
        "name":  "Odisha",
        "position":  2,
        "legacyKeys":  [
                           "bhubaneswar"
                       ],
        "legacyNames":  [
                            "Bhubaneswar"
                        ],
        "feeds":  [
                      {
                          "title":  "Times of India - Bhubaneswar",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/4118235.cms"
                      },
                      {
                          "title":  "Odisha TV - Main Feed",
                          "url":  "https://odishatv.in/feed/"
                      },
                      {
                          "title":  "OrissaPOST - Main Feed",
                          "url":  "https://www.orissapost.com/feed/"
                      },
                      {
                          "title":  "Odisha Bytes - Main Feed",
                          "url":  "https://odishabytes.com/feed/"
                      },
                      {
                          "title":  "PIB - Press Releases",
                          "url":  "https://pib.gov.in/RssMain.aspx?ModId=6\u0026Lang=1\u0026Regid=1"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "technology",
        "name":  "Technology",
        "position":  3,
        "legacyKeys":  [
                           "tech"
                       ],
        "legacyNames":  [
                            "Tech"
                        ],
        "feeds":  [
                      {
                          "title":  "BBC News - Technology",
                          "url":  "https://feeds.bbci.co.uk/news/technology/rss.xml"
                      },
                      {
                          "title":  "Reuters - Technology News",
                          "url":  "https://feeds.reuters.com/reuters/technologyNews"
                      },
                      {
                          "title":  "Hindustan Times - Technology",
                          "url":  "https://www.hindustantimes.com/feeds/rss/technology/rssfeed.xml"
                      },
                      {
                          "title":  "NDTV Gadgets 360 - Latest",
                          "url":  "https://feeds.feedburner.com/gadgets360-latest"
                      },
                      {
                          "title":  "India Today - Technology",
                          "url":  "https://www.indiatoday.in/rss/1206688"
                      },
                      {
                          "title":  "Times of India - Technology",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/66949542.cms"
                      },
                      {
                          "title":  "Fox News - Tech",
                          "url":  "https://moxie.foxnews.com/google-publisher/tech.xml"
                      },
                      {
                          "title":  "The Hindu - Technology",
                          "url":  "https://www.thehindu.com/sci-tech/technology/feeder/default.rss"
                      },
                      {
                          "title":  "The Hindu - Sci-Tech",
                          "url":  "https://www.thehindu.com/sci-tech/feeder/default.rss"
                      },
                      {
                          "title":  "Indian Express - Explained Sci-Tech",
                          "url":  "https://indianexpress.com/section/explained/explained-sci-tech/feed/"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "defense_security",
        "name":  "Defense and Security",
        "position":  4,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "PIB - Press Releases",
                          "url":  "https://pib.gov.in/RssMain.aspx?ModId=6\u0026Lang=1\u0026Regid=1"
                      },
                      {
                          "title":  "Hindustan Times - Geopolitics",
                          "url":  "https://www.hindustantimes.com/feeds/rss/geopolitics/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - International Affairs",
                          "url":  "https://www.hindustantimes.com/feeds/rss/ht-insight/international-affairs/rssfeed.xml"
                      },
                      {
                          "title":  "Reuters - Politics News",
                          "url":  "https://feeds.reuters.com/Reuters/PoliticsNews"
                      },
                      {
                          "title":  "Reuters - World News",
                          "url":  "https://feeds.reuters.com/Reuters/worldNews"
                      },
                      {
                          "title":  "BBC News - Middle East",
                          "url":  "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"
                      },
                      {
                          "title":  "BBC News - Asia",
                          "url":  "https://feeds.bbci.co.uk/news/world/asia/rss.xml"
                      },
                      {
                          "title":  "Times of India - South Asia",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/3907412.cms"
                      },
                      {
                          "title":  "Times of India - China",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/1898184.cms"
                      },
                      {
                          "title":  "Times of India - Pakistan",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/30359534.cms"
                      },
                      {
                          "title":  "Times of India - Middle East",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/1898272.cms"
                      },
                      {
                          "title":  "Fox News - Politics",
                          "url":  "https://moxie.foxnews.com/google-publisher/politics.xml"
                      },
                      {
                          "title":  "News18 - Politics",
                          "url":  "https://www.news18.com/commonfeeds/v1/eng/rss/politics.xml"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "ai_ml",
        "name":  "AI and ML",
        "position":  5,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "Hindustan Times - AI",
                          "url":  "https://www.hindustantimes.com/feeds/rss/ai/rssfeed.xml"
                      },
                      {
                          "title":  "TechCrunch - Artificial Intelligence",
                          "url":  "https://techcrunch.com/category/artificial-intelligence/feed/"
                      },
                      {
                          "title":  "VentureBeat - AI",
                          "url":  "https://venturebeat.com/category/ai/feed/"
                      },
                      {
                          "title":  "Analytics India Magazine - Main Feed",
                          "url":  "https://analyticsindiamag.com/feed"
                      },
                      {
                          "title":  "arXiv - Computer Science AI",
                          "url":  "https://rss.arxiv.org/rss/cs.AI"
                      },
                      {
                          "title":  "arXiv - Computer Science Machine Learning",
                          "url":  "https://rss.arxiv.org/rss/cs.LG"
                      },
                      {
                          "title":  "arXiv - Statistics Machine Learning",
                          "url":  "https://rss.arxiv.org/rss/stat.ML"
                      },
                      {
                          "title":  "Hacker News - Front Page",
                          "url":  "https://news.ycombinator.com/rss"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "science",
        "name":  "Science",
        "position":  6,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "BBC News - Science and Environment",
                          "url":  "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"
                      },
                      {
                          "title":  "Reuters - Science News",
                          "url":  "https://feeds.reuters.com/reuters/scienceNews"
                      },
                      {
                          "title":  "Hindustan Times - Science",
                          "url":  "https://www.hindustantimes.com/feeds/rss/science/rssfeed.xml"
                      },
                      {
                          "title":  "India Today - Science",
                          "url":  "https://www.indiatoday.in/rss/1206814"
                      },
                      {
                          "title":  "Times of India - Science",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/-2128672765.cms"
                      },
                      {
                          "title":  "Fox News - Science",
                          "url":  "https://moxie.foxnews.com/google-publisher/science.xml"
                      },
                      {
                          "title":  "The Hindu - Science",
                          "url":  "https://www.thehindu.com/sci-tech/science/feeder/default.rss"
                      },
                      {
                          "title":  "The Hindu - Sci-Tech",
                          "url":  "https://www.thehindu.com/sci-tech/feeder/default.rss"
                      },
                      {
                          "title":  "NASA - Breaking News",
                          "url":  "http://www.nasa.gov/rss/breaking_news.rss"
                      },
                      {
                          "title":  "arXiv - Physics",
                          "url":  "https://rss.arxiv.org/rss/physics"
                      },
                      {
                          "title":  "arXiv - Quantitative Biology",
                          "url":  "https://rss.arxiv.org/rss/q-bio"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "geopolitics",
        "name":  "Geopolitics",
        "position":  7,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "Hindustan Times - Geopolitics",
                          "url":  "https://www.hindustantimes.com/feeds/rss/geopolitics/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - International Affairs",
                          "url":  "https://www.hindustantimes.com/feeds/rss/ht-insight/international-affairs/rssfeed.xml"
                      },
                      {
                          "title":  "Reuters - World News",
                          "url":  "https://feeds.reuters.com/Reuters/worldNews"
                      },
                      {
                          "title":  "Reuters - Politics News",
                          "url":  "https://feeds.reuters.com/Reuters/PoliticsNews"
                      },
                      {
                          "title":  "BBC News - Asia",
                          "url":  "https://feeds.bbci.co.uk/news/world/asia/rss.xml"
                      },
                      {
                          "title":  "BBC News - Middle East",
                          "url":  "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"
                      },
                      {
                          "title":  "BBC News - Europe",
                          "url":  "https://feeds.bbci.co.uk/news/world/europe/rss.xml"
                      },
                      {
                          "title":  "Times of India - South Asia",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/3907412.cms"
                      },
                      {
                          "title":  "Times of India - China",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/1898184.cms"
                      },
                      {
                          "title":  "Times of India - Pakistan",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/30359534.cms"
                      },
                      {
                          "title":  "Times of India - Middle East",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/1898272.cms"
                      },
                      {
                          "title":  "Times of India - Rest of World",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/671314.cms"
                      },
                      {
                          "title":  "India Today - China",
                          "url":  "https://www.indiatoday.in/rss/1207557"
                      },
                      {
                          "title":  "India Today - US",
                          "url":  "https://www.indiatoday.in/rss/1938656"
                      },
                      {
                          "title":  "India Today - UK",
                          "url":  "https://www.indiatoday.in/rss/1938659"
                      },
                      {
                          "title":  "India Today - Canada",
                          "url":  "https://www.indiatoday.in/rss/1938657"
                      },
                      {
                          "title":  "Fox News - World",
                          "url":  "https://moxie.foxnews.com/google-publisher/world.xml"
                      },
                      {
                          "title":  "Fox News - Politics",
                          "url":  "https://moxie.foxnews.com/google-publisher/politics.xml"
                      },
                      {
                          "title":  "Indian Express - Explained Global",
                          "url":  "https://indianexpress.com/section/explained/explained-global/feed/"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "international_relations",
        "name":  "International Relations",
        "position":  8,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "Hindustan Times - International Affairs",
                          "url":  "https://www.hindustantimes.com/feeds/rss/ht-insight/international-affairs/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - Geopolitics",
                          "url":  "https://www.hindustantimes.com/feeds/rss/geopolitics/rssfeed.xml"
                      },
                      {
                          "title":  "Reuters - World News",
                          "url":  "https://feeds.reuters.com/Reuters/worldNews"
                      },
                      {
                          "title":  "Reuters - Politics News",
                          "url":  "https://feeds.reuters.com/Reuters/PoliticsNews"
                      },
                      {
                          "title":  "BBC News - World",
                          "url":  "https://feeds.bbci.co.uk/news/world/rss.xml"
                      },
                      {
                          "title":  "BBC News - Asia",
                          "url":  "https://feeds.bbci.co.uk/news/world/asia/rss.xml"
                      },
                      {
                          "title":  "India Today - World",
                          "url":  "https://www.indiatoday.in/rss/1206577"
                      },
                      {
                          "title":  "The Hindu - International",
                          "url":  "https://www.thehindu.com/news/international/feeder/default.rss"
                      },
                      {
                          "title":  "Indian Express - Explained Global",
                          "url":  "https://indianexpress.com/section/explained/explained-global/feed/"
                      },
                      {
                          "title":  "PIB - Press Releases",
                          "url":  "https://pib.gov.in/RssMain.aspx?ModId=6\u0026Lang=1\u0026Regid=1"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "sports",
        "name":  "Sports",
        "position":  9,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "BBC Sport - Main",
                          "url":  "https://feeds.bbci.co.uk/sport/0/rss.xml?edition=uk"
                      },
                      {
                          "title":  "BBC Sport - Cricket",
                          "url":  "https://feeds.bbci.co.uk/sport/cricket/rss.xml"
                      },
                      {
                          "title":  "BBC Sport - Football",
                          "url":  "https://feeds.bbci.co.uk/sport/football/rss.xml"
                      },
                      {
                          "title":  "BBC Sport - Tennis",
                          "url":  "https://feeds.bbci.co.uk/sport/tennis/rss.xml"
                      },
                      {
                          "title":  "Reuters - Sports News",
                          "url":  "https://feeds.reuters.com/reuters/sportsNews"
                      },
                      {
                          "title":  "Hindustan Times - Sports",
                          "url":  "https://www.hindustantimes.com/feeds/rss/sports/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - Cricket",
                          "url":  "https://www.hindustantimes.com/feeds/rss/cricket/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - Football",
                          "url":  "https://www.hindustantimes.com/feeds/rss/sports/football/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - Hockey",
                          "url":  "https://www.hindustantimes.com/feeds/rss/sports/hockey/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - Tennis",
                          "url":  "https://www.hindustantimes.com/feeds/rss/sports/tennis/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - Badminton",
                          "url":  "https://www.hindustantimes.com/feeds/rss/sports/badminton/rssfeed.xml"
                      },
                      {
                          "title":  "NDTV - Sports",
                          "url":  "https://feeds.feedburner.com/ndtvsports-latest"
                      },
                      {
                          "title":  "NDTV - Cricket",
                          "url":  "https://feeds.feedburner.com/ndtvsports-cricket"
                      },
                      {
                          "title":  "India Today - Sports",
                          "url":  "https://www.indiatoday.in/rss/1206550"
                      },
                      {
                          "title":  "India Today - Cricket",
                          "url":  "https://www.indiatoday.in/rss/1207035"
                      },
                      {
                          "title":  "India Today - Football",
                          "url":  "https://www.indiatoday.in/rss/1207082"
                      },
                      {
                          "title":  "Times of India - Sports News",
                          "url":  "https://timesofindia.indiatimes.com/rssfeeds/4719148.cms"
                      },
                      {
                          "title":  "News18 - Sports",
                          "url":  "https://www.news18.com/commonfeeds/v1/eng/rss/sports.xml"
                      },
                      {
                          "title":  "Fox News - Sports",
                          "url":  "https://moxie.foxnews.com/google-publisher/sports.xml"
                      },
                      {
                          "title":  "The Hindu - Cricket",
                          "url":  "https://www.thehindu.com/sport/cricket/feeder/default.rss"
                      },
                      {
                          "title":  "The Hindu - Football",
                          "url":  "https://www.thehindu.com/sport/football/feeder/default.rss"
                      },
                      {
                          "title":  "The Hindu - Hockey",
                          "url":  "https://www.thehindu.com/sport/hockey/feeder/default.rss"
                      },
                      {
                          "title":  "Indian Express - Explained Sports",
                          "url":  "https://indianexpress.com/section/explained/explained-sports/feed/"
                      },
                      {
                          "title":  "Indian Express - English Premier League",
                          "url":  "https://indianexpress.com/section/sports/football/english-premier-league/feed/"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "mythology",
        "name":  "Mythology",
        "position":  10,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "Hindustan Times - Astrology",
                          "url":  "https://www.hindustantimes.com/feeds/rss/astrology/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - Panchang Shubh Muhurat",
                          "url":  "https://www.hindustantimes.com/feeds/rss/astrology/panchang-shubh-muhurat/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - Spiritual",
                          "url":  "https://www.hindustantimes.com/feeds/rss/lifestyle/spiritual/rssfeed.xml"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "indian_culture_traditions",
        "name":  "Indian Culture and Traditions",
        "position":  11,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "The Hindu - Society",
                          "url":  "https://www.thehindu.com/society/feeder/default.rss"
                      },
                      {
                          "title":  "The Hindu - History and Culture",
                          "url":  "https://www.thehindu.com/society/history-and-culture/feeder/default.rss"
                      },
                      {
                          "title":  "India Today - Society and The Arts",
                          "url":  "https://www.indiatoday.in/rss/1206504"
                      },
                      {
                          "title":  "Hindustan Times - Spiritual",
                          "url":  "https://www.hindustantimes.com/feeds/rss/lifestyle/spiritual/rssfeed.xml"
                      },
                      {
                          "title":  "Hindustan Times - Astrology",
                          "url":  "https://www.hindustantimes.com/feeds/rss/astrology/rssfeed.xml"
                      },
                      {
                          "title":  "Indian Express - Explained Culture",
                          "url":  "https://indianexpress.com/section/explained/explained-culture/feed/"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "government_official_sources",
        "name":  "Government and Official Sources",
        "position":  12,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "PIB - Press Releases",
                          "url":  "https://pib.gov.in/RssMain.aspx?ModId=6\u0026Lang=1\u0026Regid=1"
                      },
                      {
                          "title":  "PIB - Media Invitation",
                          "url":  "https://pib.gov.in/RssMain.aspx?ModId=10\u0026Lang=1\u0026Regid=1"
                      },
                      {
                          "title":  "PIB - Photos RSS",
                          "url":  "https://pib.gov.in/RssMain.aspx?ModId=8\u0026Lang=1\u0026Regid=1"
                      },
                      {
                          "title":  "NASA - Breaking News",
                          "url":  "http://www.nasa.gov/rss/breaking_news.rss"
                      },
                      {
                          "title":  "arXiv - Computer Science",
                          "url":  "https://rss.arxiv.org/rss/cs"
                      },
                      {
                          "title":  "arXiv - Computer Science AI",
                          "url":  "https://rss.arxiv.org/rss/cs.AI"
                      },
                      {
                          "title":  "arXiv - Computer Science Machine Learning",
                          "url":  "https://rss.arxiv.org/rss/cs.LG"
                      },
                      {
                          "title":  "arXiv - Statistics Machine Learning",
                          "url":  "https://rss.arxiv.org/rss/stat.ML"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    },
    {
        "key":  "other_important_buckets",
        "name":  "Other Important Buckets",
        "position":  13,
        "legacyKeys":  [

                       ],
        "legacyNames":  [

                        ],
        "feeds":  [
                      {
                          "title":  "Environment and Climate - BBC News - Science and Environment",
                          "url":  "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"
                      },
                      {
                          "title":  "Environment and Climate - Reuters - Science News",
                          "url":  "https://feeds.reuters.com/reuters/scienceNews"
                      },
                      {
                          "title":  "Environment and Climate - Hindustan Times - Environment",
                          "url":  "https://www.hindustantimes.com/feeds/rss/environment/rssfeed.xml"
                      },
                      {
                          "title":  "Environment and Climate - India Today - Environment",
                          "url":  "https://www.indiatoday.in/rss/1206542"
                      },
                      {
                          "title":  "Environment and Climate - The Hindu - Science",
                          "url":  "https://www.thehindu.com/sci-tech/science/feeder/default.rss"
                      },
                      {
                          "title":  "Policy and Politics - Reuters - Politics News",
                          "url":  "https://feeds.reuters.com/Reuters/PoliticsNews"
                      },
                      {
                          "title":  "Policy and Politics - Fox News - Politics",
                          "url":  "https://moxie.foxnews.com/google-publisher/politics.xml"
                      },
                      {
                          "title":  "Policy and Politics - News18 - Politics",
                          "url":  "https://www.news18.com/commonfeeds/v1/eng/rss/politics.xml"
                      },
                      {
                          "title":  "Policy and Politics - PIB - Press Releases",
                          "url":  "https://pib.gov.in/RssMain.aspx?ModId=6\u0026Lang=1\u0026Regid=1"
                      },
                      {
                          "title":  "Policy and Politics - India Today - Nation",
                          "url":  "https://www.indiatoday.in/rss/1206514"
                      },
                      {
                          "title":  "Explainers and Analysis - Hindustan Times - Geopolitics",
                          "url":  "https://www.hindustantimes.com/feeds/rss/geopolitics/rssfeed.xml"
                      },
                      {
                          "title":  "Explainers and Analysis - Hindustan Times - International Affairs",
                          "url":  "https://www.hindustantimes.com/feeds/rss/ht-insight/international-affairs/rssfeed.xml"
                      },
                      {
                          "title":  "Explainers and Analysis - Indian Express - Explained Global",
                          "url":  "https://indianexpress.com/section/explained/explained-global/feed/"
                      },
                      {
                          "title":  "Explainers and Analysis - Indian Express - Explained Sci-Tech",
                          "url":  "https://indianexpress.com/section/explained/explained-sci-tech/feed/"
                      },
                      {
                          "title":  "Explainers and Analysis - Indian Express - Explained Sports",
                          "url":  "https://indianexpress.com/section/explained/explained-sports/feed/"
                      },
                      {
                          "title":  "Explainers and Analysis - Indian Express - Explained Culture",
                          "url":  "https://indianexpress.com/section/explained/explained-culture/feed/"
                      },
                      {
                          "title":  "Fallback Broad Feeds - Reuters - Top News",
                          "url":  "https://feeds.reuters.com/reuters/topNews"
                      },
                      {
                          "title":  "Fallback Broad Feeds - NDTV - Top Stories",
                          "url":  "https://feeds.feedburner.com/ndtvnews-top-stories"
                      },
                      {
                          "title":  "Fallback Broad Feeds - NDTV - Latest Stories",
                          "url":  "https://feeds.feedburner.com/ndtvnews-latest"
                      },
                      {
                          "title":  "Fallback Broad Feeds - India Today - Home",
                          "url":  "https://www.indiatoday.in/rss/home"
                      },
                      {
                          "title":  "Fallback Broad Feeds - Fox News - Latest Headlines",
                          "url":  "https://moxie.foxnews.com/google-publisher/latest.xml"
                      }
                  ],
        "fetchIntervalMinutes":  30,
        "enabled":  true
    }
];


     