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
            background-color: #162841; /* Primary Brand Color */
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: opacity 0.5s ease-out, visibility 0.5s ease-out;
            opacity: 1;
            visibility: visible;
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
        }

        .faj-logo-pulse {
            width: 80px;
            height: 80px;
            object-fit: contain;
            animation: pulse-logo 2s infinite ease-in-out;
            filter: drop-shadow(0 0 20px rgba(255,255,255,0.2));
            margin-bottom: 24px;
        }

        .faj-loader-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: #4C8E4D; /* Secondary Color */
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes pulse-logo {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 0.8; }
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // Create DOM elements
    const loaderDiv = document.createElement('div');
    loaderDiv.id = 'faj-preloader';
    loaderDiv.innerHTML = `
        <div class="faj-loader-content">
            <img src="logo.png" alt="FAJ Security" class="faj-logo-pulse">
            <div class="faj-loader-spinner"></div>
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
