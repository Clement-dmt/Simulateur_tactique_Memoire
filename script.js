// --- 1. SÉLECTION DES ÉLÉMENTS DU DOM ---
const sliders = {
    cac: document.getElementById('slide-cac'),
    oat: document.getElementById('slide-oat'),
    stoxx: document.getElementById('slide-stoxx'),
    bund: document.getElementById('slide-bund'),
    aum: document.getElementById('slide-aum') // <--- Ajout du slider AUM
};

const displays = {
    cac: document.getElementById('val-cac'),
    oat: document.getElementById('val-oat'),
    stoxx: document.getElementById('val-stoxx'),
    bund: document.getElementById('val-bund'),
    aum: document.getElementById('val-aum') // <--- Ajout de l'affichage AUM
};

const kpiMdd = document.getElementById('kpi-mdd');
const kpiSortino = document.getElementById('kpi-sortino');
const kpiCorr = document.getElementById('kpi-corr');

const triggerToggle = document.getElementById('trigger-toggle');
const slideSpread = document.getElementById('slide-spread');
const valSpread = document.getElementById('val-spread');
const logBody = document.getElementById('log-body');
const btnReset = document.getElementById('btn-reset');
const crisisSelector = document.getElementById('crisis-selector');

// --- 2. BASE DE DONNÉES DES SCÉNARIOS ---
const allScenarios = {
    june2024: {
        name: "June 2024 (Parliament Dissolution)",
        mdd: { cac: -16.7, oat: -15.8, stoxx: -11.4, bund: -4.5 },
        sortino: { cac: 0.45, oat: 0.15, stoxx: 0.65, bund: 1.12 },
        crisisSpread: 83,
        peakCorr: 0.68,
        baseCorr: -0.45,
        dailySpreads: [45, 48, 53, 61, 67, 72, 76, 81, 79, 83, 80, 78, 74, 71, 69, 66, 64, 61, 59, 57],
        trajectory: [0, -0.08, -0.15, -0.12, -0.28, -0.45, -0.38, -0.65, -0.82, -1.0, -0.95, -0.88, -0.75, -0.80, -0.65, -0.55, -0.70, -0.50, -0.40, -0.35]
    },
    dec2025: {
        name: "Dec 2025 (Budget Vote Crisis)",
        mdd: { cac: -12.4, oat: -10.2, stoxx: -8.5, bund: -2.1 },
        sortino: { cac: 0.30, oat: 0.10, stoxx: 0.50, bund: 0.90 },
        crisisSpread: 75, 
        peakCorr: 0.55,
        baseCorr: -0.30,
        dailySpreads: [40, 42, 45, 49, 53, 58, 62, 65, 68, 71, 75, 73, 70, 67, 65, 62, 60, 58, 55, 52],
        trajectory: [0, -0.05, -0.18, -0.25, -0.20, -0.40, -0.60, -0.55, -0.75, -0.85, -1.0, -0.92, -0.85, -0.78, -0.65, -0.70, -0.55, -0.45, -0.30, -0.25]
    }
};

const labels = Array.from({length: 20}, (_, i) => `J${i+1}`);
let chartEquity, chartDrawdown, chartCorr;

let isTriggerFired = false; 
let currentTriggerThreshold = 70;

// --- 3. FONCTION DU TERMINAL DE LOG ---
function addLog(message, type = 'normal') {
    const p = document.createElement('p');
    let color = '#10b981'; 
    if(type === 'warning') color = '#f59e0b';
    if(type === 'danger') color = '#ef4444';
    if(type === 'info') color = '#3b82f6';
    
    p.style.color = color;
    const now = new Date();
    p.innerText = `[${now.toLocaleTimeString()}] > ${message}`;
    
    logBody.appendChild(p);
    logBody.scrollTop = logBody.scrollHeight;
}

