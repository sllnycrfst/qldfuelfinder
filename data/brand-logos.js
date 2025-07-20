// Brand logo map markers as circular SVG icons with diagonal stripe patterns
export const BRAND_LOGOS = {
  // Caltex (ID: 2) - Red with white stripes and blue accents
  2: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='caltex-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(45)'%3E%3Crect width='40' height='25' fill='%23DC2626'/%3E%3Crect y='25' width='40' height='5' fill='white'/%3E%3Crect y='30' width='40' height='10' fill='%231E40AF'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23caltex-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // BP (ID: 5) - Green with yellow and white stripes
  5: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='bp-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(30)'%3E%3Crect width='40' height='15' fill='%2300A651'/%3E%3Crect y='15' width='40' height='10' fill='%23FFE500'/%3E%3Crect y='25' width='40' height='5' fill='white'/%3E%3Crect y='30' width='40' height='10' fill='%237CB342'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23bp-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Mobil (ID: 16) - Blue with red and white stripes
  16: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='mobil-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(35)'%3E%3Crect width='40' height='20' fill='%231E3A8A'/%3E%3Crect y='20' width='40' height='10' fill='white'/%3E%3Crect y='30' width='40' height='10' fill='%23DC2626'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23mobil-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Shell (ID: 20) - Yellow dominant with red stripes
  20: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='shell-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(45)'%3E%3Crect width='40' height='25' fill='%23FFD500'/%3E%3Crect y='25' width='40' height='15' fill='%23E31E24'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23shell-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // United (ID: 23) - Blue with red and white stripes
  23: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='united-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(25)'%3E%3Crect width='40' height='20' fill='%231E40AF'/%3E%3Crect y='20' width='40' height='5' fill='white'/%3E%3Crect y='25' width='40' height='15' fill='%23DC2626'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23united-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Metro (ID: 57) - Purple with white stripes
  57: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='metro-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(60)'%3E%3Crect width='40' height='30' fill='%237B3F99'/%3E%3Crect y='30' width='40' height='5' fill='white'/%3E%3Crect y='35' width='40' height='5' fill='%236A2B8C'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23metro-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Gull (ID: 72) - Blue with yellow stripes
  72: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='gull-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(60)'%3E%3Crect width='40' height='20' fill='%232563EB'/%3E%3Crect y='20' width='40' height='5' fill='white'/%3E%3Crect y='25' width='40' height='15' fill='%23FCD34D'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23gull-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Liberty (ID: 86) - Blue with white stripes
  86: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='liberty-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(45)'%3E%3Crect width='40' height='30' fill='%230066CC'/%3E%3Crect y='30' width='40' height='5' fill='white'/%3E%3Crect y='35' width='40' height='5' fill='%23004499'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23liberty-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Freedom Fuels (ID: 110) - Red and blue diagonal
  110: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='freedom-pattern' patternUnits='userSpaceOnUse' width='50' height='50' patternTransform='rotate(45)'%3E%3Crect width='50' height='25' fill='%23DC2626'/%3E%3Crect y='25' width='50' height='25' fill='%231E40AF'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23freedom-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Coles Express (ID: 111) - Red dominant with yellow accent
  111: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='coles-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(45)'%3E%3Crect width='40' height='30' fill='%23DC2626'/%3E%3Crect y='30' width='40' height='5' fill='white'/%3E%3Crect y='35' width='40' height='5' fill='%23FCD34D'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23coles-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // 7-Eleven (ID: 113) - Orange/red with green and white
  113: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='seven-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(-30)'%3E%3Crect width='40' height='15' fill='%23E31E24'/%3E%3Crect y='15' width='40' height='5' fill='white'/%3E%3Crect y='20' width='40' height='15' fill='%23FF6B35'/%3E%3Crect y='35' width='40' height='5' fill='%2300A651'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23seven-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Astron (ID: 114) - Blue with red triangle pattern
  114: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='astron-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(30)'%3E%3Crect width='40' height='25' fill='%23003DA5'/%3E%3Crect y='25' width='40' height='5' fill='white'/%3E%3Crect y='30' width='40' height='10' fill='%23DC2626'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23astron-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // OTR (ID: 169) - Black with yellow stripes
  169: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='otr-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(0)'%3E%3Crect width='40' height='30' fill='%231F2937'/%3E%3Crect y='30' width='40' height='10' fill='%23FCD34D'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23otr-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Puma Energy (ID: 5094) - Red with green and white
  5094: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='puma-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(-45)'%3E%3Crect width='40' height='25' fill='%23DC2626'/%3E%3Crect y='25' width='40' height='5' fill='white'/%3E%3Crect y='30' width='40' height='10' fill='%23059669'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23puma-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Costco (ID: 2031031) - Blue with red accent
  2031031: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='costco-pattern' patternUnits='userSpaceOnUse' width='50' height='50' patternTransform='rotate(20)'%3E%3Crect width='50' height='35' fill='%231E40AF'/%3E%3Crect y='35' width='50' height='5' fill='white'/%3E%3Crect y='40' width='50' height='10' fill='%23DC2626'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23costco-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Pacific Petroleum (ID: 2418994) - Blue with yellow droplet
  2418994: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='pacific-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(60)'%3E%3Crect width='40' height='30' fill='%2300529F'/%3E%3Crect y='30' width='40' height='5' fill='white'/%3E%3Crect y='35' width='40' height='5' fill='%23FCD34D'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23pacific-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Ampol (ID: 3421066) - Red with blue accent
  3421066: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='ampol-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(30)'%3E%3Crect width='40' height='20' fill='%23DC2626'/%3E%3Crect y='20' width='40' height='5' fill='white'/%3E%3Crect y='25' width='40' height='15' fill='%231E40AF'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23ampol-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // EG Ampol (ID: 3421073) - Green with red stripes
  3421073: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='eg-ampol-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(45)'%3E%3Crect width='40' height='20' fill='%2384CC16'/%3E%3Crect y='20' width='40' height='5' fill='white'/%3E%3Crect y='25' width='40' height='15' fill='%23DC2626'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23eg-ampol-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Pearl Energy (ID: 3421139) - Teal with white circle
  3421139: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='pearl-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(60)'%3E%3Crect width='40' height='20' fill='%2300A19C'/%3E%3Crect y='20' width='40' height='5' fill='white'/%3E%3Crect y='25' width='40' height='15' fill='%23008B87'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23pearl-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Pacific Fuel Solutions (ID: 3421162) - Blue with yellow
  3421162: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='pacific-fuel-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(60)'%3E%3Crect width='40' height='30' fill='%232563EB'/%3E%3Crect y='30' width='40' height='5' fill='white'/%3E%3Crect y='35' width='40' height='5' fill='%23FCD34D'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23pacific-fuel-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // U-Go (ID: 3421183) - Orange with white
  3421183: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='ugo-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(30)'%3E%3Crect width='40' height='30' fill='%23EA580C'/%3E%3Crect y='30' width='40' height='5' fill='white'/%3E%3Crect y='35' width='40' height='5' fill='%23FB923C'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23ugo-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Reddy Express (ID: 3421193) - Red with white stripes
  3421193: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='reddy-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(45)'%3E%3Crect width='40' height='30' fill='%23DC2626'/%3E%3Crect y='30' width='40' height='5' fill='white'/%3E%3Crect y='35' width='40' height='5' fill='%23B91C1C'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23reddy-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Atlas Fuel (ID: 3421202) - Green with white circle
  3421202: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='atlas-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(30)'%3E%3Crect width='40' height='30' fill='%23059669'/%3E%3Crect y='30' width='40' height='5' fill='white'/%3E%3Crect y='35' width='40' height='5' fill='%2334D399'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23atlas-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  
  // Default - Gray with diagonal stripes
  0: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='default-pattern' patternUnits='userSpaceOnUse' width='40' height='40' patternTransform='rotate(45)'%3E%3Crect width='40' height='20' fill='%23808080'/%3E%3Crect y='20' width='40' height='5' fill='white'/%3E%3Crect y='25' width='40' height='15' fill='%23666666'/%3E%3C/pattern%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='45' fill='url(%23default-pattern)' stroke='white' stroke-width='2'/%3E%3C/svg%3E"
};

// Helper function to get marker by brand ID
export const getMarkerIcon = (brandId) => {
  return BRAND_LOGOS[brandId] || BRAND_LOGOS[0];
};

// Marker size constants for different map zoom levels
export const MARKER_SIZES = {
  small: { width: 24, height: 24 },
  medium: { width: 32, height: 32 },
  large: { width: 40, height: 40 }
};
