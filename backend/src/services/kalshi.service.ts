import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Map Oscar categories to Kalshi event tickers
const categoryToKalshiEvent: Record<string, string> = {
  'best-picture': 'KXOSCARPIC-26',
  'directing': 'KXOSCARDIR-26',
  'actor-leading': 'KXOSCARACTO-26',
  'actress-leading': 'KXOSCARACTR-26',
  'actor-supporting': 'KXOSCARSUPACTO-26',
  'actress-supporting': 'KXOSCARSUPACTR-26',
  'writing-original': 'KXOSCARSPLAY-26',
  'writing-adapted': 'KXOSCARASPLAY-26',
  'cinematography': 'KXOSCARCINE-26',
  'film-editing': 'KXOSCAREDIT-26',
  'music-score': 'KXOSCARSCORE-26',
  'music-song': 'KXOSCARSONG-26',
  'sound': 'KXOSCARSOUND-26',
  'production-design': 'KXOSCARPROD-26',
  'visual-effects': 'KXOSCARVIS-26',
  'costume-design': 'KXOSCARCOSTUME-26',
  'makeup-hairstyling': 'KXOSCARMAH-26',
  'international-feature': 'KXOSCARINTLFILM-26',
  'animated-feature': 'KXOSCARANIMATED-26b',
  'documentary-feature': 'KXOSCARDOCU-26',
  'documentary-short': 'KXOSCARDSFILM-26',
  'animated-short': 'KXOSCARAS-26b',
  'live-action-short': 'KXOSCARLASF-26',
  'casting': 'KXOSCARCASTING-26',
};

const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://thingproxy.freeboard.io/fetch/',
];

export class KalshiService {
  async fetchKalshiMarkets(eventTicker: string): Promise<any> {
    const seriesTicker = eventTicker.split('-')[0];
    const apiUrls = [
      `${KALSHI_API_BASE}/markets?series_ticker=${seriesTicker}&status=open`,
      `${KALSHI_API_BASE}/markets?series_ticker=${seriesTicker}`,
      `${KALSHI_API_BASE}/events/${eventTicker}?with_nested_markets=true`,
      `${KALSHI_API_BASE}/markets?event_ticker=${eventTicker}`,
    ];

    let lastError: any = null;
    for (const apiUrl of apiUrls) {
      for (const proxyBase of CORS_PROXIES) {
        try {
          const proxyUrl = `${proxyBase}${encodeURIComponent(apiUrl)}`;
          const response = await fetch(proxyUrl);

          if (response.ok) {
            const data = await response.json() as any;

            if (data.error) {
              if (data.error.code === 'not_found' || response.status === 404) {
                console.log(`Kalshi API returned not_found for ${eventTicker} (URL: ${apiUrl})`);
                return null;
              }
              console.log(`Kalshi API error for ${eventTicker}: ${JSON.stringify(data.error)}`);
              lastError = data.error;
              continue;
            }

            if (data.event && data.event.markets && data.event.markets.length > 0) {
              console.log(`Found ${data.event.markets.length} markets for ${eventTicker} via events endpoint`);
              return { markets: data.event.markets };
            }

            if (data.markets && data.markets.length > 0) {
              console.log(`Found ${data.markets.length} markets for ${eventTicker} via markets endpoint`);
              return data;
            }
          } else if (response.status === 404) {
            console.log(`404 response for ${eventTicker} (URL: ${apiUrl})`);
            break;
          } else {
            console.log(`Non-200 response (${response.status}) for ${eventTicker} (URL: ${apiUrl})`);
          }
        } catch (error) {
          console.log(`Error fetching ${eventTicker} from ${apiUrl}:`, error);
          lastError = error;
          continue;
        }
      }
    }

    if (lastError) {
      console.log(`All attempts failed for ${eventTicker}. Last error:`, lastError);
    }
    return null;
  }

  getMarketPrice(market: any): number | null {
    if (market.yes_price !== undefined && market.yes_price !== null) {
      return market.yes_price;
    }
    if (market.last_price !== undefined && market.last_price !== null) {
      return market.last_price;
    }
    if (market.yes_bid !== undefined && market.yes_ask !== undefined) {
      return Math.round((market.yes_bid + market.yes_ask) / 2);
    }
    return null;
  }

