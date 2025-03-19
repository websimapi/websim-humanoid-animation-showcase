import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { config } from './config.js';

// Scene setup
let scene, camera, renderer, controls, mixer, clock, model;
let currentAnimation = null;
let animations = [];
let activeAnimations = new Map(); // Map to track active animations
let cameraTargetPosition = new THREE.Vector3(0, 1, 0);
let playbackSpeed = config.defaultPlaybackSpeed;
let animationCategories = {};

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.sceneBackgroundColor);

    // Setup camera
    camera = new THREE.PerspectiveCamera(
        config.cameraFOV,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(
        config.defaultCameraPosition.x,
        config.defaultCameraPosition.y,
        config.defaultCameraPosition.z
    );

    // Setup renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.getElementById('scene-container').appendChild(renderer.domElement);

    // Add orbit controls with enhanced settings
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(cameraTargetPosition);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = config.cameraMinDistance;
    controls.maxDistance = config.cameraMaxDistance;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.update();

    // Lighting
    setupLights();

    // Floor
    createFloor();

    // Load model
    loadModel();

    // Clock for animations
    clock = new THREE.Clock();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();
}

function setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Directional light (sun)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 10, 7.5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    // Additional fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -7.5);
    scene.add(fillLight);
}

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: config.floorColor,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
}

function loadModel() {
    const loader = new GLTFLoader();
    
    // Show loading progress
    const loadingElement = document.createElement('div');
    loadingElement.style.position = 'absolute';
    loadingElement.style.top = '50%';
    loadingElement.style.left = '50%';
    loadingElement.style.transform = 'translate(-50%, -50%)';
    loadingElement.style.color = 'white';
    loadingElement.style.fontSize = '24px';
    loadingElement.textContent = 'Loading model...';
    document.getElementById('scene-container').appendChild(loadingElement);

    // Load the model
    loader.load(
        config.modelURL,
        function(gltf) {
            model = gltf.scene;
            model.traverse(function(node) {
                if (node.isMesh) {
                    node.castShadow = true;
                }
            });
            
            scene.add(model);
            
            // Set up animation mixer
            mixer = new THREE.AnimationMixer(model);
            animations = gltf.animations;
            
            // Debug: Log all available animations
            console.log("Available animations:", animations.map(a => ({name: a.name, duration: a.duration})));
            
            // Create buttons for animations
            createAnimationButtons();
            
            // Play the first animation by default
            if (animations.length > 0) {
                playAnimation(0);
            }
            
            // Remove loading message
            document.getElementById('scene-container').removeChild(loadingElement);
        },
        function(xhr) {
            const percent = (xhr.loaded / xhr.total) * 100;
            loadingElement.textContent = `Loading model... ${Math.round(percent)}%`;
        },
        function(error) {
            console.error('Error loading model:', error);
            loadingElement.textContent = 'Error loading model';
        }
    );
}

function createAnimationButtons() {
    const buttonContainer = document.getElementById('animation-buttons');
    
    // Organize animations by categories
    categorizeAnimations();
    
    // Create filter tags
    const filterContainer = document.createElement('div');
    filterContainer.className = 'animation-filters';
    
    // Add "All" filter
    const allFilter = document.createElement('div');
    allFilter.className = 'filter-tag active';
    allFilter.textContent = 'All';
    allFilter.dataset.category = 'all';
    allFilter.onclick = () => filterAnimations('all');
    filterContainer.appendChild(allFilter);
    
    // Add category filters
    Object.keys(animationCategories).forEach(category => {
        const filterTag = document.createElement('div');
        filterTag.className = 'filter-tag';
        filterTag.textContent = category;
        filterTag.dataset.category = category;
        filterTag.onclick = () => filterAnimations(category);
        filterContainer.appendChild(filterTag);
    });
    
    buttonContainer.appendChild(filterContainer);
    
    // Create animation buttons
    animations.forEach((animation, index) => {
        const button = document.createElement('button');
        button.textContent = animation.name;
        button.onclick = () => playAnimation(index);
        button.dataset.category = getAnimationCategory(animation.name);
        
        // Add data attribute for duration to help with debugging
        button.dataset.duration = animation.duration;
        
        buttonContainer.appendChild(button);
    });

    // Add a debug button to help troubleshoot animations
    const debugBtn = document.createElement('button');
    debugBtn.textContent = "Debug Animations";
    debugBtn.style.backgroundColor = "#e67e22";
    debugBtn.onclick = () => {
        console.log("Current animations:", animations);
        console.log("Current animation playing:", currentAnimation?.getClip().name);
        
        // Find sad/sneak poses by partial name match
        const sadIndex = animations.findIndex(a => a.name.toLowerCase().includes("sad"));
        const sneakIndex = animations.findIndex(a => a.name.toLowerCase().includes("sneak"));
        
        console.log(`Sad animation index: ${sadIndex}, Sneak animation index: ${sneakIndex}`);
        
        if (sadIndex >= 0) {
            console.log(`Sad animation details:`, animations[sadIndex]);
        }
        
        if (sneakIndex >= 0) {
            console.log(`Sneak animation details:`, animations[sneakIndex]);
        }
    };
    buttonContainer.appendChild(debugBtn);

    // Setup animation controls
    createAnimationControls();
    
    // Create camera control buttons
    setupCameraControls();
}

