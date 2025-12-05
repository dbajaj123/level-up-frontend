// Global state
let leaderboardData = [];
let sotaScore = 0;
let historicalScores = {}; // Store historical best scores per participant
let currentBenchmark = 0.5; // Baseline score that teams must beat



// API Configuration
const API_URL = 'https://level-up-backend-eight.vercel.app/api';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadFromAPI();
    updateUI();
});

// Parse WhatsApp chat text
function parseWhatsAppChat(text) {
    const lines = text.split('\n');
    const scores = [];
    
    // Regex patterns for WhatsApp messages
    // Formats: 
    // [12/3/24, 10:30:45 AM] John: CV: 0.8542
    // 12/3/24, 10:30 AM - John: Score: 0.8542
    // More flexible pattern that handles various formats
    const patterns = [
        /\[([^\]]+)\]\s*([^:]+):\s*.*?(?:CV|Score|cv|score)[:\s]+([0-9]*\.[0-9]+)/gi,
        /([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4}[^-]*)-\s*([^:]+):\s*.*?(?:CV|Score|cv|score)[:\s]+([0-9]*\.[0-9]+)/gi,
    ];
    
    for (const line of lines) {
        // Try each pattern
        let matched = false;
        for (const pattern of patterns) {
            pattern.lastIndex = 0; // Reset regex
            const match = pattern.exec(line);
            
            if (match && !matched) {
                const timestamp = match[1].trim();
                const name = match[2].trim();
                const score = parseFloat(match[3]);
                
                if (!isNaN(score) && score >= 0 && score <= 1) {
                    scores.push({
                        timestamp: timestamp,
                        name: name,
                        cvScore: score,
                        rawLine: line
                    });
                    matched = true;
                }
            }
        }
    }
    
    return scores;
}

// Sort leaderboard by total points (primary) and CV score (secondary)
function sortLeaderboard() {
    leaderboardData.sort((a, b) => {
        // Primary: Total Points (descending)
        const pointsA = a.totalPoints || 0;
        const pointsB = b.totalPoints || 0;
        if (pointsB !== pointsA) {
            return pointsB - pointsA;
        }
        // Secondary: CV Score (descending)
        return b.cvScore - a.cvScore;
    });
}

// Update UI
function updateUI() {
    updateStats();
    updateLeaderboardTable();
}

// Update stats cards
function updateStats() {
    const sotaEl = document.getElementById('sotaScore');
    const participantsEl = document.getElementById('totalParticipants');
    const lastUpdateEl = document.getElementById('lastUpdate');
    const benchmarkEl = document.getElementById('benchmarkScore');
    
    if (sotaEl) {
        sotaEl.textContent = sotaScore > 0 ? sotaScore.toFixed(4) : '-';
    }
    if (participantsEl) {
        participantsEl.textContent = leaderboardData.length;
    }
    if (lastUpdateEl) {
        lastUpdateEl.textContent = new Date().toLocaleString();
    }
    if (benchmarkEl) {
        benchmarkEl.textContent = currentBenchmark.toFixed(4);
    }
}

