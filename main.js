// City Era Timelapse 1945-2055
// Main JavaScript file for Three.js scene

let scene, camera, renderer, clock;
let timelineSlider, selectedYearSpan, eraDescription;
let currentEra = 0;
const eras = [1945, 1965, 1985, 2005, 2025, 2055];

// Scene objects
let buildings = [];
let vehicles = [];
let pedestrians = [];
let storefronts = [];
let advertisements = [];

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 50, 100);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    // Create clock for animations
    clock = new THREE.Clock();
    
    // Add lighting
    addLighting();
    
    // Add ground
    addGround();
    
    // Add initial city block (1945 era)
    addCityBlock(currentEra);
    
    // Add timeline event listeners
    setupTimelineControls();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Start animation loop
    animate();
}

// Add lighting to the scene
function addLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);
    
    // Hemisphere light for sky/ground
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x323232, 0.5);
    scene.add(hemisphereLight);
}

// Add ground plane
function addGround() {
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x228b22, // Forest green for grass
        roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    scene.add(ground);
    
    // Add road
    const roadGeometry = new THREE.PlaneGeometry(200, 40);
    const roadMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x404040, // Dark gray for asphalt
        roughness: 0.9
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    scene.add(road);
}

// Add city block based on era
function addCityBlock(eraIndex) {
    // Clear previous objects
    clearSceneObjects();
    
    const era = eras[eraIndex];
    updateUI(era);
    
    // Add buildings based on era
    addBuildings(era);
    
    // Add vehicles based on era
    addVehicles(era);
    
    // Add pedestrians based on era
    addPedestrians(era);
    
    // Add storefronts based on era
    addStorefronts(era);
    
    // Add advertisements based on era
    addAdvertisements(era);
}

// Clear objects from previous era
function clearSceneObjects() {
    // Dispose of geometries and materials
    buildings.forEach(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    });
    
    vehicles.forEach(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    });
    
    pedestrians.forEach(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    });
    
    storefronts.forEach(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    });
    
    advertisements.forEach(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    });
    
    // Clear arrays
    buildings = [];
    vehicles = [];
    pedestrians = [];
    storefronts = [];
    advertisements = [];
}

// Add buildings based on era
function addBuildings(era) {
    const buildingHeight = getBuildingHeightForEra(era);
    const buildingStyle = getBuildingStyleForEra(era);
    const buildingColor = getBuildingColorForEra(era);
    
    // Create a row of buildings
    for (let i = -3; i <= 3; i++) {
        for (let j = -2; j <= 2; j++) {
            if (Math.abs(i) === 3 || Math.abs(j) === 2) { // Border buildings
                const width = Math.random() * 15 + 10;
                const depth = Math.random() * 15 + 10;
                const height = buildingHeight + (Math.random() * 20 - 10);
                
                const geometry = new THREE.BoxGeometry(width, height, depth);
                const material = new THREE.MeshStandardMaterial({
                    color: buildingColor,
                    roughness: 0.7 + Math.random() * 0.3,
                    metalness: 0.1
                });
                
                const building = new THREE.Mesh(geometry, material);
                building.position.set(
                    i * 25,
                    height / 2,
                    j * 25
                );
                
                // Add architectural details based on era
                addArchitecturalDetails(building, era, buildingStyle);
                
                scene.add(building);
                buildings.push(building);
            }
        }
    }
}

// Add architectural details based on era
function addArchitecturalDetails(building, era, style) {
    // Add some variation to make buildings less uniform
    building.scale.y = 0.8 + Math.random() * 0.4;
}

// Add vehicles based on era
function addVehicles(era) {
    const vehicleTypes = getVehicleTypesForEra(era);
    const vehicleColors = getVehicleColorsForEra(era);
    
    // Add cars on the road
    for (let i = 0; i < 8; i++) {
        const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
        const color = vehicleColors[Math.floor(Math.random() * vehicleColors.length)];
        
        // Create a simple car representation
        const carGroup = new THREE.Group();
        
        // Car body
        const bodyGeometry = new THREE.BoxGeometry(4, 1.5, 2);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.3,
            metalness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.75;
        carGroup.add(body);
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 8);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        
        const wheelFL = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheelFL.position.set(-1.5, 0.3, -1);
        carGroup.add(wheelFL);
        
        const wheelFR = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheelFR.position.set(1.5, 0.3, -1);
        carGroup.add(wheelFR);
        
        const wheelRL = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheelRL.position.set(-1.5, 0.3, 1);
        carGroup.add(wheelRL);
        
        const wheelRR = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheelRR.position.set(1.5, 0.3, 1);
        carGroup.add(wheelRR);
        
        // Position on road
        carGroup.position.set(
            -80 + Math.random() * 160, // X position across road
            0.01, // Just above road
            -20 + Math.random() * 40   // Z position along road
        );
        
        // Random rotation for variety
        carGroup.rotation.y = Math.random() * Math.PI * 2;
        
        scene.add(carGroup);
        vehicles.push(carGroup);
    }
}

