/**
 * Marga Enterprises - Main JavaScript
 */

// Mobile menu toggle (if needed later)
document.addEventListener('DOMContentLoaded', function() {
    console.log('Marga Enterprises website loaded');
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Track phone clicks
    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
        link.addEventListener('click', function() {
            console.log('Phone link clicked:', this.href);
            // Add analytics tracking here if needed
        });
    });
});
