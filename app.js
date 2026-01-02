
/**
 * COTIZADOR VW PRO v5.8 - FIXED & STABLE
 */

// --- 1. NAVEGACIÓN GLOBAL ---
function showScreen(id) {
    const screens = document.querySelectorAll('.screen');
    const btns = document.querySelectorAll('.nav-btn');
    
    screens.forEach(s => s.classList.add('hidden'));
    btns.forEach(b => b.classList.remove('bg-white/20', 'text-vw-light-blue'));
    
    const btn = document.getElementById('btn-nav-' + id);
    if (btn) btn.classList.add('bg-white/20', 'text-vw-light-blue');
    
    const target = document.getElementById(id);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('animate-in');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showScreen = showScreen;

// --- 2. CONFIGURACIÓN ---
const SHEET_ID = '1e16MGd26-RQIVtbiUJzROex43vj9DXCPqpz_ez2Oo60';
let lista = [];
let campanias = [];
let currentCotizacion = null;

const getEl = (id) => document.getElementById(id);

const cleanNum = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    let s = String(val).trim().replace(/\$/g, "").replace(/\s/g, "");
    if (s.includes('.') && !s.includes(',')) {
        s = s.replace(/\./g, "");
    } else {
        s = s.replace(/\./g, "").replace(',', '.');
    }
    return parseFloat(s) || 0;
};

const fmtPrice = (val) => Math.round(Number(val)).toLocaleString('es-AR');
const fmtCurrency = (val) => '$' + fmtPrice(val);

function parseCSV(csvText) {
    if (csvText.includes('<!DOCTYPE html>')) {
        throw new Error("La hoja no está publicada. Ve a Archivo > Compartir > Publicar en la Web");
    }
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').toLowerCase().trim());
    
    return lines.slice(1).map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const obj = {};
        headers.forEach((header, i) => {
            let val = values[i] ? values[i].replace(/^"|"$/g, '').trim() : '';
            obj[header] = val;
        });
        return obj;
    });
}

async function fetchSheet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Error de red");
    const text = await response.text();
    return parseCSV(text);
}

// --- 3. GESTIÓN DE DATOS ---
async function initData() {
    console.log("Sincronizando con Google Sheets...");
    const msg = getEl('loader-message');
    const spinner = getEl('loader-spinner');

    try {
        const [preciosRaw, campRaw] = await Promise.all([
            fetchSheet('precios'),
            fetchSheet('campanias')
        ]);

        lista = preciosRaw.map(p => ({
            modelo: String(p.modelo || "").toLowerCase().trim(),
            version: String(p.version || "").trim(),
            ano: String(p.ano || "").trim(),
            fae: cleanNum(p.fae),
            precioFinal: cleanNum(p.preciofinal)
        })).filter(p => p.modelo !== "");

        campanias = campRaw.map(c => ({
            nombre: String(c.nombre || "").trim(),
            cuota1000: cleanNum(c.cuota1000),
            maxFin: cleanNum(c.maxfin),
            quebranto: cleanNum(c.quebranto),
            cuotas: cleanNum(c.cuotas),
            modelos: String(c.modelos || "").toLowerCase().split(',').map(m => m.trim())
        })).filter(c => c.nombre !== "");

        console.log("Sincronización exitosa:", lista.length, "unidades.");
        populateUI();
    } catch (err) {
        console.error("Fallo initData:", err);
        if (msg) {
            msg.innerHTML = `
                <div class="p-6 bg-white rounded-3xl shadow-xl border-2 border-red-100 max-w-xs mx-auto">
                    <h3 class="text-red-600 font-black text-lg mb-2">Error de Conexión</h3>
                    <p class="text-[10px] text-slate-500 mb-4">${err.message}</p>
                    <button onclick="useOfflineData()" class="w-full bg-vw-blue text-white py-3 rounded-xl font-black text-xs mb-2">MODO OFFLINE (Respaldo)</button>
                    <button onclick="location.reload()" class="w-full bg-slate-100 text-slate-500 py-2 rounded-xl font-bold text-[10px]">REINTENTAR</button>
                </div>`;
            if (spinner) spinner.classList.add('hidden');
        }
        return; // Detener para que el finishLoading no oculte el mensaje de error inmediatamente
    }
    finishLoading();
}

