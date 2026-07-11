export interface GalleryPickerOptions {
  multiple?: boolean;
  accept?: string;
}

export function triggerGalleryPicker(
  options: GalleryPickerOptions = {}
): Promise<File[]> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve([]);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept || 'image/*,video/*';
    input.multiple = options.multiple || false;

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
