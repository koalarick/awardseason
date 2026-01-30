// Image cache removed - always fetch fresh images

// Wikipedia image fetching removed

// Kalshi API Configuration
const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Map Oscar categories to Kalshi event tickers (format: SERIES-YEAR)
// Based on Kalshi website, events are like KXOSCARPIC-26 (uppercase)
// Per Kalshi docs: use series_ticker (uppercase) parameter, no auth required
const categoryToKalshiEvent = {
    'best-picture': 'KXOSCARPIC-26',
    'directing': 'KXOSCARDIR-26',
    'actor-leading': 'KXOSCARACTO-26',
    'actress-leading': 'KXOSCARACTR-26',
    'actor-supporting': 'KXOSCARSUPACTO-26',
    'actress-supporting': 'KXOSCARSUPACTR-26',
    'writing-original': 'KXOSCARSPLAY-26', // Original Screenplay
    'writing-adapted': 'KXOSCARASPLAY-26', // Adapted Screenplay
    'cinematography': 'KXOSCARCINE-26',
    'film-editing': 'KXOSCAREDIT-26',
    'music-score': 'KXOSCARSCORE-26',
    'music-song': 'KXOSCARSONG-26',
    'sound': 'KXOSCARSOUND-26',
    'production-design': 'KXOSCARPROD-26',
    'visual-effects': 'KXOSCARVIS-26', // Verified on Kalshi website
    'costume-design': 'KXOSCARCOSTUME-26',
    'makeup-hairstyling': 'KXOSCARMAH-26', // Verified on Kalshi website
    'international-feature': 'KXOSCARINTLFILM-26', // Verified on Kalshi website
    'animated-feature': 'KXOSCARANIMATED-26b', // Verified on Kalshi website (note 'b' suffix)
    'documentary-feature': 'KXOSCARDOCU-26', // Verified on Kalshi website
    'documentary-short': 'KXOSCARDSFILM-26', // Verified on Kalshi website
    'animated-short': 'KXOSCARAS-26b', // Verified on Kalshi website (note 'b' suffix)
    'live-action-short': 'KXOSCARLASF-26', // Verified on Kalshi website
    'casting': 'KXOSCARCasting-26' // Verified on Kalshi website
};

// Cache for odds data
const oddsCache = {};
const CACHE_TIME = 3600000; // Cache for 1 hour (60 minutes * 60 seconds * 1000 ms)

// Function to fetch markets from Kalshi API
// Based on Kalshi docs: use series_ticker (uppercase), no auth required for market data
// If no open markets, remove status filter or use status=all
async function fetchKalshiMarkets(eventTicker) {
    const cacheKey = `kalshi_markets_${eventTicker}`;
    
    // Check cache (including negative cache for "no markets found")
    if (oddsCache[cacheKey] && oddsCache[cacheKey].timestamp && Date.now() - oddsCache[cacheKey].timestamp < CACHE_TIME) {
        if (oddsCache[cacheKey].data === null) {
            // Cached "no markets found" result - return null silently
            return null;
        }
        return oddsCache[cacheKey].data;
    }
    
    try {
        // Extract series ticker (uppercase, e.g., KXOSCARPIC from KXOSCARPIC-26)
        // Per docs: use series_ticker parameter with uppercase ticker
        const seriesTicker = eventTicker.split('-')[0]; // Keep uppercase
        
        // Per docs quick start: prioritize series_ticker, try with and without status filter
        const apiUrls = [
            `${KALSHI_API_BASE}/markets?series_ticker=${seriesTicker}&status=open`,
            `${KALSHI_API_BASE}/markets?series_ticker=${seriesTicker}`,
            `${KALSHI_API_BASE}/events/${eventTicker}?with_nested_markets=true`,
            `${KALSHI_API_BASE}/markets?event_ticker=${eventTicker}`
        ];
        
        // CORS proxy - per docs, no auth needed but browser CORS restrictions apply
        const proxies = [
            'https://corsproxy.io/?',
            'https://api.allorigins.win/raw?url=',
            'https://thingproxy.freeboard.io/fetch/'
        ];
        
        let lastError = null;
        for (const apiUrl of apiUrls) {
            for (const proxyBase of proxies) {
                try {
                    const proxyUrl = `${proxyBase}${encodeURIComponent(apiUrl)}`;
                    const response = await fetch(proxyUrl);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Handle error responses (e.g., 404 not found)
                        if (data.error) {
                            // If it's a "not found" error, cache it and return null
                            if (data.error.code === 'not_found' || response.status === 404) {
                                oddsCache[cacheKey] = {
                                    data: null,
                                    timestamp: Date.now()
                                };
                                return null;
                            }
                            continue; // Try next URL for other errors
                        }
                        
                        // Handle event endpoint response (has event.markets)
                        if (data.event && data.event.markets && data.event.markets.length > 0) {
                            const marketsData = { markets: data.event.markets };
                            
                            oddsCache[cacheKey] = {
                                data: marketsData,
                                timestamp: Date.now()
                            };
                            
                            return marketsData;
                        }
                        
                        // Handle markets endpoint response
                        if (data.markets && data.markets.length > 0) {
                            oddsCache[cacheKey] = {
                                data: data,
                                timestamp: Date.now()
                            };
                            
                            return data;
                        }
                        
                        // If no markets found but response was OK, try next URL
                        break;
                    } else if (response.status === 404) {
                        // 404 means the event/market doesn't exist - cache this result
                        oddsCache[cacheKey] = {
                            data: null,
                            timestamp: Date.now()
                        };
                        return null;
                    }
                } catch (err) {
                    lastError = err;
                    continue;
                }
            }
        }
        
        // If we get here, no markets were found - cache this negative result
        oddsCache[cacheKey] = {
            data: null,
            timestamp: Date.now()
        };
        return null;
    } catch (error) {
        // Cache the error as "no markets found" to avoid repeated failures
        oddsCache[cacheKey] = {
            data: null,
            timestamp: Date.now()
        };
        return null;
    }
}