function categorizeAnimations() {
    // Define categories and keywords
    const categories = {
        'Poses': ['pose', 'sad', 'sneak', 'idle'],
        'Walking': ['walk', 'stride', 'run', 'jog'],
        'Dancing': ['dance', 'hip', 'hop'],
        'Actions': ['jump', 'punch', 'kick'],
        'Emotions': ['sad', 'happy', 'angry', 'laugh']
    };
    
    // Categorize each animation
    animations.forEach(animation => {
        const name = animation.name.toLowerCase();
        
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => name.includes(keyword))) {
                if (!animationCategories[category]) {
                    animationCategories[category] = [];
                }
                animationCategories[category].push(animation.name);
                break;
            }
        }
    });
    
    console.log('Animation categories:', animationCategories);
}

function getAnimationCategory(name) {
    name = name.toLowerCase();
    for (const [category, animations] of Object.entries(animationCategories)) {
        if (animations.some(anim => anim.toLowerCase() === name)) {
            return category;
        }
    }
    return 'Other';
}

function filterAnimations(category) {
    // Update active filter
    const filters = document.querySelectorAll('.filter-tag');
    filters.forEach(filter => {
        if (filter.dataset.category === category) {
            filter.classList.add('active');
        } else {
            filter.classList.remove('active');
        }
    });
    
    // Show/hide buttons based on category
    const buttons = document.querySelectorAll('#animation-buttons button');
    buttons.forEach(button => {
        if (category === 'all' || button.dataset.category === category) {
            button.style.display = 'inline-block';
        } else {
            button.style.display = 'none';
        }
    });
}

