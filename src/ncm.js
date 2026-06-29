/**
 * NCM.JS — NeteaseCloudMusicApi 适配器
 * 歌曲检索、直链、歌词、推荐
 */
const NCM_BASE = process.env.NCM_API_BASE || 'http://localhost:3000';

export async function searchNcm(keyword) {
  try {
    const res = await fetch(`${NCM_BASE}/search?keywords=${encodeURIComponent(keyword)}&limit=5`);
    const data = await res.json();
    if (data.result?.songs) {
      return data.result.songs.map(s => ({
        id: s.id,
        title: s.name,
        artist: s.artists?.map(a => a.name).join('/') || '未知',
      }));
    }
    return [];
  } catch (e) {
    console.error('[NCM] 搜索失败:', e.message);
    return [];
  }
}

export async function getSongUrl(songId) {
  try {
    const res = await fetch(`${NCM_BASE}/song/url?id=${songId}`);
    const data = await res.json();
    return data.data?.[0]?.url || null;
  } catch (e) {
    console.error('[NCM] 获取直链失败:', e.message);
    return null;
  }
}

export async function getLyric(songId) {
  try {
    const res = await fetch(`${NCM_BASE}/lyric?id=${songId}`);
    const data = await res.json();
    return data.lrc?.lyric || '';
  } catch {
    return '';
  }
}