// Add pedestrians based on era
function addPedestrians(era) {
    const pedestrianCount = era < 2000 ? 6 : 12; // More people in modern eras
    const clothingStyle = getClothingStyleForEra(era);
    
    for (let i = 0; i < pedestrianCount; i++) {
        // Simple person representation
        const personGroup = new THREE.Group();
        
        // Body
        const bodyGeometry = new THREE.BoxGeometry(0.6, 1.6, 0.3);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: getRandomClothingColor(clothingStyle),
            roughness: 0.7
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        personGroup.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const headMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffdbac, // Skin tone
            roughness: 0.8
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.8;
        personGroup.add(head);
        
        // Position on sidewalk
        personGroup.position.set(
            -40 + Math.random() * 80, // X position
            0, // Ground level
            -45 + Math.random() * 30  // Z position (on sidewalk)
        );
        
        // Random rotation
        personGroup.rotation.y = Math.random() * Math.PI * 2;
        
        scene.add(personGroup);
        pedestrians.push(personGroup);
    }
}

// Add storefronts based on era
function addStorefronts(era) {
    const storefrontStyle = getStorefrontStyleForEra(era);
    
    // Add storefronts along the main road
    for (let i = -2; i <= 2; i++) {
        const storefrontGroup = new THREE.Group();
        
        // Storefront base
        const baseGeometry = new THREE.BoxGeometry(8, 3, 0.2);
        const baseMaterial = new THREE.MeshStandardMaterial({ 
            color: getStorefrontColorForEra(era, storefrontStyle),
            roughness: 0.5
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(i * 20, 1.5, -22);
        storefrontGroup.add(base);
        
        // Window
        const windowGeometry = new THREE.BoxGeometry(7.5, 2, 0.1);
        const windowMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xadd8e6, // Light blue for glass
            opacity: 0.8,
            transparent: true
        });
        const window = new THREE.Mesh(windowGeometry, windowMaterial);
        window.position.set(i * 20, 2.5, -21.9);
        storefrontGroup.add(window);
        
        // Sign
        const signGeometry = new THREE.BoxGeometry(6, 0.5, 0.1);
        const signMaterial = new THREE.MeshStandardMaterial({ 
            color: getSignColorForEra(era),
            roughness: 0.3
        });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(i * 20, 3.5, -21.9);
        storefrontGroup.add(sign);
        
        scene.add(storefrontGroup);
        storefronts.push(storefrontGroup);
    }
}

// Add advertisements based on era
function addAdvertisements(era) {
    const adStyle = getAdStyleForEra(era);
    
    // Add billboards and signs
    for (let i = 0; i < 3; i++) {
        const adGroup = new THREE.Group();
        
        // Billboard base
        const baseGeometry = new THREE.BoxGeometry(10, 4, 0.3);
        const baseMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2f4f4f, // Dark slate gray
            roughness: 0.8
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(-60 + i * 60, 8, -35);
        adGroup.add(base);
        
        // Ad content (simplified as colored rectangle)
        const adGeometry = new THREE.BoxGeometry(9.5, 3.5, 0.15);
        const adMaterial = new THREE.MeshStandardMaterial({ 
            color: getAdColorForEra(era, adStyle),
            roughness: 0.4
        });
        const ad = new THREE.Mesh(adGeometry, adMaterial);
        ad.position.set(-60 + i * 60, 8, -34.85);
        adGroup.add(ad);
        
        scene.add(adGroup);
        advertisements.push(adGroup);
    }
}

// Helper functions to determine era-specific properties
function getBuildingHeightForEra(era) {
    if (era < 1960) return 10;  // Low-rise pre-1960
    if (era < 1990) return 18;  // Mid-rise 1960-1990
    if (era < 2020) return 25;  // High-rise 1990-2020
    return 35;  // Very tall 2020+
}

function getBuildingStyleForEra(era) {
    if (era < 1950) return 'art_deco';
    if (era < 1970) return 'modernist';
    if (era < 1990) return 'brutalist';
    if (era < 2010) return 'postmodern';
    return 'contemporary';
}

function getBuildingColorForEra(era) {
    const colors = {
        1945: 0x8b4513, // Saddle brown
        1965: 0x696969, // Dim gray
        1985: 0x2f4f4f, // Dark slate gray
        2005: 0x708090, // Slate gray
        2025: 0x4682b4, // Steel blue
        2055: 0x00bfff  // Deep sky blue
    };
    return colors[era] || 0x808080;
}

function getVehicleTypesForEra(era) {
    const types = {
        1945: ['sedan', 'truck', 'bus'],
        1965: ['sedan', 'convertible', 'station_wagon', 'bus'],
        1985: ['sedan', 'suv', 'truck', 'bus'],
        2005: ['sedan', 'suv', 'hybrid', 'bus'],
        2025: ['sedan', 'electric_suv', 'hybrid', 'bus', 'scooter'],
        2055: ['flying_car', 'electric_pod', 'maglev_bus', 'personal_drone']
    };
    return types[era] || ['sedan'];
}

