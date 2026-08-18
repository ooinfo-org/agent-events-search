export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
  /** Visita URL e retorna texto da página. Implementado onde JS rendering é necessário. */
  visitPage?(url: string): Promise<string>;
}