// Helper to extract price from market (yes_price, last_price, or computed from yes_bid/yes_ask)
function getMarketPrice(market) {
    // Per docs quick start example, yes_price exists, but API response shows yes_bid/yes_ask/last_price
    // Try yes_price first, then last_price, then compute from yes_bid/yes_ask
    if (market.yes_price !== undefined && market.yes_price !== null) {
        return market.yes_price;
    }
    if (market.last_price !== undefined && market.last_price !== null) {
        return market.last_price;
    }
    // Compute midpoint from bid/ask if available
    if (market.yes_bid !== undefined && market.yes_ask !== undefined) {
        return Math.round((market.yes_bid + market.yes_ask) / 2);
    }
    return null;
}

// Function to match nominee name to Kalshi market outcome
function matchNomineeToMarket(nomineeName, nomineeFilm, markets) {
    if (!markets || !markets.markets || markets.markets.length === 0) {
        console.log('No markets found in response:', markets);
        return null;
    }
    
    const searchName = nomineeName.toLowerCase().trim();
    const searchFilm = nomineeFilm ? nomineeFilm.toLowerCase().trim() : '';
    
    // Try multiple matching strategies
    for (const market of markets.markets) {
        const marketTitle = market.title ? market.title.toLowerCase() : '';
        const ticker = market.ticker || '';
        const subtitle = market.subtitle ? market.subtitle.toLowerCase() : '';
        const yesSubTitle = market.yes_sub_title ? market.yes_sub_title.toLowerCase() : '';
        
        // Strategy 1: Exact match in title
        if (marketTitle === searchName || marketTitle === searchFilm) {
            const price = getMarketPrice(market);
            console.log(`Exact match found: ${marketTitle} -> ${price}¢`);
            // Price is already in cents (1-100), representing percentage
            return price || null;
        }
        
        // Strategy 2: Name appears in title
        if (marketTitle.includes(searchName) || (searchFilm && marketTitle.includes(searchFilm))) {
            const price = getMarketPrice(market);
            console.log(`Partial match found: ${marketTitle} -> ${price}¢`);
            // Price is already in cents (1-100), representing percentage
            return price || null;
        }
        
        // Strategy 3: Check subtitle
        if (subtitle && (subtitle.includes(searchName) || (searchFilm && subtitle.includes(searchFilm)))) {
            const price = getMarketPrice(market);
            console.log(`Subtitle match found: ${subtitle} -> ${price}¢`);
            // Price is already in cents (1-100), representing percentage
            return price || null;
        }
        
        // Strategy 4: Check yes_sub_title (for binary markets, this is the "YES" outcome)
        if (yesSubTitle && (yesSubTitle.includes(searchName) || (searchFilm && yesSubTitle.includes(searchFilm)))) {
            const price = getMarketPrice(market);
            console.log(`Yes subtitle match found: ${yesSubTitle} -> ${price}¢`);
            // Price is already in cents (1-100), representing percentage
            return price || null;
        }
        
        // Strategy 5: Check ticker (e.g., KXOSCARPIC-26-ONE for "One Battle After Another")
        const tickerLower = ticker.toLowerCase();
        const nameSlug = searchName.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (tickerLower.includes(nameSlug) || (searchFilm && tickerLower.includes(searchFilm.replace(/\s+/g, '-')))) {
            const price = getMarketPrice(market);
            console.log(`Ticker match found: ${ticker} -> ${price}¢`);
            // Price is already in cents (1-100), representing percentage
            return price || null;
        }
    }
    
    console.log(`No match found for: ${nomineeName} (film: ${nomineeFilm})`);
    console.log('Available markets:', markets.markets.map(m => ({ 
        title: m.title, 
        ticker: m.ticker, 
        yes_sub_title: m.yes_sub_title,
        price: getMarketPrice(m)
    })));
    return null;
}

