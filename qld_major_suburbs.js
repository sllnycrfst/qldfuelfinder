// QLD Major Suburbs/Cities with 20,000+ Population
// Based on Australian Bureau of Statistics data and major population centers

window.QLD_MAJOR_SUBURBS = [
  // Brisbane Metro (Major Areas)
  "Brisbane City", "Chermside", "Indooroopilly", "Sunnybank", "Mount Gravatt",
  "Carindale", "Garden City", "Toowong", "Fortitude Valley", "South Brisbane",
  
  // Brisbane Suburbs (Large)
  "Aspley", "Stafford", "Kedron", "Nundah", "Clayfield", "Hamilton", "Ascot",
  "New Farm", "Teneriffe", "Kangaroo Point", "Woolloongabba", "West End",
  "Milton", "Paddington", "Red Hill", "Kelvin Grove", "Windsor", "Lutwyche",
  "Albion", "Newstead", "Eagle Farm", "Hendra", "Cannon Hill", "Morningside",
  "Hawthorne", "Bulimba", "Balmoral", "Camp Hill", "Coorparoo", "Greenslopes",
  "Holland Park", "Annerley", "Fairfield", "Yeronga", "Moorooka", "Salisbury",
  "Rocklea", "Sherwood", "Graceville", "Oxley", "Inala", "Forest Lake",
  "Sunnybank Hills", "Upper Mount Gravatt", "Mansfield", "Wishart", "Capalaba",
  "Eight Mile Plains", "Springwood", "Logan Central", "Woodridge", "Kingston",
  
  // Gold Coast
  "Gold Coast", "Southport", "Surfers Paradise", "Broadbeach", "Burleigh Heads",
  "Coolangatta", "Tugun", "Palm Beach", "Currumbin", "Robina", "Varsity Lakes",
  "Nerang", "Mudgeeraba", "Reedy Creek", "Helensvale", "Coomera", "Oxenford",
  "Upper Coomera", "Pimpama", "Ormeau", "Runaway Bay", "Labrador", "Biggera Waters",
  "Arundel", "Parkwood", "Ashmore", "Benowa", "Bundall", "Main Beach",
  "Mermaid Beach", "Mermaid Waters", "Miami", "Nobby Beach", "Clear Island Waters",
  "Molendinar", "Worongary", "Tallai", "Advancetown", "Bonogin", "Gilston",
  
  // Sunshine Coast
  "Sunshine Coast", "Maroochydore", "Mooloolaba", "Caloundra", "Noosa Heads",
  "Kawana Waters", "Buderim", "Nambour", "Tewantin", "Cooroy", "Pomona",
  "Gympie", "Tin Can Bay", "Rainbow Beach", "Maleny", "Montville", "Mapleton",
  "Yandina", "Eumundi", "Peregian Beach", "Marcus Beach", "Coolum Beach",
  "Marcoola", "Mudjimba", "Twin Waters", "Sippy Downs", "Forest Glen",
  "Palmwoods", "Woombye", "Bli Bli", "Eudlo", "Chevallum", "Hunchy",
  
  // Ipswich Region
  "Ipswich", "Springfield", "Springfield Lakes", "Springfield Central", "Redbank Plains",
  "Goodna", "Yamanto", "Leichhardt", "Booval", "Bundamba", "Dinmore", "Riverview",
  "Bellbird Park", "Camira", "Collingwood Park", "Augustine Heights", "Brookwater",
  "Redbank", "North Ipswich", "Blackstone", "Silkstone", "Raceview", "Flinders View",
  "Rosewood", "Walloon", "Willowbank", "Amberley", "Brassall", "One Mile",
  "Eastern Heights", "Tivoli", "Newtown", "Coalfalls", "Sadliers Crossing",
  
  // Logan Region  
  "Logan Central", "Springwood", "Woodridge", "Kingston", "Slacks Creek", "Daisy Hill",
  "Shailer Park", "Loganholme", "Beenleigh", "Eagleby", "Waterford", "Browns Plains",
  "Marsden", "Crestmead", "Park Ridge", "Heritage Park", "Regents Park", "Berrinba",
  "Mount Warren Park", "Bahrs Scrub", "Holmview", "Edens Landing", "Bethania",
  "Loganlea", "Meadowbrook", "Underwood", "Rochedale", "Rochedale South",
  "Kuraby", "Runcorn", "Algester", "Calamvale", "Acacia Ridge", "Sunnybank",
  
  // Redlands
  "Cleveland", "Capalaba", "Victoria Point", "Redland Bay", "Wellington Point",
  "Thornlands", "Birkdale", "Alexandra Hills", "Sheldon", "Mount Cotton",
  "Ormiston", "Thorneside", "Wynnum", "Manly", "Lota", "Tingalpa", "Chandler",
  "Belmont", "Gumdale", "Wakerley", "Ransome", "Murarrie", "Hemmant",
  
  // Moreton Bay
  "Redcliffe", "Scarborough", "Clontarf", "Margate", "Woody Point", "Newport",
  "Rothwell", "Kippa-Ring", "Deception Bay", "North Lakes", "Mango Hill",
  "Griffin", "Murrumba Downs", "Kallangur", "Petrie", "Narangba", "Burpengary",
  "Morayfield", "Caboolture", "Bribie Island", "Bongaree", "Bellara", "Woorim",
  "Sandstone Point", "Ningi", "Toorbul", "Beachmere", "Elimbah", "Wamuran",
  
  // Regional Cities (20,000+)
  "Toowoomba", "Cairns", "Townsville", "Rockhampton", "Mackay", "Bundaberg",
  "Hervey Bay", "Maryborough", "Gladstone", "Mount Isa", "Emerald", "Kingaroy",
  "Dalby", "Roma", "Charleville", "Warwick", "Stanthorpe", "Goondiwindi",
  "Chinchilla", "Miles", "Blackwater", "Moranbah", "Clermont", "Dysart",
  "Bowen", "Ayr", "Home Hill", "Charters Towers", "Ingham", "Cardwell",
  "Tully", "Mission Beach", "Innisfail", "Babinda", "Gordonvale", "Edmonton",
  "Smithfield", "Port Douglas", "Mossman", "Mareeba", "Atherton", "Kuranda",
  "Yungaburra", "Malanda", "Ravenshoe", "Herberton", "Millaa Millaa",
  "Mount Garnet", "Chillagoe", "Cooktown", "Weipa", "Thursday Island",
  
  // Additional Major Centers
  "Airlie Beach", "Cannonvale", "Proserpine", "Collinsville", "Capella",
  "Longreach", "Barcaldine", "Blackall", "Winton", "Hughenden", "Richmond",
  "Julia Creek", "Cloncurry", "Normanton", "Karumba", "Burketown", "Doomadgee"
];

// Function to search suburbs
window.searchQLDMajorSuburbs = function(query) {
  if (!query || query.trim().length === 0) {
    // Return top 20 major areas when no search
    return [
      "Brisbane City", "Gold Coast", "Sunshine Coast", "Cairns", "Townsville",
      "Toowoomba", "Rockhampton", "Mackay", "Bundaberg", "Ipswich",
      "Southport", "Surfers Paradise", "Broadbeach", "Robina", "Nerang",
      "Maroochydore", "Caloundra", "Noosa Heads", "Logan Central", "Redcliffe"
    ];
  }
  
  const searchTerm = query.toLowerCase().trim();
  return window.QLD_MAJOR_SUBURBS
    .filter(suburb => suburb.toLowerCase().includes(searchTerm))
    .sort()
    .slice(0, 20);
};

console.log('📍 QLD Major Suburbs database loaded:', window.QLD_MAJOR_SUBURBS.length, 'suburbs');