function createAnimationControls() {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'animation-controls';
    
    // Create heading
    const heading = document.createElement('h2');
    heading.textContent = 'Animation Controls';
    controlsContainer.appendChild(heading);
    
    // Create playback speed slider
    const speedContainer = document.createElement('div');
    speedContainer.className = 'slider-container';
    
    const speedLabel = document.createElement('label');
    speedLabel.textContent = 'Playback Speed:';
    speedContainer.appendChild(speedLabel);
    
    const speedValue = document.createElement('span');
    speedValue.className = 'value-display';
    speedValue.textContent = config.defaultPlaybackSpeed.toFixed(1) + 'x';
    speedLabel.appendChild(speedValue);
    
    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.min = config.minPlaybackSpeed;
    speedSlider.max = config.maxPlaybackSpeed;
    speedSlider.step = 0.1;
    speedSlider.value = config.defaultPlaybackSpeed;
    
    speedSlider.oninput = function() {
        playbackSpeed = parseFloat(this.value);
        speedValue.textContent = playbackSpeed.toFixed(1) + 'x';
        
        // Update all active animations
        if (mixer) {
            activeAnimations.forEach(action => {
                action.setEffectiveTimeScale(playbackSpeed);
            });
        }
    };
    
    speedContainer.appendChild(speedSlider);
    controlsContainer.appendChild(speedContainer);
    
    // Animation blending controls
    const blendContainer = document.createElement('div');
    blendContainer.className = 'blend-animations';
    
    const blendHeading = document.createElement('h3');
    blendHeading.textContent = 'Blend Animations';
    blendContainer.appendChild(blendHeading);
    
    // Primary animation select
    const primaryGroup = document.createElement('div');
    primaryGroup.className = 'animation-group';
    
    const primaryLabel = document.createElement('label');
    primaryLabel.textContent = 'Primary Animation:';
    primaryGroup.appendChild(primaryLabel);
    
    const primarySelect = document.createElement('select');
    primarySelect.className = 'animation-select';
    animations.forEach((animation, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = animation.name;
        primarySelect.appendChild(option);
    });
    primaryGroup.appendChild(primarySelect);
    
    // Secondary animation select
    const secondaryGroup = document.createElement('div');
    secondaryGroup.className = 'animation-group';
    
    const secondaryLabel = document.createElement('label');
    secondaryLabel.textContent = 'Secondary Animation:';
    secondaryGroup.appendChild(secondaryLabel);
    
    const secondarySelect = document.createElement('select');
    secondarySelect.className = 'animation-select';
    animations.forEach((animation, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = animation.name;
        if (index === 1 && animations.length > 1) {
            option.selected = true;
        }
        secondarySelect.appendChild(option);
    });
    secondaryGroup.appendChild(secondarySelect);
    
    // Blend weight slider
    const weightContainer = document.createElement('div');
    weightContainer.className = 'slider-container';
    
    const weightLabel = document.createElement('label');
    weightLabel.textContent = 'Blend Weight:';
    weightContainer.appendChild(weightLabel);
    
    const weightValue = document.createElement('span');
    weightValue.className = 'value-display';
    weightValue.textContent = '0.5';
    weightLabel.appendChild(weightValue);
    
    const weightSlider = document.createElement('input');
    weightSlider.type = 'range';
    weightSlider.min = 0;
    weightSlider.max = 1;
    weightSlider.step = 0.05;
    weightSlider.value = 0.5;
    
    weightSlider.oninput = function() {
        weightValue.textContent = this.value;
    };
    
    weightContainer.appendChild(weightSlider);
    
    // Blend button
    const blendButton = document.createElement('button');
    blendButton.textContent = 'Blend Animations';
    blendButton.className = 'mix-button';
    blendButton.onclick = function() {
        const primaryIndex = parseInt(primarySelect.value);
        const secondaryIndex = parseInt(secondarySelect.value);
        const weight = parseFloat(weightSlider.value);
        blendAnimations(primaryIndex, secondaryIndex, weight);
    };
    
    blendContainer.appendChild(primaryGroup);
    blendContainer.appendChild(secondaryGroup);
    blendContainer.appendChild(weightContainer);
    blendContainer.appendChild(blendButton);
    
    controlsContainer.appendChild(blendContainer);
    
    // Add controls to document
    document.getElementById('controls').appendChild(controlsContainer);
}

function blendAnimations(primaryIndex, secondaryIndex, weight) {
    if (mixer) {
        // Stop current animation if any
        if (currentAnimation) {
            currentAnimation.fadeOut(config.crossFadeDuration);
        }
        
        // Clear active animations map
        activeAnimations.clear();
        
        // Play primary animation
        const primaryAction = mixer.clipAction(animations[primaryIndex]);
        primaryAction.reset().setEffectiveWeight(1 - weight).fadeIn(config.crossFadeDuration).play();
        primaryAction.setEffectiveTimeScale(playbackSpeed);
        activeAnimations.set(primaryIndex, primaryAction);
        
        // Play secondary animation
        const secondaryAction = mixer.clipAction(animations[secondaryIndex]);
        secondaryAction.reset().setEffectiveWeight(weight).fadeIn(config.crossFadeDuration).play();
        secondaryAction.setEffectiveTimeScale(playbackSpeed);
        activeAnimations.set(secondaryIndex, secondaryAction);
        
        // Update UI to show blended animations
        document.getElementById('current-animation').textContent = 
            `${animations[primaryIndex].name} (${(1-weight).toFixed(2)}) + ${animations[secondaryIndex].name} (${weight.toFixed(2)})`;
        
        // Update active button
        const buttons = document.querySelectorAll('#animation-buttons button');
        buttons.forEach(btn => btn.classList.remove('active'));
    }
}