// Function to get all markets for a category (batched to avoid rate limits)
async function getCategoryMarkets(categoryId) {
    const eventTicker = categoryToKalshiEvent[categoryId];
    if (!eventTicker) {
        return null;
    }
    
    const cacheKey = `category_markets_${categoryId}`;
    // Check if we have cached markets with valid timestamp
    if (oddsCache[cacheKey] && oddsCache[cacheKey].timestamp && Date.now() - oddsCache[cacheKey].timestamp < CACHE_TIME) {
        // Return cached data (could be null if no markets found)
        return oddsCache[cacheKey].data !== undefined ? oddsCache[cacheKey].data : oddsCache[cacheKey];
    }
    
    const markets = await fetchKalshiMarkets(eventTicker);
    // Cache the result (even if null) with timestamp
    oddsCache[cacheKey] = {
        data: markets,
        timestamp: Date.now()
    };
    return markets;
}

// Function to get odds for a nominee from Kalshi
async function getNomineeOdds(year, categoryId, nomineeId, nomineeName, nomineeFilm) {
    const cacheKey = `nominee_odds_${year}_${categoryId}_${nomineeId}`;
    const cached = oddsCache[cacheKey];
    
    // Check if we have cached odds with valid timestamp
    if (cached !== undefined) {
        // Handle both old format (just a number/null) and new format (object with odds and timestamp)
        if (cached && typeof cached === 'object' && cached.timestamp) {
            // New format with timestamp
            if (Date.now() - cached.timestamp < CACHE_TIME) {
                console.log(`Using cached odds for ${nomineeName} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
                return cached.odds;
            }
        } else if (cached !== null && cached !== undefined && typeof cached !== 'object') {
            // Old format (just a number/null) - treat as expired and refetch
            console.log(`Old cache format detected for ${nomineeName}, refetching...`);
        }
    }
    
    try {
        // Get markets for the category (cached per category)
        const markets = await getCategoryMarkets(categoryId);
        if (!markets) {
            oddsCache[cacheKey] = { odds: null, timestamp: Date.now() };
            return null;
        }
        
        const odds = matchNomineeToMarket(nomineeName, nomineeFilm, markets);
        oddsCache[cacheKey] = { odds: odds, timestamp: Date.now() };
        return odds;
    } catch (error) {
        console.warn(`Failed to get odds for ${nomineeName}:`, error);
        oddsCache[cacheKey] = { odds: null, timestamp: Date.now() };
        return null;
    }
}

// Function to format odds as percentage
// Odds are already in percentage form (1-100), not decimal (0-1)
function formatOdds(odds) {
    if (odds === null || odds === undefined) return '';
    // Round to nearest integer since odds are in cents (1-100)
    return `${Math.round(odds)}%`;
}

// Helper function to convert film name to slug format
function filmNameToSlug(filmName) {
    return filmName
        .toLowerCase()
        .replace(/[āáàâä]/g, 'a')
        .replace(/[ēéèêë]/g, 'e')
        .replace(/[īíìîï]/g, 'i')
        .replace(/[ōóòôö]/g, 'o')
        .replace(/[ūúùûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[ñ]/g, 'n')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Main function to get image URL for a nominee
function getNomineeImage(nominee, categoryId, year = '2026') {
    if (nominee.image) return nominee.image;
    
    // Only directing, actor, and actress categories use person images
    // All other categories (writing, cinematography, film-editing, etc.) use movie images
    const isPersonCategory = categoryId.includes('actor') || categoryId.includes('actress') || 
                             categoryId.includes('directing');
    
    // Person categories: use category-specific path
    if (isPersonCategory) {
        const nomineeId = nominee.id;
        return `images/${year}_${categoryId}_${nomineeId}.jpg`;
    }
    
    // Movie categories: use shared movies path
    // For international feature films, use the film field if available
    // For music-song, extract movie name from the song field (format: "from Movie Name;")
    let movieId = nominee.id;
    if (nominee.film && categoryId === 'international-feature') {
        movieId = filmNameToSlug(nominee.film);
    } else if (nominee.song && categoryId === 'music-song') {
        // Extract movie name from song field (format: "from Movie Name; Music...")
        const match = nominee.song.match(/from\s+([^;]+)/i);
        if (match && match[1]) {
            movieId = filmNameToSlug(match[1].trim());
        }
    }
    
    return `images/${year}_movie_${movieId}.jpg`;
}

// Oscars Nominees Data by Year
const nomineesByYear = {
  2026: [
    {
      id: 'best-picture',
      name: 'Best Picture',
      defaultPoints: 10,
      nominees: [
        { id: 'bugonia', name: 'Bugonia', film: 'Bugonia', producers: 'Ed Guiney & Andrew Lowe, Yorgos Lanthimos, Emma Stone and Lars Knudsen, Producers' },
        { id: 'f1', name: 'F1', film: 'F1', producers: 'Chad Oman, Brad Pitt, Dede Gardner, Jeremy Kleiner, Joseph Kosinski and Jerry Bruckheimer, Producers' },
        { id: 'frankenstein', name: 'Frankenstein', film: 'Frankenstein', producers: 'Guillermo del Toro, J. Miles Dale and Scott Stuber, Producers' },
        { id: 'hamnet', name: 'Hamnet', film: 'Hamnet', producers: 'Liza Marshall, Pippa Harris, Nicolas Gonda, Steven Spielberg and Sam Mendes, Producers' },
        { id: 'marty-supreme', name: 'Marty Supreme', film: 'Marty Supreme', producers: 'Eli Bush, Ronald Bronstein, Josh Safdie, Anthony Katagas and Timothée Chalamet, Producers' },
        { id: 'one-battle-after-another', name: 'One Battle after Another', film: 'One Battle after Another', producers: 'Adam Somner, Sara Murphy and Paul Thomas Anderson, Producers' },
        { id: 'the-secret-agent', name: 'The Secret Agent', film: 'The Secret Agent', producers: 'Emilie Lesclaux, Producer' },
        { id: 'sentimental-value', name: 'Sentimental Value', film: 'Sentimental Value', producers: 'Maria Ekerhovd and Andrea Berentsen Ottmar, Producers' },
        { id: 'sinners', name: 'Sinners', film: 'Sinners', producers: 'Zinzi Coogler, Sev Ohanian and Ryan Coogler, Producers' },
        { id: 'train-dreams', name: 'Train Dreams', film: 'Train Dreams', producers: 'Marissa McMahon, Teddy Schwarzman, Will Janowitz, Ashley Schlaifer and Michael Heimler, Producers' }
      ]
    },
    {
      id: 'directing',
      name: 'Directing',
      defaultPoints: 8,
      nominees: [
        { id: 'chloe-zhao', name: 'Chloé Zhao', film: 'Hamnet' },
        { id: 'josh-safdie', name: 'Josh Safdie', film: 'Marty Supreme' },
        { id: 'paul-thomas-anderson', name: 'Paul Thomas Anderson', film: 'One Battle after Another' },
        { id: 'joachim-trier', name: 'Joachim Trier', film: 'Sentimental Value' },
        { id: 'ryan-coogler', name: 'Ryan Coogler', film: 'Sinners' }
      ]
    },
    {
      id: 'actor-leading',
      name: 'Actor in a Leading Role',
      defaultPoints: 5,
      nominees: [
        { id: 'timothee-chalamet', name: 'Timothée Chalamet', film: 'Marty Supreme' },
        { id: 'leonardo-dicaprio', name: 'Leonardo DiCaprio', film: 'One Battle after Another' },
        { id: 'ethan-hawke', name: 'Ethan Hawke', film: 'Blue Moon' },
        { id: 'michael-b-jordan', name: 'Michael B. Jordan', film: 'Sinners' },
        { id: 'wagner-moura', name: 'Wagner Moura', film: 'The Secret Agent' }
      ]
    },
    {
      id: 'actress-leading',
      name: 'Actress in a Leading Role',
      defaultPoints: 5,
      nominees: [
        { id: 'jessie-buckley', name: 'Jessie Buckley', film: 'Hamnet' },
        { id: 'rose-byrne', name: 'Rose Byrne', film: 'If I Had Legs I\'d Kick You' },
        { id: 'kate-hudson', name: 'Kate Hudson', film: 'Song Sung Blue' },
        { id: 'renate-reinsve', name: 'Renate Reinsve', film: 'Sentimental Value' },
        { id: 'emma-stone', name: 'Emma Stone', film: 'Bugonia' }
      ]
    },
    {
      id: 'actor-supporting',
      name: 'Actor in a Supporting Role',
      defaultPoints: 5,
      nominees: [
        { id: 'benicio-del-toro', name: 'Benicio Del Toro', film: 'One Battle after Another' },
        { id: 'jacob-elordi', name: 'Jacob Elordi', film: 'Frankenstein' },
        { id: 'delroy-lindo', name: 'Delroy Lindo', film: 'Sinners' },
        { id: 'sean-penn', name: 'Sean Penn', film: 'One Battle after Another' },
        { id: 'stellan-skarsgard', name: 'Stellan Skarsgård', film: 'Sentimental Value' }
      ]
    },
    {
      id: 'actress-supporting',
      name: 'Actress in a Supporting Role',
      defaultPoints: 5,
      nominees: [
        { id: 'elle-fanning', name: 'Elle Fanning', film: 'Sentimental Value' },
        { id: 'inga-ibsdotter-lilleaas', name: 'Inga Ibsdotter Lilleaas', film: 'Sentimental Value' },
        { id: 'amy-madigan', name: 'Amy Madigan', film: 'Weapons' },
        { id: 'wunmi-mosaku', name: 'Wunmi Mosaku', film: 'Sinners' },
        { id: 'teyana-taylor', name: 'Teyana Taylor', film: 'One Battle after Another' }
      ]
    },
    {
      id: 'writing-original',
      name: 'Writing (Original Screenplay)',
      defaultPoints: 5,
      nominees: [
        { id: 'blue-moon', name: 'Blue Moon', writer: 'Written by Robert Kaplow' },
        { id: 'it-was-just-an-accident', name: 'It Was Just an Accident', writer: 'Written by Jafar Panahi; Script collaborators - Nader Saïvar, Shadmehr Rastin, Mehdi Mahmoudian' },
        { id: 'marty-supreme', name: 'Marty Supreme', writer: 'Written by Ronald Bronstein & Josh Safdie' },
        { id: 'sentimental-value', name: 'Sentimental Value', writer: 'Written by Eskil Vogt, Joachim Trier' },
        { id: 'sinners', name: 'Sinners', writer: 'Written by Ryan Coogler' }
      ]
    },
    {
      id: 'writing-adapted',
      name: 'Writing (Adapted Screenplay)',
      defaultPoints: 5,
      nominees: [
        { id: 'bugonia', name: 'Bugonia', writer: 'Screenplay by Will Tracy' },
        { id: 'frankenstein', name: 'Frankenstein', writer: 'Written for the Screen by Guillermo del Toro' },
        { id: 'hamnet', name: 'Hamnet', writer: 'Screenplay by Chloé Zhao & Maggie O\'Farrell' },
        { id: 'one-battle-after-another', name: 'One Battle after Another', writer: 'Written by Paul Thomas Anderson' },
        { id: 'train-dreams', name: 'Train Dreams', writer: 'Screenplay by Clint Bentley & Greg Kwedar' }
      ]
    },
    {
      id: 'cinematography',
      name: 'Cinematography',
      defaultPoints: 3,
      nominees: [
        { id: 'frankenstein', name: 'Frankenstein', cinematographer: 'Dan Laustsen' },
        { id: 'marty-supreme', name: 'Marty Supreme', cinematographer: 'Darius Khondji' },
        { id: 'one-battle-after-another', name: 'One Battle after Another', cinematographer: 'Michael Bauman' },
        { id: 'sinners', name: 'Sinners', cinematographer: 'Autumn Durald Arkapaw' },
        { id: 'train-dreams', name: 'Train Dreams', cinematographer: 'Adolpho Veloso' }
      ]
    },
    {
      id: 'film-editing',
      name: 'Film Editing',
      defaultPoints: 3,
      nominees: [
        { id: 'f1', name: 'F1', editor: 'Stephen Mirrione' },
        { id: 'marty-supreme', name: 'Marty Supreme', editor: 'Ronald Bronstein and Josh Safdie' },
        { id: 'one-battle-after-another', name: 'One Battle after Another', editor: 'Andy Jurgensen' },
        { id: 'sentimental-value', name: 'Sentimental Value', editor: 'Olivier Bugge Coutté' },
        { id: 'sinners', name: 'Sinners', editor: 'Michael P. Shawver' }
      ]
    },
    {
      id: 'production-design',
      name: 'Production Design',
      defaultPoints: 3,
      nominees: [
        { id: 'frankenstein', name: 'Frankenstein', design: 'Production Design: Tamara Deverell; Set Decoration: Shane Vieau' },
        { id: 'hamnet', name: 'Hamnet', design: 'Production Design: Fiona Crombie; Set Decoration: Alice Felton' },
        { id: 'marty-supreme', name: 'Marty Supreme', design: 'Production Design: Jack Fisk; Set Decoration: Adam Willis' },
        { id: 'one-battle-after-another', name: 'One Battle after Another', design: 'Production Design: Florencia Martin; Set Decoration: Anthony Carlino' },
        { id: 'sinners', name: 'Sinners', design: 'Production Design: Hannah Beachler; Set Decoration: Monique Champagne' }
      ]
    },
    {
      id: 'costume-design',
      name: 'Costume Design',
      defaultPoints: 3,
      nominees: [
        { id: 'avatar-fire-and-ash', name: 'Avatar: Fire and Ash', designer: 'Deborah L. Scott' },
        { id: 'frankenstein', name: 'Frankenstein', designer: 'Kate Hawley' },
        { id: 'hamnet', name: 'Hamnet', designer: 'Malgosia Turzanska' },
        { id: 'marty-supreme', name: 'Marty Supreme', designer: 'Miyako Bellizzi' },
        { id: 'sinners', name: 'Sinners', designer: 'Ruth E. Carter' }
      ]
    },
    {
      id: 'sound',
      name: 'Sound',
      defaultPoints: 3,
      nominees: [
        { id: 'f1', name: 'F1', soundTeam: 'Gareth John, Al Nelson, Gwendolyn Yates Whittle, Gary A. Rizzo and Juan Peralta' },
        { id: 'frankenstein', name: 'Frankenstein', soundTeam: 'Greg Chapman, Nathan Robitaille, Nelson Ferreira, Christian Cooke and Brad Zoern' },
        { id: 'one-battle-after-another', name: 'One Battle after Another', soundTeam: 'José Antonio García, Christopher Scarabosio and Tony Villaflor' },
        { id: 'sinners', name: 'Sinners', soundTeam: 'Chris Welcker, Benjamin A. Burtt, Felipe Pacheco, Brandon Proctor and Steve Boeddeker' },
        { id: 'sirat', name: 'Sirāt', soundTeam: 'Amanda Villavieja, Laia Casanovas and Yasmina Praderas' }
      ]
    },
    {
      id: 'visual-effects',
      name: 'Visual Effects',
      defaultPoints: 3,
      nominees: [
        { id: 'avatar-fire-and-ash', name: 'Avatar: Fire and Ash', effectsTeam: 'Joe Letteri, Richard Baneham, Eric Saindon and Daniel Barrett' },
        { id: 'f1', name: 'F1', effectsTeam: 'Ryan Tudhope, Nicolas Chevallier, Robert Harrington and Keith Dawson' },
        { id: 'jurassic-world-rebirth', name: 'Jurassic World Rebirth', effectsTeam: 'David Vickery, Stephen Aplin, Charmaine Chan and Neil Corbould' },
        { id: 'the-lost-bus', name: 'The Lost Bus', effectsTeam: 'Charlie Noble, David Zaretti, Russell Bowen and Brandon K. McLaughlin' },
        { id: 'sinners', name: 'Sinners', effectsTeam: 'Michael Ralla, Espen Nordahl, Guido Wolter and Donnie Dean' }
      ]
    },
    {
      id: 'makeup-hairstyling',
      name: 'Makeup and Hairstyling',
      defaultPoints: 3,
      nominees: [
        { id: 'frankenstein', name: 'Frankenstein', makeupTeam: 'Mike Hill, Jordan Samuel and Cliona Furey' },
        { id: 'kokuho', name: 'Kokuho', makeupTeam: 'Kyoko Toyokawa, Naomi Hibino and Tadashi Nishimatsu' },
        { id: 'sinners', name: 'Sinners', makeupTeam: 'Ken Diaz, Mike Fontaine and Shunika Terry' },
        { id: 'the-smashing-machine', name: 'The Smashing Machine', makeupTeam: 'Kazu Hiro, Glen Griffin and Bjoern Rehbein' },
        { id: 'the-ugly-stepsister', name: 'The Ugly Stepsister', makeupTeam: 'Thomas Foldberg and Anne Cathrine Sauerberg' }
      ]
    },
    {
      id: 'music-score',
      name: 'Music (Original Score)',
      defaultPoints: 3,
      nominees: [
        { id: 'bugonia', name: 'Bugonia', composer: 'Jerskin Fendrix' },
        { id: 'frankenstein', name: 'Frankenstein', composer: 'Alexandre Desplat' },
        { id: 'hamnet', name: 'Hamnet', composer: 'Max Richter' },
        { id: 'one-battle-after-another', name: 'One Battle after Another', composer: 'Jonny Greenwood' },
        { id: 'sinners', name: 'Sinners', composer: 'Ludwig Goransson' }
      ]
    },
    {
      id: 'music-song',
      name: 'Music (Original Song)',
      defaultPoints: 3,
      nominees: [
        { id: 'dear-me', name: 'Dear Me', song: 'from Diane Warren: Relentless; Music and Lyric by Diane Warren' },
        { id: 'golden', name: 'Golden', song: 'from KPop Demon Hunters; Music and Lyric by EJAE, Mark Sonnenblick, Joong Gyu Kwak, Yu Han Lee, Hee Dong Nam, Jeong Hoon Seo and Teddy Park' },
        { id: 'i-lied-to-you', name: 'I Lied To You', song: 'from Sinners; Music and Lyric by Raphael Saadiq and Ludwig Goransson' },
        { id: 'sweet-dreams-of-joy', name: 'Sweet Dreams Of Joy', song: 'from Viva Verdi!; Music and Lyric by Nicholas Pike' },
        { id: 'train-dreams-song', name: 'Train Dreams', song: 'from Train Dreams; Music by Nick Cave and Bryce Dessner; Lyric by Nick Cave' }
      ]
    },
    {
      id: 'casting',
      name: 'Casting',
      defaultPoints: 3,
      nominees: [
        { id: 'hamnet', name: 'Hamnet', castingDirector: 'Nina Gold' },
        { id: 'marty-supreme', name: 'Marty Supreme', castingDirector: 'Jennifer Venditti' },
        { id: 'one-battle-after-another', name: 'One Battle after Another', castingDirector: 'Cassandra Kulukundis' },
        { id: 'the-secret-agent', name: 'The Secret Agent', castingDirector: 'Gabriel Domingues' },
        { id: 'sinners', name: 'Sinners', castingDirector: 'Francine Maisler' }
      ]
    },
    {
      id: 'animated-feature',
      name: 'Animated Feature Film',
      defaultPoints: 2,
      nominees: [
        { id: 'arco', name: 'Arco', producers: 'Ugo Bienvenu, Félix de Givry, Sophie Mas and Natalie Portman' },
        { id: 'elio', name: 'Elio', producers: 'Madeline Sharafian, Domee Shi, Adrian Molina and Mary Alice Drumm' },
        { id: 'kpop-demon-hunters', name: 'KPop Demon Hunters', producers: 'Maggie Kang, Chris Appelhans and Michelle L.M. Wong' },
        { id: 'little-amelie', name: 'Little Amélie or the Character of Rain', producers: 'Maïlys Vallade, Liane-Cho Han, Nidia Santiago and Henri Magalon' },
        { id: 'zootopia-2', name: 'Zootopia 2', producers: 'Jared Bush, Byron Howard and Yvett Merino' }
      ]
    },
    {
      id: 'international-feature',
      name: 'International Feature Film',
      defaultPoints: 2,
      nominees: [
        { id: 'brazil-secret-agent', name: 'Brazil - The Secret Agent', film: 'The Secret Agent' },
        { id: 'france-accident', name: 'France - It Was Just an Accident', film: 'It Was Just an Accident' },
        { id: 'norway-sentimental', name: 'Norway - Sentimental Value', film: 'Sentimental Value' },
        { id: 'spain-sirat', name: 'Spain - Sirāt', film: 'Sirāt' },
        { id: 'tunisia-voice', name: 'Tunisia - The Voice of Hind Rajab', film: 'The Voice of Hind Rajab' }
      ]
    },
    {
      id: 'documentary-feature',
      name: 'Documentary Feature Film',
      defaultPoints: 2,
      nominees: [
        { id: 'alabama-solution', name: 'The Alabama Solution', producers: 'Andrew Jarecki and Charlotte Kaufman' },
        { id: 'come-see-me', name: 'Come See Me in the Good Light', producers: 'Ryan White, Jessica Hargrave, Tig Notaro and Stef Willen' },
        { id: 'cutting-through-rocks', name: 'Cutting through Rocks', producers: 'Sara Khaki and Mohammadreza Eyni' },
        { id: 'mr-nobody', name: 'Mr. Nobody against Putin', producers: 'Nominees to be determined' },
        { id: 'perfect-neighbor', name: 'The Perfect Neighbor', producers: 'Geeta Gandbhir, Alisa Payne, Nikon Kwantu and Sam Bisbee' }
      ]
    },
    {
      id: 'animated-short',
      name: 'Animated Short Film',
      defaultPoints: 2,
      nominees: [
        { id: 'butterfly', name: 'Butterfly', producers: 'Florence Miailhe and Ron Dyens' },
        { id: 'forevergreen', name: 'Forevergreen', producers: 'Nathan Engelhardt and Jeremy Spears' },
        { id: 'girl-who-cried-pearls', name: 'The Girl Who Cried Pearls', producers: 'Chris Lavis and Maciek Szczerbowski' },
        { id: 'retirement-plan', name: 'Retirement Plan', producers: 'John Kelly and Andrew Freedman' },
        { id: 'three-sisters', name: 'The Three Sisters', producers: 'Konstantin Bronzit' }
      ]
    },
    {
      id: 'documentary-short',
      name: 'Documentary Short Film',
      defaultPoints: 2,
      nominees: [
        { id: 'all-empty-rooms', name: 'All the Empty Rooms', producers: 'Joshua Seftel and Conall Jones' },
        { id: 'armed-camera', name: 'Armed Only with a Camera: The Life and Death of Brent Renaud', producers: 'Craig Renaud and Juan Arredondo' },
        { id: 'children-no-more', name: 'Children No More: "Were and Are Gone"', producers: 'Hilla Medalia and Sheila Nevins' },
        { id: 'devil-is-busy', name: 'The Devil Is Busy', producers: 'Christalyn Hampton and Geeta Gandbhir' },
        { id: 'perfectly-strangeness', name: 'Perfectly a Strangeness', producers: 'Alison McAlpine' }
      ]
    },
    {
      id: 'live-action-short',
      name: 'Live Action Short Film',
      defaultPoints: 2,
      nominees: [
        { id: 'butchers-stain', name: 'Butcher\'s Stain', producers: 'Meyer Levinson-Blount and Oron Caspi' },
        { id: 'friend-of-dorothy', name: 'A Friend of Dorothy', producers: 'Lee Knight and James Dean' },
        { id: 'jane-austen-period', name: 'Jane Austen\'s Period Drama', producers: 'Julia Aks and Steve Pinder' },
        { id: 'singers', name: 'The Singers', producers: 'Sam A. Davis and Jack Piatt' },
        { id: 'two-people-saliva', name: 'Two People Exchanging Saliva', producers: 'Alexandre Singh and Natalie Musteata' }
      ]
    }
  ]
};

// Export for Node.js (for scraping script)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { nomineesByYear };
}
