export const config = {
    // Scene settings
    sceneBackgroundColor: 0x2c3e50,
    floorColor: 0x999999,
    
    // Camera settings
    cameraFOV: 50,
    cameraMinDistance: 1,
    cameraMaxDistance: 10,
    defaultCameraPosition: { x: 0, y: 1.5, z: 3 },
    
    // Animation settings
    crossFadeDuration: 0.5,
    
    // Model URL (using a free humanoid model from Three.js examples)
    modelURL: 'https://threejs.org/examples/models/gltf/Xbot.glb',
    
    // Default colors for body parts
    defaultColors: {
        body: '#ffffff',
        head: '#ffffff',
        upperBody: '#ffffff',
        lowerBody: '#ffffff',
        arms: '#ffffff',
        legs: '#ffffff'
    },
    
    // Body part mapping (these will be specific to the model)
    bodyPartMappings: {
        head: ['mixamorigHead'],
        upperBody: ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorigNeck'],
        lowerBody: ['mixamorigHips'],
        arms: ['mixamorigLeftArm', 'mixamorigRightArm', 'mixamorigLeftForeArm', 'mixamorigRightForeArm', 
               'mixamorigLeftHand', 'mixamorigRightHand', 'mixamorigLeftShoulder', 'mixamorigRightShoulder'],
        legs: ['mixamorigLeftUpLeg', 'mixamorigRightUpLeg', 'mixamorigLeftLeg', 'mixamorigRightLeg', 
               'mixamorigLeftFoot', 'mixamorigRightFoot']
    }
};