import html2pdf from 'html2pdf.js';

export async function exportMemoToPDF(memo, onProgress) {
  if (!memo) throw new Error('备忘录数据为空');
  const container = document.createElement('div');
  container.style.cssText = 'padding: 40px 50px; font-family: "Inter", "Noto Sans SC", system-ui, sans-serif; color: #1f2937; line-height: 1.8; max-width: 800px; margin: 0 auto; background: white;';
  const titleEl = document.createElement('h1');
  titleEl.textContent = memo.title || '无标题';
  titleEl.style.cssText = 'font-size: 28px; font-weight: 800; color: #111827; margin: 0 0 16px 0; line-height: 1.3;';
  container.appendChild(titleEl);
  const metaEl = document.createElement('div');
  metaEl.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center;';
  if (memo.author_name) { const author = document.createElement('span'); author.textContent = memo.author_name; metaEl.appendChild(author); }
  const created = document.createElement('span'); created.textContent = `创建: ${memo.created_at || '-'}`; metaEl.appendChild(created);
  const updated = document.createElement('span'); updated.textContent = `修改: ${memo.updated_at || '-'}`; metaEl.appendChild(updated);
  container.appendChild(metaEl);
  if (memo.tags?.length > 0) {
    const tagsEl = document.createElement('div');
    tagsEl.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;';
    memo.tags.forEach(tag => { const t = document.createElement('span'); t.textContent = tag.name; t.style.cssText = `padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: ${tag.color || '#6366f1'}18; color: ${tag.color || '#6366f1'};`; tagsEl.appendChild(t); });
    container.appendChild(tagsEl);
  }
  const divider = document.createElement('hr');
  divider.style.cssText = 'border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;';
  container.appendChild(divider);
  const contentEl = document.createElement('div');
  contentEl.style.cssText = 'font-size: 15px; line-height: 1.8; color: #374151;';
  if (memo.content_type === 'markdown' || (memo.content && !memo.content.trim().startsWith('<'))) { contentEl.innerHTML = memo.content || ''; }
  else { contentEl.innerHTML = memo.content || ''; }
  container.appendChild(contentEl);
  const footer = document.createElement('div');
  footer.style.cssText = 'margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center;';
  footer.textContent = `导出自备忘录系统`;
  container.appendChild(footer);
  document.body.appendChild(container);
  try {
    await html2pdf().set({ margin: [10, 10, 15, 10], filename: `${memo.title}.pdf`, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['avoid-all', 'css', 'legacy'] } }).from(container).save();
    if (onProgress) onProgress(100);
    return { success: true, filename: `${memo.title}.pdf` };
  } finally { document.body.removeChild(container); }
}