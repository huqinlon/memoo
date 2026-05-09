import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function importPDFToMemo(file, onProgress) {
  if (!file) throw new Error('请选择PDF文件');
  if (file.size > 50 * 1024 * 1024) throw new Error('PDF文件大小超过50MB限制');
  if (file.size === 0) throw new Error('PDF文件为空');
  const arrayBuffer = await file.arrayBuffer();
  if (onProgress) onProgress(10);
  let pdf;
  try { pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise; }
  catch (err) {
    if (err.name === 'PasswordException') throw new Error('该PDF文件受密码保护');
    if (err.name === 'InvalidPDFException') throw new Error('无效的PDF文件');
    throw new Error('PDF解析失败');
  }
  if (onProgress) onProgress(20);
  const totalPages = pdf.numPages;
  const lines = [];
  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      textContent.items.forEach(item => { if (item.str) lines.push(item.str); });
      if (onProgress) onProgress(20 + Math.floor((i / totalPages) * 60));
    } catch (e) { lines.push(`[第${i}页解析失败]`); }
  }
  if (onProgress) onProgress(85);
  const content = lines.map(l => `<p>${l}</p>`).join('\n');
  if (onProgress) onProgress(100);
  return { title: lines[0]?.substring(0, 100) || '导入的备忘录', content, content_type: 'rich', visibility: 'public', tags: [] };
}