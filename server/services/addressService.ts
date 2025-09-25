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
      const url = `${this.apiUrl}?q=${encodeURIComponent(query)}&limit=${limit}`;
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
    const mockAddresses = [
      "123 Queen Street, Auckland Central, Auckland 1010",
      "456 George Street, Dunedin Central, Dunedin 9016", 
      "789 Lambton Quay, Wellington Central, Wellington 6011",
      "321 Manchester Street, Christchurch Central, Christchurch 8011",
      "654 Devon Street East, New Plymouth Central, New Plymouth 4310",
      "987 Princes Street, Dunedin Central, Dunedin 9016",
      "147 Victoria Street, Hamilton Central, Hamilton 3204",
      "258 High Street, Christchurch Central, Christchurch 8011",
      "369 Karangahape Road, Auckland Central, Auckland 1010",
      "741 Cuba Street, Wellington Central, Wellington 6011",
      "852 Cashel Street, Christchurch Central, Christchurch 8011",
      "963 Tauranga Road, Mount Maunganui, Tauranga 3116"
    ];

    return mockAddresses
      .filter(addr => addr.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
      .map((addr, index) => ({
        a: addr,
        pxid: `mock-${index}-${Date.now()}`,
        v: 1
      }));
  }
}

export const addressService = new AddressService();