// Update leaderboard table
function updateLeaderboardTable() {
    const tbody = document.getElementById('leaderboardBody');
    
    // If leaderboard table doesn't exist on this page, skip
    if (!tbody) {
        return;
    }
    
    console.log('Updating table with', leaderboardData.length, 'participants');
    
    if (leaderboardData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    No data yet. Upload a WhatsApp chat to get started!
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    leaderboardData.forEach((participant, index) => {
        const rank = index + 1;
        const row = document.createElement('tr');
        
        // Rank
        const rankCell = document.createElement('td');
        let rankClass = 'rank';
        if (rank === 1) rankClass += ' rank-1';
        else if (rank === 2) rankClass += ' rank-2';
        else if (rank === 3) rankClass += ' rank-3';
        
        rankCell.innerHTML = `<span class="${rankClass}">#${rank}</span>`;
        row.appendChild(rankCell);
        
        // Participant name
        const nameCell = document.createElement('td');
        nameCell.innerHTML = `<span class="participant-name">${escapeHtml(participant.name)}</span>`;
        row.appendChild(nameCell);
        
        // CV Score
        const scoreCell = document.createElement('td');
        scoreCell.innerHTML = `<span class="cv-score">${participant.cvScore.toFixed(4)}</span>`;
        row.appendChild(scoreCell);
        
        // Points
        const pointsCell = document.createElement('td');
        const totalPoints = participant.totalPoints || 0;
        const submissionCount = participant.submissionCount || 1;
        pointsCell.innerHTML = `<span class="points-value">${totalPoints.toFixed(2)}</span><br><span class="submission-count">${submissionCount} submission${submissionCount > 1 ? 's' : ''}</span>`;
        row.appendChild(pointsCell);
        
        // Time Bonus (removed from table, kept for future use)
        const timeBonusCell = document.createElement('td');
        const lastPoints = participant.lastSubmissionPoints || 0;
        timeBonusCell.innerHTML = `<span class="last-submission">+${lastPoints.toFixed(2)}</span>`;
        row.appendChild(timeBonusCell);
        
        // Improvement
        const improvementCell = document.createElement('td');
        const improvement = participant.improvement;
        let improvementClass = 'improvement ';
        let improvementSign = '';
        
        if (improvement > 0) {
            improvementClass += 'positive';
            improvementSign = '+';
        } else if (improvement < 0) {
            improvementClass += 'negative';
        } else {
            improvementClass += 'neutral';
        }
        
        improvementCell.innerHTML = `<span class="${improvementClass}">${improvementSign}${improvement.toFixed(4)}</span>`;
        row.appendChild(improvementCell);
        
        // Status
        const statusCell = document.createElement('td');
        let statusClass = 'status-badge ';
        let statusText = '';
        
        if (participant.cvScore === sotaScore && sotaScore > 0) {
            statusClass += 'status-new-sota';
            statusText = 'SOTA';
        } else if (totalPoints > 0) {
            statusClass += 'status-improved';
            statusText = 'Scored';
        } else {
            statusClass += 'status-submitted';
            statusText = 'Below Benchmark';
        }
        
        statusCell.innerHTML = `<span class="${statusClass}">${statusText}</span>`;
        row.appendChild(statusCell);
        
        tbody.appendChild(row);
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API functions for global storage
async function loadFromAPI() {
    try {
        // Add cache buster to prevent stale data
        const cacheBuster = `?t=${Date.now()}`;
        console.log('Loading from API:', `${API_URL}/leaderboard${cacheBuster}`);
        const response = await fetch(`${API_URL}/leaderboard${cacheBuster}`);
        const result = await response.json();
        
        console.log('API Response:', result);
        
        if (result.success) {
            leaderboardData = result.data.leaderboardData || [];
            sotaScore = result.data.sotaScore || 0;
            historicalScores = result.data.historicalScores || {};
            
            console.log('Loaded data:', {
                participantCount: leaderboardData.length,
                participants: leaderboardData.map(p => ({ 
                    name: p.name, 
                    cvScore: p.cvScore,
                    totalPoints: p.totalPoints, 
                    submissionCount: p.submissionCount,
                    improvement: p.improvement,
                    lastSubmissionPoints: p.lastSubmissionPoints
                })),
                sotaScore,
                historicalScores
            });
        } else {
            console.error('API returned success=false:', result);
        }
    } catch (error) {
        console.error('Error loading from API:', error);
    }
}

async function updateLeaderboardAPI(newScores) {
    try {
        console.log('Sending to API:', newScores);
        const response = await fetch(`${API_URL}/leaderboard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scores: newScores,
                resetLeaderboard: true, // Always reset on upload
                activity: {
                    fileName: 'WhatsApp Chat',
                    scoresFound: newScores.length,
                    participants: [...new Set(newScores.map(s => s.name))]
                }
            })
        });
        
        const result = await response.json();
        console.log('API response:', result);
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to update leaderboard');
        }
        
        return result;
    } catch (error) {
        console.error('Error updating API:', error);
        throw error;
    }
}