  normalizeSpecialCharacters(text: string): string {
    return text
      .toLowerCase()
      .replace(/[āáàâä]/g, 'a')
      .replace(/[ēéèêë]/g, 'e')
      .replace(/[īíìîï]/g, 'i')
      .replace(/[ōóòôö]/g, 'o')
      .replace(/[ūúùûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .trim();
  }

  filmNameToSlug(name: string): string {
    return this.normalizeSpecialCharacters(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  matchNomineeToMarket(
    nomineeName: string,
    nomineeFilm: string | null,
    markets: any
  ): { market: any; price: number } | null {
    if (!markets || !markets.markets || markets.markets.length === 0) {
      return null;
    }

    // Normalize special characters for better matching
    const searchName = this.normalizeSpecialCharacters(nomineeName);
    const searchFilm = nomineeFilm ? this.normalizeSpecialCharacters(nomineeFilm) : '';
    const searchNameSlug = this.filmNameToSlug(nomineeName);
    const searchFilmSlug = nomineeFilm ? this.filmNameToSlug(nomineeFilm) : '';

    for (const market of markets.markets) {
      // Normalize market fields for comparison
      const marketTitle = market.title ? this.normalizeSpecialCharacters(market.title) : '';
      const marketTicker = market.ticker ? this.normalizeSpecialCharacters(market.ticker) : '';
      const marketSubtitle = market.subtitle ? this.normalizeSpecialCharacters(market.subtitle) : '';
      const marketYesSubTitle = market.yes_sub_title ? this.normalizeSpecialCharacters(market.yes_sub_title) : '';

      // Strategy 1: Exact match
      if (marketTitle === searchName || (searchFilm && marketTitle === searchFilm)) {
        const price = this.getMarketPrice(market);
        if (price !== null) return { market, price };
      }

      // Strategy 2: Partial match
      if (marketTitle.includes(searchName) || (searchFilm && marketTitle.includes(searchFilm))) {
        const price = this.getMarketPrice(market);
        if (price !== null) return { market, price };
      }

      // Strategy 3: Slug match
      if (
        marketTicker.includes(searchNameSlug) ||
        marketTitle.includes(searchNameSlug) ||
        (searchFilmSlug && (marketTicker.includes(searchFilmSlug) || marketTitle.includes(searchFilmSlug)))
      ) {
        const price = this.getMarketPrice(market);
        if (price !== null) return { market, price };
      }

      // Strategy 4: Subtitle match
      if (marketSubtitle.includes(searchName) || (searchFilm && marketSubtitle.includes(searchFilm))) {
        const price = this.getMarketPrice(market);
        if (price !== null) return { market, price };
      }

      // Strategy 5: Yes subtitle match
      if (marketYesSubTitle.includes(searchName) || (searchFilm && marketYesSubTitle.includes(searchFilm))) {
        const price = this.getMarketPrice(market);
        if (price !== null) return { market, price };
      }
    }

    return null;
  }

  async getCategoryMarkets(categoryId: string): Promise<any> {
    const eventTicker = categoryToKalshiEvent[categoryId];
    if (!eventTicker) {
      console.log(`No Kalshi event ticker found for category: ${categoryId}`);
      return null;
    }

    console.log(`Fetching markets for category ${categoryId} with ticker ${eventTicker}`);
    const markets = await this.fetchKalshiMarkets(eventTicker);
    if (!markets) {
      console.log(`No markets returned for category ${categoryId} (ticker: ${eventTicker})`);
    }
    return markets;
  }

  async createOddsSnapshot(categoryId: string, nominees: any[]): Promise<void> {
    // Extract base category ID (remove year suffix if present)
    // categoryId might be "best-picture-2026", but we need "best-picture" for the lookup
    const baseCategoryId = categoryId.includes('-2026') 
      ? categoryId.replace('-2026', '') 
      : categoryId.replace(/-\d{4}$/, ''); // Remove any 4-digit year suffix
    
    const markets = await this.getCategoryMarkets(baseCategoryId);
    if (!markets) {
      console.log(`No markets found for category ${baseCategoryId} (full ID: ${categoryId})`);
      return;
    }

    const snapshotTime = new Date();

    for (const nominee of nominees) {
      // For casting category, nominees have 'name' (film) and 'castingDirector'
      // For international feature films, nominees have 'name' (country - film) and 'film' (film name)
      // For other categories, nominees have 'name' and 'film'
      const nomineeName = nominee.name || nominee.film || '';
      const nomineeFilm = nominee.film || nominee.name || null;
      const castingDirector = nominee.castingDirector || null;

      // For international feature films, prioritize film name over country-name format
      let match: { market: any; price: number } | null = null;
      if (baseCategoryId === 'international-feature' && nomineeFilm) {
        // Try matching with just the film name first (e.g., "Sirāt" instead of "Spain - Sirāt")
        match = this.matchNomineeToMarket(nomineeFilm, null, markets);
      }
      
      // If no match yet, try standard approach
      if (!match) {
        match = this.matchNomineeToMarket(nomineeName, nomineeFilm, markets);
      }
      
      // If no match and this is casting category, try multiple strategies:
      // 1. Try matching with casting director name as primary
      // 2. Try matching with film name only (no director)
      if (!match && baseCategoryId === 'casting') {
        if (castingDirector) {
          match = this.matchNomineeToMarket(castingDirector, nomineeName, markets);
        }
        // If still no match, try just the film name without director
        if (!match) {
          match = this.matchNomineeToMarket(nomineeName, null, markets);
        }
      }

      if (match && match.price !== null) {
        // Always create new snapshot for history tracking
        // getCurrentOdds will get the most recent one
        await prisma.oddsSnapshot.create({
          data: {
            categoryId, // Use full category ID with year for database
            nomineeId: nominee.id,
            nomineeName: baseCategoryId === 'casting' ? (castingDirector || nomineeName) : nomineeName,
            nomineeFilm: baseCategoryId === 'casting' ? nomineeName : nomineeFilm,
            oddsPercentage: match.price,
            snapshotTime,
          },
        });
        console.log(`✓ Created odds snapshot for ${baseCategoryId} nominee ${nominee.id} (${nomineeName}): ${match.price}%`);
      } else {
        console.log(`✗ No odds match found for ${baseCategoryId} nominee ${nominee.id}: ${nomineeName}${castingDirector ? ` (director: ${castingDirector})` : ''}`);
      }
    }
  }

  async checkMarketResolution(categoryId: string): Promise<{ nomineeId: string | null; resolved: boolean }> {
    const markets = await this.getCategoryMarkets(categoryId);
    if (!markets || !markets.markets) {
      return { nomineeId: null, resolved: false };
    }

    for (const market of markets.markets) {
      // Check if market is resolved
      if (market.status === 'resolved' || market.status === 'closed') {
        // Check if YES outcome won (price = 100)
        if (market.yes_price === 100 || market.last_price === 100) {
          // Extract winner from market title/subtitle
          const winnerName = market.yes_sub_title || market.subtitle || market.title;
          return { nomineeId: winnerName, resolved: true };
        }
        // Check if NO outcome won
        if (market.no_price === 100) {
          // This means the nominee did NOT win
          return { nomineeId: null, resolved: true };
        }
      }
    }

    return { nomineeId: null, resolved: false };
  }
}