function getVehicleColorsForEra(era) {
    const colors = {
        1945: [0x8b0000, 0x000080, 0x006400, 0xb8860b], // Dark red, navy, dark green, goldenrod
        1965: [0xff0000, 0x0000ff, 0xffff00, 0xffa500, 0x800080], // Bright colors
        1985: [0x000000, 0xffffff, 0xc0c0c0, 0x808080], // Monochrome trend
        2005: [0xffffff, 0x000000, 0xff0000, 0x0000ff], // White/black/red/blue
        2025: [0x00ff00, 0x00ffff, 0xff00ff, 0xffff00], // Bright eco colors
        2055: [0xff00ff, 0x00ffff, 0xff0000, 0x00ff00] // Neon future colors
    };
    return colors[era] || [0xffffff];
}

function getClothingStyleForEra(era) {
    if (era < 1960) return 'vintage';
    if (era < 1980) return 'retro';
    if (era < 2000) return 'casual';
    if (era < 2020) return 'modern';
    return 'futuristic';
}

function getRandomClothingColor(style) {
    const colors = {
        vintage: [0x8b0000, 0x000080, 0x006400, 0xb8860b],
        retro: [0xff0000, 0x0000ff, 0xffff00, 0xffa500, 0x800080],
        casual: [0x000000, 0xffffff, 0xc0c0c0, 0x808080, 0x0000ff],
        modern: [0xffffff, 0x000000, 0xff0000, 0x0000ff, 0x008000],
        futuristic: [0xff00ff, 0x00ffff, 0x00ff00, 0xffff00, 0xff0000]
    };
    const palette = colors[style] || [0x808080];
    return palette[Math.floor(Math.random() * palette.length)];
}

function getStorefrontStyleForEra(era) {
    if (era < 1950) return 'art_deco';
    if (era < 1970) return 'mid_century';
    if (era < 1990) return 'brutalist';
    if (era < 2010) return 'minimalist';
    return 'smart';
}

function getStorefrontColorForEra(era, style) {
    const colors = {
        art_deco: 0x8b4513,
        mid_century: 0x696969,
        brutalist: 0x2f4f4f,
        minimalist: 0xffffff,
        smart: 0x00bfff
    };
    return colors[style] || 0x808080;
}

function getSignColorForEra(era) {
    if (era < 1960) return 0xffd700; // Gold
    if (era < 1990) return 0xff0000; // Red
    if (era < 2020) return 0x0000ff; // Blue
    return 0x00ff00; // Green
}

function getAdStyleForEra(era) {
    if (era < 1960) return 'print';
    if (era < 1990) return 'broadcast';
    if (era < 2020) return 'digital';
    return 'holographic';
}

function getAdColorForEra(era, style) {
    const colors = {
        print: 0x8b0000,
        broadcast: 0x0000cd,
        digital: 0x00ff00,
        holographic: 0xff00ff
    };
    return colors[style] || 0xffffff;
}

// Setup timeline controls
function setupTimelineControls() {
    timelineSlider = document.getElementById('timeline-slider');
    selectedYearSpan = document.getElementById('selected-year');
    eraDescription = document.getElementById('era-description');
    
    timelineSlider.addEventListener('input', function() {
        const value = parseInt(this.value);
        if (value !== currentEra) {
            currentEra = value;
            updateUI(eras[value]);
            // Smooth transition between eras
            transitionToEra(value);
        }
    });
    
    // Initial update
    updateUI(eras[currentEra]);
}

// Update UI elements
function updateUI(year) {
    selectedYearSpan.textContent = year;
    eraDescription.textContent = getEraDescription(year);
}

// Get description for era
function getEraDescription(year) {
    const descriptions = {
        1945: "Post-WWII Era: Rebuilding, vintage cars, Art Deco architecture",
        1965: "Space Age: Mid-century modern, bold colors, cultural revolution",
        1985: "Digital Dawn: Early computers, boxy designs, neon beginnings",
        2005: "Digital Age: Internet boom, sleek designs, globalization",
        2025: "Sustainable Future: Green tech, smart cities, electric vehicles",
        2055: "Advanced Civilization: AI integration, flying vehicles, holographic ads"
    };
    return descriptions[year] || "Unknown Era";
}

// Smooth transition between eras
function transitionToEra(newEraIndex) {
    // Fade out current objects
    const allObjects = [...buildings, ...vehicles, ...pedestrians, ...storefronts, ...advertisements];
    
    allObjects.forEach(obj => {
        if (obj.material) {
            gsap.to(obj.material, {
                opacity: 0.3,
                duration: 0.8,
                ease: "power2.out"
            });
        }
    });
    
    // Wait for fade out, then update scene
    setTimeout(() => {
        addCityBlock(newEraIndex);
        
        // Fade in new objects
        const newObjects = [...buildings, ...vehicles, ...pedestrians, ...storefronts, ...advertisements];
        newObjects.forEach(obj => {
            if (obj.material) {
                gsap.to(obj.material, {
                    opacity: 1.0,
                    duration: 0.8,
                    ease: "power2.out"
                });
            }
        });
    }, 800);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Update any animations here
    // For now, just render
    
    renderer.render(scene, camera);
}

// Initialize the scene when the page loads
window.addEventListener('load', init);