// --- 4. LE PLUGIN CHART.JS (LA LIGNE ROUGE) ---
const vueSoutenancePlugin = {
    id: 'vueSoutenance',
    afterDraw: function(chart) {
        if (isTriggerFired) {
            const ctx = chart.ctx;
            const yAxis = chart.scales.y || chart.scales['y-axis-0'];
            
            if (!yAxis) return;

            let currentScenario = allScenarios[crisisSelector.value];
            let triggerDayIndex = currentScenario.dailySpreads.findIndex(spread => spread >= currentTriggerThreshold);
            if (triggerDayIndex === -1) return;

            const meta = chart.getDatasetMeta(0);
            if (!meta.data[triggerDayIndex]) return;
            const xPixel = meta.data[triggerDayIndex].x;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xPixel, yAxis.top);
            ctx.lineTo(xPixel, yAxis.bottom);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ef4444'; 
            ctx.setLineDash([6, 6]); 
            ctx.stroke();
            
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            
            let textX = xPixel > (chart.width / 2) ? xPixel - 60 : xPixel + 60;
            ctx.fillText(`⚡ SIGNAL: ${currentTriggerThreshold} bps`, textX, yAxis.top + 15);
            ctx.restore();
        }
    }
};

// --- 5. INITIALISATION DES GRAPHIQUES ---
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { labels: { color: '#f8fafc', font: { family: 'Inter' } } } },
    scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
    }
};

function initCharts() {
    const ctxEq = document.getElementById('chart-equity').getContext('2d');
    chartEquity = new Chart(ctxEq, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Portfolio Equity Curve (Base 100)', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', data: [], fill: true, tension: 0.3 }]},
        options: { ...chartOptions, plugins: { title: { display: true, text: 'Simulated Performance', color: '#94a3b8' } } },
        plugins: [vueSoutenancePlugin]
    });

    const ctxDd = document.getElementById('chart-drawdown').getContext('2d');
    chartDrawdown = new Chart(ctxDd, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Underwater Drawdown (%)', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.5)', data: [], fill: true, tension: 0.1 }]},
        options: { ...chartOptions, plugins: { title: { display: true, text: 'Capital Destruction', color: '#94a3b8' } }, scales: { y: { min: -20, max: 0, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } } },
        plugins: [vueSoutenancePlugin]
    });

    const ctxCorr = document.getElementById('chart-corr').getContext('2d');
    chartCorr = new Chart(ctxCorr, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Rolling Correlation (CAC/Bonds)', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], fill: true, tension: 0.4 }]},
        options: { ...chartOptions, plugins: { title: { display: true, text: 'Diversification Breakdown', color: '#94a3b8' } }, scales: { y: { min: -1, max: 1, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } } }
    });
}

// --- 6. MOTEUR DE BALANCEMENT ---
function balanceSliders(changedKey) {
    if (changedKey === 'aum') {
        updateDashboard('slider');
        return; 
    }

    let newVal = parseInt(sliders[changedKey].value);
    let otherKeys = ['cac', 'oat', 'stoxx', 'bund'].filter(key => key !== changedKey);
    let sumOthers = otherKeys.reduce((sum, key) => sum + parseInt(sliders[key].value), 0);
    let targetSumOthers = 100 - newVal;

    if (sumOthers === 0 && targetSumOthers > 0) {
        let split = Math.round(targetSumOthers / 3);
        otherKeys.forEach(key => sliders[key].value = split);
    } else if (sumOthers > 0) {
        otherKeys.forEach(key => {
            let proportion = parseInt(sliders[key].value) / sumOthers;
            sliders[key].value = Math.round(proportion * targetSumOthers);
        });
    }

    let finalSum = parseInt(sliders[changedKey].value) + otherKeys.reduce((sum, key) => sum + parseInt(sliders[key].value), 0);
    if (finalSum !== 100) { sliders[otherKeys[0]].value = parseInt(sliders[otherKeys[0]].value) + (100 - finalSum); }

    updateDashboard('slider');
}

