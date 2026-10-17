// Only known video hosts are embedded. Other HTTPS links remain clickable,
// which avoids putting an arbitrary third-party page inside the course page.
export function resolveCourseVideo(value) {
  if (!value) return null;
  let url;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase();
  let id;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    id = url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')
      ? url.pathname.split('/')[2]
      : url.searchParams.get('v');
  }
  if (id && /^[\w-]{11}$/.test(id)) {
    return { type: 'embed', src: `https://www.youtube-nocookie.com/embed/${id}`, href: url.href };
  }

  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    id = url.pathname.split('/').filter(Boolean).pop();
    if (/^\d+$/.test(id || '')) return { type: 'embed', src: `https://player.vimeo.com/video/${id}`, href: url.href };
  }

  if (host === 'iframe.mediadelivery.net' && /^\/embed\/\d+\/[\w-]+\/?$/.test(url.pathname)) {
    return { type: 'embed', src: url.href, href: url.href };
  }

  if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return { type: 'file', src: url.href, href: url.href };
  return { type: 'link', href: url.href };
}
