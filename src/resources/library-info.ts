import { config } from '../config';

export const metadata = {
  uri: 'calibre://library/info',
  name: 'Library Configuration',
  description: 'Current Calibre library configuration including path and server settings',
  mimeType: 'application/json',
};

export default async function libraryInfo() {
  const info = {
    libraryPath: config.calibreLibraryPath,
    serverName: config.serverName,
    calibredbCommand: config.calibredbCommand,
    commandTimeoutMs: config.commandTimeoutMs,
  };

  return {
    contents: [
      {
        uri: metadata.uri,
        mimeType: metadata.mimeType,
        text: JSON.stringify(info, null, 2),
      },
    ],
  };
}
