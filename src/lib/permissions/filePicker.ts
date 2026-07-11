export interface FilePickerConfig {
  multiple?: boolean;
  accept?: string;
}

export function triggerNativeFilePicker(
  config: FilePickerConfig = {}
): Promise<File[]> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve([]);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = config.accept || '*/*';
    input.multiple = config.multiple || false;

    const handleAndClean = () => {
      if (input.files) {
        resolve(Array.from(input.files));
      } else {
        resolve([]);
      }
    };

    input.onchange = handleAndClean;
    input.oncancel = () => resolve([]);
    input.click();
  });
}
