/**
 * Marga Enterprises - GA4 Custom Event Tracking
 * Version: 1.0.0
 * Created: 2026-01-10
 * 
 * Events tracked:
 * - click_quote_button: "Get Instant Quote" and similar CTA clicks
 * - click_phone: Phone number clicks (tel: links)
 * - click_email: Email link clicks (mailto:)
 * - click_pricing_guide: Pricing guide button clicks
 * - click_contact_link: Contact page navigation
 * - form_submit: Form submissions
 * - scroll_depth: 25%, 50%, 75%, 100% scroll milestones
 * - outbound_click: External link clicks
 */

(function() {
    'use strict';

    // Wait for gtag to be available
    function waitForGtag(callback, maxAttempts = 50) {
        let attempts = 0;
        const check = setInterval(function() {
            attempts++;
            if (typeof gtag === 'function') {
                clearInterval(check);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(check);
                console.warn('GA4 Events: gtag not available after waiting');
            }
        }, 100);
    }

    // Helper function to send GA4 events
    function trackEvent(eventName, params = {}) {
        if (typeof gtag === 'function') {
            // Add common parameters
            params.page_location = window.location.href;
            params.page_title = document.title;
            
            gtag('event', eventName, params);
            console.log('GA4 Event:', eventName, params);
        }
    }

    // Get button text helper
    function getButtonText(element) {
        return (element.textContent || element.innerText || '').trim().substring(0, 100);
    }

    // =====================================================
    // 1. QUOTE BUTTON TRACKING
    // =====================================================
    function setupQuoteButtonTracking() {
        // Track buttons with specific text or classes
        const quoteSelectors = [
            'a.btn-primary',
            'a[href*="/contact"]',
            'button[type="submit"]',
            '.cta-buttons a',
            'a[href*="inquiry"]'
        ];

        document.querySelectorAll(quoteSelectors.join(', ')).forEach(function(element) {
            const text = getButtonText(element).toLowerCase();
            
            // Check if it's a quote/contact CTA
            if (text.includes('quote') || text.includes('contact') || 
                text.includes('inquir') || text.includes('get started')) {
                
                element.addEventListener('click', function(e) {
                    trackEvent('click_quote_button', {
                        button_text: getButtonText(this),
                        button_url: this.href || '',
                        button_location: this.closest('section')?.className || 'unknown'
                    });
                });
            }
        });

        // Also track the specific "Get Instant Quote" button
        document.querySelectorAll('a').forEach(function(link) {
            const text = getButtonText(link).toLowerCase();
            if (text.includes('instant quote') || text === 'get instant quote') {
                link.addEventListener('click', function(e) {
                    trackEvent('click_quote_button', {
                        button_text: 'Get Instant Quote',
                        button_url: this.href,
                        button_location: 'hero_section'
                    });
                });
            }
        });
    }

    // =====================================================
    // 2. PHONE CLICK TRACKING
    // =====================================================
    function setupPhoneTracking() {
        document.querySelectorAll('a[href^="tel:"]').forEach(function(link) {
            link.addEventListener('click', function(e) {
                const phoneNumber = this.href.replace('tel:', '');
                trackEvent('click_phone', {
                    phone_number: phoneNumber,
                    link_text: getButtonText(this),
                    click_location: this.closest('section')?.className || 
                                   this.closest('footer') ? 'footer' : 'body'
                });
            });
        });
    }

    // =====================================================
    // 3. EMAIL CLICK TRACKING
    // =====================================================
    function setupEmailTracking() {
        document.querySelectorAll('a[href^="mailto:"]').forEach(function(link) {
            link.addEventListener('click', function(e) {
                const email = this.href.replace('mailto:', '').split('?')[0];
                trackEvent('click_email', {
                    email_address: email,
                    link_text: getButtonText(this),
                    click_location: this.closest('footer') ? 'footer' : 'body'
                });
            });
        });
    }

    // =====================================================
    // 4. PRICING GUIDE TRACKING
    // =====================================================
    function setupPricingGuideTracking() {
        document.querySelectorAll('a[href*="/pricing"]').forEach(function(link) {
            link.addEventListener('click', function(e) {
                trackEvent('click_pricing_guide', {
                    link_text: getButtonText(this),
                    link_url: this.href,
                    click_location: this.closest('section')?.className || 'body'
                });
            });
        });
    }

    // =====================================================
    // 5. SCROLL DEPTH TRACKING
    // =====================================================
    function setupScrollTracking() {
        const milestones = [25, 50, 75, 100];
        const trackedMilestones = new Set();
        let ticking = false;

        function getScrollPercentage() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            return Math.round((scrollTop / scrollHeight) * 100);
        }

        function checkScrollMilestones() {
            const scrollPercent = getScrollPercentage();
            
            milestones.forEach(function(milestone) {
                if (scrollPercent >= milestone && !trackedMilestones.has(milestone)) {
                    trackedMilestones.add(milestone);
                    trackEvent('scroll_depth', {
                        percent_scrolled: milestone,
                        page_path: window.location.pathname
                    });
                }
            });
        }

        window.addEventListener('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() {
                    checkScrollMilestones();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }

    // =====================================================
    // 6. OUTBOUND LINK TRACKING
    // =====================================================
    function setupOutboundTracking() {
        const currentDomain = window.location.hostname;
        
        document.querySelectorAll('a[href^="http"]').forEach(function(link) {
            try {
                const linkDomain = new URL(link.href).hostname;
                if (linkDomain !== currentDomain && !linkDomain.includes('marga.biz')) {
                    link.addEventListener('click', function(e) {
                        trackEvent('outbound_click', {
                            outbound_url: this.href,
                            link_text: getButtonText(this),
                            link_domain: linkDomain
                        });
                    });
                }
            } catch (err) {
                // Invalid URL, skip
            }
        });
    }

    // =====================================================
    // 7. FORM SUBMISSION TRACKING
    // =====================================================
    function setupFormTracking() {
        document.querySelectorAll('form').forEach(function(form) {
            form.addEventListener('submit', function(e) {
                const formId = this.id || this.name || 'unnamed_form';
                const formAction = this.action || window.location.href;
                
                trackEvent('form_submit', {
                    form_id: formId,
                    form_action: formAction,
                    form_location: window.location.pathname
                });
            });
        });
    }

    // =====================================================
    // 8. CTA BUTTON STYLE TRACKING (Additional CTAs)
    // =====================================================
    function setupCTATracking() {
        // Track all styled buttons/links
        const ctaSelectors = [
            '.btn',
            '.btn-primary',
            '.btn-secondary',
            '.cta-link',
            'a[style*="background-color"]'
        ];

        document.querySelectorAll(ctaSelectors.join(', ')).forEach(function(element) {
            // Skip if already tracked by other handlers
            if (element.href && (
                element.href.includes('tel:') || 
                element.href.includes('mailto:') ||
                element.href.includes('/contact') ||
                element.href.includes('/pricing')
            )) {
                return;
            }

            element.addEventListener('click', function(e) {
                trackEvent('click_cta', {
                    cta_text: getButtonText(this),
                    cta_url: this.href || '',
                    cta_class: this.className,
                    cta_location: window.location.pathname
                });
            });
        });
    }

    // =====================================================
    // 9. PAGE ENGAGEMENT TIME
    // =====================================================
    function setupEngagementTracking() {
        let startTime = Date.now();
        let engaged = true;

        // Track when user leaves or hides page
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                engaged = false;
                const timeOnPage = Math.round((Date.now() - startTime) / 1000);
                if (timeOnPage > 10) { // Only track if > 10 seconds
                    trackEvent('page_engagement', {
                        time_on_page_seconds: timeOnPage,
                        page_path: window.location.pathname
                    });
                }
            } else {
                startTime = Date.now();
                engaged = true;
            }
        });

        // Also track on page unload
        window.addEventListener('beforeunload', function() {
            const timeOnPage = Math.round((Date.now() - startTime) / 1000);
            if (timeOnPage > 10 && engaged) {
                // Use sendBeacon for reliable delivery
                const data = {
                    event: 'page_engagement',
                    time_on_page_seconds: timeOnPage,
                    page_path: window.location.pathname
                };
                
                if (navigator.sendBeacon) {
                    // GA4 doesn't support sendBeacon directly, 
                    // but we log for debugging
                    console.log('Page engagement (unload):', data);
                }
            }
        });
    }

    // =====================================================
    // INITIALIZE ALL TRACKING
    // =====================================================
    function initGA4Events() {
        console.log('GA4 Events: Initializing custom event tracking...');
        
        setupQuoteButtonTracking();
        setupPhoneTracking();
        setupEmailTracking();
        setupPricingGuideTracking();
        setupScrollTracking();
        setupOutboundTracking();
        setupFormTracking();
        setupCTATracking();
        setupEngagementTracking();
        
        console.log('GA4 Events: All tracking initialized');
        
        // Track that custom events are loaded (useful for debugging)
        trackEvent('ga4_events_loaded', {
            version: '1.0.0',
            page_path: window.location.pathname
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            waitForGtag(initGA4Events);
        });
    } else {
        waitForGtag(initGA4Events);
    }

})();
