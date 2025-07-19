// Brand logo file mappings for actual PNG files in /images/ directory
export const BRAND_LOGO_FILES = {
  // BP
  5: 'images/2.png',
  
  // Puma
  5094: 'images/5.png',
  
  // Costco
  2031031: 'images/12.png',
  
  // Speedway
  167: 'images/16.png',
  
  // Coles/Woolworths
  111: 'images/20.png',
  
  // Additional brands
  86: 'images/23.png',   // Liberty
  65: 'images/26.png',   // Petrogas
  
  // 7-Eleven
  113: 'images/57.png',
  
  // Metro
  57: 'images/86.png',
  
  // Caltex/Ampol
  2: 'images/110.png',
  3421066: 'images/110.png', // Ampol
  
  // United
  23: 'images/111.png',
  
  // Freedom
  110: 'images/113.png',
  
  // Pacific
  2418994: 'images/114.png',
  3421162: 'images/114.png', // Pacific Fuel
  
  // Pearl
  3421139: 'images/169.png',
  
  // Pacific (additional)
  2418995: 'images/2418994.png', // Vibe
  
  // Enhance
  2419037: 'images/2419037.png',
  
  // Additional PNG files based on your BRAND_NAMES
  3421028: 'images/3421028.png', // X Convenience
  3421073: 'images/3421073.png', // EG Ampol
  3421183: 'images/3421183.png', // U-Go
  3421193: 'images/3421193.png', // Reddy Express (Shell Reddy)
  3421202: 'images/3421202.png', // Atlas
  
  // Shell (main)
  20: 'images/5094.png',
  
  // Default fallback
  0: 'images/default.png'
};

// Helper function to get brand logo file path
export const getBrandLogoFile = (brandId) => {
  return BRAND_LOGO_FILES[brandId] || BRAND_LOGO_FILES[0];
};

// Helper function to get brand name with logo
export const getBrandWithLogo = (brandId, brandName) => {
  const logoPath = getBrandLogoFile(brandId);
  return {
    name: brandName || 'Independent',
    logo: logoPath,
    hasLogo: BRAND_LOGO_FILES.hasOwnProperty(brandId)
  };
};
