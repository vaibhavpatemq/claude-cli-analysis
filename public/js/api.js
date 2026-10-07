async function analyzeZipFiles(files, userName = '') {
  const formData = new FormData();

  if (userName) {
    formData.append('userName', userName);
  }

  for (const file of Array.from(files || [])) {
    formData.append('files', file);
  }

  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: formData
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Upload failed.');
  }

  return payload;
}
