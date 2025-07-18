document.addEventListener(“DOMContentLoaded”, () => {
console.log(“Script starting…”);

// Apple Maps token
const APPLE_MAPS_TOKEN = “eyJraWQiOiJHRzdDODlGSlQ5IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyNzE2NDEyLCJleHAiOjE3NTMzNDAzOTl9.kR2EAjIdFvID72QaCY2zMFIAp7jJqhUit4w0s6z5P67WEvTcDw6wlbF8fbtOcRHwzIYvyQL15zaZRGbADLJ16g”;

// Initialize Apple Maps
mapkit.init({
authorizationCallback: function(done) {
done(APPLE_MAPS_TOKEN);
}
});

// Create map
const region = new mapkit.CoordinateRegion(
new mapkit.Coordinate(-27.4698, 153.0251), // Brisbane
new mapkit.CoordinateSpan(0.1, 0.1)
);

const myMap = new mapkit.Map(“apple-map”, {
region: region,
showsCompass: mapkit.FeatureVisibility.Visible,
showsScale: mapkit.FeatureVisibility.Hidden,
showsMapTypeControl: false,
showsZoomControl: false,
showsUserLocationControl: true
});

console.log(“Map created successfully”);

// Basic toolbar functionality
const searchBtn = document.getElementById(‘toolbar-search-btn’);
const listBtn = document.getElementById(‘toolbar-list-btn’);
const mapBtn = document.getElementById(‘toolbar-map-btn’);

if (searchBtn) {
searchBtn.onclick = () => {
console.log(“Search button clicked”);
alert(“Search button works!”);
};
}

if (listBtn) {
listBtn.onclick = () => {
console.log(“List button clicked”);
alert(“List button works!”);
};
}

if (mapBtn) {
mapBtn.onclick = () => {
console.log(“Map button clicked”);
alert(“Map button works!”);
};
}

console.log(“Script loaded successfully”);
});