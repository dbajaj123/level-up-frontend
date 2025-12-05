// Upload page specific functionality
const UPLOAD_PASSWORD = 'levelup2024'; // Change this to your desired password

document.addEventListener('DOMContentLoaded', () => {
    // Password protection
    const passwordOverlay = document.getElementById('passwordOverlay');
    const passwordInput = document.getElementById('passwordInput');
    const passwordSubmit = document.getElementById('passwordSubmit');
    const passwordError = document.getElementById('passwordError');
    
    // Check if already authenticated in this session
    if (sessionStorage.getItem('uploadAuth') === 'true') {
        passwordOverlay.style.display = 'none';
    }
    
    passwordSubmit.addEventListener('click', () => {
        if (passwordInput.value === UPLOAD_PASSWORD) {
            sessionStorage.setItem('uploadAuth', 'true');
            passwordOverlay.style.display = 'none';
            passwordError.style.display = 'none';
        } else {
            passwordError.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });
    
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            passwordSubmit.click();
        }
    });
    
    loadActivityLog();
    updateStorageStatus();
    
    const parseBtn = document.getElementById('parseBtn');
    const chatUpload = document.getElementById('chatUpload');
    
    if (parseBtn) {
        parseBtn.addEventListener('click', handleChatUpload);
    }
    
    if (chatUpload) {
        chatUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const fileName = e.target.files[0].name;
                document.getElementById('fileName').textContent = fileName;
            }
        });

        // Drag and drop functionality
        const uploadLabel = document.querySelector('.upload-label-large');
        
        uploadLabel.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadLabel.style.borderColor = '#0099ff';
            uploadLabel.style.background = 'rgba(0, 212, 255, 0.2)';
        });

        uploadLabel.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadLabel.style.borderColor = '#00d4ff';
            uploadLabel.style.background = 'rgba(0, 212, 255, 0.05)';
        });

        uploadLabel.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadLabel.style.borderColor = '#00d4ff';
            uploadLabel.style.background = 'rgba(0, 212, 255, 0.05)';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                chatUpload.files = files;
                document.getElementById('fileName').textContent = files[0].name;
            }
        });
    }
});

// Handle chat upload
async function handleChatUpload() {
    const fileInput = document.getElementById('chatUpload');
    const file = fileInput.files[0];
    const statusDiv = document.getElementById('uploadStatus');
    
    if (!file) {
        showStatus('Error: Please select a WhatsApp chat file first!', 'error');
        return;
    }
    
    showStatus('Processing chat file...', 'loading');
    
    try {
        const text = await file.text();
        
        if (typeof parseWhatsAppChat !== 'function') {
            showStatus('Error: Parser not loaded. Please refresh the page.', 'error');
            return;
        }
        
        const newScores = parseWhatsAppChat(text);
        
        console.log('Parsed scores:', newScores);
        
        if (newScores.length === 0) {
            showStatus('Error: No valid scores found in the chat. Make sure scores are in format "CV: 0.XXXX" or "Score: 0.XXXX"', 'error');
            return;
        }
        
        // Update leaderboard via API
        console.log('Updating leaderboard API with', newScores.length, 'scores');
        const updateResult = await updateLeaderboardAPI(newScores);
        console.log('Update result:', updateResult);
        
        console.log('Loading fresh data from API');
        await loadFromAPI();
        
        // Log activity locally for this session
        logActivity({
            timestamp: new Date().toISOString(),
            fileName: file.name,
            scoresFound: newScores.length,
            participants: [...new Set(newScores.map(s => s.name))]
        });
        
        showStatus(`Successfully processed ${newScores.length} score(s) from ${[...new Set(newScores.map(s => s.name))].length} participant(s).`, 'success');
        
        // Reset file input
        fileInput.value = '';
        document.getElementById('fileName').textContent = 'Choose File or Drag & Drop';
        
        // Show button to go to leaderboard
        setTimeout(() => {
            statusDiv.innerHTML += '<br><a href="index.html" class="btn-secondary" style="margin-top: 15px;">View Updated Leaderboard</a>';
        }, 500);
        
    } catch (error) {
        console.error('Error processing file:', error);
        showStatus('Error: Failed to process file. Please check the console for details.', 'error');
    }
}

// Show status message
function showStatus(message, type) {
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.className = `upload-status ${type}`;
    statusDiv.innerHTML = message;
}

// Log activity
function logActivity(activity) {
    try {
        let activityLog = JSON.parse(localStorage.getItem('activityLog') || '[]');
        activityLog.unshift(activity);
        
        // Keep only last 10 activities
        if (activityLog.length > 10) {
            activityLog = activityLog.slice(0, 10);
        }
        
        localStorage.setItem('activityLog', JSON.stringify(activityLog));
        loadActivityLog();
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

// Load activity log
function loadActivityLog() {
    const activityLogDiv = document.getElementById('activityLog');
    if (!activityLogDiv) return;
    
    try {
        const activityLog = JSON.parse(localStorage.getItem('activityLog') || '[]');
        
        if (activityLog.length === 0) {
            activityLogDiv.innerHTML = '<p class="empty-state">No uploads yet</p>';
            return;
        }
        
        activityLogDiv.innerHTML = activityLog.map(activity => {
            const date = new Date(activity.timestamp);
            return `
                <div class="activity-item">
                    <div class="activity-icon">FILE</div>
                    <div class="activity-details">
                        <div class="activity-file">${activity.fileName}</div>
                        <div class="activity-meta">
                            ${activity.scoresFound} score(s) • ${activity.participants.length} participant(s) • 
                            ${date.toLocaleDateString()} ${date.toLocaleTimeString()}
                        </div>
                        <div class="activity-participants">
                            ${activity.participants.join(', ')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading activity log:', error);
        activityLogDiv.innerHTML = '<p class="empty-state">Error loading activity log</p>';
    }
}

// Update storage status in navbar
function updateStorageStatus() {
    const statusSpan = document.getElementById('storageStatus');
    if (!statusSpan) return;
    
    try {
        if (typeof leaderboardData !== 'undefined' && leaderboardData.length > 0) {
            statusSpan.textContent = `${leaderboardData.length} participants (Global)`;
        } else {
            statusSpan.textContent = 'Loading... (Global)';
        }
    } catch (error) {
        statusSpan.textContent = 'Storage unavailable';
    }
}
