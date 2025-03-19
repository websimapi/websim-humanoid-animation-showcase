import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { config } from './config.js';

// Scene setup
let scene, camera, renderer, controls, mixer, clock, model;
let currentAnimation = null;
let animations = [];
let cameraTargetPosition = new THREE.Vector3(0, 1, 0);

// Material mapping
let bodyPartMaterials = new Map();
let originalMaterials = new Map();
let selectedBodyPart = null;  // Track which body part is selected

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
            
            // Create a mapping of materials by body part
            mapMaterialsByBodyPart(model);
            
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
            
            // Create color controls
            createColorControls();
            
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

function mapMaterialsByBodyPart(model) {
    // Store original materials
    model.traverse((node) => {
        if (node.isMesh) {
            // Store original material for reset functionality
            if (!originalMaterials.has(node.name)) {
                originalMaterials.set(node.name, node.material.clone());
            }
            
            // Create new material that can be modified
            node.material = node.material.clone();
        }
    });
    
    // Create a map of body parts
    const bodyParts = {};
    
    // Initialize body parts
    for (const part in config.bodyPartMappings) {
        bodyParts[part] = [];
    }
    
    // Map nodes to body parts
    model.traverse((node) => {
        if (node.isMesh) {
            let assignedToPart = false;
            
            // Check which body part this mesh belongs to
            for (const part in config.bodyPartMappings) {
                const boneNames = config.bodyPartMappings[part];
                
                // Check if the node name contains any of the bone names
                // or is a child of any of the bones
                if (nodeMatchesBodyPart(node, boneNames)) {
                    bodyParts[part].push(node);
                    assignedToPart = true;
                    break;
                }
            }
            
            // If not assigned to any specific part, assign to 'body'
            if (!assignedToPart) {
                if (!bodyParts['body']) {
                    bodyParts['body'] = [];
                }
                bodyParts['body'].push(node);
            }
        }
    });
    
    // Create and store materials for each body part
    for (const part in bodyParts) {
        const meshes = bodyParts[part];
        if (meshes && meshes.length > 0) {
            // Create a group material for this body part
            const material = meshes[0].material.clone();
            bodyPartMaterials.set(part, material);
            
            // Assign the material to all meshes in this part
            meshes.forEach(mesh => {
                mesh.material = material;
            });
        }
    }
    
    console.log('Body parts mapping:', bodyParts);
}

function nodeMatchesBodyPart(node, boneNames) {
    // Check if the node name contains any of the bone names
    for (const boneName of boneNames) {
        if (node.name.includes(boneName)) {
            return true;
        }
        
        // Check parent hierarchy
        let parent = node.parent;
        while (parent) {
            if (parent.name && parent.name.includes(boneName)) {
                return true;
            }
            parent = parent.parent;
        }
    }
    return false;
}

function createColorControls() {
    // Create color controls container
    const controlsContainer = document.getElementById('controls');
    const colorControls = document.createElement('div');
    colorControls.id = 'color-controls';
    
    // Create color section
    const colorSection = document.createElement('div');
    colorSection.className = 'color-section';
    
    // Add header
    const header = document.createElement('h2');
    header.textContent = 'Color Controls';
    colorSection.appendChild(header);
    
    // Add color pickers for each body part
    for (const part in config.defaultColors) {
        const colorPicker = document.createElement('div');
        colorPicker.className = 'color-picker';
        
        const label = document.createElement('label');
        label.textContent = part.charAt(0).toUpperCase() + part.slice(1);
        
        const input = document.createElement('input');
        input.type = 'color';
        input.value = config.defaultColors[part];
        input.dataset.part = part;
        
        // Focus/click handler for highlighting body part
        label.addEventListener('click', (e) => {
            selectBodyPart(part);
        });
        
        input.addEventListener('focus', (e) => {
            selectBodyPart(e.target.dataset.part);
        });
        
        input.addEventListener('input', (e) => {
            changeBodyPartColor(e.target.dataset.part, e.target.value);
        });
        
        input.addEventListener('blur', (e) => {
            clearBodyPartSelection();
        });
        
        colorPicker.appendChild(label);
        colorPicker.appendChild(input);
        colorSection.appendChild(colorPicker);
    }
    
    // Add reset button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Colors';
    resetBtn.className = 'reset-color-btn';
    resetBtn.onclick = resetColors;
    colorSection.appendChild(resetBtn);
    
    // Add to color controls
    colorControls.appendChild(colorSection);
    
    // Add to main controls
    controlsContainer.appendChild(colorControls);
}

function selectBodyPart(part) {
    // Clear previous selection
    clearBodyPartSelection();
    
    // Store current selection
    selectedBodyPart = part;
    
    // Highlight color picker in UI
    const picker = document.querySelector(`.color-picker input[data-part="${part}"]`).parentElement;
    picker.classList.add('active-picker');
    
    // Highlight the selected body part in the model
    if (bodyPartMaterials.has(part)) {
        const material = bodyPartMaterials.get(part);
        
        // Store original properties
        material.userData = material.userData || {};
        material.userData.originalEmissive = material.userData.originalEmissive || material.emissive.clone();
        material.userData.originalEmissiveIntensity = material.userData.originalEmissiveIntensity || material.emissiveIntensity;
        
        // Add highlight effect
        material.emissive.set(0x666666);
        material.emissiveIntensity = 0.5;
    }
}

function clearBodyPartSelection() {
    if (selectedBodyPart && bodyPartMaterials.has(selectedBodyPart)) {
        const material = bodyPartMaterials.get(selectedBodyPart);
        
        // Restore original properties
        if (material.userData && material.userData.originalEmissive) {
            material.emissive.copy(material.userData.originalEmissive);
            material.emissiveIntensity = material.userData.originalEmissiveIntensity;
        }
        
        // Remove UI highlight
        const picker = document.querySelector(`.color-picker input[data-part="${selectedBodyPart}"]`).parentElement;
        picker.classList.remove('active-picker');
        
        selectedBodyPart = null;
    }
}

function changeBodyPartColor(part, colorValue) {
    const color = new THREE.Color(colorValue);
    
    if (bodyPartMaterials.has(part)) {
        const material = bodyPartMaterials.get(part);
        material.color.set(color);
    } else {
        console.warn(`No material found for body part: ${part}`);
    }
}

function resetColors() {
    // Reset to original material colors
    for (const part in config.defaultColors) {
        if (bodyPartMaterials.has(part)) {
            const color = new THREE.Color(config.defaultColors[part]);
            bodyPartMaterials.get(part).color.set(color);
        }
    }
    
    // Reset color picker values in UI
    const colorInputs = document.querySelectorAll('#color-controls input[type="color"]');
    colorInputs.forEach(input => {
        input.value = config.defaultColors[input.dataset.part];
    });
}

function createAnimationButtons() {
    const buttonContainer = document.getElementById('animation-buttons');
    
    animations.forEach((animation, index) => {
        const button = document.createElement('button');
        button.textContent = animation.name;
        button.onclick = () => playAnimation(index);
        
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

    // Create camera control buttons
    setupCameraControls();
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

function playAnimation(index) {
    if (mixer) {
        // Debug information
        console.log(`Playing animation: ${animations[index].name}, Duration: ${animations[index].duration}`);
        
        // Stop current animation
        if (currentAnimation) {
            currentAnimation.fadeOut(config.crossFadeDuration);
        }
        
        // Play new animation
        currentAnimation = mixer.clipAction(animations[index]);
        currentAnimation.reset().fadeIn(config.crossFadeDuration).play();
        
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
            currentAnimation.setEffectiveTimeScale(1);
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