// --- 7. LE CERVEAU QUANTITATIF (AVEC SLIPPAGE DYNAMIQUE) ---
function updateDashboard(source = 'auto') {
    let scenarioKey = crisisSelector.value;
    let marketData = allScenarios[scenarioKey];

    if (source === 'scenario_change') {
        addLog(`Scenario updated to: ${marketData.name}`, 'info');
        if (triggerToggle.checked) {
            triggerToggle.checked = false; 
            addLog(`Spread Trigger reset due to scenario change.`, 'warning');
        }
    }

    let base_w_cac = parseInt(sliders.cac.value) / 100;
    let base_w_oat = parseInt(sliders.oat.value) / 100;
    let base_w_stoxx = parseInt(sliders.stoxx.value) / 100;
    let base_w_bund = parseInt(sliders.bund.value) / 100;
    let currentAUM = parseInt(sliders.aum.value); // <--- Lecture de l'AUM

    let threshold = parseInt(slideSpread.value);
    valSpread.innerText = threshold;
    currentTriggerThreshold = threshold; 

    displays.cac.innerText = sliders.cac.value;
    displays.oat.innerText = sliders.oat.value;
    displays.stoxx.innerText = sliders.stoxx.value;
    displays.bund.innerText = sliders.bund.value;
    displays.aum.innerText = currentAUM;

    let w_cac = base_w_cac;
    let w_oat = base_w_oat;
    let w_stoxx = base_w_stoxx;
    let w_bund = base_w_bund;
    
    let slippagePenalty = 0; 
    let slippageRateBps = 0;
    isTriggerFired = false; 

    // Vérification du déclenchement du Trigger
    if (triggerToggle.checked) {
        if (marketData.crisisSpread >= threshold && w_oat > 0) {
            isTriggerFired = true; 
            
            // --- CŒUR DU MARKET IMPACT (Slippage Dynamique) ---
            // 10 M€ -> 0.10% (10 bps). 1000 M€ -> 1.00% (100 bps).
            let slippageRate = 0.10 + ((currentAUM - 10) / 990) * 0.90;
            slippageRateBps = (slippageRate * 100).toFixed(0);
            
            if(source === 'trigger' || source === 'slider') {
                let dayIndex = marketData.dailySpreads.findIndex(s => s >= threshold);
                let dayName = dayIndex !== -1 ? `Day ${dayIndex + 1}` : 'Unknown Day';
                let blockToSell = (currentAUM * w_oat).toFixed(1);
                
                addLog(`CRITICAL: Spread crossed ${threshold} bps at ${dayName}.`, 'danger');
                addLog(`Flight to Quality: Selling ${blockToSell}M€ of OAT. Buying Bunds.`, 'warning');
                addLog(`Market Impact for ${currentAUM}M€ fund: Penalty of ${slippageRateBps} bps applied.`, 'danger');
            }
            
            slippagePenalty = w_oat * slippageRate; // Application de la pénalité proportionnelle
            w_bund = w_bund + w_oat; 
            w_oat = 0; 
        } else if (source === 'trigger') {
            addLog(`Market stable. Max spread is below limit (${threshold} bps).`, 'normal');
        }
    }

    // Calculs Ratios
    let peakCorr = (w_oat / (w_oat + w_bund || 1)) * marketData.peakCorr + (w_bund / (w_oat + w_bund || 1)) * marketData.baseCorr;
    let baseMdd = (w_cac * marketData.mdd.cac) + (w_oat * marketData.mdd.oat) + (w_stoxx * marketData.mdd.stoxx) + (w_bund * marketData.mdd.bund);
    
    let diversificationBonus = 0;
    if (peakCorr < 0) {
        let equityWeight = w_cac + w_stoxx;
        let safeBondWeight = w_bund;
        let balanceFactor = equityWeight * safeBondWeight * 4; 
        diversificationBonus = Math.abs(baseMdd) * Math.abs(peakCorr) * 0.15 * balanceFactor; 
    }
    
    let calcMdd = baseMdd + diversificationBonus - slippagePenalty; 
    let calcSortino = (w_cac * marketData.sortino.cac) + (w_oat * marketData.sortino.oat) + (w_stoxx * marketData.sortino.stoxx) + (w_bund * marketData.sortino.bund);

    // Mise à jour visuelle des KPI
    kpiMdd.innerText = calcMdd.toFixed(2) + "%";
    kpiSortino.innerText = calcSortino.toFixed(2);
    
    const labelCard = kpiMdd.parentElement.querySelector('.kpi-label');
    if (slippagePenalty > 0) {
        labelCard.innerHTML = `<span style="color: #ef4444; font-weight: bold; animation: pulse 1s infinite;">⚠️ SLIPPAGE: -${slippagePenalty.toFixed(2)}% (${slippageRateBps} bps)</span>`;
    } else {
        labelCard.innerText = "Peak-to-Trough Loss";
    }
    
    if (peakCorr > 0) {
        kpiCorr.innerText = "+" + peakCorr.toFixed(2);
        kpiCorr.className = "kpi-value danger";
    } else {
        kpiCorr.innerText = peakCorr.toFixed(2);
        kpiCorr.className = "kpi-value success";
    }

    // Mise à jour des Graphiques
    chartEquity.data.datasets[0].data = marketData.trajectory.map(factor => 100 + (factor * Math.abs(calcMdd)));
    chartEquity.update();

    chartDrawdown.data.datasets[0].data = marketData.trajectory.map(factor => factor * Math.abs(calcMdd));
    chartDrawdown.update();

    chartCorr.data.datasets[0].data = marketData.trajectory.map(factor => {
        let normalizedStress = Math.abs(factor); 
        let startCorr = marketData.baseCorr; 
        return startCorr + (normalizedStress * (peakCorr - startCorr));
    });
    chartCorr.update();
}

