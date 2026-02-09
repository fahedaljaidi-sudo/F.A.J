/**
 * Premium Success Modal
 * Injects styles and HTML for a beautiful success feedback with confetti.
 */

(function() {
    // Load canvas-confetti from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
    document.head.appendChild(script);

    // Inject Styles
    const style = document.createElement('style');
    style.textContent = `
        #success-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease-out;
        }

        #success-modal-overlay.active {
            opacity: 1;
            visibility: visible;
        }

        #success-modal-card {
            background: white;
            border-radius: 24px;
            padding: 40px;
            width: 90%;
            max-width: 400px;
            text-align: center;
            transform: scale(0.8) translateY(20px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            position: relative;
            overflow: hidden;
        }

        #success-modal-overlay.active #success-modal-card {
            transform: scale(1) translateY(0);
            opacity: 1;
        }

        .success-checkmark-circle {
            width: 80px;
            height: 80px;
            background: #DCFCE7;
            border-radius: 50%;
            margin: 0 auto 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }

        .success-checkmark-circle::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: #22c55e;
            opacity: 0.2;
            animation: pulse-ring 2s infinite;
        }

        .success-checkmark {
            width: 40px;
            height: 40px;
            color: #16a34a;
            stroke-width: 3;
            stroke: currentColor;
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
        }

        #success-modal-overlay.active .success-checkmark {
            animation: draw-check 0.6s 0.2s forwards ease-in-out;
        }

        #success-title {
            font-family: 'Public Sans', sans-serif;
            font-weight: 800;
            font-size: 24px;
            color: #162841;
            margin-bottom: 8px;
        }

        #success-message {
            font-family: 'Public Sans', sans-serif;
            color: #64748b;
            font-size: 15px;
            line-height: 1.5;
            margin-bottom: 32px;
        }

        #success-btn {
            background: #162841;
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s;
            font-family: inherit;
        }

        #success-btn:hover {
            background: #233b5c;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(22, 40, 65, 0.2);
        }

        @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(1.5); opacity: 0; }
        }

        @keyframes draw-check {
            to { stroke-dashoffset: 0; }
        }
    `;
    document.head.appendChild(style);

    // Inject HTML and Logic when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        const successModalHTML = `
            <div id="success-modal-overlay">
                <div id="success-modal-card">
                    <div class="success-checkmark-circle">
                        <svg class="success-checkmark" viewBox="0 0 24 24">
                            <path d="M20 6L9 17l-5-5"></path>
                        </svg>
                    </div>
                    <h2 id="success-title">Success!</h2>
                    <p id="success-message">Operation completed successfully.</p>
                    <button id="success-btn">موافق</button>
                </div>
            </div>
        `;

        const confirmModalHTML = `
            <div id="confirm-modal-overlay" style="
                position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); z-index: 9999;
                display: flex; align-items: center; justify-content: center; opacity: 0; visibility: hidden; transition: all 0.3s ease-out;
            ">
                <div id="confirm-modal-card" style="
                    background: white; border-radius: 24px; padding: 32px; width: 90%; max-width: 400px; text-align: center;
                    transform: scale(0.8) translateY(20px); opacity: 0; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                ">
                    <div style="margin-bottom: 20px;">
                        <span class="material-symbols-outlined" style="font-size: 48px; color: #F59E0B;">help</span>
                    </div>
                    <h2 id="confirm-title" style="font-family: inherit; font-weight: 800; font-size: 22px; color: #162841; margin-bottom: 8px;">هل أنت متأكد؟</h2>
                    <p id="confirm-message" style="font-family: inherit; color: #64748b; font-size: 15px; line-height: 1.5; margin-bottom: 32px;">لا يمكن التراجع عن هذا الإجراء.</p>
                    <div style="display: flex; gap: 12px;">
                        <button id="confirm-cancel-btn" style="
                            flex: 1; background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px;
                            font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s;
                        ">إلغاء</button>
                        <button id="confirm-yes-btn" style="
                            flex: 1; background: #162841; color: white; border: none; padding: 12px; border-radius: 12px;
                            font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s;
                        ">تأكيد</button>
                    </div>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = successModalHTML + confirmModalHTML;
        document.body.appendChild(div);

        // --- Success Modal Logic ---
        const successOverlay = document.getElementById('success-modal-overlay');
        const successBtn = document.getElementById('success-btn');
        const titleEl = document.getElementById('success-title');
        const msgEl = document.getElementById('success-message');

        function hideSuccessModal() {
            successOverlay.classList.remove('active');
        }

        successBtn.addEventListener('click', hideSuccessModal);
        successOverlay.addEventListener('click', (e) => {
            if (e.target === successOverlay) hideSuccessModal();
        });

        window.showSuccessModal = function (title, message) {
            if (titleEl) titleEl.textContent = title;
            if (msgEl) msgEl.textContent = message;
            if (successOverlay) successOverlay.classList.add('active');

            if (window.confetti) {
                window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#162841', '#4C8E4D', '#FBBF24', '#ffffff'] });
                setTimeout(() => {
                    window.confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#162841', '#4C8E4D'] });
                    window.confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#162841', '#4C8E4D'] });
                }, 300);
            }
        };

        // --- Confirm Modal Logic ---
        const confirmOverlay = document.getElementById('confirm-modal-overlay');
        const confirmCard = document.getElementById('confirm-modal-card');
        const confirmTitle = document.getElementById('confirm-title');
        const confirmMessage = document.getElementById('confirm-message');
        const confirmYesBtn = document.getElementById('confirm-yes-btn');
        const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

        let confirmResolve = null;

        function hideConfirmModal() {
            confirmOverlay.style.opacity = '0';
            confirmOverlay.style.visibility = 'hidden';
            confirmCard.style.opacity = '0';
            confirmCard.style.transform = 'scale(0.8) translateY(20px)';
            if (confirmResolve) confirmResolve(false);
        }

        confirmCancelBtn.addEventListener('click', () => {
            hideConfirmModal();
        });

        confirmYesBtn.addEventListener('click', () => {
            confirmOverlay.style.opacity = '0';
            confirmOverlay.style.visibility = 'hidden';
            confirmCard.style.opacity = '0';
            confirmCard.style.transform = 'scale(0.8) translateY(20px)';
            if (confirmResolve) confirmResolve(true);
        });

        window.showConfirmModal = function (title, message, isDestructive = false) {
            return new Promise((resolve) => {
                confirmResolve = resolve;
                confirmTitle.textContent = title;
                confirmMessage.textContent = message;

                if (isDestructive) {
                    confirmYesBtn.style.background = '#ef4444'; // Red
                    confirmYesBtn.textContent = 'حذف';
                } else {
                    confirmYesBtn.style.background = '#162841'; // Primary
                    confirmYesBtn.textContent = 'تأكيد';
                }

                confirmOverlay.style.visibility = 'visible';
                confirmOverlay.style.opacity = '1';
                confirmCard.style.opacity = '1';
                confirmCard.style.transform = 'scale(1) translateY(0)';
            });
        };
    });
})();
