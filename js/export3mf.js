// Minimal 3MF writer: one or more named meshes, units mm, zipped with fflate.
import { zipSync, strToU8 } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js';

const fmt = v => {
  const s = v.toFixed(4);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** objekte: [{name, mesh: manifold Mesh, x, y}] -> Uint8Array (.3mf) */
export function make3mf(objekte) {
  const teile = [], items = [];
  objekte.forEach((o, i) => {
    const id = i + 1, np = o.mesh.numProp, vp = o.mesh.vertProperties, tv = o.mesh.triVerts;
    const v = [], t = [];
    for (let k = 0; k < vp.length; k += np) v.push(`<vertex x="${fmt(vp[k])}" y="${fmt(vp[k + 1])}" z="${fmt(vp[k + 2])}"/>`);
    for (let k = 0; k < tv.length; k += 3) t.push(`<triangle v1="${tv[k]}" v2="${tv[k + 1]}" v3="${tv[k + 2]}"/>`);
    teile.push(`<object id="${id}" name="${esc(o.name)}" type="model"><mesh><vertices>${v.join('')}</vertices>` +
      `<triangles>${t.join('')}</triangles></mesh></object>`);
    items.push(`<item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 ${fmt(o.x || 0)} ${fmt(o.y || 0)} 0"/>`);
  });
  const model = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
    '<metadata name="Application">Deckbox Creator</metadata>' +
    `<resources>${teile.join('')}</resources><build>${items.join('')}</build></model>`;
  const types = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
    '</Relationships>';
  return zipSync({
    '[Content_Types].xml': strToU8(types),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(model),
  }, { level: 6 });
}