// --- 8. ÉCOUTEURS D'ÉVÉNEMENTS ---
Object.keys(sliders).forEach(key => {
    sliders[key].addEventListener('input', () => balanceSliders(key));
});

slideSpread.addEventListener('input', () => updateDashboard('slider'));
triggerToggle.addEventListener('change', () => updateDashboard('trigger'));
crisisSelector.addEventListener('change', () => updateDashboard('scenario_change'));

btnReset.addEventListener('click', () => {
    sliders.cac.value = 60;
    sliders.oat.value = 40;
    sliders.stoxx.value = 0;
    sliders.bund.value = 0;
    sliders.aum.value = 100;
    slideSpread.value = 70;
    triggerToggle.checked = false;
    crisisSelector.value = 'june2024';
    
    addLog('--- SIMULATION RESET TO DEFAULT BY USER ---', 'info');
    updateDashboard('reset');
});

// Démarrage
initCharts();
setTimeout(() => {
    addLog('System online. Strategic parameters loaded.', 'success');
}, 500);
updateDashboard();

// --- 9. GESTION DU SPLASH SCREEN ET DE LA QUESTION DE SÉCURITÉ ---
const btnEnter = document.getElementById('btn-enter');
const splashScreen = document.getElementById('splash-screen');
const securityInput = document.getElementById('security-input');
const securityMessage = document.getElementById('security-message');

let attemptCount = 0;

// Liste des réponses acceptées (en minuscules pour la vérification)
const validAnswers = [
    "oat",
    "o.a.t",
    "obligation assimilable du tresor",
    "obligations assimilables du tresor",
    "obligation assimilable du trésor",
    "obligations assimilables du trésor"
];

if (btnEnter && splashScreen && securityInput) {
    
    function checkSecurityAnswer() {
        const userAnswer = securityInput.value.trim().toLowerCase();
        
        if (validAnswers.includes(userAnswer)) {
            // Bonne réponse : la porte s'ouvre
            splashScreen.classList.add('splash-hidden');
            addLog('Security cleared. User authenticated. Dashboard access granted.', 'success');
        } else {
            // Mauvaise réponse : l'écran reste bloqué et on affiche les indices
            attemptCount++;
            
            if (attemptCount === 1) {
                // 1er échec : Indice
                securityInput.style.borderColor = "#f59e0b"; // Passe en orange
                securityMessage.style.color = "#f59e0b";
                securityMessage.innerText = "Hint: It is a 3-letter acronym corresponding to the 15th, 1st, and 20th letters of the alphabet.";
            } else if (attemptCount >= 2) {
                // 2ème échec et plus : Réponse directe
                securityInput.style.borderColor = "#ef4444"; // Passe en rouge
                securityMessage.style.color = "#ef4444";
                securityMessage.innerText = "The correct answer is: OAT. Please type it to proceed.";
            }
        }
    }

    // On utilise onclick pour forcer l'écrasement de toute ancienne commande fantôme
    btnEnter.onclick = function(event) {
        event.preventDefault(); // Empêche tout comportement par défaut
        checkSecurityAnswer();
    };

    // Permet de valider avec la touche "Entrée" du clavier
    securityInput.onkeypress = function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkSecurityAnswer();
        }
    };
}