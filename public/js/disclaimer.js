// Ron Penones | November 15th 2025 - Feel free to share and reproduce, the core idea is mine with some assistance of AI. Padayon!

document.addEventListener('DOMContentLoaded', () => {
const btn = document.getElementById('view-disclaimer-btn');

if (!btn) return;

btn.addEventListener('click', async () => {
try {
const res = await fetch('/disclaimer.md');
if (!res.ok) throw new Error('Unable to load disclaimer.md');


const text = await res.text();

// Dito po gagawin iyong modal container
const modal = document.createElement('div');
modal.className = 'disclaimer-modal';

const inner = document.createElement('div');
inner.className = 'disclaimer-modal-content';

const close = document.createElement('button');
close.className = 'disclaimer-close-btn';
close.textContent = '×';
close.addEventListener('click', () => modal.remove());

const content = document.createElement('div');
content.className = 'disclaimer-text';
content.innerHTML = marked.parse(text);

inner.appendChild(close);
inner.appendChild(content);
modal.appendChild(inner);
document.body.appendChild(modal);
} catch (err) {
console.error(err);
alert('Error loading disclaimer.');
}
});
});
