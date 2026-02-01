/**
 * branded-loader.js
 * Injects a premium pre-loading screen with the FAJ Identity.
 * Duration: 1.2 seconds.
 */

(function () {
    // Create styles
    const style = document.createElement('style');
    style.textContent = `
        #faj-preloader {
            position: fixed;
            inset: 0;
            background-color: rgba(255, 255, 255, 0.2); /* Transparent White */
            backdrop-filter: blur(16px); /* Heavy Blur (Glassmorphism) */
            -webkit-backdrop-filter: blur(16px);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: opacity 0.5s ease-out, visibility 0.5s ease-out;
            opacity: 1;
            visibility: visible;
            box-shadow: inset 0 0 100px rgba(0,0,0,0.05);
        }

        #faj-preloader.fade-out {
            opacity: 0;
            visibility: hidden;
        }

        .faj-loader-content {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }

        .faj-logo-pulse {
            width: 90px;
            height: 90px;
            object-fit: contain;
            /* Ensure logo pops against glass */
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
            margin-bottom: 32px;
            animation: float-logo 3s ease-in-out infinite;
        }

        /* Premium SVG Spinner */
        .faj-spinner-svg {
            width: 50px;
            height: 50px;
            animation: rotate 2s linear infinite;
        }
        
        .faj-spinner-circle {
            stroke: #162841; /* Primary Color */
            stroke-width: 3;
            stroke-dasharray: 1, 150; /* Start small */
            stroke-dashoffset: 0;
            stroke-linecap: round;
            fill: none;
            animation: dash 1.5s ease-in-out infinite;
        }

        @keyframes float-logo {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }

        @keyframes rotate {
            100% { transform: rotate(360deg); }
        }

        @keyframes dash {
            0% {
                stroke-dasharray: 1, 150;
                stroke-dashoffset: 0;
            }
            50% {
                stroke-dasharray: 90, 150;
                stroke-dashoffset: -35;
            }
            100% {
                stroke-dasharray: 90, 150;
                stroke-dashoffset: -124;
            }
        }
    `;
    document.head.appendChild(style);

    // Create DOM elements
    const loaderDiv = document.createElement('div');
    loaderDiv.id = 'faj-preloader';
    loaderDiv.innerHTML = `
        <div class="faj-loader-content">
            <img src="loader-logo.png" alt="FAJ Security" class="faj-logo-pulse">
            <svg class="faj-spinner-svg" viewBox="0 0 50 50">
                <circle class="faj-spinner-circle" cx="25" cy="25" r="20"></circle>
            </svg>
        </div>
    `;

    // Inject immediately
    if (document.body) {
        document.body.appendChild(loaderDiv);
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(loaderDiv);
        });
    }

    // Remove logic
    const MIN_LOADING_TIME = 1200; // 1.2 seconds
    const startTime = Date.now();

    function removeLoader() {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

        setTimeout(() => {
            const loader = document.getElementById('faj-preloader');
            if (loader) {
                loader.classList.add('fade-out');
                setTimeout(() => {
                    loader.remove();
                }, 500); // Wait for fade out transition
            }
        }, remainingTime);
    }

    // Wait for full page load or fallback
    if (document.readyState === 'complete') {
        removeLoader();
    } else {
        window.addEventListener('load', removeLoader);
        // Fallback: If load event doesn't fire quickly (e.g. stalled network image), force remove after 3s max
        setTimeout(removeLoader, 3000);
    }
})();
