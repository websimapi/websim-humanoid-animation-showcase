import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { config } from './config.js';

// Scene setup
let scene, camera, renderer, controls, mixer, clock, model;
let currentAnimation = null;
let animations = [];
let cameraTargetPosition = new THREE.Vector3(0, 1, 0);

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
    controls.zoomSpeed = 0.5; 
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
    
    animations.forEach((animation, index) => {
        const button = document.createElement('button');
        button.textContent = animation.name;
        button.onclick = () => playAnimation(index);
        buttonContainer.appendChild(button);
    });

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
        // Stop current animation
        if (currentAnimation) {
            currentAnimation.fadeOut(config.crossFadeDuration);
        }
        
        // Play new animation
        currentAnimation = mixer.clipAction(animations[index]);
        currentAnimation.reset().fadeIn(config.crossFadeDuration).play();
        
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