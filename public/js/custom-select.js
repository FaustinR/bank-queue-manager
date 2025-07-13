document.addEventListener('DOMContentLoaded', function() {
    const languageSelect = document.getElementById('language');
    const originalSelect = languageSelect;
    
    // Create a custom select container
    const customSelect = document.createElement('div');
    customSelect.className = 'custom-select-container';
    
    // Create the selected display
    const selectedDisplay = document.createElement('div');
    selectedDisplay.className = 'selected-option';
    selectedDisplay.textContent = 'Select language';
    
    // Create the options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'select-options';
    optionsContainer.style.display = 'none';
    
    // Add the custom elements to the container
    customSelect.appendChild(selectedDisplay);
    customSelect.appendChild(optionsContainer);
    
    // Insert the custom select before the original
    originalSelect.parentNode.insertBefore(customSelect, originalSelect);
    
    // Hide the original select
    originalSelect.style.display = 'none';
    
    // Create custom options
    Array.from(originalSelect.options).forEach(option => {
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
        customOption.addEventListener('click', function() {
            // Update the original select
            originalSelect.value = this.dataset.value;
            
            // Update the display
            selectedDisplay.innerHTML = '';
            if (flagName) {
                const flagImg = document.createElement('img');
                flagImg.src = '/images/' + flagName;
                flagImg.className = 'flag-img';
                flagImg.alt = option.textContent + ' flag';
                selectedDisplay.appendChild(flagImg);
            }
            selectedDisplay.appendChild(document.createTextNode(option.textContent));
            
            // Hide the options
            optionsContainer.style.display = 'none';
            
            // Trigger change event on original select
            const event = new Event('change');
            originalSelect.dispatchEvent(event);
        });
    });
    
    // Toggle options display when clicking the selected display
    selectedDisplay.addEventListener('click', function() {
        const isVisible = optionsContainer.style.display === 'block';
        optionsContainer.style.display = isVisible ? 'none' : 'block';
    });
    
    // Close options when clicking outside
    document.addEventListener('click', function(e) {
        if (!customSelect.contains(e.target)) {
            optionsContainer.style.display = 'none';
        }
    });
});