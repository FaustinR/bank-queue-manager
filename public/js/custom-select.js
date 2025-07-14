document.addEventListener('DOMContentLoaded', function() {
    // Apply to service first so it gets a higher z-index
    applyCustomSelect('service', 'Select a service');
    applyCustomSelect('language', 'Select language');
    
    function applyCustomSelect(selectId, defaultText) {
        // Add a small delay to ensure DOM is fully loaded
        setTimeout(() => {
            // Set a unique z-index based on the selectId to prevent overlapping
            const zIndex = selectId === 'service' ? 3000 : 2000;
            
            const originalSelect = document.getElementById(selectId);
            if (!originalSelect) return;
            
            // Create a custom select container
            const customSelect = document.createElement('div');
            customSelect.className = 'custom-select-container';
            customSelect.style.zIndex = zIndex;
            
            // Create the selected display
            const selectedDisplay = document.createElement('div');
            selectedDisplay.className = 'selected-option';
            selectedDisplay.textContent = defaultText;
            
            // Create the options container
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'select-options';
            optionsContainer.style.display = 'none';
            optionsContainer.style.zIndex = zIndex;
            
            // Add the custom elements to the container
            customSelect.appendChild(selectedDisplay);
            customSelect.appendChild(optionsContainer);
            
            // Insert the custom select before the original
            originalSelect.parentNode.insertBefore(customSelect, originalSelect);
            
            // Hide the original select
            originalSelect.style.display = 'none';
            
            // Create custom options
            Array.from(originalSelect.options).forEach(option => {
                // Skip empty options
                if (!option.value) return;
                
                const customOption = document.createElement('div');
                customOption.className = 'select-option';
                customOption.dataset.value = option.value;
                
                // Check if this option has a flag
                const flagName = option.getAttribute('data-flag');
                if (flagName) {
                    const flagImg = document.createElement('img');
                    flagImg.src = '/images/' + flagName;
                    flagImg.className = 'flag-img';
                    flagImg.alt = option.textContent + ' flag';
                    customOption.appendChild(flagImg);
                }
                
                const optionText = document.createTextNode(option.textContent);
                customOption.appendChild(optionText);
                
                optionsContainer.appendChild(customOption);
                
                // Add click event to the option
                customOption.addEventListener('click', function(e) {
                    e.stopPropagation();
                    
                    // Update the original select
                    originalSelect.value = this.dataset.value;
                    
                    // Update the display
                    selectedDisplay.innerHTML = '';
                    
                    // Create a span to hold the text and flag
                    const textSpan = document.createElement('span');
                    
                    if (flagName) {
                        const flagImg = document.createElement('img');
                        flagImg.src = '/images/' + flagName;
                        flagImg.className = 'flag-img';
                        flagImg.alt = option.textContent + ' flag';
                        textSpan.appendChild(flagImg);
                    }
                    
                    textSpan.appendChild(document.createTextNode(option.textContent));
                    selectedDisplay.appendChild(textSpan);
                    
                    // Hide the options
                    optionsContainer.style.display = 'none';
                    
                    // Trigger change event on original select
                    const event = new Event('change');
                    originalSelect.dispatchEvent(event);
                });
            });
            
            // Toggle options display when clicking the selected display
            selectedDisplay.addEventListener('click', function(e) {
                e.stopPropagation();
                const isVisible = optionsContainer.style.display === 'block';
                
                // Close all other open dropdowns first
                document.querySelectorAll('.select-options').forEach(el => {
                    if (el !== optionsContainer) {
                        el.style.display = 'none';
                    }
                });
                
                optionsContainer.style.display = isVisible ? 'none' : 'block';
            });
            
            // Close options when clicking outside
            document.addEventListener('click', function(e) {
                if (!customSelect.contains(e.target)) {
                    optionsContainer.style.display = 'none';
                }
            });
        }, 100); // End of setTimeout
    }
});