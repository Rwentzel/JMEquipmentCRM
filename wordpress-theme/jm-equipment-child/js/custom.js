/**
 * JM Equipment Custom JavaScript
 *
 * @package JM_Equipment_Child
 * @version 1.0.0
 */

(function($) {
    'use strict';

    /**
     * Document Ready
     */
    $(document).ready(function() {
        // Initialize all functions
        initProductGallery();
        initSmoothScroll();
        initPhoneTracking();
        initFormEnhancements();
        initMobileMenu();
        initScrollEffects();
    });

    /**
     * Product Image Gallery
     */
    function initProductGallery() {
        $('.product-image-thumbnails img').on('click', function() {
            var newSrc = $(this).attr('data-full-size') || $(this).attr('src');

            // Update main image
            $('.product-image-main').attr('src', newSrc);

            // Update active state
            $('.product-image-thumbnails img').removeClass('active');
            $(this).addClass('active');
        });

        // Set first thumbnail as active
        $('.product-image-thumbnails img').first().addClass('active');

        // Add lightbox functionality (if images are clickable)
        $('.product-image-main').on('click', function() {
            var imgSrc = $(this).attr('src');
            openLightbox(imgSrc);
        });
    }

    /**
     * Simple Lightbox for Product Images
     */
    function openLightbox(imageSrc) {
        var lightboxHTML = '<div class="jm-lightbox">' +
            '<span class="jm-lightbox-close">&times;</span>' +
            '<img src="' + imageSrc + '" alt="Product Image">' +
            '</div>';

        $('body').append(lightboxHTML);

        // Close lightbox on click
        $('.jm-lightbox, .jm-lightbox-close').on('click', function() {
            $('.jm-lightbox').fadeOut(300, function() {
                $(this).remove();
            });
        });

        // Prevent closing when clicking on image
        $('.jm-lightbox img').on('click', function(e) {
            e.stopPropagation();
        });

        // Close on ESC key
        $(document).on('keyup.lightbox', function(e) {
            if (e.key === 'Escape') {
                $('.jm-lightbox').fadeOut(300, function() {
                    $(this).remove();
                });
                $(document).off('keyup.lightbox');
            }
        });
    }

    /**
     * Smooth Scroll for Anchor Links
     */
    function initSmoothScroll() {
        $('a[href*="#"]:not([href="#"])').on('click', function(e) {
            if (location.pathname.replace(/^\//, '') === this.pathname.replace(/^\//, '') &&
                location.hostname === this.hostname) {

                var target = $(this.hash);
                target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');

                if (target.length) {
                    e.preventDefault();
                    $('html, body').animate({
                        scrollTop: target.offset().top - 100
                    }, 800);
                }
            }
        });
    }

    /**
     * Phone Click Tracking (for analytics)
     */
    function initPhoneTracking() {
        $('a[href^="tel:"]').on('click', function() {
            var phoneNumber = $(this).attr('href').replace('tel:', '');

            // Track with Google Analytics if available
            if (typeof gtag !== 'undefined') {
                gtag('event', 'phone_click', {
                    'event_category': 'Contact',
                    'event_label': phoneNumber,
                    'value': 1
                });
            }

            // Track with Google Analytics Universal if available
            if (typeof ga !== 'undefined') {
                ga('send', 'event', 'Contact', 'Phone Click', phoneNumber);
            }

            console.log('Phone click tracked: ' + phoneNumber);
        });

        // Track email clicks
        $('a[href^="mailto:"]').on('click', function() {
            var email = $(this).attr('href').replace('mailto:', '');

            if (typeof gtag !== 'undefined') {
                gtag('event', 'email_click', {
                    'event_category': 'Contact',
                    'event_label': email,
                    'value': 1
                });
            }

            if (typeof ga !== 'undefined') {
                ga('send', 'event', 'Contact', 'Email Click', email);
            }

            console.log('Email click tracked: ' + email);
        });
    }

    /**
     * Form Enhancements
     */
    function initFormEnhancements() {
        // Add loading state to forms
        $('form').on('submit', function() {
            var $submitBtn = $(this).find('button[type="submit"], input[type="submit"]');

            // Disable button and show loading
            $submitBtn.prop('disabled', true);

            var originalText = $submitBtn.val() || $submitBtn.text();
            $submitBtn.data('original-text', originalText);

            if ($submitBtn.is('input')) {
                $submitBtn.val('Sending...');
            } else {
                $submitBtn.text('Sending...');
            }
        });

        // Float labels on focus
        $('.wpforms-field input, .wpforms-field textarea, .wpforms-field select').on('focus blur', function(e) {
            var $field = $(this);
            var $label = $field.closest('.wpforms-field').find('label');

            if (e.type === 'focus' || $field.val() !== '') {
                $label.addClass('active');
            } else {
                $label.removeClass('active');
            }
        });

        // Trigger float labels for fields with values on page load
        $('.wpforms-field input, .wpforms-field textarea, .wpforms-field select').each(function() {
            if ($(this).val() !== '') {
                $(this).closest('.wpforms-field').find('label').addClass('active');
            }
        });
    }

    /**
     * Mobile Menu Enhancements
     */
    function initMobileMenu() {
        // Add submenu toggles for mobile
        if ($(window).width() <= 768) {
            $('.main-navigation .menu-item-has-children > a').after('<button class="submenu-toggle" aria-label="Toggle submenu"><span></span></button>');

            $('.submenu-toggle').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                var $submenu = $(this).siblings('.sub-menu');
                var $parent = $(this).parent();

                // Toggle this submenu
                $submenu.slideToggle(300);
                $parent.toggleClass('submenu-open');

                // Close other submenus at same level
                $parent.siblings('.menu-item-has-children').find('.sub-menu').slideUp(300);
                $parent.siblings('.menu-item-has-children').removeClass('submenu-open');
            });
        }
    }

    /**
     * Scroll Effects
     */
    function initScrollEffects() {
        var $header = $('.site-header');
        var lastScrollTop = 0;

        $(window).on('scroll', function() {
            var scrollTop = $(this).scrollTop();

            // Add shadow to header on scroll
            if (scrollTop > 50) {
                $header.addClass('scrolled');
            } else {
                $header.removeClass('scrolled');
            }

            // Hide/show header on scroll (optional)
            if (scrollTop > lastScrollTop && scrollTop > 300) {
                // Scrolling down
                $header.addClass('header-hidden');
            } else {
                // Scrolling up
                $header.removeClass('header-hidden');
            }

            lastScrollTop = scrollTop;
        });

        // Fade in elements on scroll
        if ($('.fade-in-on-scroll').length) {
            checkFadeElements();

            $(window).on('scroll', function() {
                checkFadeElements();
            });
        }
    }

    /**
     * Check and fade in elements
     */
    function checkFadeElements() {
        var windowHeight = $(window).height();
        var scrollTop = $(window).scrollTop();

        $('.fade-in-on-scroll').each(function() {
            var elementTop = $(this).offset().top;

            if (elementTop < scrollTop + windowHeight - 100) {
                $(this).addClass('faded-in');
            }
        });
    }

    /**
     * Product Comparison Feature
     */
    var comparisonItems = [];

    window.addToComparison = function(productId, productName) {
        if (comparisonItems.length >= 3) {
            alert('You can compare up to 3 products at a time.');
            return;
        }

        if (comparisonItems.includes(productId)) {
            alert('This product is already in your comparison.');
            return;
        }

        comparisonItems.push(productId);
        updateComparisonUI();

        // Store in sessionStorage
        sessionStorage.setItem('jm_comparison', JSON.stringify(comparisonItems));

        // Track event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'add_to_comparison', {
                'event_category': 'Product',
                'event_label': productName,
                'value': 1
            });
        }
    };

    window.removeFromComparison = function(productId) {
        comparisonItems = comparisonItems.filter(function(id) {
            return id !== productId;
        });
        updateComparisonUI();
        sessionStorage.setItem('jm_comparison', JSON.stringify(comparisonItems));
    };

    function updateComparisonUI() {
        var $comparisonBar = $('#comparison-bar');

        if (comparisonItems.length > 0) {
            $comparisonBar.show();
            $('#comparison-count').text(comparisonItems.length);
        } else {
            $comparisonBar.hide();
        }
    }

    // Load comparison items from sessionStorage on page load
    var storedComparison = sessionStorage.getItem('jm_comparison');
    if (storedComparison) {
        try {
            comparisonItems = JSON.parse(storedComparison);
            updateComparisonUI();
        } catch (e) {
            console.error('Error loading comparison data:', e);
        }
    }

    /**
     * Print Product Page
     */
    window.printProduct = function() {
        window.print();
    };

    /**
     * Share Product
     */
    window.shareProduct = function(platform, url, title) {
        var shareUrl = '';

        switch (platform) {
            case 'linkedin':
                shareUrl = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url);
                break;
            case 'twitter':
                shareUrl = 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(title);
                break;
            case 'facebook':
                shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
                break;
            case 'email':
                shareUrl = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(url);
                window.location.href = shareUrl;
                return;
        }

        if (shareUrl) {
            window.open(shareUrl, 'share-dialog', 'width=600,height=400');
        }

        // Track share event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'share', {
                'event_category': 'Product',
                'event_label': platform,
                'value': 1
            });
        }
    };

    /**
     * Download PDF (if PDF download button exists)
     */
    $('a[href$=".pdf"]').on('click', function() {
        var pdfName = $(this).attr('href').split('/').pop();

        if (typeof gtag !== 'undefined') {
            gtag('event', 'pdf_download', {
                'event_category': 'Resources',
                'event_label': pdfName,
                'value': 1
            });
        }

        if (typeof ga !== 'undefined') {
            ga('send', 'event', 'Resources', 'PDF Download', pdfName);
        }
    });

    /**
     * Video Play Tracking
     */
    $('video').on('play', function() {
        var videoSrc = $(this).find('source').attr('src') || 'unknown';

        if (typeof gtag !== 'undefined') {
            gtag('event', 'video_play', {
                'event_category': 'Video',
                'event_label': videoSrc,
                'value': 1
            });
        }
    });

    /**
     * Accordion functionality (for FAQs, specs, etc.)
     */
    $('.jm-accordion-header').on('click', function() {
        var $content = $(this).next('.jm-accordion-content');
        var $parent = $(this).parent('.jm-accordion-item');

        // Toggle this accordion
        $content.slideToggle(300);
        $parent.toggleClass('active');

        // Optional: close other accordions
        // $parent.siblings('.jm-accordion-item').find('.jm-accordion-content').slideUp(300);
        // $parent.siblings('.jm-accordion-item').removeClass('active');
    });

    /**
     * Back to Top Button
     */
    var $backToTop = $('<button id="back-to-top" aria-label="Back to top">↑</button>');
    $('body').append($backToTop);

    $(window).on('scroll', function() {
        if ($(this).scrollTop() > 300) {
            $backToTop.fadeIn();
        } else {
            $backToTop.fadeOut();
        }
    });

    $backToTop.on('click', function() {
        $('html, body').animate({ scrollTop: 0 }, 600);
        return false;
    });

    /**
     * Lazy Load Images (if not using plugin)
     */
    function lazyLoadImages() {
        var lazyImages = document.querySelectorAll('img[data-src]');

        if ('IntersectionObserver' in window) {
            var imageObserver = new IntersectionObserver(function(entries, observer) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        var img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(function(img) {
                imageObserver.observe(img);
            });
        } else {
            // Fallback for older browsers
            lazyImages.forEach(function(img) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    }

    // Initialize lazy loading if data-src images exist
    if (document.querySelectorAll('img[data-src]').length > 0) {
        lazyLoadImages();
    }

    /**
     * Cookie Consent (basic implementation)
     */
    function checkCookieConsent() {
        if (!localStorage.getItem('jm_cookie_consent')) {
            var consentHTML = '<div id="cookie-consent" class="cookie-consent">' +
                '<p>We use cookies to improve your experience on our site. By continuing to use our site, you accept our use of cookies. ' +
                '<a href="/privacy-policy/">Learn more</a></p>' +
                '<button id="accept-cookies" class="button">Accept</button>' +
                '</div>';

            $('body').append(consentHTML);

            $('#accept-cookies').on('click', function() {
                localStorage.setItem('jm_cookie_consent', 'accepted');
                $('#cookie-consent').fadeOut(300, function() {
                    $(this).remove();
                });
            });
        }
    }

    // Uncomment to enable cookie consent
    // checkCookieConsent();

})(jQuery);
