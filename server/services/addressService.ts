interface AddySuggestion {
  a: string; // Full address
  pxid: string; // Unique ID
  v: number; // Version
}

interface AddressSearchResponse {
  addresses: AddySuggestion[];
}

class AddressService {
  private readonly apiKey?: string;
  private readonly apiUrl = "https://api.addy.co.nz/address";
  
  constructor() {
    // In production, get API key from environment variable
    this.apiKey = process.env.ADDY_API_KEY;
  }

  async searchAddresses(query: string, limit: number = 8): Promise<AddySuggestion[]> {
    if (query.length < 3) {
      return [];
    }

    try {
      // Filter to Gisborne region only using territory parameter
      const url = `${this.apiUrl}?q=${encodeURIComponent(query)}&limit=${limit}&territory=Gisborne`;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      // Add API key if available
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, { headers });

      if (response.ok) {
        const data: AddressSearchResponse = await response.json();
        return data.addresses || [];
      } else {
        console.warn(`Addy.co.nz API returned ${response.status}: ${response.statusText}`);
        return this.generateMockSuggestions(query);
      }
    } catch (error) {
      console.warn('Address API unavailable, using mock data:', error);
      return this.generateMockSuggestions(query);
    }
  }

  private generateMockSuggestions(query: string): AddySuggestion[] {
    console.log(`[Mock Data Debug] Query: "${query}"`);
    // Gisborne addresses only (filtered to match territory restriction)
    const mockAddresses = [
      // Gisborne Central addresses
      "1 Gladstone Road, Gisborne Central, Gisborne 4010",
      "20 Gladstone Road, Gisborne Central, Gisborne 4010",
      "67 Gladstone Road, Gisborne Central, Gisborne 4010",
      "123 Gladstone Road, Gisborne Central, Gisborne 4010",
      "200 Gladstone Road, Gisborne Central, Gisborne 4010",
      
      // Grey Street
      "1 Grey Street, Gisborne Central, Gisborne 4010",
      "20 Grey Street, Gisborne Central, Gisborne 4010",
      "45 Grey Street, Gisborne Central, Gisborne 4010",
      "67 Grey Street, Gisborne Central, Gisborne 4010",
      
      // Peel Street
      "1 Peel Street, Gisborne Central, Gisborne 4010",
      "20 Peel Street, Gisborne Central, Gisborne 4010",
      "45 Peel Street, Gisborne Central, Gisborne 4010",
      
      // Ormond Road
      "1 Ormond Road, Gisborne, Gisborne 4010",
      "50 Ormond Road, Gisborne, Gisborne 4010",
      "100 Ormond Road, Whataupoko, Gisborne 4010",
      "200 Ormond Road, Whataupoko, Gisborne 4010",
      
      // Stout Street
      "1 Stout Street, Gisborne Central, Gisborne 4010",
      "20 Stout Street, Gisborne Central, Gisborne 4010",
      
      // Childers Road
      "1 Childers Road, Gisborne Central, Gisborne 4010",
      "50 Childers Road, Gisborne Central, Gisborne 4010",
      "100 Childers Road, Mangapapa, Gisborne 4010",
      
      // Lytton Road
      "1 Lytton Road, Gisborne Central, Gisborne 4010",
      "50 Lytton Road, Gisborne, Gisborne 4010",
      "100 Lytton Road, Gisborne, Gisborne 4010",
      
      // Wainui Road
      "1 Wainui Road, Gisborne, Gisborne 4010",
      "100 Wainui Road, Okitu, Gisborne 4010",
      "500 Wainui Road, Wainui, Gisborne 4010",
      
      // Rutene Road  
      "1 Rutene Road, Kaiti, Gisborne 4010",
      "50 Rutene Road, Kaiti, Gisborne 4010",
      "100 Rutene Road, Kaiti, Gisborne 4010",
      
      // Main Road variations
      "1 Main Road, Makaraka, Gisborne 4010",
      "20 Main Road, Makaraka, Gisborne 4010",
      
      // Aberdeen Road
      "1 Aberdeen Road, Gisborne, Gisborne 4010",
      "20 Aberdeen Road, Gisborne, Gisborne 4010",
      "50 Aberdeen Road, Gisborne, Gisborne 4010"
    ];

    const filtered = mockAddresses.filter(addr => addr.toLowerCase().includes(query.toLowerCase()));
    console.log(`[Mock Data Debug] Found ${filtered.length} matches for "${query}"`);
    console.log(`[Mock Data Debug] Matches:`, filtered.slice(0, 3));
    
    return filtered
      .slice(0, 8)
      .map((addr, index) => ({
        a: addr,
        pxid: `mock-${index}-${Date.now()}`,
        v: 1
      }));
  }
}

export const addressService = new AddressService();