function playAnimation(index) {
    if (mixer) {
        // Debug information
        console.log(`Playing animation: ${animations[index].name}, Duration: ${animations[index].duration}`);
        
        // Stop current animation
        if (currentAnimation) {
            currentAnimation.fadeOut(config.crossFadeDuration);
        }
        
        // Clear active animations map
        activeAnimations.clear();
        
        // Play new animation
        currentAnimation = mixer.clipAction(animations[index]);
        currentAnimation.reset().fadeIn(config.crossFadeDuration).play();
        currentAnimation.setEffectiveTimeScale(playbackSpeed);
        
        // Add to active animations
        activeAnimations.set(index, currentAnimation);
        
        // Handle pose-type animations (very short or zero duration)
        if (animations[index].duration < 0.5) {
            console.log(`Detected pose animation: ${animations[index].name}`);
            currentAnimation.clampWhenFinished = true;
            currentAnimation.setLoop(THREE.LoopOnce, 1);
            
            // For zero-duration animations, force them to "stick"
            if (animations[index].duration === 0) {
                currentAnimation.setEffectiveTimeScale(0);
            }
        } else {
            // Regular looping animation
            currentAnimation.setLoop(THREE.LoopRepeat);
            currentAnimation.setEffectiveTimeScale(playbackSpeed);
        }
        
        // Update UI
        document.getElementById('current-animation').textContent = animations[index].name;
        
        // Update active button
        const buttons = document.querySelectorAll('#animation-buttons button');
        buttons.forEach((btn, i) => {
            if (i === index) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

function setupCameraControls() {
    const cameraControls = document.getElementById('camera-controls');
    
    // Reset camera button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Camera';
    resetBtn.onclick = resetCamera;
    cameraControls.appendChild(resetBtn);

    // Front view
    const frontBtn = document.createElement('button');
    frontBtn.textContent = 'Front View';
    frontBtn.onclick = () => setCameraPosition(0, 1.5, 3);
    cameraControls.appendChild(frontBtn);

    // Side view
    const sideBtn = document.createElement('button');
    sideBtn.textContent = 'Side View';
    sideBtn.onclick = () => setCameraPosition(3, 1.5, 0);
    cameraControls.appendChild(sideBtn);

    // Top view
    const topBtn = document.createElement('button');
    topBtn.textContent = 'Top View';
    topBtn.onclick = () => setCameraPosition(0, 4, 0.1);
    cameraControls.appendChild(topBtn);

    // Create zoom controls
    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '🔍+';
    zoomInBtn.onclick = zoomIn;
    zoomInBtn.className = 'zoom-btn';
    cameraControls.appendChild(zoomInBtn);

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '🔍-';
    zoomOutBtn.onclick = zoomOut;
    zoomOutBtn.className = 'zoom-btn';
    cameraControls.appendChild(zoomOutBtn);
}

function setCameraPosition(x, y, z) {
    window.gsap.to(camera.position, {
        x: x,
        y: y, 
        z: z,
        duration: 1,
        onUpdate: function() {
            camera.lookAt(cameraTargetPosition);
            controls.update();
        }
    });
}

function resetCamera() {
    window.gsap.to(camera.position, {
        x: config.defaultCameraPosition.x,
        y: config.defaultCameraPosition.y,
        z: config.defaultCameraPosition.z,
        duration: 1,
        onUpdate: function() {
            camera.lookAt(cameraTargetPosition);
            controls.update();
        }
    });
    controls.target.copy(cameraTargetPosition);
    controls.update();
}

function zoomIn() {
    const newDistance = controls.getDistance() * 0.8;
    if (newDistance >= config.cameraMinDistance) {
        window.gsap.to(camera.position, {
            x: camera.position.x * 0.8,
            y: camera.position.y * 0.8,
            z: camera.position.z * 0.8,
            duration: 0.5,
            onUpdate: function() {
                controls.update();
            }
        });
    }
}

function zoomOut() {
    const newDistance = controls.getDistance() * 1.2;
    if (newDistance <= config.cameraMaxDistance) {
        window.gsap.to(camera.position, {
            x: camera.position.x * 1.2,
            y: camera.position.y * 1.2,
            z: camera.position.z * 1.2,
            duration: 0.5,
            onUpdate: function() {
                controls.update();
            }
        });
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    // Update mixer
    const delta = clock.getDelta();
    if (mixer) {
        mixer.update(delta);
    }
    
    // Update controls with damping effect
    controls.update();
    
    // Render scene
    renderer.render(scene, camera);
}

init();