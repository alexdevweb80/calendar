const fs = require('fs');

const filePath = 'd:/chronos-planning/css/style.css';
let css = fs.readFileSync(filePath, 'utf-8');

const replacements = {
    // HEX colors
    "#00f6ff": "#00d4ff",
    "#ff2dbf": "#a855f7",
    "#5a7bff": "#3b82f6",
    "#b44aff": "#8b5cf6",
    "#39ff14": "#00b4d8",
    "#ffd700": "#e0aaff",
    "#ff0066": "#7e22ce",
    "#00ffcc": "#00d4ff",
    "#ffcc00": "#c084fc",
    "#ff66cc": "#a855f7",
    "#6666ff": "#3b82f6",
    "#ff3388": "#6b21a8",
    "#00e6b8": "#00b4d8",
    "#e6b800": "#a855f7",
    "#ff4db8": "#8b5cf6",
    "#5555ee": "#2563eb",
    "#7777ff": "#60a5fa",
    "#FF0066": "#7E22CE",
    "#00F6FF": "#00D4FF",

    // RGBA
    "0, 246, 255": "0, 212, 255",
    "255, 45, 191": "168, 85, 247",
    "90, 123, 255": "59, 130, 246",
    "180, 74, 255": "139, 92, 246",
    "57, 255, 20": "0, 180, 216",
    "255, 0, 102": "126, 34, 206",

    // Background adjustments for chic
    "--bg-1: #03030f": "--bg-1: #02020a", 
    "--bg-2: #0a1628": "--bg-2: #050b14",
    "--bg-3: #110a2e": "--bg-3: #0a051c",

    // Glass effect tweaks
    "blur(16px)": "blur(24px)",
    "blur(20px)": "blur(28px)",
    "rgba(255, 255, 255, 0.05)": "rgba(255, 255, 255, 0.03)", 
    "rgba(255, 255, 255, 0.09)": "rgba(255, 255, 255, 0.06)",
    "rgba(255, 255, 255, 0.12)": "rgba(255, 255, 255, 0.15)",
    
    // Gradients
    "linear-gradient(135deg, #ff0066, #6f00ff, #00f6ff)": "linear-gradient(135deg, #7e22ce, #3b82f6, #00d4ff)"
};

for (const [oldVal, newVal] of Object.entries(replacements)) {
    // global replacement
    css = css.split(oldVal).join(newVal);
}

fs.writeFileSync(filePath, css, 'utf-8');
console.log('Refactor complete.');
