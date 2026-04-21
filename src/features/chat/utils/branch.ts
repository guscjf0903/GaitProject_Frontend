export const getBranchColor = (branch: string) => {
  if (branch === 'main') return '#00B894'
  if (branch.startsWith('feat')) return '#0984E3'
  return '#e17055'
}

export const normalizeBranchName = (name: string) =>
  (name || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._\-/]/g, '')
    .replace(/\/+/g, '/')
