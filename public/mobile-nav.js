/**
 * Mobile Navigation Handler
 * FAJ Security Management System
 * Handles sidebar toggle and mobile menu functionality
 */

(function () {
    'use strict';

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // Check if we have a sidebar
        const sidebar = document.querySelector('aside');
        if (!sidebar) return;

        // Create mobile menu button
        createMobileMenuButton();

        // Create overlay
        createOverlay();

        // Setup event listeners
        setupEventListeners();

        // Handle window resize
        handleResize();
        window.addEventListener('resize', handleResize);
    }

    function createMobileMenuButton() {
        // Check if button already exists
        if (document.querySelector('.mobile-menu-btn')) return;

        const header = document.querySelector('header');
        if (!header) return;

        const menuButton = document.createElement('button');
        menuButton.className = 'mobile-menu-btn hidden items-center justify-center w-10 h-10 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors';
        menuButton.setAttribute('aria-label', 'فتح القائمة');
        menuButton.innerHTML = '<span class="material-symbols-outlined">menu</span>';

        // Insert at the beginning of header
        header.insertBefore(menuButton, header.firstChild);
    }

    function createOverlay() {
        // Check if overlay already exists
        if (document.querySelector('.sidebar-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    function setupEventListeners() {
        const menuButton = document.querySelector('.mobile-menu-btn');
        const overlay = document.querySelector('.sidebar-overlay');
        const sidebar = document.querySelector('aside');

        if (!menuButton || !overlay || !sidebar) return;

        // Toggle menu
        menuButton.addEventListener('click', toggleMenu);

        // Close menu when clicking overlay
        overlay.addEventListener('click', closeMenu);

        // Close menu when clicking a link (on mobile)
        const sidebarLinks = sidebar.querySelectorAll('a');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    closeMenu();
                }
            });
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMenu();
            }
        });

        // Prevent body scroll when menu is open
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const sidebar = mutation.target;
                    if (sidebar.classList.contains('mobile-open')) {
                        document.body.style.overflow = 'hidden';
                    } else {
                        document.body.style.overflow = '';
                    }
                }
            });
        });

        if (sidebar) {
            observer.observe(sidebar, { attributes: true });
        }
    }

    function toggleMenu() {
        const sidebar = document.querySelector('aside');
        const overlay = document.querySelector('.sidebar-overlay');

        if (!sidebar || !overlay) return;

        const isOpen = sidebar.classList.contains('mobile-open');

        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    function openMenu() {
        const sidebar = document.querySelector('aside');
        const overlay = document.querySelector('.sidebar-overlay');
        const menuButton = document.querySelector('.mobile-menu-btn');

        if (!sidebar || !overlay) return;

        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');

        if (menuButton) {
            menuButton.setAttribute('aria-label', 'إغلاق القائمة');
            menuButton.querySelector('.material-symbols-outlined').textContent = 'close';
        }
    }

    function closeMenu() {
        const sidebar = document.querySelector('aside');
        const overlay = document.querySelector('.sidebar-overlay');
        const menuButton = document.querySelector('.mobile-menu-btn');

        if (!sidebar || !overlay) return;

        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');

        if (menuButton) {
            menuButton.setAttribute('aria-label', 'فتح القائمة');
            menuButton.querySelector('.material-symbols-outlined').textContent = 'menu';
        }
    }

    function handleResize() {
        // Close menu if window is resized to desktop
        if (window.innerWidth > 1024) {
            closeMenu();
        }
    }

    // Make functions globally available for debugging
    window.FAJMobileNav = {
        openMenu,
        closeMenu,
        toggleMenu
    };
})();
