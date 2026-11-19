// electron-builder afterPack: ícone e dados de versão no .exe sem wine (resedit, puro JS)
const fs = require('fs'), path = require('path');
const R = __dirname + '/node_modules/';
exports.default = async (ctx) => {
  const ResEdit = await import(R + 'resedit/dist/index.js').catch(() => import(R + 'resedit/dist/index.mjs'));
  const PE = await import(R + 'pe-library/dist/index.js').catch(() => import(R + 'pe-library/dist/index.mjs'));
  const ver = ctx.packager.appInfo.version;
  const exe = path.join(ctx.appOutDir, 'Duel Racer.exe');
  const ico = path.join(ctx.packager.info.projectDir, 'release', '.icon-ico', 'icon.ico');
  const exeObj = PE.NtExecutable.from(fs.readFileSync(exe));
  const res = PE.NtExecutableResource.from(exeObj);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const gid = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, iconFile.icons.map((i) => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  const [a, b, c] = ver.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'Duel Racer para computador', ProductName: 'Duel Racer', InternalName: 'Duel Racer',
    CompanyName: 'Victor Bandeira', LegalCopyright: 'Copyright © 2026 Victor Bandeira', OriginalFilename: 'Duel Racer.exe',
    FileVersion: ver, ProductVersion: ver,
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exeObj);
  fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
  console.log('  • afterPack: ícone e versão gravados em', exe);
};
