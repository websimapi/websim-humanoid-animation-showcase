// Body part selection and color management utilities
export function nodeMatchesBodyPart(node, boneNames) {
    // Check if the node name directly includes any of the bone names
    for (const boneName of boneNames) {
        if (node.name.includes(boneName)) {
            return true;
        }
    }
    
    // Check parent hierarchy
    let parent = node.parent;
    while (parent) {
        if (parent.name) {
            for (const boneName of boneNames) {
                if (parent.name.includes(boneName)) {
                    return true;
                }
            }
        }
        parent = parent.parent;
    }
    
    // Check for mesh names that might be associated with body parts
    // This helps with models where mesh names don't directly include bone names
    const nodeLower = node.name.toLowerCase();
    if (boneNames.includes('mixamorigHead') && 
        (nodeLower.includes('head') || nodeLower.includes('face') || nodeLower.includes('hair'))) {
        return true;
    }
    if (boneNames.includes('mixamorigLeftLeg') && 
        (nodeLower.includes('leg') || nodeLower.includes('shin') || nodeLower.includes('calf'))) {
        return true;
    }
    if (boneNames.includes('mixamorigLeftArm') && 
        (nodeLower.includes('arm') || nodeLower.includes('hand') || nodeLower.includes('sleeve'))) {
        return true;
    }
    
    return false;
}

export function mapMaterialsByBodyPart(model, config, originalMaterials, bodyPartMaterials) {
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
    
    // First pass: Direct mesh identification
    model.traverse((node) => {
        if (node.isMesh) {
            let assignedToPart = false;
            
            // Check which body part this mesh belongs to
            for (const part in config.bodyPartMappings) {
                const boneNames = config.bodyPartMappings[part];
                
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
    
    // Fallback for models with different structure
    if (Object.values(bodyParts).some(meshes => meshes.length === 0)) {
        console.warn("Some body parts have no meshes assigned. Using fallback mapping strategy.");
        model.traverse((node) => {
            if (node.isMesh) {
                const nodeName = node.name.toLowerCase();
                
                if (nodeName.includes('head') || nodeName.includes('face')) {
                    bodyParts['head'].push(node);
                } else if (nodeName.includes('torso') || nodeName.includes('chest') || nodeName.includes('spine')) {
                    bodyParts['upperBody'].push(node);
                } else if (nodeName.includes('hip') || nodeName.includes('pelvis') || nodeName.includes('waist')) {
                    bodyParts['lowerBody'].push(node);
                } else if (nodeName.includes('arm') || nodeName.includes('hand') || nodeName.includes('shoulder')) {
                    bodyParts['arms'].push(node);
                } else if (nodeName.includes('leg') || nodeName.includes('foot') || nodeName.includes('thigh')) {
                    bodyParts['legs'].push(node);
                } else {
                    if (!bodyParts['body']) bodyParts['body'] = [];
                    bodyParts['body'].push(node);
                }
            }
        });
    }
    
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
    return bodyParts;
}

export function selectBodyPart(part, bodyPartMaterials, selectedBodyPart) {
    // Highlight the selected body part in the model
    if (bodyPartMaterials.has(part)) {
        const material = bodyPartMaterials.get(part);
        
        // Store original properties
        material.userData = material.userData || {};
        material.userData.originalEmissive = material.userData.originalEmissive || material.emissive.clone();
        material.userData.originalEmissiveIntensity = material.userData.originalEmissiveIntensity || material.emissiveIntensity;
        
        // Add highlight effect - higher value for better visibility
        material.emissive.set(0x888888);
        material.emissiveIntensity = 0.7;
    }
    
    // Highlight color picker in UI
    const picker = document.querySelector(`.color-picker input[data-part="${part}"]`).parentElement;
    picker.classList.add('active-picker');
    
    return part;
}

export function clearBodyPartSelection(selectedBodyPart, bodyPartMaterials) {
    if (selectedBodyPart && bodyPartMaterials.has(selectedBodyPart)) {
        const material = bodyPartMaterials.get(selectedBodyPart);
        
        // Restore original properties
        if (material.userData && material.userData.originalEmissive) {
            material.emissive.copy(material.userData.originalEmissive);
            material.emissiveIntensity = material.userData.originalEmissiveIntensity;
        }
        
        // Remove UI highlight
        const picker = document.querySelector(`.color-picker input[data-part="${selectedBodyPart}"]`).parentElement;
        if (picker) {
            picker.classList.remove('active-picker');
        }
        
        return null;
    }
    return selectedBodyPart;
}

export function changeBodyPartColor(part, colorValue, bodyPartMaterials) {
    if (bodyPartMaterials.has(part)) {
        const material = bodyPartMaterials.get(part);
        material.color.set(colorValue);
    } else {
        console.warn(`No material found for body part: ${part}`);
    }
}

export function resetColors(config, bodyPartMaterials) {
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

export function createColorControls(config, bodyPartMaterials, selectedBodyPart) {
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
        colorPicker.dataset.part = part;
        
        const label = document.createElement('label');
        label.textContent = part.charAt(0).toUpperCase() + part.slice(1);
        
        const input = document.createElement('input');
        input.type = 'color';
        input.value = config.defaultColors[part];
        input.dataset.part = part;
        
        // Focus/click handler for highlighting body part
        colorPicker.addEventListener('click', (e) => {
            // First clear any existing selection
            selectedBodyPart = clearBodyPartSelection(selectedBodyPart, bodyPartMaterials);
            // Then select the clicked part
            selectedBodyPart = selectBodyPart(part, bodyPartMaterials, selectedBodyPart);
        });
        
        input.addEventListener('input', (e) => {
            changeBodyPartColor(e.target.dataset.part, e.target.value, bodyPartMaterials);
        });
        
        colorPicker.appendChild(label);
        colorPicker.appendChild(input);
        colorSection.appendChild(colorPicker);
    }
    
    // Add reset button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Colors';
    resetBtn.className = 'reset-color-btn';
    resetBtn.onclick = () => resetColors(config, bodyPartMaterials);
    colorSection.appendChild(resetBtn);
    
    // Add to color controls
    colorControls.appendChild(colorSection);
    
    // Add to main controls
    controlsContainer.appendChild(colorControls);
    
    return selectedBodyPart;
}