export function buildWhatsAppChatUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildNetflixSearchUrl(query: string): string {
  return `https://www.netflix.com/search?q=${encodeURIComponent(query.trim())}`;
}