function finishLoading() {
    const loader = getEl('loading-overlay');
    if (loader) {
        loader.classList.add('opacity-0');
        setTimeout(() => loader.classList.add('hidden'), 500);
    }
}

function useOfflineData() {
    lista = [
        {modelo: 'amarok', version: 'V6 Extreme', ano: '2024', fae: 1500000, precioFinal: 68000000},
        {modelo: 'taos', version: 'Highline', ano: '2024', fae: 800000, precioFinal: 42000000}
    ];
    campanias = [
        {nombre: 'Tasa 0% (12 meses)', cuota1000: 83.33, maxFin: 15000000, quebranto: 12, cuotas: 12, modelos: ['amarok', 'taos']}
    ];
    populateUI();
    finishLoading();
}
window.useOfflineData = useOfflineData;

// --- 4. UI ---
function populateUI() {
    const selModelo = getEl('selModelo');
    if (!selModelo) return;
    
    const uniqueModels = [...new Set(lista.map(l => l.modelo))].sort();
    selModelo.innerHTML = uniqueModels.map(m => `<option value="${m}">${m.toUpperCase()}</option>`).join('');
    
    selModelo.onchange = updateVersions;
    updateVersions();
    renderTable();

    const prCamp = getEl('prCamp');
    if (prCamp) {
        prCamp.innerHTML = campanias.map((c, i) => `<option value="${i}">${c.nombre} (${c.cuotas} cts)</option>`).join('');
    }
}

function updateVersions() {
    const selModelo = getEl('selModelo');
    const selVersion = getEl('selVersion');
    if (!selModelo || !selVersion) return;
    
    const mod = selModelo.value;
    const filtered = lista.filter(l => l.modelo === mod);
    
    selVersion.innerHTML = filtered.map((v, i) => `<option value="${i}">${v.version} - ${v.ano}</option>`).join('');
    
    selVersion.onchange = () => {
        const data = filtered[selVersion.value];
        if (data) {
            getEl('inpPrecio').value = fmtPrice(data.precioFinal);
            getEl('inpFae').value = fmtPrice(data.fae);
            updateCampaigns(mod);
        }
    };
    selVersion.onchange();
}

function updateCampaigns(model) {
    const selCamp = getEl('selCamp');
    if (!selCamp) return;
    const filtered = campanias.filter(c => c.modelos.includes(model));
    selCamp.innerHTML = filtered.length 
        ? filtered.map((c, i) => `<option value="${i}">${c.nombre}</option>`).join('')
        : '<option value="">Sin campañas</option>';
}

// --- 5. LÓGICA ---
function calcular() {
    const precio = cleanNum(getEl('inpPrecio').value);
    const fae = cleanNum(getEl('inpFae').value);
    const monto = cleanNum(getEl('inpMonto').value);
    const mod = getEl('selModelo').value;
    
    const modCamps = campanias.filter(c => c.modelos.includes(mod));
    const camp = modCamps[getEl('selCamp').value];

    if (!monto) return alert("Ingresa un monto.");
    if (!camp) return alert("Campaña no válida.");
    if (monto > camp.maxFin) return alert(`Límite: ${fmtCurrency(camp.maxFin)}`);

    const prov = getEl('selProvNqn').checked ? 'neuquen' : 'rionegro';
    const cuota = camp.cuota1000 * (monto / 1000);
    const gestion = monto * 0.02;
    const prenda = (prov === 'neuquen') ? (cuota * camp.cuotas) * 0.025 : (cuota * camp.cuotas) * 0.03;
    const patent = (prov === 'neuquen') ? (precio - fae) * 0.045 : (precio - fae) * 0.055;
    
    const isUtil = (mod.includes('amarok') || mod.includes('saveiro'));
    const baseQuebranto = monto * (camp.quebranto / 100);
    const quebrantoTotal = baseQuebranto + (baseQuebranto * (isUtil ? 0.105 : 0.21));

    const gastosTotales = gestion + prenda + patent + quebrantoTotal;
    const anticipo = (precio - monto) + gastosTotales;

    getEl('results-panel').classList.remove('hidden');
    getEl('outTotal').textContent = fmtCurrency(anticipo);
    getEl('cuotaBig').textContent = fmtCurrency(cuota);
    getEl('outDetails').innerHTML = `
        <div class="flex justify-between border-b pb-1"><span>Patentamiento Est.:</span> <span>${fmtCurrency(patent)}</span></div>
        <div class="flex justify-between border-b pb-1 text-red-600 font-bold"><span>Quebranto Financiero:</span> <span>${fmtCurrency(quebrantoTotal)}</span></div>
        <div class="flex justify-between"><span>Gestión Crédito:</span> <span>${fmtCurrency(gestion + prenda)}</span></div>
    `;

    currentCotizacion = {
        tipo: 'VENTA DIRECTA', modelo: mod.toUpperCase(),
        version: getEl('selVersion').options[getEl('selVersion').selectedIndex].text,
        monto, cuotas: camp.cuotas, valorCuota: cuota, anticipo
    };
}
window.calcular = calcular;

