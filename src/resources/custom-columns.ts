import { runCalibredb } from '../utils/calibredb';

export const metadata = {
  uri: 'calibre://library/custom-columns',
  name: 'Custom Columns',
  description: 'List of custom columns defined in the Calibre library',
  mimeType: 'application/json',
};

export default async function customColumns() {
  try {
    const output = await runCalibredb(['custom_columns']);

    return {
      contents: [
        {
          uri: metadata.uri,
          mimeType: metadata.mimeType,
          text: output || '[]',
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      contents: [
        {
          uri: metadata.uri,
          mimeType: 'text/plain',
          text: `Error fetching custom columns: ${message}`,
        },
      ],
    };
  }
}
