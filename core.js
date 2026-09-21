/* Shared data operations. No network or storage access. */
(function (global) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pathKey = path => JSON.stringify(path);
  const tags = value => Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  function parseJSON(text, source) {
    const data = JSON.parse(text), bookmarks = [], folders = [];
    function walk(node, path) {
      if (!node || typeof node !== 'object') return;
      if (typeof node.uri === 'string' || typeof node.url === 'string') {
        bookmarks.push({title: String(node.title || node.uri || node.url), url: node.uri ?? node.url, folder: path.slice(), tags: tags(node.tags), source, added: node.dateAdded || null});
      } else if (Array.isArray(node.children)) {
        // Firefox's tags root contains tag assignments rather than regular bookmarks.
        if (node.root === 'tagsFolder' || node.guid === 'tags________') return;
        const root = node.root === 'placesRoot' || node.guid === 'root________';
        const next = !root && node.title ? [...path, String(node.title)] : path;
        if (next.length) folders.push(next);
        node.children.forEach(child => walk(child, next));
      }
    }
    if (data?.format === 'bookmark-workshop' && data.version === 1 && Array.isArray(data.bookmarks)) {
      for (const b of data.bookmarks) {
        if (typeof b.url !== 'string' || !Array.isArray(b.folder) || !b.folder.every(x => typeof x === 'string')) throw new Error('Ungültiger Eintrag in der Sicherung.');
        bookmarks.push({title: String(b.title || b.url), url:b.url, folder:b.folder.slice(), tags:tags(b.tags), added:b.added || null, source});
      }
      for (const folder of data.folders || []) if (Array.isArray(folder) && folder.every(x => typeof x === 'string')) folders.push(folder);
    } else if (data && Array.isArray(data.children)) {
      walk(data, []);
      const tagRoot = data.children.find(n => n.root === 'tagsFolder' || n.guid === 'tags________');
      for (const tag of tagRoot?.children || []) for (const link of tag.children || []) {
        for (const bookmark of bookmarks) if (bookmark.url === link.uri) bookmark.tags = [...new Set([...bookmark.tags, String(tag.title)])];
      }
    } else throw new Error('Keine Firefox-JSON-Datei oder Werkstatt-Sicherung erkannt.');
    return {bookmarks, folders};
  }
  function parseHTML(text, source) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    if (!doc.querySelector('dl')) throw new Error('Keine Lesezeichen-HTML erkannt (Ordnerliste fehlt).');
    const bookmarks = [], folders = [];
    function walk(container, path) {
      let pending = null;
      function visit(node) {
        if (node.tagName === 'H3') {
          pending = [...path, node.textContent.trim() || 'Unbenannter Ordner']; folders.push(pending);
        } else if (node.tagName === 'DL') {
          walk(node, pending || path); pending = null;
        } else if (node.tagName === 'A' && node.hasAttribute('href')) {
          const url = node.getAttribute('href');
          bookmarks.push({title: node.textContent.trim() || url, url, folder:path.slice(), tags:tags(node.getAttribute('tags')), source, added: Number(node.getAttribute('add_date')) * 1000000 || null});
        } else for (const child of node.children) visit(child);
      }
      for (const node of container.children) visit(node);
    }
    walk(doc.body, []);
    return {bookmarks, folders};
  }
  function urlKey(raw, relaxed = false) {
    // Exact mode deliberately preserves meaningful URL differences.
    if (!relaxed) return raw.trim();
    try {
      const url = new URL(raw);
      if (!['http:', 'https:'].includes(url.protocol)) return raw.trim();
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || /^(fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
      return url.href;
    } catch { return raw.trim(); }
  }
  function duplicateGroups(bookmarks, relaxed = false) {
    const groups = new Map();
    for (const b of bookmarks) { const key = urlKey(b.url, relaxed); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(b); }
    return [...groups.values()].filter(group => group.length > 1);
  }
  function allFolders(bookmarks, folders) {
    const paths = new Map();
    for (const path of [...folders, ...bookmarks.map(b => b.folder)]) for (let i=1;i<=path.length;i++) paths.set(pathKey(path.slice(0,i)), path.slice(0,i));
    return [...paths.values()].sort((a,b)=>a.join(' / ').localeCompare(b.join(' / '), 'de'));
  }
  function exportHTML(bookmarks, folders) {
    const tree = {children:new Map(), bookmarks:[]};
    function ensure(path) { let node=tree; for (const name of path) { if (!node.children.has(name)) node.children.set(name,{children:new Map(),bookmarks:[]}); node=node.children.get(name); } return node; }
    allFolders(bookmarks,folders).forEach(ensure);
    bookmarks.forEach(b => ensure(b.folder).bookmarks.push(b));
    function render(node) {
      let out='<DL><p>\n';
      for (const [name, child] of node.children) out += `<DT><H3>${escape(name)}</H3>\n${render(child)}`;
      for (const b of node.bookmarks) out += `<DT><A HREF="${escape(b.url)}"${b.tags.length ? ` TAGS="${escape(b.tags.join(','))}"` : ''}${Number.isFinite(Number(b.added)) && Number(b.added)>0 ? ` ADD_DATE="${Math.floor(Number(b.added)/1000000)}"` : ''}>${escape(b.title)}</A>\n`;
      return out+'</DL><p>\n';
    }
    return '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Lesezeichen</TITLE>\n<H1>Lesezeichen</H1>\n'+render(tree);
  }
  function emptyFolders(bookmarks, folders) {
    const occupied = new Set(allFolders(bookmarks, []).map(pathKey));
    return allFolders(bookmarks, folders).filter(path => !occupied.has(pathKey(path)));
  }
  global.Bookmarks = {escape,pathKey,parseJSON,parseHTML,urlKey,duplicateGroups,allFolders,emptyFolders,exportHTML};
})(globalThis);
