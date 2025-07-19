// Brand logo file mappings for actual PNG files in /images/ directory
export const BRAND_LOGO_FILES = {
  // Caltex/Ampol
  2: 'images/110.png',
  3421066: 'images/110.png', // Ampol
  
  // BP
  5: 'images/2.png',
  
  // Shell
  20: 'images/5094.png',
  
  // 7-Eleven
  113: 'images/57.png',
  
  // Puma
  5094: 'images/5.png',
  
  // Metro
  57: 'images/86.png',
  
  // United
  23: 'images/111.png',
  
  // Freedom
  110: 'images/113.png',
  
  // Pacific
  2418994: 'images/114.png',
  3421162: 'images/114.png', // Pacific Fuel
  
  // Pearl
  3421139: 'images/169.png',
  
  // Costco
  2031031: 'images/12.png',
  
  // Speedway
  167: 'images/16.png',
  
  // Woolworths/Coles
  111: 'images/20.png', // Coles
  
  // Additional brands based on your files
  86: 'images/23.png',   // Liberty
  65: 'images/26.png',   // Petrogas
  
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
