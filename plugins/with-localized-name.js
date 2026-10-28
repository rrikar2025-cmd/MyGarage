const { withDangerousMod } = require('@expo/config-plugins');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    async (result) => {
      for (const [locale, name] of [
        ['uk', 'Мій гараж'],
        ['en', 'My Garage'],
      ]) {
        const directory = path.join(
          result.modRequest.platformProjectRoot,
          'app/src/main/res',
          `values-${locale}`,
        );
        await mkdir(directory, { recursive: true });
        await writeFile(
          path.join(directory, 'strings.xml'),
          `<?xml version="1.0" encoding="utf-8"?>\n<resources><string name="app_name">${name}</string></resources>\n`,
        );
      }
      return result;
    },
  ]);
