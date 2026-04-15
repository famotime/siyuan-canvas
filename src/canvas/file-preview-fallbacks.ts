export function getFilePreviewImageCandidates(source: string): string[] {
  const normalized = source.trim().replace(/\\/g, '/')
  if (!normalized) {
    return []
  }

  const candidates = [normalized]

  if (/^\/data\/assets\//i.test(normalized)) {
    candidates.push(normalized.replace(/^\/data\/assets\//i, '/assets/'))
  } else if (/^data\/assets\//i.test(normalized)) {
    candidates.push(`/${normalized}`)
    candidates.push(normalized.replace(/^data\/assets\//i, '/assets/'))
  } else if (/^\/assets\//i.test(normalized)) {
    candidates.push(normalized.replace(/^\/assets\//i, '/data/assets/'))
  } else if (/^assets\//i.test(normalized)) {
    candidates.push(`/data/${normalized}`)
    candidates.push(`/${normalized}`)
  }

  return [...new Set(candidates.filter(Boolean))]
}

export function getNextFilePreviewImageSource(
  source: string,
  currentSource?: string,
): string | undefined {
  const candidates = getFilePreviewImageCandidates(source)
  const currentIndex = currentSource ? candidates.indexOf(currentSource) : -1
  const nextSource = candidates[currentIndex + 1]

  if (!nextSource || nextSource === currentSource) {
    return undefined
  }

  return nextSource
}

export function applyFilePreviewImageOverrides(
  previewHtml: string,
  overrides?: Record<string, string>,
): string {
  if (!previewHtml || !overrides) {
    return previewHtml
  }

  return previewHtml.replace(
    /(<img\b[^>]*\bsrc=(["']))([^"']+)(\2)/gi,
    (match, prefix: string, _quote: string, source: string, suffix: string) => {
      const override = overrides[source]
      return override ? `${prefix}${override}${suffix}` : match
    },
  )
}
