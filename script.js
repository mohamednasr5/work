// 1. Firebase Configuration (استبدل بالبيانات الخاصة بك إذا لزم الأمر)
const firebaseConfig = {
    apiKey: "AIzaSyC4J8ncbuejvzfWvzCTAXRzjFgvrchXpE8",
    authDomain: "hedor-bea3c.firebaseapp.com",
    databaseURL: "https://hedor-bea3c-default-rtdb.firebaseio.com",
    projectId: "hedor-bea3c",
    storageBucket: "hedor-bea3c.firebasestorage.app",
    messagingSenderId: "369239455736",
    appId: "1:369239455736:web:116295854269abecf6480d"
};

// Initialize Firebase
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database().ref('parliament-requests');

// 2. Web Component: Document Entry (Shadow DOM)
class DocumentEntry extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const docName = this.getAttribute('name') || '';
        const docDesc = this.getAttribute('desc') || '';

        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; animation: fadeIn 0.3s ease; }
                .doc-row { 
                    display: grid; grid-template-columns: 1fr 2fr auto; gap: 10px; 
                    background: rgba(255,255,255,0.5); padding: 10px; border-radius: 12px; margin-bottom: 10px;
                    border: 1px solid rgba(0,0,0,0.05); align-items: center;
                }
                input { 
                    width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px; 
                    font-family: 'Cairo'; outline: none; background: rgba(255,255,255,0.8);
                }
                .btn-del { 
                    background: #ff4d4d; color: white; border: none; border-radius: 8px; 
                    width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                @media(max-width: 600px) { .doc-row { grid-template-columns: 1fr; } .btn-del { width: 100%; } }
            </style>
            <div class="doc-row">
                <input type="text" class="d-name" placeholder="اسم المستند" value="${docName}">
                <input type="text" class="d-desc" placeholder="وصف / ملاحظات" value="${docDesc}">
                <button class="btn-del" title="حذف">✖</button>
            </div>
        `;

        this.shadowRoot.querySelector('.btn-del').addEventListener('click', () => this.remove());
    }

    getData() {
        return {
            name: this.shadowRoot.querySelector('.d-name').value,
            description: this.shadowRoot.querySelector('.d-desc').value
        };
    }
}
customElements.define('document-entry', DocumentEntry);

// 3. Application Logic
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupTheme();
    loadRequests();
    
    // Date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Document Toggle Logic
    const docToggle = document.getElementById('hasDocumentsToggle');
    const docArea = document.getElementById('documentsArea');
    const docContainer = document.getElementById('docsContainer');

    docToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            docArea.classList.remove('hidden');
            if (docContainer.children.length === 0) addDocumentField();
        } else {
            docArea.classList.add('hidden');
            docContainer.innerHTML = ''; 
        }
    });

    document.getElementById('addDocBtn').addEventListener('click', addDocumentField);
    
    // Form Submit
    document.getElementById('requestForm').addEventListener('submit', handleFormSubmit);

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Failed', err));
    }
});

function addDocumentField(name = '', desc = '') {
    const docElem = document.createElement('document-entry');
    if(name) docElem.setAttribute('name', name);
    if(desc) docElem.setAttribute('desc', desc);
    document.getElementById('docsContainer').appendChild(docElem);
}

// Navigation Logic
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.page-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            document.getElementById(target).classList.add('active');
        });
    });
}

// Handle Form Submit
function handleFormSubmit(e) {
    e.preventDefault();
    
    // Collect Documents Data from Web Components
    let documents = [];
    if (document.getElementById('hasDocumentsToggle').checked) {
        const docElements = document.querySelectorAll('document-entry');
        docElements.forEach(el => {
            const data = el.getData();
            if (data.name) documents.push(data);
        });
    }

    const requestData = {
        reqId: document.getElementById('reqId').value,
        title: document.getElementById('reqTitle').value,
        details: document.getElementById('reqDetails').value,
        authority: document.getElementById('reqAuthority').value,
        submissionDate: document.getElementById('reqDate').value,
        status: document.getElementById('reqStatus').value,
        documents: documents,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    const key = document.getElementById('firebaseKey').value;
    
    if (key) {
        db.child(key).update(requestData)
            .then(() => { alert('تم التحديث بنجاح'); resetForm(); });
    } else {
        db.push(requestData)
            .then(() => { alert('تم الحفظ بنجاح'); resetForm(); });
    }
}

function resetForm() {
    document.getElementById('requestForm').reset();
    document.getElementById('firebaseKey').value = '';
    document.getElementById('documentsArea').classList.add('hidden');
    document.getElementById('docsContainer').innerHTML = '';
    document.querySelector('[data-target="view-requests"]').click();
}

// Load Requests & Render Table
function loadRequests() {
    db.on('value', snapshot => {
        const data = snapshot.val();
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        
        let total = 0, completed = 0, pending = 0;

        if (data) {
            Object.keys(data).forEach(key => {
                const req = data[key];
                total++;
                if (req.status === 'completed') completed++;
                else pending++;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${req.reqId}</strong></td>
                    <td>${req.title}</td>
                    <td>${req.authority}</td>
                    <td>${req.submissionDate}</td>
                    <td>${req.documents && req.documents.length > 0 ? '<i class="fa-solid fa-paperclip" style="color:var(--primary)"></i> ' + req.documents.length : '-'}</td>
                    <td><span class="badge ${req.status}">${getStatusText(req.status)}</span></td>
                `;
                tr.addEventListener('click', () => editRequest(key, req));
                tbody.appendChild(tr);
            });
        }
        
        updateStats(total, completed, pending);
    });
}

function getStatusText(status) {
    const map = { 'review': 'مراجعة', 'execution': 'تنفيذ', 'completed': 'مكتمل', 'rejected': 'مرفوض' };
    return map[status] || status;
}

function updateStats(total, comp, pend) {
    document.getElementById('total-count').textContent = total;
    document.getElementById('completed-count').textContent = comp;
    document.getElementById('pending-count').textContent = pend;
    initChart(comp, pend, total - (comp + pend));
}

function editRequest(key, req) {
    document.getElementById('firebaseKey').value = key;
    document.getElementById('reqId').value = req.reqId;
    document.getElementById('reqTitle').value = req.title;
    document.getElementById('reqDetails').value = req.details;
    document.getElementById('reqAuthority').value = req.authority;
    document.getElementById('reqDate').value = req.submissionDate;
    document.getElementById('reqStatus').value = req.status;

    // Handle Documents Loading
    const docToggle = document.getElementById('hasDocumentsToggle');
    const docArea = document.getElementById('documentsArea');
    const docContainer = document.getElementById('docsContainer');
    
    docContainer.innerHTML = '';
    
    if (req.documents && req.documents.length > 0) {
        docToggle.checked = true;
        docArea.classList.remove('hidden');
        req.documents.forEach(doc => {
            addDocumentField(doc.name, doc.description);
        });
    } else {
        docToggle.checked = false;
        docArea.classList.add('hidden');
    }

    document.querySelector('[data-target="add-request"]').click();
}

// Dark Mode
function setupTheme() {
    const toggle = document.getElementById('theme-toggle');
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        toggle.checked = true;
    }
    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    });
}

// Simple Chart (Requires Chart.js loaded in HTML)
let myChart;
function initChart(comp, pend, rej) {
    const ctx = document.getElementById('requestsChart').getContext('2d');
    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['مكتمل', 'قيد التنفيذ', 'مرفوض/آخر'],
            datasets: [{
                data: [comp, pend, rej],
                backgroundColor: ['#4cc9f0', '#f72585', '#4361ee'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
    });
}
