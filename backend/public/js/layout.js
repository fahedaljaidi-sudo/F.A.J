document.addEventListener('DOMContentLoaded', async () => {
    // Role-based access control
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const currentPage = document.body.dataset.page || '';
    
    // Super Admin should only access the super-admin page
    if (user.role === 'super_admin' && ['dashboard', 'visitors', 'patrols', 'reports', 'users', 'permissions'].includes(currentPage)) {
        window.location.href = '/super-admin.html';
        return;
    }

    // Load Sidebar
    try {
        const sidebarContainer = document.querySelector('aside');
        if (sidebarContainer) {
            const response = await fetch('/components/sidebar.html');
            if (response.ok) {
                const html = await response.text();
                sidebarContainer.innerHTML = html;
                
                // Set Active State
                const currentPage = document.body.dataset.page || '';
                const activeLink = sidebarContainer.querySelector(`a[data-page="${currentPage}"]`);
                
                if (activeLink) {
                    activeLink.classList.remove('text-blue-200', 'hover:bg-white/10');
                    activeLink.classList.add('bg-white/15', 'text-white', 'border-r-4', 'border-secondary');
                    activeLink.querySelector('.font-medium').classList.replace('font-medium', 'font-bold');
                }

                // Check Role-based Visibility
                if (user.role === 'super_admin') {
                    // Hide operational links for Super Admin
                    const operationalLinks = sidebarContainer.querySelectorAll('a[data-page="dashboard"], a[data-page="visitors"], a[data-page="patrols"], a[data-page="reports"]');
                    operationalLinks.forEach(link => link.classList.add('hidden'));
                    
                    const superAdminLink = document.getElementById('super-admin-link');
                    if (superAdminLink) superAdminLink.classList.remove('hidden');
                } else {
                    // Regular roles logic
                    if (user.role === 'admin' || user.role === 'supervisor') {
                        const adminLink = document.getElementById('admin-link');
                        if (adminLink) adminLink.classList.remove('hidden');
                    }
                    
                    if (user.role === 'admin') {
                        const permissionsLink = document.getElementById('admin-link-permissions');
                        if (permissionsLink) permissionsLink.classList.remove('hidden');
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading sidebar:', error);
    }
});

function logout() {
    localStorage.clear();
    window.location.href = '/';
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                // Check for updates on every load
                registration.update();
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