function calcularPromo() {
    const precio = cleanNum(getEl('prPrecio').value);
    const monto = cleanNum(getEl('prMonto').value);
    const idx = getEl('prCamp').value;
    const camp = campanias[idx];
    if (!precio || !monto || !camp) return alert("Datos incompletos.");
    const cuota = camp.cuota1000 * (monto / 1000);
    const gastos = (precio * 0.08); 
    const anticipo = (precio - monto) + gastos;
    getEl('promo-results').classList.remove('hidden');
    getEl('outPromoTotal').textContent = fmtCurrency(anticipo);
    getEl('promoCuotaBig').textContent = fmtCurrency(cuota);
}
window.calcularPromo = calcularPromo;

function generarPDF() {
    const { jsPDF } = window.jspdf;
    if (!currentCotizacion) return alert("Calcula primero.");
    const doc = new jsPDF();
    const c = currentCotizacion;
    doc.setFillColor(0, 30, 80); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255); doc.setFontSize(22); doc.text('IRUÑA S.A.', 15, 25);
    doc.setTextColor(0, 30, 80); doc.setFontSize(14); doc.text(c.modelo + ' - ' + c.version, 15, 60);
    doc.setFontSize(11); doc.text(`Pago: ${c.cuotas} cuotas de ${fmtCurrency(c.valorCuota)}`, 15, 75);
    doc.setFillColor(0, 30, 80); doc.rect(15, 90, 180, 12, 'F');
    doc.setTextColor(255); doc.text(`ANTICIPO TOTAL: ${fmtCurrency(c.anticipo)}`, 20, 98);
    doc.save(`Cotizacion_VW.pdf`);
}
window.generarPDF = generarPDF;
window.compartirPDF = () => generarPDF();

function renderTable() {
    const tbody = document.querySelector('#tablaLista tbody');
    if (!tbody) return;
    const search = getEl('tableSearch')?.value.toLowerCase() || "";
    const filtered = lista.filter(l => l.modelo.includes(search) || l.version.toLowerCase().includes(search));
    tbody.innerHTML = filtered.map(l => `
        <tr class="border-b">
            <td class="p-4 font-bold text-vw-blue uppercase text-xs">${l.modelo}</td>
            <td class="p-4 text-slate-500 text-xs">${l.version} (${l.ano})</td>
            <td class="p-4 text-right font-black text-xs">${fmtCurrency(l.precioFinal)}</td>
        </tr>`).join('');
}

// --- 6. INICIO ---
document.addEventListener('DOMContentLoaded', () => {
    showScreen('cot');
    initData();
    ['inpMonto', 'prMonto', 'prPrecio'].forEach(id => {
        const input = getEl(id);
        if (input) {
            input.addEventListener('input', function() {
                let clean = this.value.replace(/[^0-9]/g, '');
                if (clean) this.value = Number(clean).toLocaleString('es-AR');
            });
        }
    });
    getEl('tableSearch')?.addEventListener('input', renderTable);
});
